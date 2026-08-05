"""FastAPI app exposing the requisition module for end-to-end testing.

Run:
    uv run uvicorn main:app --reload --port 8000

Configuration via environment (see .env.example):
    DATABASE_URL  - defaults to Postgres; use sqlite:///requisition.db for a
                    zero-setup run.
    LLM_PROVIDER  - "ollama" (default, offline LLM) or "mock" (offline tests).

Quick test (company -> requisition -> approve -> publish):
    curl -X POST localhost:8000/company-profiles -H 'content-type: application/json' \
         -d '{"name":"Acme","location":"Bangalore","tech_stack":["Python","Django","Postgres"]}'
    # then POST /requisitions with the returned profile id
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from modules.requisition.domain import models, schemas
from modules.shared.db import get_session, init_db

app = FastAPI(title="Term Jobs — Requisition API", version="0.1.0")

from modules.identity.router import router as auth_router
app.include_router(auth_router)

from modules.candidate.router import router as candidate_router
app.include_router(candidate_router)

# Single-file browser UI (index.html) is served from the backend and can also
# be opened via file:// — allow cross-origin fetches either way.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- LLM provider selection -------------------------------------------------
def _build_service():
    from modules.requisition.llm.mock import MockLLM
    from modules.requisition.llm.ollama import OllamaClient
    from modules.requisition.services.requisition_service import RequisitionService

    provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    llm = OllamaClient() if provider == "ollama" else MockLLM()
    return RequisitionService(llm=llm, session_factory=get_session)


service = _build_service()

# Ensure tables exist (idempotent — no-op on already-migrated Postgres).
init_db()


# --- request/response models ------------------------------------------------
class CompanyProfileIn(BaseModel):
    name: str
    industry: str = ""
    size: str = ""
    location: str = ""
    tech_stack: list[str] = Field(default_factory=list)
    notes: str = ""


class RequisitionIn(BaseModel):
    company_profile_id: str
    title: str = ""
    description: str = ""
    tech_stack_hint: list[str] = Field(default_factory=list)
    prompt: str = ""
    created_by: str | None = None


class AnswerIn(BaseModel):
    answer: str


class RefineIn(BaseModel):
    instruction: str


class ApproveIn(BaseModel):
    reviewer: str | None = None
    edited_role: dict | None = None


class RejectIn(BaseModel):
    reviewer: str | None = None


class ApproveByIn(BaseModel):
    by: str | None = None


# --- serialization helpers --------------------------------------------------
def _company_dict(prof: models.CompanyProfile) -> dict:
    return {
        "id": prof.id,
        "tenant_id": prof.tenant_id,
        "name": prof.name,
        "industry": prof.industry,
        "location": prof.location,
        "tech_stack": prof.tech_stack or [],
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
def create_company_profile(body: CompanyProfileIn) -> dict:
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


# --- requisition lifecycle --------------------------------------------------
@app.post("/requisitions", status_code=201)
def create_requisition(body: RequisitionIn) -> dict:
    intent = schemas.RoleIntent(
        title=body.title,
        description=body.prompt or body.description,
        tech_stack_hint=body.tech_stack_hint,
        prompt=body.prompt,
    )
    req = service.create(
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
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


@app.get("/requisitions/{requisition_id}")
def get_requisition(requisition_id: str) -> dict:
    _get_requisition(requisition_id)
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/start")
def start_intake(requisition_id: str) -> dict:
    _get_requisition(requisition_id)
    state, interrupt = service.start_intake(requisition_id)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/answer")
def answer_intake(requisition_id: str, body: AnswerIn) -> dict:
    _get_requisition(requisition_id)
    state, interrupt = service.answer(requisition_id, body.answer)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/refine")
def refine_requisition(requisition_id: str, body: RefineIn) -> dict:
    _get_requisition(requisition_id)
    try:
        state, interrupt = service.refine(requisition_id, body.instruction)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/approve")
def approve_requisition(requisition_id: str, body: ApproveIn) -> dict:
    _get_requisition(requisition_id)
    edited = None
    if body.edited_role:
        try:
            edited = schemas.StructuredRole.model_validate(body.edited_role)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=422, detail=f"invalid edited_role: {exc}")
    state, interrupt = service.approve(requisition_id, reviewer=body.reviewer, edited_role=edited)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/reject")
def reject_requisition(requisition_id: str, body: RejectIn) -> dict:
    _get_requisition(requisition_id)
    state, interrupt = service.reject(requisition_id, reviewer=body.reviewer)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/publish")
def publish_requisition(requisition_id: str, body: ApproveByIn) -> dict:
    _get_requisition(requisition_id)
    req = service.publish(requisition_id, by=body.by)
    return _requisition_dict(req.id)


@app.post("/requisitions/{requisition_id}/close")
def close_requisition(requisition_id: str) -> dict:
    _get_requisition(requisition_id)
    req = service.close(requisition_id)
    return _requisition_dict(req.id)


@app.post("/requisitions/{requisition_id}/reset")
def reset_requisition(requisition_id: str) -> dict:
    _get_requisition(requisition_id)
    req = service.reset(requisition_id)
    return _requisition_dict(req.id)


@app.delete("/requisitions/{requisition_id}", status_code=204)
def delete_requisition(requisition_id: str) -> None:
    _get_requisition(requisition_id)
    service.delete(requisition_id)


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(Path(__file__).parent / "index.html")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "llm_provider": os.getenv("LLM_PROVIDER", "ollama")}