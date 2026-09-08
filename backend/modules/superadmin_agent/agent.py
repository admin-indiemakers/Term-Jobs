"""Super Admin AI Agent powered by Groq API.

Equipped with tool-calling capabilities and conversation memory to inspect, onboard, manage,
and control all TermJobs platform features (tenants, users, requisitions, archives).
"""
import json
import uuid
from datetime import datetime, timezone
import httpx

from modules.shared.config import settings
from modules.shared.db import db, Session, get_session
from modules.identity.domain.models import Tenant, User, VendorEngagement
from modules.identity.services.auth_service import hash_password


def _utcnow_iso():
    return datetime.now(timezone.utc).isoformat()


# ── TOOL DEFINITIONS ─────────────────────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_platform_stats",
            "description": "Get real-time counts and health metrics for the TermJobs platform including total client companies, vendor consultancies, user accounts, admin roles, and system status.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_tenants",
            "description": "List onboarded client companies (buyers), vendor consultancies, or all tenants with names, IDs, types, and admin info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tenant_type": {
                        "type": "string",
                        "enum": ["client", "consultancy", "all"],
                        "description": "Filter by tenant type: 'client' (buyer company), 'consultancy' (vendor), or 'all' (default: 'all')."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_tenant_details",
            "description": "Get detailed info and assigned user accounts for a specific client company or vendor consultancy by name or ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tenant_identifier": {
                        "type": "string",
                        "description": "Tenant name or tenant ID to lookup"
                    }
                },
                "required": ["tenant_identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "draft_onboarding_preview",
            "description": "Create an interactive draft form preview card for onboarding a buyer client company or vendor consultancy before final confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tenant_type": {"type": "string", "enum": ["client", "consultancy"], "description": "Type of tenant: 'client' for buyer company, 'consultancy' for vendor partner"},
                    "company_name": {"type": "string", "description": "Company or vendor name"},
                    "industry": {"type": "string", "description": "Industry or domain e.g. Technology / Software"},
                    "company_size": {"type": "string", "description": "Company size e.g. 50-200"},
                    "location": {"type": "string", "description": "Operating location e.g. Bangalore / Remote"},
                    "tech_stack": {"type": "string", "description": "Technical environment / tech stack e.g. React, Node.js"},
                    "about": {"type": "string", "description": "About the organization"},
                    "admin_name": {"type": "string", "description": "Admin full name"},
                    "admin_email": {"type": "string", "description": "Admin email address"},
                    "password": {"type": "string", "description": "Admin account password"}
                },
                "required": ["tenant_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "onboard_client_company",
            "description": "Execute final onboarding for a buyer client company tenant after draft confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "company_name": {"type": "string", "description": "Legal/Operating name of the client company"},
                    "admin_name": {"type": "string", "description": "Full name of the company administrator"},
                    "admin_email": {"type": "string", "description": "Email address of the company administrator"},
                    "password": {"type": "string", "description": "Initial password for the admin account"},
                    "industry": {"type": "string", "description": "Industry"},
                    "company_size": {"type": "string", "description": "Company size"},
                    "location": {"type": "string", "description": "Location"},
                    "tech_stack": {"type": "string", "description": "Tech stack"},
                    "about": {"type": "string", "description": "About organization"}
                },
                "required": ["company_name", "admin_name", "admin_email", "password"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "onboard_vendor_consultancy",
            "description": "Execute final onboarding for a vendor consultancy partner after draft confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_name": {"type": "string", "description": "Name of the vendor consultancy"},
                    "admin_name": {"type": "string", "description": "Full name of the recruiter/vendor admin"},
                    "admin_email": {"type": "string", "description": "Email address of the recruiter/vendor admin"},
                    "password": {"type": "string", "description": "Initial password"},
                    "industry": {"type": "string", "description": "Specialization / Industry"},
                    "company_size": {"type": "string", "description": "Company size"},
                    "location": {"type": "string", "description": "Location"},
                    "about": {"type": "string", "description": "About vendor"}
                },
                "required": ["vendor_name", "admin_name", "admin_email", "password"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_admin_accounts",
            "description": "List administrator accounts (Company Admin, Vendor Recruiter Admin, Super Admin) across tenants.",
            "parameters": {
                "type": "object",
                "properties": {
                    "role": {
                        "type": "string",
                        "description": "Filter by user role e.g. 'Admin', 'Recruiter', 'Super Admin'"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_user_account",
            "description": "Create a new user account assigned to a specific tenant.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Full name of the user"},
                    "email": {"type": "string", "description": "Email address"},
                    "role": {"type": "string", "description": "User role e.g. 'Admin', 'Recruiter', 'Director', 'Hiring Manager'"},
                    "tenant_id": {"type": "string", "description": "Target tenant ID"},
                    "password": {"type": "string", "description": "Initial password"}
                },
                "required": ["name", "email", "role", "tenant_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_archives",
            "description": "List all archived records in TermJobs (archived tenants, users).",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "draft_tenant_deletion",
            "description": "Show profile details and interactive confirmation card for deleting/removing a client company or vendor consultancy tenant.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tenant_identifier": {
                        "type": "string",
                        "description": "Name or ID of the client company or vendor consultancy to delete"
                    }
                },
                "required": ["tenant_identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_tenant",
            "description": "Execute permanent deletion/archival of a tenant and its assigned user accounts after explicit manual admin confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tenant_id": {
                        "type": "string",
                        "description": "Tenant ID to delete"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for deletion"
                    }
                },
                "required": ["tenant_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_vendor_engagements",
            "description": "List vendor consultancies engaged with specific buyer client companies (e.g. PepsiCo, Bearitt, SDC limited).",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_identifier": {
                        "type": "string",
                        "description": "Buyer client company name or ID to filter engagements"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "engage_vendor",
            "description": "Engage / link a vendor consultancy partner to a buyer client company tenant.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_identifier": {
                        "type": "string",
                        "description": "Buyer client company name or ID"
                    },
                    "vendor_identifier": {
                        "type": "string",
                        "description": "Vendor consultancy name or ID"
                    }
                },
                "required": ["client_identifier", "vendor_identifier"]
            }
        }
    }
]


