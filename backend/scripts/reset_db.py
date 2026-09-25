"""Full database reset — wipes ALL data except Super Admin user accounts.

Preserves:
  - Users with role == "Super Admin"
  - Their tenant record (if any)

Deletes everything else across all collections.

Usage:
    cd backend && PYTHONPATH=. .venv/bin/python -m scripts.reset_db
"""
import sys
from modules.shared.db import db, _get_client
from modules.shared.config import settings

# ── All MongoDB collections used by the application ───────────────────────────
ALL_COLLECTIONS = [
    # Identity
    "tenants",
    "users",
    "vendor_engagements",
    # Requisitions & Profiles
    "requisitions",
    "company_profiles",
    "role_templates",
    "decision_records",
    # Candidates
    "candidates",
    "candidate_submissions",
    "candidate_outreach",
    "screening_cache",
    "resumes",
    "resume_chunks",
    "telegram_links",
    "candidate_notifications",
    # Billing / Workforce
    "work_orders",
    "timesheets",
    "attendance",
    "attendance_sheets",
    "expenses",
    # Onboarding
    "onboarding_checklists",
    "onboarding_issues",
    "onboarding_documents",
    "offboarding_checklists",
    # Interviews
    "interview_schedules",
    "interview_rounds",
    "interview_messages",
    "ai_interviews",
    # Notifications / Activity
    "notifications",
    "activity_log",
    # Calendar / Settings
    "calendar_configs",
    "platform_settings",
    # AI / Agent checkpoints
    "graph_checkpoints",
    "graph_checkpoint_writes",
    # Misc
    "candidate_expenses",
]


def main():
    print("=" * 60)
    print("🔥 FULL DATABASE RESET")
    print("   Keeping: Super Admin accounts only")
    print("=" * 60)
    print()

    raw_db = _get_client()[settings.mongo_db_name]

    # ── Step 1: Preserve Super Admin users ────────────────────────────────────
    super_admins = list(raw_db["users"].find({"role": "Super Admin"}))
    if not super_admins:
        print("❌ ERROR: No Super Admin users found! Aborting to prevent full lockout.")
        sys.exit(1)

    super_admin_ids = [u["id"] for u in super_admins if u.get("id")]
    super_admin_tenant_ids = list({u.get("tenant_id") for u in super_admins if u.get("tenant_id")})

    print(f"✅ Found {len(super_admins)} Super Admin account(s) to preserve:")
    for sa in super_admins:
        print(f"   • {sa.get('name', 'N/A')}  |  email: {sa.get('email', 'N/A')}  |  id: {sa.get('id', 'N/A')}")
    print()

    # ── Step 2: Wipe all collections ─────────────────────────────────────────
    existing_collections = raw_db.list_collection_names()

    for coll_name in ALL_COLLECTIONS:
        if coll_name not in existing_collections:
            continue  # skip if collection doesn't even exist

        if coll_name == "users":
            # Keep only Super Admins
            result = raw_db["users"].delete_many({"role": {"$ne": "Super Admin"}})
            if result.deleted_count:
                print(f"  🗑  users: removed {result.deleted_count} non-admin users")
            else:
                print(f"  ✓  users: no non-admin users to remove")

        elif coll_name == "tenants":
            # Keep only Super Admin tenants (if they have one)
            if super_admin_tenant_ids:
                result = raw_db["tenants"].delete_many(
                    {"id": {"$nin": super_admin_tenant_ids}}
                )
            else:
                result = raw_db["tenants"].delete_many({})
            if result.deleted_count:
                print(f"  🗑  tenants: removed {result.deleted_count}")
            else:
                print(f"  ✓  tenants: nothing to remove")

        else:
            # Wipe everything else completely
            count = raw_db[coll_name].count_documents({})
            if count > 0:
                raw_db[coll_name].drop()
                print(f"  🗑  {coll_name}: dropped ({count} docs)")
            else:
                print(f"  ✓  {coll_name}: already empty")

    # ── Step 3: Drop any stray/unknown collections (except users + tenants) ───
    print()
    print("  Checking for any remaining collections...")
    after_collections = raw_db.list_collection_names()
    known_safe = {"users", "tenants"}
    for coll_name in after_collections:
        if coll_name not in known_safe and coll_name not in ALL_COLLECTIONS:
            count = raw_db[coll_name].count_documents({})
            print(f"  ⚠️  Unknown collection found: {coll_name!r} ({count} docs) — skipping (manual review recommended)")

    print()
    print("=" * 60)
    print("✅ DATABASE RESET COMPLETE")
    print()
    print("Preserved Super Admin accounts:")
    for sa in super_admins:
        print(f"  Email: {sa.get('email', 'N/A')}")
    print("=" * 60)


if __name__ == "__main__":
    main()
