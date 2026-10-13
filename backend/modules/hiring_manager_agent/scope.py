"""Request-local authorization for legacy hiring-agent database queries."""
from contextvars import ContextVar
from functools import wraps

_scope = ContextVar('hiring_agent_scope', default=None)


class ScopedCollection:
    def __init__(self, collection, name):
        self.collection, self.name = collection, name

    def restriction(self):
        scope = _scope.get()
        if scope is None:
            return {'_id': {'$in': []}}
        tenant = {'tenant_id': scope['tenant_id']}
        relation = {'requisition_id': {'$in': scope['req_ids']}}
        if self.name == 'requisitions':
            return {**tenant, 'created_by': scope['user_id']}
        if self.name == 'candidate_submissions':
            return {**relation, '$or': [tenant, {'tenant_id': {'$exists': False}}, {'tenant_id': None}]}
        if self.name == 'candidates':
            return {'id': {'$in': scope['candidate_ids']}, '$or': [tenant, {'tenant_id': {'$exists': False}}, {'tenant_id': None}]}
        if self.name in ('work_orders', 'interview_rounds', 'interview_schedules', 'interview_requests', 'candidate_expenses', 'timesheets'):
            return {**tenant, **relation}
        if self.name == 'tenants':
            return {'id': scope['tenant_id']}
        if self.name == 'users':
            return {**tenant, 'id': scope['user_id']}
        if self.name == 'notifications':
            return {**tenant, 'requisition_id': {'$in': scope['req_ids']}}
        if self.name == 'candidate_notifications':
            return {**tenant, 'candidate_id': {'$in': scope['candidate_ids']}}
        # New collections need an explicit ownership policy before the agent can use them.
        return {'_id': {'$in': []}}

    def __getattr__(self, name):
        reads = ('find', 'find_one', 'count_documents')
        writes = ('update_one', 'update_many', 'delete_one', 'delete_many', 'find_one_and_update', 'replace_one')
        if name in reads + writes:
            method = getattr(self.collection, name)
            def guarded(query=None, *args, **kwargs):
                if name in writes:
                    if _scope.get() is None:
                        raise PermissionError('Authenticated hiring-manager scope is required for updates.')
                    if self.name in ('candidates', 'users', 'tenants'):
                        raise PermissionError('The hiring agent cannot change shared profiles or company identity.')
                    if kwargs.get('upsert'):
                        raise PermissionError('The hiring agent cannot create records through an update.')
                    if name == 'replace_one':
                        raise PermissionError('Replacing scoped records is not permitted.')
                    if name in ('update_one', 'update_many', 'find_one_and_update'):
                        update = args[0] if args else kwargs.get('update', {})
                        protected = {'tenant_id', 'requisition_id', 'created_by', 'candidate_id', 'candidate_submission_id', 'id', '_id', 'reporting_manager', 'hiring_manager'}
                        if not isinstance(update, dict) or not update or any(not key.startswith('$') for key in update):
                            raise PermissionError('Only scoped field updates are allowed.')
                        for operator, fields in update.items():
                            if operator == '$rename' or not isinstance(fields, dict) or any(key.split('.')[0] in protected for key in fields):
                                raise PermissionError('The hiring agent cannot change record ownership or company links.')
                constraint = self.restriction()
                query = {'$and': [query or {}, constraint]} if constraint else query or {}
                return method(query, *args, **kwargs)
            return guarded
        if name == 'insert_one':
            def insert(document, *args, **kwargs):
                scope = _scope.get()
                if scope is None or self.name not in ('notifications', 'candidate_notifications'):
                    raise PermissionError('This collection cannot be created through the hiring agent.')
                if document.get('tenant_id') != scope['tenant_id']:
                    raise PermissionError('Notification company does not match the authenticated company.')
                if self.name == 'candidate_notifications' and document.get('candidate_id') not in scope['candidate_ids']:
                    raise PermissionError('The candidate is outside the hiring manager scope.')
                return self.collection.insert_one(document, *args, **kwargs)
            return insert
        raise PermissionError(f'Database operation {name} is not enabled in the hiring-agent sandbox.')


class ScopedDatabase:
    def __init__(self, database):
        self.database = database
    def __getitem__(self, name):
        return ScopedCollection(self.database[name], name)


def authorized_chat(database):
    def decorate(function):
        @wraps(function)
        def wrapped(prompt, history=None, current_user=None):
            actor = current_user or {}
            user_id, tenant_id = str(actor.get('id') or ''), actor.get('tenant_id')
            if not user_id or not tenant_id or tenant_id in ('local', 'all'):
                return {'reply': 'A verified company and hiring manager account is required.', 'executed_actions': []}
            reqs = list(database['requisitions'].find({'tenant_id': tenant_id, 'created_by': user_id}, {'id': 1}))
            req_ids = [r['id'] for r in reqs if r.get('id')]
            submissions = list(database['candidate_submissions'].find({'requisition_id': {'$in': req_ids}, '$or': [{'tenant_id': tenant_id}, {'tenant_id': {'$exists': False}}, {'tenant_id': None}]}, {'candidate_id': 1}))
            scope = {'tenant_id': tenant_id, 'user_id': user_id, 'req_ids': req_ids, 'candidate_ids': [r['candidate_id'] for r in submissions if r.get('candidate_id')]}
            token = _scope.set(scope)
            try:
                # Prior assistant messages can contain data from the old unscoped implementation.
                history = [item for item in history or [] if isinstance(item, dict) and item.get('role') == 'user']
                return function(prompt, history, current_user)
            finally:
                _scope.reset(token)
        return wrapped
    return decorate
