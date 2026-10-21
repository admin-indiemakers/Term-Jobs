import json
"""FastAPI router exposing notifications for the current user."""
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.notifications.domain.models import Notification, notification_dict
from modules.shared.db import db


router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _matches_user(n: Notification, current_user: User) -> bool:
    """Determine whether notification n is intended for current_user."""
    user_id = str(current_user.id or "")
    user_tenant = str(current_user.tenant_id or "")
    user_role = str(current_user.role or "").strip().lower()
    if user_role == "finance team":
        user_role = "finance"

    n_uid = str(getattr(n, "user_id", "") or "")
    n_tid = str(getattr(n, "tenant_id", "") or "")
    n_role = str(getattr(n, "target_role", "") or "").strip().lower()

    # 1. If notification is targeted to a specific user ID, only that user should receive it
    if n_uid:
        return n_uid == user_id

    # 2. If notification specifies a tenant, user must belong to that tenant (or be superadmin/internal)
    if n_tid and user_tenant and n_tid != user_tenant:
        return False

    # Legacy producers omitted target_role. Recover only known event audiences.
    kind = str(getattr(n, "type", "") or "").lower()
    legacy_roles = {
        "requisition_approval_request": {"director", "admin"},
        "agreement_signed": {"hr", "admin", "super admin"},
        "sow_submitted_to_procurement": {"procurement", "admin"},
        "sow_forwarded_to_director": {"director", "admin"},
    }
    normalized_role = "procurement" if user_role == "procurement team" else user_role
    normalized_target = "procurement" if n_role == "procurement team" else n_role
    if not n_role and kind in legacy_roles:
        return normalized_role in legacy_roles[kind] and bool(n_tid and n_tid == user_tenant)
    # Procurement must receive an explicit recipient, role or known procurement event.
    if normalized_role == "procurement":
        return normalized_target == "procurement" and bool(n_tid and n_tid == user_tenant)

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


def _notification(doc):
    # Legacy records have only Mongo's _id; never generate a new public ID on read.
    return Notification.from_doc({**doc, "id": str(doc.get("id") or doc["_id"]), "created_at": doc.get("created_at") or ""})


def _is_read_by_user(n: Notification, user_id: str) -> bool:
    return notification_dict(n, user_id=user_id)["read"]


def _visible_documents(user):
    return [doc for doc in db["notifications"].find({}) if _matches_user(_notification(doc), user)]


def _event_key(doc):
    # Old model upserts cloned legacy records with a new id. Match only exact
    # event content and timestamp; distinct recipients and real new events stay separate.
    if not doc.get('created_at'):
        return str(doc['_id'])
    content = {key: value for key, value in doc.items()
               if key not in {'_id', 'id', 'read', 'read_by', 'status'}}
    # Model defaults were added to cloned records; normalize those absent on originals.
    notification = _notification(doc)
    return json.dumps({
        'created_at': str(doc['created_at']), 'user_id': notification.user_id or '',
        'tenant_id': notification.tenant_id or '', 'target_role': notification.target_role or '',
        'type': notification.type or '', 'title': notification.title or '',
        'body': notification.body or doc.get('message') or '',
        'data': notification.data or {},
        'context': {key: content.get(key) for key in ('candidate_id', 'requisition_id', 'workorder_id', 'candidate_email')},
    }, sort_keys=True, default=str)


def _event_groups(user):
    groups = {}
    for doc in _visible_documents(user):
        groups.setdefault(_event_key(doc), []).append(doc)
    return list(groups.values())


def _group_item(documents, user_id):
    item = notification_dict(_notification(documents[0]), user_id=user_id)
    item['read'] = any(_is_read_by_user(_notification(doc), user_id) for doc in documents)
    return item


@router.get("")
def list_notifications(
    current_user: User = Depends(get_current_user),
    unread_only: bool = False,
    compact: bool = False,
    limit: int = Query(default=60, ge=1, le=60),
) -> list[dict]:
    items = [_group_item(group, str(current_user.id)) for group in _event_groups(current_user)]
    if unread_only:
        items = [item for item in items if not item["read"]]
    items.sort(key=lambda item: item["created_at"], reverse=True)
    return items[:limit if isinstance(limit, int) else 60]


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user)) -> dict:
    return {"count": sum(not _group_item(group, str(current_user.id))['read'] for group in _event_groups(current_user))}


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user)) -> dict:
    documents = _visible_documents(current_user)
    if documents:
        db["notifications"].update_many(
            {"_id": {"$in": [doc["_id"] for doc in documents]}},
            {"$addToSet": {"read_by": str(current_user.id)}},
        )
    return {"status": "success", "marked": len(documents)}


@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)) -> dict:
    query = {"$or": [{"id": notification_id}, {"_id": notification_id}]}
    if ObjectId.is_valid(notification_id):
        query["$or"].append({"_id": ObjectId(notification_id)})
    doc = db["notifications"].find_one(query)
    if not doc or not _matches_user(_notification(doc), current_user):
        raise HTTPException(404, "Notification not found")
    related = [item['_id'] for item in _visible_documents(current_user) if _event_key(item) == _event_key(doc)]
    db["notifications"].update_many({"_id": {"$in": related}}, {"$addToSet": {"read_by": str(current_user.id)}})
    return {"status": "success", "id": notification_id}
