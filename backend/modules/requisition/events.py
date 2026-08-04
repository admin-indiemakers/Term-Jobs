"""Requisition event emissions, forwarding to the shared bus.

Downstream modules (candidate/ etc.) subscribe to these to react to lifecycle
events. Event names are module-namespaced.
"""
from ..shared.events import bus


def emit_requisition_created(requisition_id: str, tenant_id: str) -> None:
    bus.emit("requisition.created", requisition_id=requisition_id, tenant_id=tenant_id)


def emit_intake_started(requisition_id: str) -> None:
    bus.emit("requisition.intake_started", requisition_id=requisition_id)


def emit_requisition_published(requisition_id: str, structured_role: dict | None = None) -> None:
    bus.emit(
        "requisition.published",
        requisition_id=requisition_id,
        structured_role=structured_role,
    )


def emit_requisition_closed(requisition_id: str) -> None:
    bus.emit("requisition.closed", requisition_id=requisition_id)