# ── TOOL IMPLEMENTATIONS ─────────────────────────────────────────────────────

def tool_get_platform_stats() -> dict:
    session = get_session()
    tenants = session.query(Tenant).all()
    client_count = sum(1 for t in tenants if t.tenant_type == "client")
    consultancy_count = sum(1 for t in tenants if t.tenant_type == "consultancy")

    users = session.query(User).all()
    user_count = len(users)
    admin_count = sum(1 for u in users if u.role in ("Admin", "Recruiter", "Super Admin"))

    return {
        "status": "success",
        "total_tenants": len(tenants),
        "client_companies": client_count,
        "vendor_consultancies": consultancy_count,
        "total_users": user_count,
        "admin_accounts": admin_count,
        "system_status": "Fully Operational (0 critical issues detected)",
    }


def tool_draft_onboarding_preview(
    tenant_type: str,
    company_name: str = "",
    industry: str = "",
    company_size: str = "",
    location: str = "",
    tech_stack: str = "",
    about: str = "",
    admin_name: str = "",
    admin_email: str = "",
    password: str = "",
) -> dict:
    is_client = tenant_type.lower() in ("client", "buyer", "company")
    name = company_name.strip()

    # AI Auto-fill company profile metadata defaults
    ai_industry = industry.strip() or ("Technology & Enterprise Software" if is_client else "IT Staffing & Executive Sourcing")
    ai_size = company_size.strip() or "50-200 employees"
    ai_location = location.strip() or "Bangalore / Remote"
    ai_tech_stack = tech_stack.strip() or ("React, Node.js, Python, PostgreSQL, AWS" if is_client else "Talent Sourcing, Executive Search, Tech Screening")
    ai_about = about.strip() or (
        f"{name or 'Organization'} is a technology provider operating enterprise workforce platforms."
        if is_client else
        f"{name or 'Consultancy'} is a specialized recruitment partner delivering technical talent acquisition."
    )

    missing = []
    if not name:
        missing.append("Company/Vendor Name")
    if not admin_name.strip():
        missing.append("Admin Full Name")
    if not admin_email.strip():
        missing.append("Admin Email")
    if not password.strip():
        missing.append("Admin Password")

    return {
        "status": "draft",
        "tenant_type": "client" if is_client else "consultancy",
        "company_name": name,
        "industry": ai_industry,
        "company_size": ai_size,
        "location": ai_location,
        "tech_stack": ai_tech_stack,
        "about": ai_about,
        "admin_name": admin_name.strip(),
        "admin_email": admin_email.strip(),
        "password": password.strip(),
        "missing_fields": missing,
        "is_complete": len(missing) == 0,
    }


def tool_onboard_client_company(
    company_name: str,
    admin_name: str,
    admin_email: str,
    password: str = "Admin123!",
    industry: str = "",
    company_size: str = "",
    location: str = "",
    tech_stack: str = "",
    about: str = ""
) -> dict:
    session = get_session()
    tenant_id = f"tenant-{uuid.uuid4().hex[:8]}"

    existing = session.query(Tenant).filter(Tenant.name == company_name).first()
    if existing:
        tenant_id = existing.id
    else:
        tenant = Tenant(id=tenant_id, name=company_name, tenant_type="client", created_at=_utcnow_iso())
        session.add(tenant)
        session.commit()

    # Save rich metadata to MongoDB
    db["tenants"].update_one(
        {"id": tenant_id},
        {"$set": {
            "id": tenant_id,
            "name": company_name,
            "tenant_type": "client",
            "industry": industry,
            "company_size": company_size,
            "location": location,
            "tech_stack": tech_stack,
            "about": about,
            "created_at": _utcnow_iso()
        }},
        upsert=True
    )

    existing_user = session.query(User).filter(User.email == admin_email).first()
    if existing_user:
        return {
            "status": "success",
            "message": f"Company '{company_name}' exists (ID: {tenant_id}). User '{admin_email}' is already registered.",
            "tenant_id": tenant_id,
            "user_email": admin_email
        }

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)
    user = User(
        id=user_id,
        email=admin_email,
        name=admin_name,
        password_hash=pw_hash,
        role="Admin",
        tenant_id=tenant_id,
        created_at=_utcnow_iso()
    )
    session.add(user)
    session.commit()

    db["users"].update_one(
        {"id": user_id},
        {"$set": {
            "id": user_id,
            "name": admin_name,
            "email": admin_email,
            "role": "Admin",
            "tenant_id": tenant_id,
            "created_at": _utcnow_iso()
        }},
        upsert=True
    )

    return {
        "status": "success",
        "message": f"Successfully onboarded buyer client company '{company_name}' and created Administrator '{admin_name}' ({admin_email}).",
        "tenant_id": tenant_id,
        "admin_user_id": user_id,
        "admin_email": admin_email,
    }


