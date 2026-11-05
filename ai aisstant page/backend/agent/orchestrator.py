from typing import Any, Dict

import re

def parse_inline_tool_calls(text: str) -> Dict[int, Dict[str, Any]]:
    """Parse inline tool calls output by open-source free models."""
    calls = {}
    idx = 0
    pattern_tag = r'<\|tool_call_start\|>\[?(\w+)\((.*?)\)\]?<\|tool_call_end\|>'
    for match in re.finditer(pattern_tag, text, re.DOTALL):
        tool_name = match.group(1).strip()
        raw_args = match.group(2).strip()
        args_dict = {}
        if raw_args.startswith("{") and raw_args.endswith("}"):
            try:
                args_dict = json.loads(raw_args)
            except Exception:
                pass
        else:
            pairs = re.findall(r"(\w+)\s*=\s*['\"]([^'\"]*)['\"]", raw_args)
            for k, v in pairs:
                args_dict[k] = v
        calls[idx] = {
            "id": f"inline_call_{idx}",
            "name": tool_name,
            "arguments": json.dumps(args_dict)
        }
        idx += 1

    pattern_xml = r'<tool_call>(.*?)</tool_call>'
    for match in re.finditer(pattern_xml, text, re.DOTALL):
        try:
            parsed = json.loads(match.group(1).strip())
            calls[idx] = {
                "id": f"inline_call_{idx}",
                "name": parsed.get("name", ""),
                "arguments": json.dumps(parsed.get("arguments", {}))
            }
            idx += 1
        except Exception:
            pass
    return calls

"""Multi-step agent orchestrator coordinating LLM streaming, tool execution, and SSE events."""
import json
from typing import Any, AsyncIterator, Dict, List, Optional
from .context import AgentContext
from .llm_client import BaseLLMClient, TextDeltaChunk, ToolCallDeltaChunk
from .memory import ConversationMemory
from .prompts import build_system_prompt
try:
    from ..tools.context import ToolExecutionContext
    from ..tools.registry import ToolRegistry, ToolResult
except (ImportError, ValueError):
    try:
        from backend.tools.context import ToolExecutionContext
        from backend.tools.registry import ToolRegistry, ToolResult
    except (ImportError, ValueError):
        from tools.context import ToolExecutionContext
        from tools.registry import ToolRegistry, ToolResult


class HiringAgentOrchestrator:
    """Executes multi-step agent reasoning turns and emits structured SSE events."""
    def __init__(
        self,
        llm_client: BaseLLMClient,
        tool_registry: ToolRegistry,
        max_steps: int = 8
    ):
        self.llm = llm_client
        self.tools = tool_registry
        self.max_steps = max_steps

    async def run_turn(
        self,
        user_message: str,
        agent_ctx: AgentContext,
        tool_ctx: ToolExecutionContext,
        memory: Optional[ConversationMemory] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """Run a complete conversation turn, executing tools iteratively until finished."""
        if memory is None:
            memory = ConversationMemory()
            memory.set_system_prompt(build_system_prompt(agent_ctx))

        memory.add_user_message(user_message)
        step = 0

        yield {
            "event": "message_start",
            "data": {"request_id": agent_ctx.request_id, "user_id": agent_ctx.user_id}
        }

        while step < self.max_steps:
            step += 1
            messages_payload = memory.get_messages_for_llm()
            tool_schemas = self.tools.get_openai_tools_schema()

            accumulated_text = ""
            tool_calls_buffer: Dict[int, Dict[str, Any]] = {}

            # 1. Stream from LLM
            try:
                async for chunk in self.llm.stream_chat(messages_payload, tools=tool_schemas):
                    if isinstance(chunk, TextDeltaChunk):
                        accumulated_text += chunk.text
                        yield {
                            "event": "assistant_delta",
                            "data": {"content": chunk.text}
                        }
                    elif isinstance(chunk, ToolCallDeltaChunk):
                        idx = chunk.index
                        if idx not in tool_calls_buffer:
                            tool_calls_buffer[idx] = {
                                "id": chunk.tool_id or f"call_{idx}",
                                "name": chunk.name or "",
                                "arguments": ""
                            }
                        if chunk.name:
                            tool_calls_buffer[idx]["name"] = chunk.name
                        if chunk.arguments_delta:
                            tool_calls_buffer[idx]["arguments"] += chunk.arguments_delta
            except Exception as exc:
                yield {
                    "event": "error",
                    "data": {"message": f"LLM streaming error: {str(exc)}"}
                }
                break

            # 2. Check for inline tool calls if provider didn't emit delta chunks
            if not tool_calls_buffer:
                tool_calls_buffer = parse_inline_tool_calls(accumulated_text)

            # If still no tool calls, response is complete
            if not tool_calls_buffer:
                memory.add_assistant_message(content=accumulated_text or "")
                break

            # 3. Format tool calls for memory
            formatted_tool_calls = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": tc["arguments"]
                    }
                }
                for tc in tool_calls_buffer.values()
            ]
            memory.add_assistant_message(
                content=accumulated_text or None,
                tool_calls=formatted_tool_calls
            )

            # 4. Execute each tool call
            has_pending_proposal = False
            for tc in tool_calls_buffer.values():
                call_id = tc["id"]
                tool_name = tc["name"]
                raw_args_str = tc["arguments"]

                try:
                    args_dict = json.loads(raw_args_str) if raw_args_str else {}
                except Exception:
                    args_dict = {}

                yield {
                    "event": "tool_call",
                    "data": {"tool": tool_name, "call_id": call_id, "arguments": args_dict}
                }

                # Execute tool via registry
                result: ToolResult = await self.tools.execute(tool_name, args_dict, tool_ctx)

                if result.proposal_required:
                    has_pending_proposal = True
                    yield {
                        "event": "proposal_created",
                        "data": {
                            "proposal_id": result.proposal_id,
                            "tool": tool_name,
                            "parameters": args_dict,
                            "ui_card": result.ui_card
                        }
                    }
                else:
                    yield {
                        "event": "tool_result",
                        "data": {
                            "tool": tool_name,
                            "call_id": call_id,
                            "result": result.to_dict(),
                            "ui_card": result.ui_card
                        }
                    }

                # Record tool outcome in memory for LLM to see in next iteration
                memory.add_tool_result(
                    tool_call_id=call_id,
                    tool_name=tool_name,
                    result_content=json.dumps(result.to_dict())
                )

            # If a proposal was created, halt iteration and await human confirmation
            if has_pending_proposal:
                yield {
                    "event": "assistant_delta",
                    "data": {"content": "\n\nI have prepared the confirmation request above. Please confirm when ready to proceed."}
                }
                break

        yield {
            "event": "message_complete",
            "data": {"status": "DONE", "steps": step}
        }
