"""Notification creation service.

Hooks into key workflows:
  - requisition published  -> notify recruiters of engaged vendor tenants
  - candidate shortlisted  -> notify the company (Hiring Manager/HR/Admin)
  - candidate rejected     -> notify the vendor/recruiter who submitted

Targeting is role-based per tenant:
  - COMPANY_ROLES: users on the client company tenant side.
  - RECRUITER_ROLE: users on the consultancy (vendor) tenant side.
"""
import logging

from modules.notifications.domain.models import Notification

logger = logging.getLogger("notifications")

COMPANY_ROLES = {"Admin", "HR", "Hiring Manager", "Director"}
RECRUITER_ROLE = {"Recruiter"}

# Each type maps to a human label + relative link template.
LINK_TEMPLATES = {
    "requisition.published": "/dashboard/recruiter/requisitions",
    "candidate.shortlisted": "/dashboard/requisitions/{requisition_id}/candidates",
    "candidate.rejected": "/dashboard/requisitions/{requisition_id}/candidates",
}


def _utcnow_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def create_notification(user_id: str, tenant_id: str, ntype: str, title: str, body: str, data: dict | None = None) -> None:
    """Persist a single notification for one recipient."""
    from modules.shared.db import get_session

    data = data or {}
    try:
        with get_session() as session:
            n = Notification(
                user_id=user_id,
                tenant_id=tenant_id,
                type=ntype,
                title=title,
                body=body,
                data=data,
                read=False,
                created_at=_utcnow_iso(),
            )
            session.add(n)
            session.commit()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to create notification for {user_id}: {e}")


def _company_users(session, tenant_id: str) -> list:
    from modules.identity.domain.models import User

    return [
        u
        for u in session.query(User).filter(User.tenant_id == tenant_id).all()
        if u.is_active and u.role in COMPANY_ROLES
    ]


def _recruiters_for_tenant(session, vendor_tenant_id: str) -> list:
    from modules.identity.domain.models import User

    return [
        u
        for u in session.query(User).filter(User.tenant_id == vendor_tenant_id).all()
        if u.is_active and u.role in RECRUITER_ROLE
    ]


def _engaged_vendor_tenant_ids(session, company_tenant_id: str) -> list[str]:
    from modules.identity.domain.models import VendorEngagement

    rows = session.query(VendorEngagement).filter(VendorEngagement.tenant_id == company_tenant_id).all()
    return [r.vendor_tenant_id for r in rows if r.vendor_tenant_id]


def _requisition_context(session, requisition_id: str) -> dict:
    """Return {id, ref, title, company_name, company_tenant_id} for a requisition."""
    from modules.requisition.domain.models import CompanyProfile, Requisition

    req = session.get(Requisition, requisition_id)
    if not req:
        return {}
    company_name = ""
    if req.company_profile_id:
        prof = session.get(CompanyProfile, req.company_profile_id)
        if prof:
            company_name = prof.name
    return {
        "id": req.id,
        "ref": f"REQ-{str(req.id)[:6].upper()}",
        "title": req.title or "Untitled Requisition",
        "company_name": company_name,
        "company_tenant_id": req.tenant_id,
    }


def notify_requisition_published(requisition_id: str) -> None:
    """Notify recruiters of all vendor tenants engaged with this company."""
    from modules.shared.db import get_session

    try:
        with get_session() as session:
            ctx = _requisition_context(session, requisition_id)
            if not ctx:
                return
            vendor_tenants = _engaged_vendor_tenant_ids(session, ctx["company_tenant_id"])
            recipients: set[str] = set()
            for vt in vendor_tenants:
                for u in _recruiters_for_tenant(session, vt):
                    recipients.add(u.id)

            title = "New requisition published"
            body = f"{ctx['company_name'] or 'A client'} published a new position: {ctx['title']} ({ctx['ref']})"
            data = {
                "requisition_id": ctx["id"],
                "requisition_ref": ctx["ref"],
                "requisition_title": ctx["title"],
                "company_name": ctx["company_name"],
                "link": LINK_TEMPLATES["requisition.published"],
            }
            for uid in recipients:
                create_notification(
                    user_id=uid,
                    tenant_id=ctx["company_tenant_id"],
                    ntype="requisition.published",
                    title=title,
                    body=body,
                    data=data,
                )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"notify_requisition_published failed: {e}")


def notify_candidate_shortlisted(requisition_id: str, candidate_name: str, vendor_name: str, match_score=None) -> None:
    """Notify the company side that a recruiter shortlisted a candidate."""
    from modules.shared.db import get_session

    try:
        with get_session() as session:
            ctx = _requisition_context(session, requisition_id)
            if not ctx:
                return
            company_users = _company_users(session, ctx["company_tenant_id"])
            score_txt = f" ({round(match_score)}% match)" if match_score is not None else ""
            title = "Candidate shortlisted"
            body = (
                f"{vendor_name or 'A recruiter'} shortlisted {candidate_name} for "
                f"{ctx['title']}{score_txt}"
            )
            data = {
                "requisition_id": ctx["id"],
                "requisition_ref": ctx["ref"],
                "requisition_title": ctx["title"],
                "candidate_name": candidate_name,
                "vendor_name": vendor_name,
                "match_score": match_score,
                "link": LINK_TEMPLATES["candidate.shortlisted"].format(requisition_id=ctx["id"]),
            }
            for u in company_users:
                create_notification(
                    user_id=u.id,
                    tenant_id=ctx["company_tenant_id"],
                    ntype="candidate.shortlisted",
                    title=title,
                    body=body,
                    data=data,
                )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"notify_candidate_shortlisted failed: {e}")


def notify_candidate_status(requisition_id: str, candidate_name: str, new_status: str, vendor_tenant_id: str, match_score=None) -> None:
    """Notify the vendor/recruiter side when a candidate is shortlisted or rejected.

    new_status is expected to be 'Shortlisted' or 'Rejected'.
    """
    from modules.shared.db import get_session

    if new_status not in ("Shortlisted", "Rejected"):
        return

    verb = {"Shortlisted": "shortlisted", "Rejected": "rejected"}.get(new_status, new_status.lower())

    try:
        with get_session() as session:
            ctx = _requisition_context(session, requisition_id)
            if not ctx:
                return
            recruiters = _recruiters_for_tenant(session, vendor_tenant_id)
            score_txt = f" ({round(match_score)}% match)" if match_score is not None else ""
            title = f"Candidate {verb}"
            body = (
                f"{candidate_name} was {verb} for {ctx['title']}"
                f"{score_txt} by {ctx['company_name'] or 'the company'}"
            )
            data = {
                "requisition_id": ctx["id"],
                "requisition_ref": ctx["ref"],
                "requisition_title": ctx["title"],
                "candidate_name": candidate_name,
                "match_score": match_score,
                "status": new_status,
                "link": LINK_TEMPLATES["candidate.rejected"].format(requisition_id=ctx["id"]),
            }
            for u in recruiters:
                create_notification(
                    user_id=u.id,
                    tenant_id=vendor_tenant_id,
                    ntype="candidate.rejected" if new_status == "Rejected" else "candidate.shortlisted",
                    title=title,
                    body=body,
                    data=data,
                )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"notify_candidate_status failed: {e}")