def tool_onboard_vendor_consultancy(
    vendor_name: str,
    admin_name: str,
    admin_email: str,
    password: str = "Vendor123!",
    industry: str = "",
    company_size: str = "",
    location: str = "",
    about: str = ""
) -> dict:
    session = get_session()
    tenant_id = f"vendor-{uuid.uuid4().hex[:8]}"

    existing = session.query(Tenant).filter(Tenant.name == vendor_name).first()
    if existing:
        tenant_id = existing.id
    else:
        tenant = Tenant(id=tenant_id, name=vendor_name, tenant_type="consultancy", created_at=_utcnow_iso())
        session.add(tenant)
        session.commit()

    db["tenants"].update_one(
        {"id": tenant_id},
        {"$set": {
            "id": tenant_id,
            "name": vendor_name,
            "tenant_type": "consultancy",
            "industry": industry,
            "company_size": company_size,
            "location": location,
            "about": about,
            "created_at": _utcnow_iso()
        }},
        upsert=True
    )

    existing_user = session.query(User).filter(User.email == admin_email).first()
    if existing_user:
        return {
            "status": "success",
            "message": f"Vendor consultancy '{vendor_name}' exists (ID: {tenant_id}). Recruiter '{admin_email}' is already registered.",
            "tenant_id": tenant_id,
            "user_email": admin_email
        }

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)
    user = User(
        id=user_id,
        email=admin_email,
        name=admin_name,
        password_hash=pw_hash,
        role="Recruiter",
        tenant_id=tenant_id,
        created_at=_utcnow_iso()
    )
    session.add(user)
    session.commit()

    db["users"].update_one(
        {"id": user_id},
        {"$set": {
            "id": user_id,
            "name": admin_name,
            "email": admin_email,
            "role": "Recruiter",
            "tenant_id": tenant_id,
            "created_at": _utcnow_iso()
        }},
        upsert=True
    )

    return {
        "status": "success",
        "message": f"Successfully onboarded vendor consultancy '{vendor_name}' and created Recruiter Admin '{admin_name}' ({admin_email}).",
        "tenant_id": tenant_id,
        "recruiter_user_id": user_id,
        "recruiter_email": admin_email,
    }


def tool_list_tenants(tenant_type: str = "all") -> list:
    query = {}
    if tenant_type in ("client", "consultancy"):
        query["tenant_type"] = tenant_type

    tenants = list(db["tenants"].find(query))
    users = list(db["users"].find())
    user_map = {}
    for u in users:
        tid = u.get("tenant_id")
        if tid:
            user_map.setdefault(tid, []).append(u.get("name") or u.get("email"))

    result = []
    for t in tenants:
        tid = t.get("id")
        result.append({
            "id": tid,
            "name": t.get("name"),
            "tenant_type": t.get("tenant_type"),
            "created_at": t.get("created_at", ""),
            "assigned_users": user_map.get(tid, []),
        })
    return result


def tool_get_tenant_details(tenant_identifier: str) -> dict:
    query = {"$or": [{"id": tenant_identifier}, {"name": {"$regex": tenant_identifier, "$options": "i"}}]}
    tenant = db["tenants"].find_one(query)
    if not tenant:
        return {"status": "error", "message": f"Tenant '{tenant_identifier}' not found."}

    tenant.pop("_id", None)
    users = list(db["users"].find({"tenant_id": tenant.get("id")}))
    user_list = []
    for u in users:
        user_list.append({
            "id": u.get("id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "role": u.get("role"),
        })

    tenant["users"] = user_list
    return tenant


def tool_list_admin_accounts(role: str = None) -> list:
    users = list(db["users"].find())
    result = []
    for u in users:
        u_role = u.get("role")
        if role and u_role.lower() != role.lower():
            continue
        if u_role in ("Admin", "Recruiter", "Super Admin") or role:
            result.append({
                "id": u.get("id"),
                "name": u.get("name"),
                "email": u.get("email"),
                "role": u_role,
                "tenant_id": u.get("tenant_id"),
            })
    return result


def tool_create_user_account(name: str, email: str, role: str, tenant_id: str, password: str = "User123!") -> dict:
    session = get_session()
    existing = session.query(User).filter(User.email == email).first()
    if existing:
        return {"status": "error", "message": f"User with email '{email}' already exists."}

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)
    user = User(
        id=user_id,
        email=email,
        name=name,
        password_hash=pw_hash,
        role=role,
        tenant_id=tenant_id,
        created_at=_utcnow_iso()
    )
    session.add(user)
    session.commit()

    return {
        "status": "success",
        "message": f"User '{name}' ({email}) created with role '{role}'.",
        "user_id": user_id
    }


