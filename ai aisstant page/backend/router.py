"""FastAPI router for Aura AI Assistant chat and proposal endpoints."""
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .config import Settings, get_settings
from .dependencies import (
    get_authenticated_user,
    get_db,
    get_audit_logger,
    get_proposal_service,
    get_llm_client
)
from .security.authentication import AuthenticatedUser
from .security.authorization import AuthorizationError
from .audit.logger import AuditLogger
from .proposals.service import ProposalService
from .proposals.models import ProposalConfirmationRequest, ProposalDocument
from .tools.context import ToolExecutionContext
from .tools.registry import registry
from .agent.context import AgentContext
from .agent.orchestrator import HiringAgentOrchestrator
from .agent.memory import ConversationMemory
from .agent.llm_client import BaseLLMClient, OpenRouterLLMClient

# Ensure all tool handlers are registered
from .tools import handlers

router = APIRouter()

# In-memory session memory storage for multi-turn conversations
_conversation_sessions: Dict[str, ConversationMemory] = {}


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User prompt or instruction")
    conversation_id: Optional[str] = Field(None, description="Conversation session ID")
    user_api_key: Optional[str] = Field(None, description="User-configured AI API Key")
    user_model: Optional[str] = Field(None, description="User-selected model")
    user_provider: Optional[str] = Field(None, description="User-selected provider")


@router.post("/chat")
async def chat_endpoint(
    req: ChatRequest,
    x_user_ai_key: Optional[str] = Header(None, alias="x-user-ai-key"),
    x_user_ai_model: Optional[str] = Header(None, alias="x-user-ai-model"),
    x_user_ai_provider: Optional[str] = Header(None, alias="x-user-ai-provider"),
    user: AuthenticatedUser = Depends(get_authenticated_user),
    db=Depends(get_db),
    audit_logger: AuditLogger = Depends(get_audit_logger),
    proposal_service: ProposalService = Depends(get_proposal_service),
    llm_client: BaseLLMClient = Depends(get_llm_client),
    settings: Settings = Depends(get_settings)
):
    """Streaming chat endpoint consuming user instructions and yielding Server-Sent Events."""
    conv_id = req.conversation_id or f"conv_{user.user_id[:8]}"
    if conv_id not in _conversation_sessions:
        _conversation_sessions[conv_id] = ConversationMemory(max_messages=30)

    memory = _conversation_sessions[conv_id]

    agent_ctx = AgentContext(user=user)
    tool_ctx = ToolExecutionContext(
        user=user,
        db_client=db,
        audit_logger=audit_logger,
        proposal_service=proposal_service,
        request_id=agent_ctx.request_id
    )

    # Dynamically honor user-configured API key and model if provided from the UI
    effective_key = req.user_api_key or x_user_ai_key or settings.openrouter_api_key or settings.openai_api_key
    effective_model = req.user_model or x_user_ai_model or settings.openrouter_model
    if effective_key and not settings.test_mode:
        active_llm = OpenRouterLLMClient(
            api_key=effective_key,
            preferred_model=effective_model,
            api_base=settings.openrouter_api_base
        )
    else:
        active_llm = llm_client

    orchestrator = HiringAgentOrchestrator(
        llm_client=active_llm,
        tool_registry=registry,
        max_steps=settings.max_agent_steps
    )

    async def sse_generator():
        try:
            async for event in orchestrator.run_turn(
                user_message=req.message,
                agent_ctx=agent_ctx,
                tool_ctx=tool_ctx,
                memory=memory
            ):
                event_type = event.get("event", "message")
                data_json = json.dumps(event.get("data", {}))
                yield f"event: {event_type}\ndata: {data_json}\n\n"
        except Exception as exc:
            err_data = json.dumps({"error": str(exc)})
            yield f"event: error\ndata: {err_data}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/proposals", response_model=List[ProposalDocument])
async def list_proposals(
    user: AuthenticatedUser = Depends(get_authenticated_user),
    proposal_service: ProposalService = Depends(get_proposal_service)
):
    """Retrieve pending confirmation proposals for the authenticated Hiring Manager."""
    return await proposal_service.list_pending_proposals(
        tenant_id=user.tenant_id,
        user_id=user.user_id
    )


@router.post("/proposals/{proposal_id}/confirm")
async def confirm_proposal(
    proposal_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    proposal_service: ProposalService = Depends(get_proposal_service),
    db=Depends(get_db),
    audit_logger: AuditLogger = Depends(get_audit_logger)
):
    """Confirm and execute a pending proposal atomically."""
    tool_ctx = ToolExecutionContext(
        user=user,
        db_client=db,
        audit_logger=audit_logger,
        proposal_service=proposal_service
    )

    async def executor(action: str, params: Dict[str, Any]):
        tool = registry.get(action)
        if not tool:
            raise ValueError(f"Tool '{action}' not found.")
        parsed_args = tool.input_model(**params)
        res = await tool.handler(parsed_args, tool_ctx)
        if not res.success:
            raise RuntimeError(res.error or res.message)
        return res.to_dict()

    try:
        result = await proposal_service.confirm_and_execute(proposal_id, user, executor)
        await audit_logger.log_action(
            tenant_id=user.tenant_id,
            user_id=user.user_id,
            user_email=user.email,
            action="confirm_proposal",
            target_resource="proposals",
            target_id=proposal_id,
            result_summary=result,
            status="SUCCESS",
            proposal_id=proposal_id
        )
        return result
    except AuthorizationError as exc:
        raise HTTPException(status_code=403, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/proposals/{proposal_id}/reject")
async def reject_proposal(
    proposal_id: str,
    body: Optional[ProposalConfirmationRequest] = None,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    proposal_service: ProposalService = Depends(get_proposal_service),
    audit_logger: AuditLogger = Depends(get_audit_logger)
):
    """Reject and cancel a pending proposal."""
    reason = body.rejection_reason if body else "Rejected by user"
    try:
        proposal = await proposal_service.reject_proposal(proposal_id, user, reason)
        await audit_logger.log_action(
            tenant_id=user.tenant_id,
            user_id=user.user_id,
            user_email=user.email,
            action="reject_proposal",
            target_resource="proposals",
            target_id=proposal_id,
            result_summary={"state": proposal.state.value, "reason": reason},
            status="ABORTED",
            proposal_id=proposal_id
        )
        return {"success": True, "message": "Proposal rejected successfully.", "proposal": proposal}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/health")
async def health_check():
    """Service health inspection."""
    tools = registry.list_tools()
    return {
        "status": "HEALTHY",
        "service": "Aura AI Hiring Manager Assistant",
        "registered_tools_count": len(tools),
        "domains": list(set(t.domain for t in tools))
    }
