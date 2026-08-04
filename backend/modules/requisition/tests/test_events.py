"""Events are emitted at the correct lifecycle points."""
from modules.requisition.domain.schemas import RoleIntent
from modules.shared.events import bus

EVENTS = []


def _reset():
    EVENTS.clear()


def _register():
    bus.on("requisition.created", lambda **p: EVENTS.append(("created", p["requisition_id"])))
    bus.on("requisition.intake_started", lambda **p: EVENTS.append(("intake_started", p["requisition_id"])))
    bus.on("requisition.published", lambda **p: EVENTS.append(("published", p["requisition_id"])))
    bus.on("requisition.closed", lambda **p: EVENTS.append(("closed", p["requisition_id"])))


def test_lifecycle_events(service, company_profile):
    _reset()
    _register()

    profile_id = company_profile(tech_stack=["Python", "Django"])
    req = service.create(profile_id, RoleIntent(title="Backend Engineer", tech_stack_hint=["Python"]))
    service.start_intake(req.id)
    service.approve(req.id, reviewer="mgr")
    service.publish(req.id)
    service.close(req.id)

    names = [n for n, _ in EVENTS]
    assert "created" in names
    assert "intake_started" in names
    assert "published" in names
    assert "closed" in names