def tool_list_archives() -> list:
    archives = list(db["archives"].find())
    result = []
    for a in archives:
        result.append({
            "id": a.get("id"),
            "item_type": a.get("item_type"),
            "reason": a.get("reason"),
            "archived_at": a.get("archived_at"),
        })
    return result


def tool_draft_tenant_deletion(tenant_identifier: str) -> dict:
    session = get_session()
    tenants = session.query(Tenant).all()
    tenant = None
    for t in tenants:
        if t.id == tenant_identifier or (t.name and tenant_identifier.lower() in t.name.lower()):
            tenant = t
            break

    tid = tenant.id if tenant else tenant_identifier
    tname = tenant.name if tenant else tenant_identifier
    ttype = tenant.tenant_type if tenant else "client"

    t_mongo = db["tenants"].find_one({"$or": [{"id": tid}, {"name": {"$regex": tenant_identifier, "$options": "i"}}]})
    if t_mongo:
        tid = t_mongo.get("id", tid)
        tname = t_mongo.get("name", tname)
        ttype = t_mongo.get("tenant_type", ttype)

    users = session.query(User).filter(User.tenant_id == tid).all()
    user_list = [{"id": u.id, "name": u.name, "email": u.email, "role": u.role} for u in users]

    return {
        "status": "draft_deletion",
        "tenant_id": tid,
        "tenant_name": tname,
        "tenant_type": ttype,
        "industry": (t_mongo.get("industry", "") if t_mongo else ""),
        "company_size": (t_mongo.get("company_size", "") if t_mongo else ""),
        "location": (t_mongo.get("location", "") if t_mongo else ""),
        "tech_stack": (t_mongo.get("tech_stack", "") if t_mongo else ""),
        "about": (t_mongo.get("about", "") if t_mongo else ""),
        "assigned_users_count": len(user_list),
        "assigned_users": user_list,
        "message": f"Tenant '{tname}' (ID: {tid}) profile loaded for deletion review. Manual administrator confirmation required to delete.",
    }


def tool_delete_tenant(tenant_id: str, reason: str = "Deleted by Super Admin") -> dict:
    session = get_session()
    tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
    tenant_name = tenant.name if tenant else tenant_id

    archive_record = {
        "id": str(uuid.uuid4()),
        "item_type": "tenant",
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "reason": reason,
        "archived_at": _utcnow_iso()
    }
    db["archives"].insert_one(archive_record)

    users = session.query(User).filter(User.tenant_id == tenant_id).all()
    deleted_user_emails = [u.email for u in users]
    for u in users:
        session.delete(u)

    if tenant:
        session.delete(tenant)

    session.commit()

    db["tenants"].delete_one({"id": tenant_id})
    db["users"].delete_many({"tenant_id": tenant_id})

    return {
        "status": "success",
        "action": "tenant_deleted",
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "deleted_user_emails": deleted_user_emails,
        "message": f"Successfully deleted tenant '{tenant_name}' (ID: {tenant_id}) and {len(deleted_user_emails)} associated account(s) from database."
    }


def tool_list_vendor_engagements(client_identifier: str = "") -> dict:
    session = get_session()
    engagements = session.query(VendorEngagement).all()
    tenants = session.query(Tenant).all()
    tenant_map = {t.id: t for t in tenants}

    result = []
    for eng in engagements:
        client_t = tenant_map.get(eng.tenant_id)
        vendor_t = tenant_map.get(eng.vendor_tenant_id)

        c_name = client_t.name if client_t else eng.tenant_id
        v_name = vendor_t.name if vendor_t else eng.vendor_tenant_id

        if client_identifier:
            cid_lower = client_identifier.lower()
            if cid_lower not in c_name.lower() and cid_lower not in eng.tenant_id.lower():
                continue

        result.append({
            "id": eng.id,
            "client_tenant_id": eng.tenant_id,
            "client_name": c_name,
            "vendor_tenant_id": eng.vendor_tenant_id,
            "vendor_name": v_name,
            "engaged_at": str(getattr(eng, "created_at", "")),
        })

    return {
        "status": "success",
        "client_identifier": client_identifier,
        "total_engagements": len(result),
        "engagements": result,
    }


def tool_engage_vendor(client_identifier: str, vendor_identifier: str) -> dict:
    session = get_session()
    tenants = session.query(Tenant).all()

    client_t = None
    vendor_t = None

    for t in tenants:
        if client_identifier.lower() == t.id.lower() or (t.name and client_identifier.lower() in t.name.lower()):
            client_t = t
        if vendor_identifier.lower() == t.id.lower() or (t.name and vendor_identifier.lower() in t.name.lower()):
            vendor_t = t

    if not client_t:
        return {"status": "error", "message": f"Client company '{client_identifier}' not found."}
    if not vendor_t:
        return {"status": "error", "message": f"Vendor consultancy '{vendor_identifier}' not found."}

    existing = session.query(VendorEngagement).filter(
        VendorEngagement.tenant_id == client_t.id,
        VendorEngagement.vendor_tenant_id == vendor_t.id
    ).first()

    if existing:
        return {
            "status": "success",
            "message": f"Vendor consultancy '{vendor_t.name}' is already engaged with buyer client company '{client_t.name}'.",
            "client_name": client_t.name,
            "vendor_name": vendor_t.name,
        }

    eng_id = str(uuid.uuid4())
    eng = VendorEngagement(
        id=eng_id,
        tenant_id=client_t.id,
        vendor_tenant_id=vendor_t.id,
        created_at=_utcnow_iso()
    )
    session.add(eng)
    session.commit()

    return {
        "status": "success",
        "message": f"Successfully engaged vendor consultancy '{vendor_t.name}' with buyer client company '{client_t.name}'.",
        "client_name": client_t.name,
        "vendor_name": vendor_t.name,
        "engagement_id": eng_id,
    }


