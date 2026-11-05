"""Tests for multi-step agent orchestrator and mock LLM loop."""
import pytest
from modules.aura_agent.agent.context import AgentContext
from modules.aura_agent.agent.llm_client import MockLLMClient
from modules.aura_agent.agent.orchestrator import HiringAgentOrchestrator
from modules.aura_agent.tools.registry import registry


def test_orchestrator_text_turn(mock_user, tool_context):
    import asyncio

    mock_llm = MockLLMClient()
    mock_llm.add_canned_text("Hello! I am Aura, your Hiring Operations Assistant.")

    orch = HiringAgentOrchestrator(llm_client=mock_llm, tool_registry=registry)
    agent_ctx = AgentContext(user=mock_user)

    events = []
    async def run():
        async for ev in orch.run_turn("Hi Aura", agent_ctx, tool_context):
            events.append(ev)

    asyncio.run(run())
    event_names = [e["event"] for e in events]
    assert "message_start" in event_names
    assert "assistant_delta" in event_names
    assert "message_complete" in event_names


def test_orchestrator_tool_calling_turn(mock_user, tool_context):
    import asyncio

    mock_llm = MockLLMClient()
    # Step 1: Call list_requisitions tool
    mock_llm.add_canned_tool_call("list_requisitions", {"status": "OPEN"})
    # Step 2: Final response
    mock_llm.add_canned_text("You have 1 open requisition for Senior Python Backend Engineer.")

    orch = HiringAgentOrchestrator(llm_client=mock_llm, tool_registry=registry)
    agent_ctx = AgentContext(user=mock_user)

    events = []
    async def run():
        async for ev in orch.run_turn("What requisitions are open?", agent_ctx, tool_context):
            events.append(ev)

    asyncio.run(run())
    event_names = [e["event"] for e in events]
    assert "tool_call" in event_names
    assert "tool_result" in event_names
    assert "message_complete" in event_names
