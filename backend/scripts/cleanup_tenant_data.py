"""Tenant-isolation cleanup for existing data.

- Deletes unowned requisitions (tenant_id == "local") and their decision records.
- Re-points company profiles whose tenant_id no longer exists onto the tenant
  that matches the profile name (idempotent, safe to re-run).

Usage:
    .venv/bin/python -m scripts.cleanup_tenant_data
"""
from modules.shared.db import db, get_session


def cleanup() -> dict:
    result: dict = {"requisitions_deleted": 0, "profiles_repointed": 0}

    with get_session() as session:
        from modules.requisition.domain.models import CompanyProfile, DecisionRecord, Requisition

        # 1. Remove unowned requisitions and their decision records.
        orphans = session.query(Requisition).filter(Requisition.tenant_id == "local").all()
        for req in orphans:
            session.query(DecisionRecord).filter_by(requisition_id=req.id).delete()
            session.delete(req)
            result["requisitions_deleted"] += 1
        session.commit()

        # 2. Re-point profiles whose tenant_id references a tenant that no
        #    longer exists onto the tenant matching the profile name.
        valid_tenant_ids = {
            t["id"] for t in db["tenants"].find({}, {"id": 1})
        }
        name_to_tenant = {}
        for t in db["tenants"].find({}, {"id": 1, "name": 1}):
            name_to_tenant.setdefault(t["name"], t["id"])

        for prof in session.query(CompanyProfile).all():
            if prof.tenant_id in valid_tenant_ids:
                continue
            target = name_to_tenant.get(prof.name)
            if not target:
                print(f"Profile '{prof.name}' ({prof.id}) has no matching tenant; leaving as-is")
                continue
            prof.tenant_id = target
            result["profiles_repointed"] += 1
        session.commit()

    return result


if __name__ == "__main__":
    print(cleanup())