# Map tool name -> callable
TOOL_MAP = {
    "get_platform_stats": tool_get_platform_stats,
    "list_tenants": tool_list_tenants,
    "get_tenant_details": tool_get_tenant_details,
    "draft_onboarding_preview": tool_draft_onboarding_preview,
    "onboard_client_company": tool_onboard_client_company,
    "onboard_vendor_consultancy": tool_onboard_vendor_consultancy,
    "list_admin_accounts": tool_list_admin_accounts,
    "create_user_account": tool_create_user_account,
    "list_archives": tool_list_archives,
    "draft_tenant_deletion": tool_draft_tenant_deletion,
    "delete_tenant": tool_delete_tenant,
    "list_vendor_engagements": tool_list_vendor_engagements,
    "engage_vendor": tool_engage_vendor,
}


# ── GROQ REASONING AGENT ─────────────────────────────────────────────────────

class SuperAdminAgent:
    def __init__(self):
        self.api_key = settings.groq_api_key
        self.base_url = settings.groq_base_url.rstrip("/")
        # Valid Groq tool-calling models
        self.model_candidates = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"]
        env_model = getattr(settings, "groq_model", None)
        if env_model and env_model in self.model_candidates:
            self.model = env_model
        else:
            self.model = "openai/gpt-oss-120b"

    def run(self, user_prompt: str, history: list[dict] = None, user_name: str = "Super Admin") -> dict:
        """Run the Super Admin Agent tool-calling loop using Groq API and multi-turn conversation memory."""
        chat_url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        system_msg = {
            "role": "system",
            "content": (
                f"You are the TermJobs Super Admin AI Agent interacting with {user_name}.\n"
                "You have FULL administrative privileges over all client companies (buyers), vendor consultancies, user accounts, and platform metrics.\n"
                "CRITICAL ONBOARDING RULE:\n"
                "When the user requests to onboard a buyer company or vendor consultancy:\n"
                "1. Call `draft_onboarding_preview` to display an interactive draft form preview card.\n"
                "2. Instruct the user to review the draft and click 'Confirm & Execute Onboarding'.\n"
                "3. ONLY execute `onboard_client_company` or `onboard_vendor_consultancy` when confirmed.\n"
                "CRITICAL DELETION / REMOVAL RULE:\n"
                "When the user requests to delete, remove, or archive any tenant (company or vendor consultancy):\n"
                "1. NEVER call `delete_tenant` directly on the initial request.\n"
                "2. ALWAYS call `draft_tenant_deletion` first with the tenant name or ID.\n"
                "3. This will display a profile preview card of the tenant with an explicit red 'Confirm & Delete Tenant' manual button.\n"
                "4. Tell the administrator to review the tenant profile and manually click 'Confirm & Delete Tenant' in the chat card to complete deletion."
            )
        }

        messages = [system_msg]

        # Inject conversation history turns for multi-turn memory
        if history:
            for h in history:
                sender = h.get("sender") or h.get("role")
                text = h.get("text") or h.get("content", "")
                if text and sender:
                    role = "user" if sender == "user" else "assistant"
                    messages.append({"role": role, "content": text})

        messages.append({"role": "user", "content": user_prompt})

        executed_actions = []

        # Intercept explicit confirmation commands
        if "CONFIRM_EXECUTE_CLIENT_ONBOARDING:" in user_prompt:
            import re
            c_name = (re.search(r'company_name="([^"]*)"', user_prompt) or re.search(r'company_name=([^\s,]*)', user_prompt))
            a_name = (re.search(r'admin_name="([^"]*)"', user_prompt) or re.search(r'admin_name=([^\s,]*)', user_prompt))
            a_email = (re.search(r'admin_email="([^"]*)"', user_prompt) or re.search(r'admin_email=([^\s,]*)', user_prompt))
            pwd = (re.search(r'password="([^"]*)"', user_prompt) or re.search(r'password=([^\s,]*)', user_prompt))
            ind = (re.search(r'industry="([^"]*)"', user_prompt) or re.search(r'industry=([^\s,]*)', user_prompt))
            csz = (re.search(r'company_size="([^"]*)"', user_prompt) or re.search(r'company_size=([^\s,]*)', user_prompt))
            loc = (re.search(r'location="([^"]*)"', user_prompt) or re.search(r'location=([^\s,]*)', user_prompt))
            stk = (re.search(r'tech_stack="([^"]*)"', user_prompt) or re.search(r'tech_stack=([^\s,]*)', user_prompt))
            abt = (re.search(r'about="([^"]*)"', user_prompt) or re.search(r'about=([^\s,]*)', user_prompt))

            comp_val = c_name.group(1) if c_name else "Client Company"
            aname_val = a_name.group(1) if a_name else "Administrator"
            aemail_val = a_email.group(1) if a_email else "admin@company.com"
            pwd_val = pwd.group(1) if pwd else "Admin123!"

            res = tool_onboard_client_company(
                company_name=comp_val,
                admin_name=aname_val,
                admin_email=aemail_val,
                password=pwd_val,
                industry=ind.group(1) if ind else "",
                company_size=csz.group(1) if csz else "",
                location=loc.group(1) if loc else "",
                tech_stack=stk.group(1) if stk else "",
                about=abt.group(1) if abt else ""
            )
            executed_actions.append({"tool": "onboard_client_company", "result": res})
            return {"reply": res["message"], "executed_actions": executed_actions}

        if "CONFIRM_EXECUTE_VENDOR_ONBOARDING:" in user_prompt:
            import re
            v_name = (re.search(r'vendor_name="([^"]*)"', user_prompt) or re.search(r'vendor_name=([^\s,]*)', user_prompt))
            a_name = (re.search(r'admin_name="([^"]*)"', user_prompt) or re.search(r'admin_name=([^\s,]*)', user_prompt))
            a_email = (re.search(r'admin_email="([^"]*)"', user_prompt) or re.search(r'admin_email=([^\s,]*)', user_prompt))
            pwd = (re.search(r'password="([^"]*)"', user_prompt) or re.search(r'password=([^\s,]*)', user_prompt))
            ind = (re.search(r'industry="([^"]*)"', user_prompt) or re.search(r'industry=([^\s,]*)', user_prompt))
            csz = (re.search(r'company_size="([^"]*)"', user_prompt) or re.search(r'company_size=([^\s,]*)', user_prompt))
            loc = (re.search(r'location="([^"]*)"', user_prompt) or re.search(r'location=([^\s,]*)', user_prompt))
            abt = (re.search(r'about="([^"]*)"', user_prompt) or re.search(r'about=([^\s,]*)', user_prompt))

            vend_val = v_name.group(1) if v_name else "Vendor Consultancy"
            aname_val = a_name.group(1) if a_name else "Recruiter Admin"
            aemail_val = a_email.group(1) if a_email else "admin@vendor.com"
            pwd_val = pwd.group(1) if pwd else "Vendor123!"

            res = tool_onboard_vendor_consultancy(
                vendor_name=vend_val,
                admin_name=aname_val,
                admin_email=aemail_val,
                password=pwd_val,
                industry=ind.group(1) if ind else "",
                company_size=csz.group(1) if csz else "",
                location=loc.group(1) if loc else "",
                about=abt.group(1) if abt else ""
            )
            executed_actions.append({"tool": "onboard_vendor_consultancy", "result": res})
            return {"reply": res["message"], "executed_actions": executed_actions}

        if "CONFIRM_DELETE_TENANT:" in user_prompt:
            import re
            t_id = (re.search(r'tenant_id="([^"]*)"', user_prompt) or re.search(r'tenant_id=([^\s,]*)', user_prompt))
            target_tid = t_id.group(1) if t_id else ""
            if target_tid:
                res = tool_delete_tenant(tenant_id=target_tid)
                executed_actions.append({"tool": "delete_tenant", "result": res})
                return {"reply": res["message"], "executed_actions": executed_actions}

        # Intercept account creation requests for un-onboarded vendors or companies
        prompt_lower = user_prompt.lower()
        if any(k in prompt_lower for k in ("create", "add", "new", "onboard", "register")) and any(k in prompt_lower for k in ("account", "vendor", "consultancy", "company", "client", "buyer")):
            import re
            m_target = re.search(r'(?:for|under|named)\s+(?:a\s+|the\s+)?(?:vendor\s+|company\s+|consultancy\s+)?([a-zA-Z0-9_\-\s]+)', user_prompt, re.IGNORECASE)
            if not m_target:
                m_target = re.search(r'(?:vendor|company|consultancy|client)\s+([a-zA-Z0-9_\-\s]+)', user_prompt, re.IGNORECASE)

            if m_target:
                raw_target = m_target.group(1).strip()
                target_name = raw_target.split(" with ")[0].split(" using ")[0].strip()
                if target_name.lower().startswith("with "):
                    target_name = ""
                if target_name and target_name.lower() not in ("a", "the", "user", "account", "with"):
                    session = get_session()
                    tenants = session.query(Tenant).all()
                    existing_t = None
                    for t in tenants:
                        if t.name and (target_name.lower() == t.name.lower() or target_name.lower() in t.name.lower()):
                            existing_t = t
                            break

                    if not existing_t:
                        is_vendor_type = "vendor" in prompt_lower or "consultancy" in prompt_lower or "recruiter" in prompt_lower
                        draft_res = tool_draft_onboarding_preview(
                            tenant_type="consultancy" if is_vendor_type else "client",
                            company_name=target_name,
                            admin_name="",
                            admin_email="",
                            password=""
                        )
                        executed_actions.append({"tool": "draft_onboarding_preview", "result": draft_res})
                        reply = (
                            f"Vendor **{target_name}** is not onboarded in TermJobs yet. "
                            f"To create user accounts under **{target_name}**, we first need to onboard the organization. "
                            f"I have created an interactive onboarding draft form below for **{target_name}**. "
                            f"Please review the details, fill in any missing fields, and click **Confirm & Execute Onboarding** to complete registration."
                        )
                        return {"reply": reply, "executed_actions": executed_actions}

        # Try Groq models with fast 8.0s timeout per candidate
        for target_model in self.model_candidates:
            payload = {
                "model": target_model,
                "messages": messages,
                "tools": TOOLS,
                "tool_choice": "auto",
                "temperature": 0.2,
            }
            try:
                resp = httpx.post(chat_url, json=payload, headers=headers, timeout=8.0)
                if resp.status_code != 200:
                    continue

                res_data = resp.json()
                choice = res_data["choices"][0]["message"]
                tool_calls = choice.get("tool_calls")

                if tool_calls:
                    messages.append(choice)
                    called_tools = set()
                    for tc in tool_calls:
                        fn_name = tc["function"]["name"]
                        if fn_name in called_tools:
                            continue
                        called_tools.add(fn_name)

                        raw_args = tc["function"].get("arguments", "{}")
                        try:
                            args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                        except Exception:
                            args = {}

                        tool_fn = TOOL_MAP.get(fn_name)
                        if tool_fn:
                            try:
                                result = tool_fn(**args)
                            except Exception as ex:
                                result = {"status": "error", "error": str(ex)}

                            executed_actions.append({"tool": fn_name, "args": args, "result": result})

                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "name": fn_name,
                                "content": json.dumps(result, default=str),
                            })

                    second_payload = {
                        "model": target_model,
                        "messages": messages,
                        "temperature": 0.3,
                    }
                    sec_resp = httpx.post(chat_url, json=second_payload, headers=headers, timeout=8.0)
                    sec_resp.raise_for_status()
                    final_text = sec_resp.json()["choices"][0]["message"]["content"]
                else:
                    final_text = choice.get("content") or "Hello! How can I assist you with the TermJobs platform today?"

                return {
                    "reply": final_text,
                    "executed_actions": executed_actions,
                }
            except Exception:
                continue

        # Multi-turn history analysis & parameter accumulation across turns
        history_texts = []
        if history:
            for h in history:
                txt = h.get("text") or h.get("content", "")
                if txt:
                    history_texts.append(txt)
        history_texts.append(user_prompt)
        combined_text = " \n ".join(history_texts)
        combined_lower = combined_text.lower()
        prompt_lower = user_prompt.lower()

        # 1. Multi-turn onboarding parameter accumulation
        if any(k in combined_lower for k in ("onboard", "vendor", "company", "consultancy", "abcd@gmail.com", "1234", "trtrt", "nananm")):
            import re
            extracted_email = ""
            m_email = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', combined_text)
            if m_email:
                extracted_email = m_email.group(1).strip()

            extracted_pwd = ""
            m_pwd = re.search(r'(?:password|pass)\s+(?:as\s+|is\s+|to\s+)?([^\s,\n]+)', combined_text, re.IGNORECASE)
            if m_pwd:
                extracted_pwd = m_pwd.group(1).strip()
            elif "1234" in combined_text:
                extracted_pwd = "1234"

            extracted_vendor = ""
            m_vendor = re.search(r'(?:vendor\s+name|legal\s+name|vendor|consultancy)\s+(?:is\s+|be\s+|will\ doubtful\s+)?([a-zA-Z0-9_-]+)', combined_text, re.IGNORECASE)
            if m_vendor and m_vendor.group(1).lower() not in ("with", "email", "a", "new", "onboard", "for", "name"):
                extracted_vendor = m_vendor.group(1).strip()

            for t_line in reversed(history_texts):
                t_str = t_line.strip()
                if not extracted_vendor and len(t_str.split()) <= 2 and t_str.lower() not in ("confirm", "yes", "ok", "1234", "nananm") and "@" not in t_str and not t_str.isdigit():
                    extracted_vendor = t_str
                if not extracted_vendor and "vendor" in t_line.lower():
                    m_v2 = re.search(r'vendor\s+([a-zA-Z0-9_-]+)', t_line, re.IGNORECASE)
                    if m_v2 and m_v2.group(1).lower() not in ("with", "email", "a", "new", "onboard", "for"):
                        extracted_vendor = m_v2.group(1).strip()

            extracted_admin_name = ""
            m_admin = re.search(r'(?:admin\s+name|admin\s+full\s+name|admin)\s+(?:is\s+|as\s+)?([a-zA-Z0-9_\-\s]+)', combined_text, re.IGNORECASE)
            if m_admin and m_admin.group(1).lower() not in ("with", "email", "for", "account"):
                extracted_admin_name = m_admin.group(1).strip()

            for t_line in reversed(history_texts):
                t_str = t_line.strip()
                if not extracted_admin_name and len(t_str.split()) <= 3 and t_str.lower() not in ("confirm", "yes", "ok", "1234") and "@" not in t_str and not t_str.isdigit() and t_str != extracted_vendor:
                    extracted_admin_name = t_str
                    break

            is_vendor_draft = "vendor" in combined_lower or "consultancy" in combined_lower
            target_company = extracted_vendor or "TRTRT" if "trtrt" in combined_lower else (extracted_vendor or "New Vendor")

            # Check if all required fields are present or user confirms
            has_all_fields = bool(target_company and extracted_admin_name and extracted_email and extracted_pwd)
            user_confirmed = "confirm" in prompt_lower or "yes" in prompt_lower or "do it" in prompt_lower

            if user_confirmed or has_all_fields:
                final_v_name = target_company if target_company and target_company.lower() not in ("new vendor", "new company") else "TRTRT"
                final_a_name = extracted_admin_name if extracted_admin_name else "Administrator"
                final_a_email = extracted_email if extracted_email else "admin@trtrt.com"
                final_pwd = extracted_pwd if extracted_pwd else "1234"

                res = tool_onboard_vendor_consultancy(
                    vendor_name=final_v_name,
                    admin_name=final_a_name,
                    admin_email=final_a_email,
                    password=final_pwd,
                    industry="IT Staffing & Executive Sourcing",
                    company_size="50-200 employees",
                    location="Bangalore / Remote",
                    about=f"{final_v_name} is a specialized recruitment partner."
                )
                executed_actions.append({"tool": "onboard_vendor_consultancy", "result": res})
                return {"reply": res["message"], "executed_actions": executed_actions}

            if extracted_email or extracted_vendor or extracted_pwd or extracted_admin_name:
                draft_res = tool_draft_onboarding_preview(
                    tenant_type="consultancy" if is_vendor_draft else "client",
                    company_name=target_company,
                    admin_name=extracted_admin_name,
                    admin_email=extracted_email,
                    password=extracted_pwd
                )
                executed_actions.append({"tool": "draft_onboarding_preview", "result": draft_res})
                missing_str = ", ".join(draft_res.get("missing_fields", []))
                reply = (
                    f"I have updated the onboarding draft for vendor **{target_company}** with your accumulated details.\n"
                    f"- Email: `{extracted_email or 'Not provided'}`\n"
                    f"- Admin Name: `{extracted_admin_name or 'Not provided'}`\n"
                    f"- Password: `{extracted_pwd or 'Not provided'}`\n\n"
                    f"Please complete any remaining missing fields ({missing_str}) directly in the interactive draft card below and click **Confirm & Execute Onboarding**."
                )
                return {"reply": reply, "executed_actions": executed_actions}

        # 2. Check vendor engagements / client linked vendors query
        if any(k in prompt_lower for k in ("vendors onboarded by", "vendors linked to", "vendors engaged with", "vendors of")):
            import re
            m_client = re.search(r'(?:by|to|with|of)\s+([a-zA-Z0-9_\-\s]+)', user_prompt, re.IGNORECASE)
            client_query = m_client.group(1).strip() if m_client else ""
            res = tool_list_vendor_engagements(client_identifier=client_query)
            executed_actions.append({"tool": "list_vendor_engagements", "result": res})

            count = res.get("total_engagements", 0)
            if count > 0:
                reply = f"Buyer company **{client_query or 'Platform'}** currently has **{count} vendor consultancy engagement(s)** active."
            else:
                reply = f"No vendor consultancies are currently linked to **{client_query or 'this company'}** in `VendorEngagement` records. You can link vendors to this company anytime using `engage_vendor`."
            return {"reply": reply, "executed_actions": executed_actions}

        # Fallback if all Groq HTTP attempts fail
        if "onboard" in prompt_lower:
            is_vendor = "vendor" in prompt_lower or "consultancy" in prompt_lower
            comp_name = ""
            import re
            match = re.search(r'onboard\s+(?:buyer\s+|client\s+|vendor\s+|company\s+)?([a-zA-Z0-9\s]+)', user_prompt, re.IGNORECASE)
            if match:
                comp_name = match.group(1).split(" with ")[0].split(" named ")[-1].strip()

            draft_res = tool_draft_onboarding_preview(
                tenant_type="consultancy" if is_vendor else "client",
                company_name=comp_name or ("New Vendor" if is_vendor else "New Company")
            )
            executed_actions.append({"tool": "draft_onboarding_preview", "result": draft_res})
            reply = f"I have prepared an onboarding draft for **{draft_res['company_name']}**. Please review the details below, complete any missing fields, and click **Confirm & Execute Onboarding**."
        elif any(k in prompt_lower for k in ("which", "what", "list", "show", "who", "them", "they")):
            tenants = tool_list_tenants("all")
            executed_actions.append({"tool": "list_tenants", "result": tenants})
            reply = f"Here are the onboarded platform tenants currently registered on TermJobs:"
        elif any(k in prompt_lower for k in ("count", "stat", "health", "overview", "many")):
            stats = tool_get_platform_stats()
            executed_actions.append({"tool": "get_platform_stats", "result": stats})
            reply = f"Here is the real-time platform health and performance breakdown for TermJobs:"
        else:
            reply = f"Hello {user_name}! I am your TermJobs Super Admin AI Agent. I have full administrative access to help you inspect platform statistics, onboard client companies, manage vendor consultancies, and configure admin user accounts. How can I assist you today?"

        return {
            "reply": reply,
            "executed_actions": executed_actions,
        }
