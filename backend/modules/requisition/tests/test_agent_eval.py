"""Golden-fixture eval harness.

Runs the full agent flow against every scenario in fixtures/golden_roles.json
and checks the generated structured role satisfies the expected fields. This is
the CI gate the MVP calls out: no prompt/model change ships without running it.

The offline suite runs against MockLLM; the @pytest.mark.ollama variant runs
the same scenarios against the real local model for a live fit-score report.
"""
import json
from pathlib import Path

import pytest

from modules.requisition.domain import models

FIXTURES = Path(__file__).parent / "fixtures" / "golden_roles.json"
SCENARIOS = json.loads(FIXTURES.read_text())["scenarios"]


def _load_scenarios():
    return SCENARIOS


def test_fixture_file_is_valid():
    data = json.loads(FIXTURES.read_text())
    assert data["scenarios"], "fixtures must contain at least one scenario"


@pytest.mark.parametrize("scenario", _load_scenarios(), ids=lambda s: s["name"])
def test_eval_offline_mock(scenario, service, company_profile, session_factory, run_flow):
    profile_id = company_profile(tech_stack=scenario["profile"]["tech_stack"])
    intent = scenario["intent"]
    req_id = run_flow(profile_id, intent, answers=scenario["answers"])

    with session_factory() as s:
        req = s.get(models.Requisition, req_id)
        role = req.structured_role
        assert role, "structured role must be generated"

        expected = scenario["expected"]
        must_have = {str(s).lower() for s in role["must_have_skills"]}
        required = {str(s).lower() for s in expected["must_have_skills"]}
        assert required.issubset(must_have), (
            f"missing skills {required - must_have}"
        )
        assert role["seniority"] == expected["seniority"]
        assert role["location"].lower() == expected["location"].lower()
        assert req.generated_jd_markdown
        assert req.status == "Published"


@pytest.mark.ollama
@pytest.mark.parametrize("scenario", _load_scenarios(), ids=lambda s: s["name"])
def test_eval_live_ollama(scenario, session_factory, company_profile):
    """Same scenarios against the real model. Skipped unless Ollama is up."""
    from modules.requisition.domain.schemas import RoleIntent
    from modules.requisition.llm.ollama import OllamaClient
    from modules.requisition.services.requisition_service import RequisitionService

    if not _ollama_reachable():
        pytest.skip("Ollama not reachable")
    svc = RequisitionService(llm=OllamaClient(), session_factory=session_factory)
    profile_id = company_profile(tech_stack=scenario["profile"]["tech_stack"])
    req = svc.create(profile_id, RoleIntent(**scenario["intent"]))
    _, interrupt = svc.start_intake(req.id)
    answers = list(scenario["answers"])
    while isinstance(interrupt, str):
        _, interrupt = svc.answer(req.id, answers.pop(0))
    assert isinstance(interrupt, dict) and interrupt["checkpoint"] == "approval"
    svc.approve(req.id, reviewer="ci")
    svc.publish(req.id)
    with session_factory() as s:
        assert s.get(models.Requisition, req.id).structured_role


def _ollama_reachable() -> bool:
    import httpx

    from modules.shared.config import settings

    try:
        httpx.get(f"{settings.ollama_base_url}/api/tags", timeout=3)
        return True
    except Exception:  # noqa: BLE001 - any transport error means unreachable
        return False