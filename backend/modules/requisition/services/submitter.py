"""Resolve requisition creators in one projected, tenant-checked account lookup."""
from ...identity.domain.models import User


def requisition_submitters(session, requisitions):
    creator_ids = {row.created_by for row in requisitions if row.created_by}
    users = session.query(User).only('id', 'tenant_id', 'name', 'email').filter(User.id.in_(list(creator_ids))).all() if creator_ids else []
    accounts = {(user.tenant_id, user.id): user for user in users}
    result = {}
    for row in requisitions:
        account = accounts.get((row.tenant_id, row.created_by))
        result[row.id] = {
            'hiring_manager_id': account.id if account else None,
            'hiring_manager_name': (account.name or account.email) if account else (row.structured_role or {}).get('hiring_manager') or '',
            'hiring_manager_email': account.email if account else '',
        }
    return result
