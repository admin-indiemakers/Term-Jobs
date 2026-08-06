import json
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import modules.requisition.agent.graph as agent
import modules.requisition.domain.models as models
import modules.requisition.services.requisition_service as req_service
from modules.candidate.router import router as candidate_router
from modules.identity.router import router as identity_router
from modules.shared.config import settings
from modules.shared.db import get_session

app = FastAPI(
    title="TermJobs Requisition API",
    description="Intake and structure job requisitions using AI agents.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(identity_router)
app.include_router(candidate_router)


# --- helpers -----------------------------------------------------------------
def _company_dict(c: models.CompanyProfile) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "location": c.location,
        "industry": c.industry,
        "size": c.size,
        "tech_stack": c.tech_stack or [],
        "notes": c.notes,
    }


def _requisition_dict(requisition_id: str) -> dict:
    with get_session() as session:
        req = session.get(models.Requisition, requisition_id)
        if req is None:
            raise HTTPException(status_code=404, detail="requisition not found")
        company = None
        if req.company_profile_id:
            prof = session.get(models.CompanyProfile, req.company_profile_id)
            if prof:
                company = _company_dict(prof)
        return {
            "id": req.id,
            "tenant_id": req.tenant_id,
            "company_profile_id": req.company_profile_id,
            "company": company,
            "status": req.status,
            "title": req.title,
            "intent": req.intent,
            "intake_answers": req.intake_answers,
            "pending_question": req.pending_question,
            "structured_role": req.structured_role,
            "generated_jd_markdown": req.generated_jd_markdown,
            "coverage_result": req.coverage_result,
            "refinement_log": req.refinement_log or [],
            "approved_by": req.approved_by,
            "approved_at": req.approved_at.isoformat() if req.approved_at else None,
            "created_at": req.created_at.isoformat() if req.created_at else None,
        }


def _interrupt_payload(state: dict, interrupt: Any) -> dict:
    """Normalise an agent result into a consumer-friendly checkpoint."""
    payload: dict[str, Any] = {"status": state.get("status")}
    if isinstance(interrupt, str):
        payload["type"] = "intake_question"
        payload["question"] = interrupt
    elif isinstance(interrupt, dict) and interrupt.get("checkpoint") == "approval":
        payload["type"] = "approval"
        payload["structured_role"] = interrupt.get("structured_role")
        payload["generated_jd_markdown"] = interrupt.get("jd_markdown")
    else:
        payload["type"] = "completed"
    return payload


def _get_requisition(requisition_id: str) -> models.Requisition:
    with get_session() as session:
        req = session.get(models.Requisition, requisition_id)
    if req is None:
        raise HTTPException(status_code=404, detail="requisition not found")
    return req


# --- company profile endpoints ----------------------------------------------
@app.post("/company-profiles", status_code=201)
def create_company_profile(body: req_service.CompanyProfileIn) -> dict:
    with get_session() as session:
        prof = models.CompanyProfile(**body.model_dump())
        session.add(prof)
        session.commit()
        session.refresh(prof)
        return {"id": prof.id, "name": prof.name}


@app.get("/company-profiles")
def list_company_profiles() -> list[dict]:
    with get_session() as session:
        rows = (
            session.query(models.CompanyProfile)
            .order_by(models.CompanyProfile.created_at.desc())
            .all()
        )
        return [_company_dict(r) for r in rows]


# --- requisition CRUD --------------------------------------------------------
@app.post("/requisitions", status_code=201)
def create_requisition(body: req_service.RequisitionCreateIn) -> dict:
    intent = req_service.build_intent(
        title=body.title,
        description=body.description,
        tech_stack_hint=body.tech_stack_hint,
        prompt=body.prompt,
    )
    req = req_service.create(
        company_profile_id=body.company_profile_id,
        intent=intent,
        created_by=body.created_by,
    )
    return _requisition_dict(req.id)


