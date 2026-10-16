"""FastAPI router exposing notifications for the current user."""
from fastapi import APIRouter, Depends, HTTPException, Query

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.notifications.domain.models import Notification, notification_dict
from modules.shared.db import get_session


router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(
    current_user: User = Depends(get_current_user),
    unread_only: bool = False,
    compact: bool = False,
    limit: int = Query(default=60, ge=1, le=60),
) -> list[dict]:
    """Return the current user's notifications, newest first."""
    with get_session() as session:
        all_items = session.query(Notification).all()
        user_tenant = current_user.tenant_id or ""
        user_id = current_user.id or ""

        # Match notifications targeted to this user, this tenant, or global broadcast
        matched = []
        for n in all_items:
            n_uid = n.user_id or ""
            n_tid = n.tenant_id or ""
            if n_uid == user_id or (user_tenant and n_tid == user_tenant) or (not n_uid and not n_tid):
                matched.append(n)

        if unread_only:
            matched = [
                n for n in matched
                if not getattr(n, "read", False) and getattr(n, "status", "") != "read"
            ]

        matched.sort(key=lambda x: str(x.created_at or ""), reverse=True)
        lim = int(limit) if isinstance(limit, (int, float, str)) and str(limit).isdigit() else 60
        items = matched[:lim]
        return [notification_dict(n) for n in items]


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user)) -> dict:
    with get_session() as session:
        all_items = session.query(Notification).all()
        user_tenant = current_user.tenant_id or ""
        user_id = current_user.id or ""

        unread_items = [
            n for n in all_items
            if (n.user_id == user_id or (user_tenant and n.tenant_id == user_tenant) or (not n.user_id and not n.tenant_id))
            and not getattr(n, "read", False)
            and getattr(n, "status", "") != "read"
        ]
        return {"count": len(unread_items)}


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    with get_session() as session:
        n = session.get(Notification, notification_id)
        if not n:
            # Also check by string id or mongo _id
            all_items = session.query(Notification).all()
            for it in all_items:
                if str(getattr(it, "id", "")) == notification_id or str(getattr(it, "_id", "")) == notification_id:
                    n = it
                    break
        if not n:
            raise HTTPException(status_code=404, detail="Notification not found")
        n.read = True
        n.status = "read"
        session.add(n)
        session.commit()
        return {"status": "success", "id": notification_id}


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user)) -> dict:
    with get_session() as session:
        all_items = session.query(Notification).all()
        user_tenant = current_user.tenant_id or ""
        user_id = current_user.id or ""

        marked = 0
        for n in all_items:
            n_uid = n.user_id or ""
            n_tid = n.tenant_id or ""
            if n_uid == user_id or (user_tenant and n_tid == user_tenant) or (not n_uid and not n_tid):
                n.read = True
                n.status = "read"
                session.add(n)
                marked += 1
        session.commit()
        return {"status": "success", "marked": marked}
