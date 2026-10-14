"""Single-use browser sign-in links and explicitly linked Telegram identities."""
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
from fastapi import HTTPException
from modules.shared.db import db
from modules.interview.services.interview_service import _resolve_interview_domain


def linked_user(chat_id, sender_id=None, tenant_id=None):
    query = {'telegram_chat_id': str(chat_id), 'role': 'Hiring Manager', 'is_active': {'$ne': False}, 'is_deleted': {'$ne': True}}
    if tenant_id:
        query['tenant_id'] = tenant_id
    user = db.users.find_one(query)
    if user and sender_id is not None and user.get('telegram_user_id') and str(user['telegram_user_id']) != str(sender_id):
        return None
    return user


def create_login_link(chat_id, sender, tenant_id=None):
    state = secrets.token_urlsafe(32)
    db.hm_telegram_login_states.create_index('expires_at', expireAfterSeconds=0)
    db.hm_telegram_login_states.delete_many({'chat_id': str(chat_id)})
    db.hm_telegram_login_states.insert_one({
        '_id': hashlib.sha256(state.encode()).hexdigest(), 'chat_id': str(chat_id),
        'telegram_user_id': str(sender['id']), 'telegram_username': sender.get('username') or '',
        'tenant_id': tenant_id, 'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10),
    })
    return f"{_resolve_interview_domain()}/hiring-manager/telegram-login?{urlencode({'state': state})}"


def complete_login(state, user):
    if user.role != 'Hiring Manager' or not user.is_active or getattr(user, 'is_deleted', False):
        raise HTTPException(status_code=403, detail='Sign in with an active Hiring Manager account.')
    key = hashlib.sha256(state.encode()).hexdigest()
    record = db.hm_telegram_login_states.find_one({'_id': key, 'expires_at': {'$gt': datetime.now(timezone.utc)}})
    if not record:
        raise HTTPException(status_code=400, detail='This link expired or was used. Send /login to the bot again.')
    if record.get('tenant_id') and record['tenant_id'] != user.tenant_id:
        raise HTTPException(status_code=403, detail='This Telegram bot belongs to a different company.')
    target = db.users.find_one({'id': str(user.id), 'role': 'Hiring Manager', 'is_active': {'$ne': False}, 'is_deleted': {'$ne': True}})
    if not target:
        raise HTTPException(status_code=403, detail='Hiring Manager account is unavailable.')
    claimed = db.hm_telegram_login_states.find_one_and_delete({'_id': key, 'expires_at': {'$gt': datetime.now(timezone.utc)}})
    if not claimed:
        raise HTTPException(status_code=400, detail='This link was already used. Send /login again.')
    db.users.update_many({'telegram_chat_id': record['chat_id'], '_id': {'$ne': target['_id']}}, {'$unset': {
        'telegram_chat_id': '', 'telegram_user_id': '', 'telegram_username': '', 'telegram_linked_at': '',
    }})
    old_chat = target.get('telegram_chat_id')
    db.users.update_one({'_id': target['_id']}, {'$set': {
        'telegram_chat_id': record['chat_id'], 'telegram_user_id': record['telegram_user_id'],
        'telegram_username': record['telegram_username'], 'telegram_linked_at': datetime.now(timezone.utc).isoformat(),
    }})
    from .session import invalidate_session
    invalidate_session(record['chat_id'])
    if old_chat:
        invalidate_session(old_chat)
    return record


def logout_chat(chat_id, sender_id, tenant_id=None):
    user = linked_user(chat_id, sender_id, tenant_id)
    if user:
        db.users.update_one({'_id': user['_id']}, {'$unset': {
            'telegram_chat_id': '', 'telegram_user_id': '', 'telegram_username': '', 'telegram_linked_at': '',
            'bot_pairing_token': '', 'bot_pairing_token_expires_at': '',
        }})
    db.hm_telegram_login_states.delete_many({'chat_id': str(chat_id)})
    from .session import invalidate_session
    invalidate_session(chat_id)
