"""PyMongo-backed persistence layer with a SQLAlchemy-like API.

Models are plain classes mapping to MongoDB collections. ``Session`` mirrors
the subset of the SQLAlchemy Session API used across the app
(get/query/add/commit/refresh/flush/delete) so service/router code stays
unchanged while documents live in MongoDB Atlas.
"""
import uuid
from datetime import datetime, timezone

UTC = timezone.utc
from typing import ClassVar
try:
    from typing import Self
except ImportError:
    from typing_extensions import Self

from pymongo import ASCENDING, DESCENDING, MongoClient

from .config import settings


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC)


# Lazy client — defer DNS resolution until first actual DB operation.
# This prevents startup crash when DNS (mongodb+srv://) is slow or offline.
_client: "MongoClient | None" = None

def _get_client() -> "MongoClient":
    global _client
    if _client is None:
        _client = MongoClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            maxPoolSize=50,
            minPoolSize=10,
            retryWrites=True,
            retryReads=True,
            tls=True,
        )
    return _client


class _LazyDB:
    """Proxy that resolves the real database on first access."""
    def __getattr__(self, name):
        return getattr(_get_client()[settings.mongo_db_name], name)
    def __getitem__(self, key):
        return _get_client()[settings.mongo_db_name][key]
    def command(self, *args, **kwargs):
        return _get_client()[settings.mongo_db_name].command(*args, **kwargs)


client = _get_client  # callable — use _get_client() where raw client needed
db = _LazyDB()


class Criterion:
    """A filter expression produced by ``Model.column == value``."""

    __slots__ = ("name", "op", "value")

    def __init__(self, name: str, op: str, value) -> None:
        self.name = name
        self.op = op
        self.value = value


class Sort:
    """A sort key produced by ``Model.column.asc()/desc()``."""

    __slots__ = ("direction", "name")

    def __init__(self, name: str, direction: int) -> None:
        self.name = name
        self.direction = direction

    def asc(self) -> "Sort":
        self.direction = ASCENDING
        return self

    def desc(self) -> "Sort":
        self.direction = DESCENDING
        return self

    def nulls_last(self) -> "Sort":
        return self

    def nulls_first(self) -> "Sort":
        return self

    def __iter__(self):
        return iter((self.name, self.direction))


class Column:
    """Class-level descriptor supporting filter/sort expression building."""

    __slots__ = ("name",)

    def __init__(self, name: str) -> None:
        self.name = name

    def __eq__(self, other) -> Criterion:
        return Criterion(self.name, "$eq", other)

    def __ne__(self, other) -> Criterion:
        return Criterion(self.name, "$ne", other)

    def in_(self, values) -> Criterion:
        return Criterion(self.name, "$in", list(values))

    def asc(self) -> Sort:
        return Sort(self.name, ASCENDING)

    def desc(self) -> Sort:
        return Sort(self.name, DESCENDING)


class Model:
    """Base class for Mongo-backed models."""

    __tablename__: str = ""
    _fields: ClassVar[dict[str, object]] = {}  # name -> default factory (callable) or static value

    def __init__(self, **kwargs) -> None:
        for name, default in self._fields.items():
            value = default() if callable(default) else default
            setattr(self, name, value)
        for name, value in kwargs.items():
            setattr(self, name, value)

    @classmethod
    def from_doc(cls, doc: dict):
        obj = cls()
        for name, value in doc.items():
            if name != "_id":
                setattr(obj, name, value)
        return obj

    def to_doc(self) -> dict:
        return dict(self.__dict__)


class Query:
    def __init__(self, session: "Session", model: type[Model]) -> None:
        self._session = session
        self._model = model
        self._filters: dict = {}
        self._sorts: list = []
        self._limit: int | None = None

    def _coll(self):
        return self._session._db[self._model.__tablename__]

    def filter(self, *criteria, **kwargs) -> "Query":
        for c in criteria:
            if isinstance(c, Criterion):
                if c.op == "$ne":
                    self._filters[c.name] = {"$ne": c.value}
                elif c.op == "$in":
                    self._filters[c.name] = {"$in": c.value if c.value else [""]}
                else:
                    self._filters[c.name] = c.value
            elif isinstance(c, dict):
                self._filters.update(c)
        for name, value in kwargs.items():
            self._filters[name] = value
        return self

    def filter_by(self, **kwargs) -> "Query":
        return self.filter(**kwargs)

    def order_by(self, *sorts) -> "Query":
        for s in sorts:
            if isinstance(s, Sort):
                self._sorts.append(tuple(s))
            else:
                self._sorts.append(s)
        return self

    def limit(self, n: int) -> "Query":
        self._limit = n
        return self

    def first(self):
        doc = self._coll().find_one(self._filters, sort=self._sorts or None)
        if doc is None:
            return None
        obj = self._model.from_doc(doc)
        self._session._track(obj)
        return obj

    def all(self) -> list[Model]:
        cursor = self._coll().find(self._filters)
        if self._sorts:
            cursor = cursor.sort(self._sorts)
        if self._limit:
            cursor = cursor.limit(self._limit)
        rows = [self._model.from_doc(d) for d in cursor]
        for row in rows:
            self._session._track(row)
        return rows

    def count(self) -> int:
        return self._coll().count_documents(self._filters)

    def delete(self, synchronize_session=False) -> int:
        result = self._coll().delete_many(self._filters)
        return result.deleted_count