@app.get("/requisitions")
def list_requisitions() -> list[dict]:
    with get_session() as session:
        rows = (
            session.query(models.Requisition)
            .order_by(models.Requisition.created_at.desc())
            .all()
        )
        profiles = {p.id: p for p in session.query(models.CompanyProfile).all()}
        return [
            {
                "id": r.id,
                "status": r.status,
                "title": r.title,
                "company_profile_id": r.company_profile_id,
                "company_name": profiles[r.company_profile_id].name
                if r.company_profile_id in profiles
                else None,
                "generated_jd_markdown": r.generated_jd_markdown,
                "structured_role": r.structured_role,
                "intent": r.intent,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


@app.get("/requisitions/{requisition_id}")
def get_requisition(requisition_id: str) -> dict:
    _get_requisition(requisition_id)
    return _requisition_dict(requisition_id)


# --- agent flow endpoints ----------------------------------------------------
@app.post("/requisitions/{requisition_id}/start")
def start_requisition_flow(requisition_id: str) -> dict:
    _get_requisition(requisition_id)

    def action():
        graph = agent.get_graph()
        result = graph.invoke(
            agent.make_input(requisition_id),
            config=agent.make_config(requisition_id),
        )
        state = agent.get_requisition_state(requisition_id)
        interrupt = agent.extract_interrupt_value(result)
        return _interrupt_payload(state, interrupt)

    return req_service.run_action_transactional(requisition_id, "start", action)


@app.post("/requisitions/{requisition_id}/answer")
def answer_intake_question(
    requisition_id: str, body: req_service.AnswerIn
) -> dict:
    _get_requisition(requisition_id)

    def action():
        graph = agent.get_graph()
        result = graph.invoke(
            agent.make_resume_input(body.answer),
            config=agent.make_config(requisition_id),
        )
        state = agent.get_requisition_state(requisition_id)
        interrupt = agent.extract_interrupt_value(result)
        return _interrupt_payload(state, interrupt)

    return req_service.run_action_transactional(requisition_id, "answer", action)


@app.post("/requisitions/{requisition_id}/refine")
def refine_requisition_jd(
    requisition_id: str, body: req_service.RefineIn
) -> dict:
    _get_requisition(requisition_id)

    def action():
        graph = agent.get_graph()
        result = graph.invoke(
            agent.make_resume_input(body.instruction),
            config=agent.make_config(requisition_id),
        )
        state = agent.get_requisition_state(requisition_id)
        interrupt = agent.extract_interrupt_value(result)
        return _interrupt_payload(state, interrupt)

    return req_service.run_action_transactional(requisition_id, "refine", action)


@app.post("/requisitions/{requisition_id}/approve")
def approve_requisition(
    requisition_id: str, body: req_service.ReviewIn | None = None
) -> dict:
    reviewer = body.reviewer if body else None
    req_service.approve(requisition_id, reviewer=reviewer)
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/reject")
def reject_requisition(
    requisition_id: str, body: req_service.ReviewIn | None = None
) -> dict:
    reviewer = body.reviewer if body else None
    req_service.reject(requisition_id, reviewer=reviewer)
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/publish")
def publish_requisition(
    requisition_id: str, body: req_service.PublishIn | None = None
) -> dict:
    by = body.by if body else None
    req_service.publish(requisition_id, by=by)
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/close")
def close_requisition(requisition_id: str) -> dict:
    req_service.close(requisition_id)
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/reset")
def reset_requisition(requisition_id: str) -> dict:
    req_service.reset(requisition_id)
    return _requisition_dict(requisition_id)


@app.delete("/requisitions/{requisition_id}", status_code=204)
def delete_requisition(requisition_id: str) -> None:
    req_service.delete(requisition_id)


# --- health check ------------------------------------------------------------
@app.get("/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "llm_provider": settings.llm_provider,
        "default_model": settings.ollama_default_model,
        "mongodb_url": settings.mongodb_url,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)