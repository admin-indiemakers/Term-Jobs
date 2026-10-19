"""FastAPI router exposing notifications for the current user."""
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.notifications.domain.models import Notification, notification_dict
from modules.shared.db import get_session, db


router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _matches_user(n: Notification, current_user: User) -> bool:
    """Determine whether notification n is intended for current_user."""
    user_id = str(current_user.id or "")
    user_tenant = str(current_user.tenant_id or "")
    user_role = str(current_user.role or "").strip().lower()

    n_uid = str(getattr(n, "user_id", "") or "")
    n_tid = str(getattr(n, "tenant_id", "") or "")
    n_role = str(getattr(n, "target_role", "") or "").strip().lower()

    # 1. If notification is targeted to a specific user ID, only that user should receive it
    if n_uid:
        return n_uid == user_id

    # 2. If notification specifies a tenant, user must belong to that tenant (or be superadmin/internal)
    if n_tid and user_tenant and n_tid != user_tenant:
        return False

    # 3. If notification targets a specific role (e.g. 'director', 'admin', 'hiring manager')
    if n_role:
        if user_role == n_role:
            return True
        if user_role == "admin" and n_role in ("director", "admin"):
            return True
        return False

    # 4. Broadcast / general notification for the tenant or global
    if n_tid:
        return not user_tenant or n_tid == user_tenant
    return True


def _is_read_by_user(n: Notification, user_id: str) -> bool:
    """Check if notification is read by this user."""
    n_uid = str(getattr(n, "user_id", "") or "")
    if n_uid and n_uid == user_id:
        return bool(getattr(n, "read", False)) or getattr(n, "status", "") == "read"

    # For shared/broadcast/tenant notifications, check user_id in read_by list
    read_by = getattr(n, "read_by", None) or []
    if isinstance(read_by, list) and user_id in read_by:
        return True
    return bool(getattr(n, "read", False)) or getattr(n, "status", "") == "read"


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
        user_id = str(current_user.id or "")

        matched = [n for n in all_items if _matches_user(n, current_user)]

        if unread_only:
            matched = [n for n in matched if not _is_read_by_user(n, user_id)]

        matched.sort(key=lambda x: str(getattr(x, "created_at", "") or ""), reverse=True)
        lim = int(limit) if isinstance(limit, (int, float, str)) and str(limit).isdigit() else 60
        items = matched[:lim]
        return [notification_dict(n, user_id=user_id) for n in items]


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user)) -> dict:
    with get_session() as session:
        all_items = session.query(Notification).all()
        user_id = str(current_user.id or "")

        unread_items = [
            n for n in all_items
            if _matches_user(n, current_user) and not _is_read_by_user(n, user_id)
        ]
        return {"count": len(unread_items)}


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    user_id = str(current_user.id or "")
    with get_session() as session:
        n = session.get(Notification, notification_id)
        if not n:
            all_items = session.query(Notification).all()
            for it in all_items:
                if str(getattr(it, "id", "")) == notification_id or str(getattr(it, "_id", "")) == notification_id:
                    n = it
                    break
        if not n:
            raise HTTPException(status_code=404, detail="Notification not found")

        n_uid = str(getattr(n, "user_id", "") or "")
        if not n_uid or n_uid == user_id:
            n.read = True
            n.status = "read"

        read_by = list(getattr(n, "read_by", None) or [])
        if user_id and user_id not in read_by:
            read_by.append(user_id)
            n.read_by = read_by

        session.add(n)
        session.commit()

        # Direct MongoDB sync to ensure immediate persistence across queries
        try:
            update_fields = {"read": True, "status": "read"}
            push_fields = {"read_by": user_id} if user_id else {}
            mongo_filter = {"$or": [
                {"id": notification_id},
                {"id": getattr(n, "id", "")},
            ]}
            if ObjectId.is_valid(notification_id):
                mongo_filter["$or"].append({"_id": ObjectId(notification_id)})

            update_op = {"$set": update_fields}
            if push_fields:
                update_op["$addToSet"] = push_fields
            db["notifications"].update_many(mongo_filter, update_op)
        except Exception:
            pass

        return {"status": "success", "id": notification_id}


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user)) -> dict:
    user_id = str(current_user.id or "")
    with get_session() as session:
        all_items = session.query(Notification).all()
        matched = [n for n in all_items if _matches_user(n, current_user)]

        marked_ids = []
        for n in matched:
            n_uid = str(getattr(n, "user_id", "") or "")
            if not n_uid or n_uid == user_id:
                n.read = True
                n.status = "read"

            read_by = list(getattr(n, "read_by", None) or [])
            if user_id and user_id not in read_by:
                read_by.append(user_id)
                n.read_by = read_by

            session.add(n)
            doc_id = str(getattr(n, "id", "") or getattr(n, "_id", ""))
            if doc_id:
                marked_ids.append(doc_id)

        session.commit()

        # Direct Mongo sync for all matched notification IDs
        if marked_ids:
            try:
                db["notifications"].update_many(
                    {"$or": [{"id": {"$in": marked_ids}}, {"user_id": user_id}]},
                    {"$set": {"read": True, "status": "read"}, "$addToSet": {"read_by": user_id}}
                )
            except Exception:
                pass

        return {"status": "success", "marked": len(marked_ids)}