class Session:
    def __init__(self, database=None) -> None:
        self._db = database or db
        self._tracked: list[Model] = []
        self._pending: list[Model] = []
        self._deleted: list[Model] = []
        self._snapshots: dict[int, dict] = {}  # id(obj) -> serialized state at load time

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc) -> bool:
        return False

    def _coll(self, model: type[Model]):
        return self._db[model.__tablename__]

    def _track(self, obj: Model) -> None:
        if obj not in self._tracked:
            self._tracked.append(obj)
            self._snapshots[id(obj)] = obj.to_doc()

    def get(self, model: type[Model], doc_id: str):
        doc = self._coll(model).find_one({"id": doc_id})
        if doc is None:
            return None
        obj = model.from_doc(doc)
        self._track(obj)
        return obj

    def query(self, model: type[Model]) -> Query:
        return Query(self, model)

    def add(self, obj: Model) -> None:
        self._pending.append(obj)
        self._track(obj)

    def flush(self) -> None:
        for obj in self._pending:
            self._coll(type(obj)).replace_one(
                {"id": obj.id}, obj.to_doc(), upsert=True
            )
            self._snapshots[id(obj)] = obj.to_doc()
        self._pending = []

    def commit(self) -> None:
        self.flush()
        # Only write back tracked objects whose state actually changed
        for obj in self._tracked:
            current = obj.to_doc()
            snapshot = self._snapshots.get(id(obj))
            if current != snapshot:
                self._coll(type(obj)).replace_one(
                    {"id": obj.id}, current, upsert=True
                )
                self._snapshots[id(obj)] = current
        for obj in self._deleted:
            self._coll(type(obj)).delete_one({"id": obj.id})
        self._tracked = []
        self._snapshots = {}
        self._deleted = []

    def refresh(self, obj: Model) -> None:
        doc = self._coll(type(obj)).find_one({"id": obj.id})
        if doc:
            for name, value in doc.items():
                if name != "_id":
                    setattr(obj, name, value)
            self._snapshots[id(obj)] = obj.to_doc()

    def delete(self, obj: Model) -> None:
        self._deleted.append(obj)


def get_session() -> Session:
    return Session()


def init_db() -> None:
    """Create indexes. Idempotent — safe to call on every start."""
    db["users"].create_index("email", unique=True)
    db["users"].create_index("tenant_id")
    db["tenants"].create_index("name")
    db["company_profiles"].create_index("tenant_id")
    db["requisitions"].create_index("tenant_id")
    db["requisitions"].create_index("company_profile_id")
    db["requisitions"].create_index("status")
    db["role_templates"].create_index("tenant_id")
    db["decision_records"].create_index("requisition_id")
    db["candidate_submissions"].create_index("requisition_id")
    db["candidates"].create_index("tenant_id")
    db["notifications"].create_index("user_id")
    db["notifications"].create_index("created_at")
    db["onboarding_checklists"].create_index("candidate_id")

    # Candidate submissions compound indexes for high-throughput queries
    try:
        db["candidate_submissions"].create_index([("requisition_id", 1), ("status", 1), ("match_score", -1)])
        db["candidate_submissions"].create_index([("tenant_id", 1), ("status", 1)])
        db["candidate_submissions"].create_index([("vendor_name", 1), ("status", 1)])
        db["candidate_submissions"].create_index("status")
        db["candidate_submissions"].create_index("id", unique=True)
        db["candidates"].create_index([("tenant_id", 1), ("created_at", -1)])
        db["candidates"].create_index("id")
    except Exception as e:
        print(f"Index creation warning for candidate collections: {e}")

    try:
        db["screening_cache"].create_index("expires_at", expireAfterSeconds=0)
        db["screening_cache"].create_index("cache_key")
        db["screening_cache"].create_index([("recruiter_id", 1), ("requisition_id", 1), ("expires_at", -1)])
    except Exception as e:
        print(f"Index creation warning for screening_cache: {e}")
    try:
        db["work_orders"].create_index("candidate_id")
        db["work_orders"].create_index("work_order_number")
        db["work_orders"].create_index("status")
        db["timesheets"].create_index([("candidate_id", 1), ("week_start_date", -1)])
        db["timesheets"].create_index("work_order_id")
        db["timesheets"].create_index("status")
        db["attendance_sheets"].create_index([("candidate_id", 1), ("month_year", -1)])
    except Exception as e:
        print(f"Index creation warning for candidate_portal collections: {e}")


