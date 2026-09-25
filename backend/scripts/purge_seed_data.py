"""Remove all seed/fake test data inserted by seed_test_data.py.

Deletes everything belonging to the fake tenants:
  - Acme Corp
  - TechVista Solutions
  - GlobalStaff Partners
  - HireLink Agency

Leaves all real production data (Super Admin, other real tenants) untouched.

Usage:
    cd backend && PYTHONPATH=. .venv/bin/python -m scripts.purge_seed_data
"""
import sys
from modules.shared.db import db, get_session
from modules.identity.domain.models import (
    Tenant, User, VendorEngagement
)
from modules.requisition.domain.models import Requisition, CompanyProfile
from modules.candidate.domain.models import CandidateSubmission

# ── Seed tenant names to purge ────────────────────────────────────────────────
SEED_TENANT_NAMES = [
    "Acme Corp",
    "TechVista Solutions",
    "GlobalStaff Partners",
    "HireLink Agency",
]

# ── MongoDB collections that store tenant-scoped data ─────────────────────────
MONGO_TENANT_COLLECTIONS = [
    "work_orders",
    "timesheets",
    "attendance",
    "expenses",
    "onboarding_checklists",
    "onboarding_issues",
    "candidate_submissions",
    "requisitions",
    "company_profiles",
    "vendor_engagements",
    "notifications",
    "activity_log",
]

# ── Collections that reference candidate submissions ──────────────────────────
MONGO_SUBMISSION_COLLECTIONS = [
    "work_orders",
    "timesheets",
    "attendance",
    "expenses",
    "onboarding_checklists",
    "onboarding_issues",
]


def main():
    print("=" * 60)
    print("🧹 PURGING SEED / FAKE TEST DATA")
    print("=" * 60)
    print()

    # ── Step 1: Resolve seed tenant IDs from SQL ─────────────────────────────
    seed_tenant_ids = []
    with get_session() as session:
        for name in SEED_TENANT_NAMES:
            tenant = session.query(Tenant).filter(Tenant.name == name).first()
            if tenant:
                seed_tenant_ids.append(tenant.id)
                print(f"  Found seed tenant: {name!r}  id={tenant.id}")
            else:
                print(f"  Seed tenant not found (already deleted?): {name!r}")

    if not seed_tenant_ids:
        print("\n✅ No seed tenants found in the database — nothing to delete.")
        return

    print(f"\n  Seed tenant IDs to purge: {seed_tenant_ids}")
    print()

    # ── Step 2: Collect submission / work-order IDs for cascade deletes ───────
    submission_ids = []
    work_order_ids = []

    with get_session() as session:
        subs = session.query(CandidateSubmission).filter(
            CandidateSubmission.tenant_id.in_(seed_tenant_ids)
        ).all()
        submission_ids = [s.id for s in subs]
        print(f"  SQL CandidateSubmissions to remove: {len(submission_ids)}")

    # Mongo work_orders scoped to seed tenants
    wo_cursor = db["work_orders"].find(
        {"tenant_id": {"$in": seed_tenant_ids}},
        {"_id": 1, "id": 1}
    )
    for wo in wo_cursor:
        wo_id = wo.get("id") or str(wo.get("_id"))
        if wo_id:
            work_order_ids.append(wo_id)
    print(f"  MongoDB work_orders to remove: {len(work_order_ids)}")

    print()

    # ── Step 3: Delete MongoDB records ───────────────────────────────────────
    if work_order_ids:
        for coll in ["timesheets", "attendance", "expenses"]:
            r = db[coll].delete_many({"work_order_id": {"$in": work_order_ids}})
            if r.deleted_count:
                print(f"  🗑  {coll}: removed {r.deleted_count} docs (by work_order_id)")

        for coll in ["onboarding_checklists", "onboarding_issues"]:
            r = db[coll].delete_many({"work_order_id": {"$in": work_order_ids}})
            if r.deleted_count:
                print(f"  🗑  {coll}: removed {r.deleted_count} docs (by work_order_id)")

    if submission_ids:
        for coll in ["onboarding_checklists", "onboarding_issues", "onboarding_documents"]:
            r = db[coll].delete_many({"submission_id": {"$in": submission_ids}})
            if r.deleted_count:
                print(f"  🗑  {coll}: removed {r.deleted_count} docs (by submission_id)")

    # Purge remaining mongo collections scoped by tenant_id
    for coll in MONGO_TENANT_COLLECTIONS:
        r = db[coll].delete_many({"tenant_id": {"$in": seed_tenant_ids}})
        if r.deleted_count:
            print(f"  🗑  {coll}: removed {r.deleted_count} docs (by tenant_id)")

    print()

    # ── Step 4: Delete SQL records (cascade order) ────────────────────────────
    with get_session() as session:
        # Candidate submissions
        if submission_ids:
            deleted = session.query(CandidateSubmission).filter(
                CandidateSubmission.tenant_id.in_(seed_tenant_ids)
            ).delete(synchronize_session=False)
            print(f"  🗑  SQL CandidateSubmissions: {deleted}")

        # Requisitions
        deleted = session.query(Requisition).filter(
            Requisition.tenant_id.in_(seed_tenant_ids)
        ).delete(synchronize_session=False)
        print(f"  🗑  SQL Requisitions: {deleted}")

        # Company profiles
        deleted = session.query(CompanyProfile).filter(
            CompanyProfile.tenant_id.in_(seed_tenant_ids)
        ).delete(synchronize_session=False)
        print(f"  🗑  SQL CompanyProfiles: {deleted}")

        # Vendor engagements (both directions)
        deleted = session.query(VendorEngagement).filter(
            VendorEngagement.tenant_id.in_(seed_tenant_ids)
        ).delete(synchronize_session=False)
        deleted2 = session.query(VendorEngagement).filter(
            VendorEngagement.vendor_tenant_id.in_(seed_tenant_ids)
        ).delete(synchronize_session=False)
        print(f"  🗑  SQL VendorEngagements: {deleted + deleted2}")

        # Users
        deleted = session.query(User).filter(
            User.tenant_id.in_(seed_tenant_ids)
        ).delete(synchronize_session=False)
        print(f"  🗑  SQL Users: {deleted}")

        # Tenants (last)
        deleted = session.query(Tenant).filter(
            Tenant.id.in_(seed_tenant_ids)
        ).delete(synchronize_session=False)
        print(f"  🗑  SQL Tenants: {deleted}")

        session.commit()

    print()
    print("=" * 60)
    print("✅ PURGE COMPLETE — all seed/fake data removed.")
    print("=" * 60)


if __name__ == "__main__":
    main()
