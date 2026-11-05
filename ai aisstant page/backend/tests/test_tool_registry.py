"""Tests for tool registry, validation, and domain handlers."""
import pytest
from backend.tools.registry import registry, ToolResult
from backend.tools.context import ToolExecutionContext


def test_all_38_tools_registered():
    tools = registry.list_tools()
    assert len(tools) == 38, f"Expected 38 registered tools, found {len(tools)}"


def test_unknown_tool_returns_error(tool_context):
    import asyncio
    result = asyncio.run(registry.execute("non_existent_tool", {}, tool_context))
    assert result.success is False
    assert result.error == "UNKNOWN_TOOL"


def test_invalid_arguments_validation(tool_context):
    import asyncio
    # create_requisition_draft requires headcount >= 1 and title
    result = asyncio.run(registry.execute("create_requisition_draft", {"title": ""}, tool_context))
    assert result.success is False
    assert result.error == "VALIDATION_ERROR"


def test_read_only_tool_executes_directly(tool_context):
    import asyncio
    result = asyncio.run(registry.execute("list_requisitions", {"limit": 5}, tool_context))
    assert result.success is True
    assert "requisitions" in result.data
    assert result.ui_card == "requisition_list_card"
    assert result.proposal_required is False


def test_consequential_tool_creates_proposal(tool_context):
    import asyncio
    # reject_candidate requires confirmation
    args = {
        "candidate_id": "cand_001",
        "requisition_id": "req_001",
        "rejection_reason": "Candidate lacks required enterprise backend experience in Python."
    }
    result = asyncio.run(registry.execute("reject_candidate", args, tool_context))
    assert result.success is True
    assert result.proposal_required is True
    assert result.proposal_id is not None
    assert result.ui_card == "proposal_confirmation_card"
