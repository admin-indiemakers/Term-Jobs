"""FastAPI router exposing notifications for the current user."""
from fastapi import APIRouter, Depends, HTTPException

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.notifications.domain.models import Notification, notification_dict
from modules.shared.db import get_session


router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(
    current_user: User = Depends(get_current_user),
    unread_only: bool = False,
) -> list[dict]:
    """Return the current user's notifications, newest first."""
    with get_session() as session:
        query = session.query(Notification).filter(Notification.user_id == current_user.id)
        if unread_only:
            query = query.filter(Notification.read == False)  # noqa: E712
        items = query.order_by(Notification.created_at.desc()).limit(60).all()
        return [notification_dict(n) for n in items]


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user)) -> dict:
    with get_session() as session:
        items = session.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.read == False,  # noqa: E712
        ).all()
        return {"count": len(items)}


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    with get_session() as session:
        n = session.get(Notification, notification_id)
        if not n or n.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Notification not found")
        n.read = True
        session.add(n)
        session.commit()
        return {"status": "success", "id": notification_id}


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user)) -> dict:
    with get_session() as session:
        items = session.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.read == False,  # noqa: E712
        ).all()
        for n in items:
            n.read = True
            session.add(n)
        session.commit()
        return {"status": "success", "marked": len(items)}