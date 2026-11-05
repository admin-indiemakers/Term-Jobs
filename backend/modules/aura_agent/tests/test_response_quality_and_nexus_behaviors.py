import asyncio
import pytest
from datetime import datetime, timezone
from modules.aura_agent.agent.context import AgentContext
from modules.aura_agent.agent.prompts import build_system_prompt, AURA_CORE_DIRECTIVES
from modules.aura_agent.security.authentication import AuthenticatedUser
from modules.aura_agent.tools.context import ToolExecutionContext
from modules.aura_agent.tools.schemas import ListRequisitionsInput, SearchCandidatesInput, ListPendingTimesheetsInput
from modules.aura_agent.tools.handlers.requisitions import list_requisitions_handler
from modules.aura_agent.tools.handlers.candidates import search_candidates_handler
from modules.aura_agent.tools.handlers.workforce_operations import list_pending_timesheets_handler

UTC = timezone.utc

def make_user():
    return AuthenticatedUser(
        user_id="usr_hm_99",
        tenant_id="tenant_alpha",
        role="Hiring Manager",
        email="hm@company.com",
        name="Alex Mercer",
        department="Engineering"
    )

def test_nexus_style_system_prompt():
    user = make_user()
    ctx = AgentContext(user=user, active_requisition_ids=["req_01"])
    prompt = build_system_prompt(ctx)
    
    # 1. Executive Framing & Context
    assert "Acknowledge & Frame Context Naturally" in prompt
    
    # 2. Key Insights & Synthesis
    assert "Key Insights" in prompt or "Quick Notes" in prompt
    assert "Thoughtful Synthesis & Operational Insights" in prompt
    
    # 3. Distinguish facts from recommendations
    assert "Distinguish Verified Facts from Recommendations" in prompt
    
    # 4. Action-oriented next step
    assert "One Focused Actionable Next Step" in prompt
    
    # 5. Two-phase execution confirmation
    assert "Two-Phase Execution & Confirmation Gate" in prompt
    
    # 6. Absence of old mechanical one-sentence restriction
    assert "DO NOT dump long 10-bullet contact breakdowns in text. Provide only a brief 1-sentence intro" not in prompt

def test_requisitions_filter_shortlisted():
    async def run():
        user = make_user()
        tool_ctx = ToolExecutionContext(user=user, db_client=None)
        
        # When filtering for requisitions with shortlisted candidates > 0
        res = await list_requisitions_handler(ListRequisitionsInput(has_shortlisted_candidates=True), tool_ctx)
        assert res.success is True
        for req in res.data["requisitions"]:
            assert req["shortlist_candidate_count"] > 0
            assert "coverage_result" not in req  # verify bulky debug fields are stripped
    asyncio.run(run())

def test_search_candidates_filtering():
    async def run():
        user = make_user()
        tool_ctx = ToolExecutionContext(user=user, db_client=None)
        
        # Filter with min_match_score = 90
        res = await search_candidates_handler(SearchCandidatesInput(min_match_score=90), tool_ctx)
        assert res.success is True
        assert res.data["count"] == 1
        assert res.data["candidates"][0]["candidate_name"] == "Sarah Connor"
        assert res.data["candidates"][0]["match_score"] >= 90
        assert "matched_skills" in res.data["candidates"][0]
    asyncio.run(run())

def test_timesheets_billable_hours_and_overtime():
    async def run():
        user = make_user()
        tool_ctx = ToolExecutionContext(user=user, db_client=None)
        
        res = await list_pending_timesheets_handler(ListPendingTimesheetsInput(), tool_ctx)
        assert res.success is True
        assert "total_billable_hours" in res.data
        assert res.data["total_billable_hours"] == 40.0
        for ts in res.data["timesheets"]:
            assert "has_overtime" in ts
    asyncio.run(run())
