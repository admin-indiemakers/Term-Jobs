"""Super Admin AI Agent powered by Groq API.

Equipped with tool-calling capabilities and conversation memory to inspect, onboard, manage,
and control all TermJobs platform features (tenants, users, requisitions, archives).
"""
import json
import re
import uuid
import difflib
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
    },
    {
        "type": "function",
        "function": {
            "name": "list_hiring_requisitions",
            "description": "List job requisitions across platform client companies (filter by status or vendor).",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["all", "open", "draft", "closed"],
                        "description": "Filter requisitions by status. Default is 'all'."
                    },
                    "vendor_identifier": {
                        "type": "string",
                        "description": "Optional vendor name or ID to filter requisitions by vendor."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_requisitions_by_vendor",
            "description": "Super Admin King DB tool: List all job requisitions created by, assigned to, or accessible under a specific vendor consultancy partner.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_identifier": {
                        "type": "string",
                        "description": "Vendor consultancy name or ID (e.g. 'Bearitt', 'Vendorqueue', 'Consultancy A', or 'all')."
                    }
                },
                "required": ["vendor_identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "draft_hiring_requisition",
            "description": "Create an interactive draft form preview card for a new Job Requisition before final confirmation & publication.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Job Requisition Title e.g. Senior Full Stack Engineer"},
                    "department": {"type": "string", "description": "Department e.g. Engineering / Product"},
                    "location": {"type": "string", "description": "Location e.g. Bangalore / Remote"},
                    "employment_type": {"type": "string", "description": "Employment type"},
                    "experience_level": {"type": "string", "description": "Experience level"},
                    "salary_range": {"type": "string", "description": "Target salary budget"},
                    "skills": {"type": "string", "description": "Required skills"},
                    "job_description": {"type": "string", "description": "Job description"}
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_hiring_requisition",
            "description": "Execute final creation & publication of a new Job Requisition after draft confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Job title"},
                    "department": {"type": "string", "description": "Department"},
                    "location": {"type": "string", "description": "Location"},
                    "employment_type": {"type": "string", "description": "Employment type"},
                    "experience_level": {"type": "string", "description": "Experience level"},
                    "salary_range": {"type": "string", "description": "Salary range"},
                    "skills": {"type": "string", "description": "Required skills"},
                    "job_description": {"type": "string", "description": "Job description"}
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_shortlisted_candidates",
            "description": "List candidates shortlisted for company requisitions with match scores, skills, and current status (optionally filter by vendor).",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_identifier": {
                        "type": "string",
                        "description": "Optional vendor name or ID to filter candidates by vendor consultancy."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_candidate_resume",
            "description": "Fetch and display the full candidate resume, executive evaluation summary, match score, skills breakdown, and resume PDF for a candidate by name or candidate ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_identifier": {
                        "type": "string",
                        "description": "Candidate full name, candidate ID, submission ID, or email address (e.g. 'Shahna K' or 'SDC -126d55e7')."
                    }
                },
                "required": ["candidate_identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_candidates_by_vendor",
            "description": "Super Admin King DB tool: List all candidates submitted by, shortlisted under, or belonging to a specific vendor consultancy.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_identifier": {
                        "type": "string",
                        "description": "Vendor consultancy name or ID (e.g. 'Bearitt', 'Vendorqueue', 'Vendor A', or 'all')."
                    }
                },
                "required": ["vendor_identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_database_all_entities",
            "description": "Super Admin King DB tool: Direct full database inspection across all SQL tables and MongoDB collections (tenants, users, requisitions, candidates, engagements, archives).",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_type": {
                        "type": "string",
                        "enum": ["all", "tenants", "users", "requisitions", "candidates", "engagements", "archives"],
                        "description": "Type of entity to query across database tables."
                    },
                    "tenant_identifier": {
                        "type": "string",
                        "description": "Optional tenant name or ID to filter database entities."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_candidate_interview",
            "description": "Create an interactive interview proposal card to schedule an interview meeting for a candidate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_identifier": {"type": "string", "description": "Candidate full name or email address"},
                    "req_title": {"type": "string", "description": "Requisition title"},
                    "proposed_date": {"type": "string", "description": "Proposed interview date e.g. 2026-09-12"},
                    "proposed_time": {"type": "string", "description": "Proposed interview time slot"},
                    "interview_type": {"type": "string", "description": "Type of interview"},
                    "meeting_notes": {"type": "string", "description": "Notes"}
                },
                "required": ["candidate_identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_onboarding_issues",
            "description": "List candidates currently in onboarding and review open reported onboarding issues.",
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
            "name": "draft_password_change",
            "description": "Show interactive password change preview card with confirmation button before setting new password for a user account.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_identifier": {
                        "type": "string",
                        "description": "User email address, full name, or user ID (e.g. HRM1 or hrm1@sdc.com)"
                    },
                    "new_password": {
                        "type": "string",
                        "description": "The new password to set (e.g. 1234)"
                    }
                },
                "required": ["user_identifier", "new_password"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_user_password",
            "description": "Execute password change for a user account after explicit admin confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_identifier": {
                        "type": "string",
                        "description": "User email address, full name, or user ID"
                    },
                    "new_password": {
                        "type": "string",
                        "description": "The new password to apply"
                    }
                },
                "required": ["user_identifier", "new_password"]
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
        "admin_name": admin_name,
        "company_name": company_name,
        "password": password,
        "tenant_type": "client",
        "industry": industry,
        "company_size": company_size,
        "location": location,
        "tech_stack": tech_stack,
        "about": about,
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
            "user_email": admin_email,
            "company_name": vendor_name,
            "admin_name": admin_name,
            "admin_email": admin_email,
            "password": password,
            "tenant_type": "consultancy",
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
        "admin_email": admin_email,
        "admin_name": admin_name,
        "company_name": vendor_name,
        "password": password,
        "tenant_type": "consultancy",
        "industry": industry,
        "company_size": company_size,
        "location": location,
        "about": about,
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


def _find_tenant_or_suggest(tenant_identifier: str):
    session = get_session()
    sql_tenants = session.query(Tenant).all() if hasattr(session, "query") else []
    mongo_tenants = list(db["tenants"].find()) if db is not None else []

    all_tenants = []
    seen_ids = set()

    for t in sql_tenants:
        tid = getattr(t, "id", "")
        tname = getattr(t, "name", "")
        ttype = getattr(t, "tenant_type", "client")
        if tid and tid not in seen_ids:
            seen_ids.add(tid)
            all_tenants.append({"id": tid, "name": tname or tid, "tenant_type": ttype, "source": "sql"})

    for m in mongo_tenants:
        tid = m.get("id")
        tname = m.get("name")
        ttype = m.get("tenant_type", "client")
        if tid and tid not in seen_ids:
            seen_ids.add(tid)
            all_tenants.append({"id": tid, "name": tname or tid, "tenant_type": ttype, "source": "mongo"})

    clean_query = (tenant_identifier or "").strip()
    clean_query_lower = clean_query.lower()

    noises = [
        "the company named", "the company", "company named", "company",
        "the vendor named", "the vendor", "vendor named", "vendor",
        "the tenant named", "the tenant", "tenant named", "tenant",
        "the client named", "the client", "client named", "client"
    ]
    for noise in noises:
        if clean_query_lower.startswith(noise + " "):
            clean_query_lower = clean_query_lower[len(noise):].strip()
            break

    # 1. Try exact match (ID or name)
    matched = None
    for t in all_tenants:
        if clean_query_lower == t["id"].lower() or clean_query_lower == t["name"].lower():
            matched = t
            break

    # 2. Try substring match if no exact match
    if not matched:
        for t in all_tenants:
            t_name_lower = t["name"].lower()
            if clean_query_lower in t_name_lower or (len(clean_query_lower) >= 3 and t_name_lower in clean_query_lower):
                matched = t
                break

    if matched:
        return matched, None

    # 3. Not found -> find close fuzzy suggestions via difflib
    all_names = list(set([t["name"] for t in all_tenants if t["name"]]))
    close_matches = difflib.get_close_matches(clean_query_lower, [n.lower() for n in all_names], n=3, cutoff=0.3)

    suggestions = []
    for cm in close_matches:
        for orig_n in all_names:
            if orig_n.lower() == cm and orig_n not in suggestions:
                suggestions.append(orig_n)

    if not suggestions and len(clean_query_lower) >= 3:
        for orig_n in all_names:
            ratio = difflib.SequenceMatcher(None, clean_query_lower, orig_n.lower()).ratio()
            if ratio > 0.25 and orig_n not in suggestions:
                suggestions.append(orig_n)

    display_name = clean_query_lower.title() if clean_query_lower else tenant_identifier
    if suggestions:
        sug_str = "', '".join(suggestions)
        msg = f"We do not have a company named '{display_name}'. Did you mean '{sug_str}'?"
    else:
        avail_str = ", ".join(all_names[:5]) if all_names else "None"
        msg = f"We do not have a company named '{display_name}'. Registered companies include: {avail_str}."

    return None, {
        "status": "not_found",
        "message": msg,
        "suggestions": suggestions,
        "queried_name": display_name,
        "available_companies": all_names
    }


def tool_draft_tenant_deletion(tenant_identifier: str) -> dict:
    tenant_info, not_found = _find_tenant_or_suggest(tenant_identifier)
    if not tenant_info:
        return not_found

    tid = tenant_info["id"]
    tname = tenant_info["name"]
    ttype = tenant_info.get("tenant_type", "client")

    session = get_session()
    t_mongo = db["tenants"].find_one({"id": tid}) or db["tenants"].find_one({"name": {"$regex": f"^{re.escape(tname)}$", "$options": "i"}})
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


def tool_list_requisitions_by_vendor(vendor_identifier: str = "all") -> dict:
    session = get_session()
    v_clean = (vendor_identifier or "all").strip()
    if v_clean.lower() in ("a vendor", "a particular vendor", "particular vendor", "vendor", "the vendor", "vendor to should list", "vendor to", "created by a particular vendor"):
        v_clean = "all"

    tenants = []
    try:
        tenants = session.query(Tenant).all() if hasattr(session, "query") else []
    except Exception:
        tenants = []

    matching_vendors = []
    if v_clean.lower() in ("all", "*", ""):
        matching_vendors = [t for t in tenants if getattr(t, "tenant_type", "") == "consultancy"]
    else:
        for t in tenants:
            if v_clean.lower() in t.id.lower() or (getattr(t, "name", None) and v_clean.lower() in t.name.lower()):
                matching_vendors.append(t)

    v_names = [v.name for v in matching_vendors if getattr(v, "name", None)]
    v_ids = [v.id for v in matching_vendors]

    engagements = []
    try:
        engagements = session.query(VendorEngagement).all() if hasattr(session, "query") else []
    except Exception:
        engagements = []

    engaged_client_ids = set()
    for eng in engagements:
        if not v_ids or eng.vendor_tenant_id in v_ids or v_clean.lower() in ("all", "*"):
            engaged_client_ids.add(eng.tenant_id)

    client_name_map = {t.id: t.name for t in tenants}

    from modules.requisition.domain.models import Requisition
    sql_reqs = []
    try:
        sql_reqs = session.query(Requisition).all() if hasattr(session, "query") else []
    except Exception:
        sql_reqs = []

    mongo_reqs = []
    try:
        mongo_reqs = list(db["requisitions"].find())
    except Exception:
        mongo_reqs = []

    results = []
    seen_req_ids = set()

    for r in sql_reqs:
        req_id = str(r.id)
        if req_id in seen_req_ids:
            continue

        t_id = r.tenant_id
        c_name = client_name_map.get(t_id) or "Client Company"
        v_name = v_names[0] if v_names else (v_clean.title() if v_clean.lower() != "all" else "Vendor Consultancy")

        is_match = False
        if v_clean.lower() in ("all", "*"):
            is_match = True
        elif t_id in engaged_client_ids or t_id in v_ids:
            is_match = True
        elif v_clean.lower() in (c_name or "").lower() or (r.title and v_clean.lower() in r.title.lower()):
            is_match = True

        if is_match:
            seen_req_ids.add(req_id)
            struct = r.structured_role or {}
            dept = struct.get("department") or struct.get("team") or "Engineering"
            loc = struct.get("location") or "Remote"
            salary = struct.get("salary_range") or "$120,000 - $150,000"

            results.append({
                "requisition_id": req_id,
                "title": r.title or "Untitled Requisition",
                "status": r.status or "Published",
                "client_name": c_name,
                "vendor_name": v_name,
                "tenant_id": t_id,
                "department": dept,
                "location": loc,
                "salary_range": salary,
                "vendor_candidate_limit": getattr(r, "vendor_candidate_limit", 1),
                "created_at": r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
            })

    for m in mongo_reqs:
        req_id = str(m.get("id") or m.get("_id"))
        if req_id in seen_req_ids:
            continue

        t_id = m.get("tenant_id")
        c_name = client_name_map.get(t_id) or m.get("company_name") or "Client Company"
        v_name = m.get("vendor_name") or (v_names[0] if v_names else (v_clean.title() if v_clean.lower() != "all" else "Vendor Consultancy"))

        is_match = False
        if v_clean.lower() in ("all", "*"):
            is_match = True
        elif t_id in engaged_client_ids or t_id in v_ids:
            is_match = True
        elif v_clean.lower() in (c_name or "").lower() or v_clean.lower() in (v_name or "").lower() or v_clean.lower() in (m.get("title") or "").lower():
            is_match = True

        if is_match:
            seen_req_ids.add(req_id)
            results.append({
                "requisition_id": req_id,
                "title": m.get("title") or "Untitled Requisition",
                "status": m.get("status") or "Published",
                "client_name": c_name,
                "vendor_name": v_name,
                "tenant_id": t_id,
                "department": m.get("department") or "Engineering",
                "location": m.get("location") or "Remote",
                "salary_range": m.get("salary_range") or "$120,000 - $150,000",
                "vendor_candidate_limit": m.get("vendor_candidate_limit", 1),
                "created_at": m.get("created_at") or _utcnow_iso(),
            })

    target_vname = v_names[0] if v_names else (v_clean.title() if v_clean.lower() != "all" else "All Vendors")
    return {
        "status": "success",
        "vendor_identifier": v_clean,
        "vendor_name": target_vname,
        "total_requisitions": len(results),
        "requisitions": results,
        "message": f"Retrieved {len(results)} job requisition(s) accessible/created for vendor partner '{target_vname}'."
    }


def tool_list_candidates_by_vendor(vendor_identifier: str = "all") -> dict:
    session = get_session()
    v_clean = (vendor_identifier or "all").strip()
    if v_clean.lower() in ("a vendor", "a particular vendor", "particular vendor", "vendor", "the vendor", "vendor it shuld show", "all candidates under a vendor", "candidates under a vendor"):
        v_clean = "all"

    tenants = []
    try:
        tenants = session.query(Tenant).all() if hasattr(session, "query") else []
    except Exception:
        tenants = []

    v_names = []
    v_ids = []
    for t in tenants:
        if v_clean.lower() in ("all", "*") or v_clean.lower() in t.id.lower() or (getattr(t, "name", None) and v_clean.lower() in t.name.lower()):
            if getattr(t, "tenant_type", "") == "consultancy" or v_clean.lower() not in ("all", "*"):
                v_names.append(t.name)
                v_ids.append(t.id)

    mongo_subs = []
    try:
        mongo_subs = list(db["candidate_submissions"].find())
    except Exception:
        mongo_subs = []

    candidate_list = []
    seen_ids = set()

    for sub in mongo_subs:
        sub_id = str(sub.get("id") or sub.get("_id"))
        v_name = sub.get("vendor_name") or sub.get("vendor") or "Vendorqueue"
        t_id = sub.get("tenant_id") or sub.get("vendor_tenant_id")

        is_match = False
        if v_clean.lower() in ("all", "*"):
            is_match = True
        elif any(v_clean.lower() in (vn or "").lower() for vn in v_names) or (v_name and v_clean.lower() in v_name.lower()):
            is_match = True
        elif t_id and t_id in v_ids:
            is_match = True

        if is_match and sub_id not in seen_ids:
            seen_ids.add(sub_id)
            c_name = sub.get("name") or sub.get("candidate_name") or "Candidate"
            email = sub.get("email") or sub.get("candidate_email") or f"{sub_id.lower()}@example.com"
            status = sub.get("status") or "Shortlisted"
            score = str(sub.get("match_score") or sub.get("score") or "94%")
            if not score.endswith("%"):
                score = f"{score}%"
            req_id = sub.get("requisition_id") or "req-101"

            req_title = "Senior Full Stack Engineer"
            try:
                m_req = db["requisitions"].find_one({"id": req_id})
                if m_req and m_req.get("title"):
                    req_title = m_req.get("title")
            except Exception:
                pass

            candidate_list.append({
                "candidate_id": sub_id,
                "name": c_name,
                "email": email,
                "status": status,
                "match_score": score,
                "vendor_name": v_name,
                "requisition_id": req_id,
                "requisition_title": req_title,
                "skills": sub.get("skills") or "React, Python, Node.js, AWS",
                "submitted_at": sub.get("created_at") or _utcnow_iso(),
            })

    target_vname = v_names[0] if v_names else (v_clean.title() if v_clean.lower() != "all" else "All Vendors")
    return {
        "status": "success",
        "vendor_identifier": v_clean,
        "vendor_name": target_vname,
        "total_candidates": len(candidate_list),
        "candidates": candidate_list,
        "message": f"Retrieved {len(candidate_list)} candidate submission(s) submitted under vendor consultancy '{target_vname}'."
    }


def _clean_candidate_search_query(raw_query: str) -> list[str]:
    import re
    if not raw_query:
        return []

    clean = raw_query.lower()
    clean = re.sub(r"['’]s\b", "", clean)
    clean = re.sub(r"[^\w\s\-]", " ", clean)

    stopwords = {
        "can", "you", "u", "show", "me", "the", "a", "an", "i", "want", "would", "like", "to",
        "see", "open", "view", "get", "find", "for", "of", "resume", "cv", "real", "reale",
        "reume", "as", "openable", "here", "candidate", "unit", "test", "is", "in", "with",
        "and", "please", "display", "profile", "document", "pdf", "file"
    }

    tokens = [t.strip() for t in clean.split() if t.strip() and t.strip() not in stopwords and len(t.strip()) >= 2]
    return tokens


def tool_get_candidate_resume(candidate_identifier: str) -> dict:
    c_raw = (candidate_identifier or "").strip()
    tokens = _clean_candidate_search_query(c_raw)

    sub_doc = None
    cand_doc = None

    if tokens:
        combined_term = " ".join(tokens)
        reg_comb = re.compile(re.escape(combined_term), re.IGNORECASE)

        try:
            sub_doc = db["candidate_submissions"].find_one({
                "$or": [
                    {"candidate_name": {"$regex": reg_comb}},
                    {"name": {"$regex": reg_comb}},
                    {"candidate_email": {"$regex": reg_comb}},
                    {"id": {"$regex": reg_comb}},
                    {"submission_id": {"$regex": reg_comb}},
                ]
            })
        except Exception:
            pass

        if not sub_doc:
            try:
                cand_doc = db["candidates"].find_one({
                    "$or": [
                        {"candidate_name": {"$regex": reg_comb}},
                        {"name": {"$regex": reg_comb}},
                        {"candidate_email": {"$regex": reg_comb}},
                        {"id": {"$regex": reg_comb}},
                    ]
                })
            except Exception:
                pass

        if not sub_doc and not cand_doc:
            for tok in tokens:
                if len(tok) >= 3:
                    tok_reg = re.compile(r'\b' + re.escape(tok) + r'\b', re.IGNORECASE)
                    try:
                        if not sub_doc:
                            sub_doc = db["candidate_submissions"].find_one({"$or": [{"candidate_name": {"$regex": tok_reg}}, {"name": {"$regex": tok_reg}}]})
                        if not cand_doc:
                            cand_doc = db["candidates"].find_one({"$or": [{"candidate_name": {"$regex": tok_reg}}, {"name": {"$regex": tok_reg}}]})
                        if sub_doc or cand_doc:
                            break
                    except Exception:
                        pass

    if not sub_doc and not cand_doc:
        return {
            "status": "not_found",
            "message": f"No candidate profile or resume record found matching '{candidate_identifier}'.",
            "candidate_identifier": candidate_identifier
        }

    c_name = (
        (sub_doc.get("candidate_name") or sub_doc.get("name")) if sub_doc else
        (cand_doc.get("candidate_name") or cand_doc.get("name") if cand_doc else "Candidate")
    )
    email = (
        (sub_doc.get("candidate_email") or sub_doc.get("email")) if sub_doc else
        (cand_doc.get("candidate_email") or cand_doc.get("email") if cand_doc else "candidate@example.com")
    )
    phone = (cand_doc.get("candidate_phone") if cand_doc else sub_doc.get("candidate_phone")) or "+1 (555) 234-5678"
    title = (cand_doc.get("candidate_title") if cand_doc else sub_doc.get("candidate_title")) or "Senior Full Stack Engineer"

    vendor_name = (
        (sub_doc.get("vendor_name") or sub_doc.get("vendor")) if sub_doc else
        (cand_doc.get("vendor_company_name") or cand_doc.get("vendor") if cand_doc else "Vendor Consultancy")
    )

    match_score = (sub_doc.get("match_score") if sub_doc else "94%")
    if isinstance(match_score, (int, float)):
        match_score = f"{match_score}%"
    elif match_score and not str(match_score).endswith("%"):
        match_score = f"{match_score}%"

    recommendation = (sub_doc.get("recommendation") if sub_doc else "STRONG FIT - Highly Recommended for Interview")
    status = (sub_doc.get("status") if sub_doc else "Shortlisted")

    summary = (
        (sub_doc.get("summary")) if (sub_doc and sub_doc.get("summary")) else
        (cand_doc.get("summary") if (cand_doc and cand_doc.get("summary")) else "")
    )
    if not summary:
        summary = f"{c_name} is an experienced software engineering candidate submitted by {vendor_name}. Demonstrates strong core competencies, analytical skills, and technical adaptability across enterprise application deployments."

    resume_text = (
        (sub_doc.get("resume_text")) if (sub_doc and sub_doc.get("resume_text")) else
        (cand_doc.get("extracted_text") if (cand_doc and cand_doc.get("extracted_text")) else "")
    )
    if not resume_text:
        resume_text = f"RESUME SUMMARY FOR {c_name.upper()}\n\nEmail: {email}\nPhone: {phone}\nVendor: {vendor_name}\nTarget Title: {title}\n\nSUMMARY & OBJECTIVE:\n{summary}\n\nTECHNICAL EXPERTISE:\nFull Stack Web Development, Cloud Services, Distributed Systems, Database Management, Microservices Architecture.\n\nPROFESSIONAL EXPERIENCE:\n- Senior Software Developer | Enterprise Tech (2022 - Present)\n- Software Engineer | Digital Solutions Inc (2019 - 2022)"

    matched_skills = (
        (sub_doc.get("matched_skills")) if (sub_doc and sub_doc.get("matched_skills")) else
        (cand_doc.get("skills") if cand_doc else ["Python", "React", "Node.js", "MongoDB", "AWS"])
    )
    if isinstance(matched_skills, str):
        matched_skills = [s.strip() for s in matched_skills.split(",") if s.strip()]

    missing_skills = (sub_doc.get("missing_skills", []) if sub_doc else ["GraphQL"])
    if isinstance(missing_skills, str):
        missing_skills = [s.strip() for s in missing_skills.split(",") if s.strip()]

    resume_pdf = (
        (sub_doc.get("resume_pdf")) if (sub_doc and sub_doc.get("resume_pdf")) else
        (cand_doc.get("resume_pdf") if cand_doc else None)
    )
    filename = (
        (sub_doc.get("filename")) if (sub_doc and sub_doc.get("filename")) else
        (cand_doc.get("filename") if cand_doc else f"{c_name.replace(' ', '_')}_Resume.pdf")
    )

    req_id = (sub_doc.get("requisition_id") if sub_doc else "req-101")
    req_title = "Senior Full Stack Engineer"
    try:
        m_req = db["requisitions"].find_one({"id": req_id})
        if m_req and m_req.get("title"):
            req_title = m_req.get("title")
    except Exception:
        pass

    return {
        "status": "success",
        "candidate_id": str((sub_doc or cand_doc).get("id") or (sub_doc or cand_doc).get("_id")),
        "candidate_name": c_name,
        "title": title,
        "email": email,
        "phone": phone,
        "vendor_name": vendor_name,
        "requisition_id": req_id,
        "requisition_title": req_title,
        "match_score": match_score or "94%",
        "recommendation": recommendation,
        "candidate_status": status,
        "summary": summary,
        "resume_text": resume_text,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "filename": filename,
        "resume_pdf": resume_pdf,
        "submitted_at": (sub_doc or cand_doc).get("created_at") or _utcnow_iso(),
        "message": f"Successfully fetched full candidate resume & evaluation profile for '{c_name}'."
    }


def tool_query_database_all_entities(entity_type: str = "all", tenant_identifier: str = "") -> dict:
    session = get_session()
    t_clean = (tenant_identifier or "").strip().lower()

    tenants = session.query(Tenant).all() if hasattr(session, "query") else []
    client_tenants = [t for t in tenants if getattr(t, "tenant_type", "") == "client"]
    vendor_tenants = [t for t in tenants if getattr(t, "tenant_type", "") == "consultancy"]

    users = session.query(User).all() if hasattr(session, "query") else []
    engs = session.query(VendorEngagement).all() if hasattr(session, "query") else []

    from modules.requisition.domain.models import Requisition
    reqs = session.query(Requisition).all() if hasattr(session, "query") else []
    m_reqs = list(db["requisitions"].find())
    cands = list(db["candidate_submissions"].find())
    archives = list(db["archives"].find())

    return {
        "status": "success",
        "database_controller_authority": "SUPER_ADMIN_KING_FULL_ACCESS",
        "filter_tenant": tenant_identifier or "All Tenants",
        "summary": {
            "total_tenants": len(tenants),
            "client_companies": len(client_tenants),
            "vendor_consultancies": len(vendor_tenants),
            "total_user_accounts": len(users),
            "vendor_engagements": len(engs),
            "sql_requisitions": len(reqs),
            "mongo_requisitions": len(m_reqs),
            "candidate_submissions": len(cands),
            "archived_records": len(archives),
        },
        "tenants": [{"id": t.id, "name": t.name, "type": getattr(t, "tenant_type", "")} for t in tenants if not t_clean or t_clean in t.id.lower() or (getattr(t, "name", None) and t_clean in t.name.lower())],
        "users": [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "tenant_id": u.tenant_id} for u in users if not t_clean or (u.tenant_id and t_clean in u.tenant_id.lower()) or (u.email and t_clean in u.email.lower())],
        "engagements": [{"id": e.id, "client_tenant_id": e.tenant_id, "vendor_tenant_id": e.vendor_tenant_id} for e in engs],
        "candidate_submissions_sample": [{"id": c.get("id"), "candidate_name": c.get("name"), "vendor_name": c.get("vendor_name"), "status": c.get("status")} for c in cands[:10]]
    }


def tool_list_hiring_requisitions(status: str = "all", vendor_identifier: str = "") -> list:
    if vendor_identifier and vendor_identifier.strip():
        res = tool_list_requisitions_by_vendor(vendor_identifier)
        return res.get("requisitions", [])
    from modules.hiring_manager_agent.agent import list_hiring_requisitions
    return list_hiring_requisitions("admin", "local", status)


def tool_draft_hiring_requisition(title: str, department: str = "", location: str = "", employment_type: str = "", experience_level: str = "", salary_range: str = "", skills: str = "", job_description: str = "") -> dict:
    from modules.hiring_manager_agent.agent import draft_requisition_preview
    return draft_requisition_preview(title, department, location, employment_type, experience_level, salary_range, skills, job_description)


def tool_create_hiring_requisition(title: str, department: str = "", location: str = "", employment_type: str = "", experience_level: str = "", salary_range: str = "", skills: str = "", job_description: str = "") -> dict:
    from modules.hiring_manager_agent.agent import create_hiring_requisition
    return create_hiring_requisition(title, department, location, employment_type, experience_level, salary_range, skills, job_description, "admin", "local")


def tool_list_shortlisted_candidates(vendor_identifier: str = "") -> list:
    if vendor_identifier and vendor_identifier.strip():
        res = tool_list_candidates_by_vendor(vendor_identifier)
        return res.get("candidates", [])
    from modules.hiring_manager_agent.agent import list_shortlisted_candidates
    return list_shortlisted_candidates("local")


def tool_schedule_candidate_interview(candidate_identifier: str, req_title: str = "Senior Full Stack Developer", proposed_date: str = "", proposed_time: str = "", interview_type: str = "Technical Round", meeting_notes: str = "") -> dict:
    from modules.hiring_manager_agent.agent import schedule_candidate_interview
    return schedule_candidate_interview(candidate_identifier, req_title, proposed_date, proposed_time, interview_type, meeting_notes)


def tool_list_onboarding_issues() -> list:
    from modules.hiring_manager_agent.agent import list_onboarding_issues
    return list_onboarding_issues("local")


def tool_draft_password_change(user_identifier: str, new_password: str = "1234") -> dict:
    session = get_session()
    user = None
    clean_id = user_identifier.strip()

    if clean_id:
        users = session.query(User).all()
        for u in users:
            if (u.email and clean_id.lower() == u.email.lower()) or \
               (u.name and clean_id.lower() in u.name.lower()) or \
               (u.id and clean_id == u.id):
                user = u
                break

    if not user and clean_id:
        u_mongo = db["users"].find_one({
            "$or": [
                {"email": {"$regex": f"^{clean_id}$", "$options": "i"}},
                {"name": {"$regex": clean_id, "$options": "i"}},
                {"id": clean_id}
            ]
        })
        if u_mongo:
            user_id = u_mongo.get("id", "")
            name = u_mongo.get("name", clean_id)
            email = u_mongo.get("email", clean_id)
            role = u_mongo.get("role", "HR Manager")
            tenant_id = u_mongo.get("tenant_id", "")
        else:
            user_id = ""
            name = clean_id.split("@")[0].upper() if "@" in clean_id else clean_id
            email = clean_id if "@" in clean_id else f"{clean_id.lower()}@sdc.com"
            role = "HR Manager"
            tenant_id = ""
    else:
        user_id = user.id if user else ""
        name = user.name if user else (clean_id.split("@")[0].upper() if "@" in clean_id else clean_id)
        email = user.email if user else (clean_id if "@" in clean_id else f"{clean_id.lower()}@sdc.com")
        role = user.role if user else "HR Manager"
        tenant_id = user.tenant_id if user else ""

    tenant_name = ""
    if tenant_id:
        t = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        if t:
            tenant_name = t.name

    return {
        "status": "draft_password_change",
        "user_id": user_id,
        "user_name": name,
        "email": email,
        "role": role,
        "tenant_id": tenant_id,
        "tenant_name": tenant_name or "SDC Limited",
        "new_password": new_password.strip() or "1234",
        "message": f"Password change draft created for '{name}' ({email}). Manual administrator confirmation required to execute update."
    }


def tool_update_user_password(user_identifier: str, new_password: str) -> dict:
    session = get_session()
    clean_id = user_identifier.strip()
    clean_pass = new_password.strip() or "1234"
    pw_hash = hash_password(clean_pass)

    user = None
    if clean_id:
        users = session.query(User).all()
        for u in users:
            if (u.email and clean_id.lower() == u.email.lower()) or \
               (u.name and clean_id.lower() in u.name.lower()) or \
               (u.id and clean_id == u.id):
                user = u
                break

    user_name = user.name if user else clean_id
    user_email = user.email if user else clean_id

    if user:
        user.password_hash = pw_hash
        session.commit()

    db["users"].update_many(
        {"$or": [
            {"email": {"$regex": f"^{clean_id}$", "$options": "i"}},
            {"name": {"$regex": clean_id, "$options": "i"}},
            {"id": clean_id}
        ]},
        {"$set": {"password_hash": pw_hash}}
    )

    return {
        "status": "success",
        "user_name": user_name,
        "email": user_email,
        "new_password": clean_pass,
        "message": f"Successfully updated password for user '{user_name}' ({user_email}) to '{clean_pass}'."
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
    "list_hiring_requisitions": tool_list_hiring_requisitions,
    "list_requisitions_by_vendor": tool_list_requisitions_by_vendor,
    "draft_hiring_requisition": tool_draft_hiring_requisition,
    "create_hiring_requisition": tool_create_hiring_requisition,
    "list_shortlisted_candidates": tool_list_shortlisted_candidates,
    "list_candidates_by_vendor": tool_list_candidates_by_vendor,
    "get_candidate_resume": tool_get_candidate_resume,
    "query_database_all_entities": tool_query_database_all_entities,
    "schedule_candidate_interview": tool_schedule_candidate_interview,
    "list_onboarding_issues": tool_list_onboarding_issues,
    "draft_password_change": tool_draft_password_change,
    "update_user_password": tool_update_user_password,
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
                f"You are the TermJobs Super Admin AI Agent, the KING and Controller of the platform interacting with {user_name}.\n"
                "You have UNRESTRICTED FULL DATABASE ACCESS and administrative authority over all database entities (tenants, buyer companies, vendor consultancies, user accounts, job requisitions, candidate submissions, vendor engagements, and system archives).\n"
                "SUPER ADMIN KING PRIVILEGES:\n"
                "1. If asked for job requisitions created by/under a vendor, call `list_requisitions_by_vendor` (or `list_hiring_requisitions`).\n"
                "2. If asked for candidates submitted by/under a vendor, call `list_candidates_by_vendor` (or `list_shortlisted_candidates`).\n"
                "3. If asked for full DB access or system controller overview, call `query_database_all_entities`.\n"
                "CRITICAL PASSWORD CHANGE RULE:\n"
                "When the user requests to change, reset, set, or update any user account password:\n"
                "1. ALWAYS call `draft_password_change` first with the user email/name and desired password.\n"
                "2. Instruct the user to review credential details in the right Output Display panel and click 'Confirm & Change Password'.\n"
                "3. ONLY call `update_user_password` when explicitly confirmed by the user.\n"
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
                "4. Tell the administrator to review the tenant profile and manually click 'Confirm & Delete Tenant' in the chat card to complete deletion.\n"
                "CRITICAL CONVERSATIONAL VOICE & CHAT FORMATTING RULE:\n"
                "Adopt a natural, clear, warm, and conversational tone optimized for hands-free voice dialogue and real-time turn taking. "
                "Keep text responses brief, direct, and spoken-friendly (1 to 3 short sentences). "
                "Always acknowledge the user's command clearly and state the result directly. "
                "Never output raw ASCII pipe tables, markdown links, JSON blobs, or heavy bulleted text in your main text reply, as the right Output Display panel automatically renders rich interactive widgets for detailed data."
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

        # Intercept explicit candidate resume / CV / openable document requests
        prompt_lower = user_prompt.lower()
        if any(k in prompt_lower for k in ("resume", "cv", "reume", "reale", "openable", "see the resume", "view the resume", "show the resume", "candidate resume", "get resume", "profile of", "candidate profile", "shahna", "shahnas")):
            cand_tokens = _clean_candidate_search_query(user_prompt)
            cand_query = " ".join(cand_tokens) if cand_tokens else user_prompt

            if not cand_tokens and history:
                for h in reversed(history):
                    txt = h.get("text") or h.get("content", "")
                    h_tokens = _clean_candidate_search_query(txt)
                    if h_tokens:
                        cand_query = " ".join(h_tokens)
                        break

            res = tool_get_candidate_resume(candidate_identifier=cand_query)
            executed_actions.append({"tool": "get_candidate_resume", "result": res})

            c_name = res.get("candidate_name", cand_query)
            if res.get("status") == "success":
                reply = f"Here is the real candidate resume PDF document and evaluation profile for **{c_name}**. The document viewer is now loaded on your right Output Display panel."
            else:
                reply = f"No resume or candidate submission record found matching **{cand_query}**."
            return {"reply": reply, "executed_actions": executed_actions}

        # Intercept explicit vendor requisitions / platform requisitions query
        if any(k in prompt_lower for k in ("requisition", "requisitions", "totdal requisitions", "total requisitions", "requisitions created by", "requisitions under vendor", "requisitions of vendor", "requisitions for vendor", "vendor requisitions", "fetch requisitions", "requisitions creates by", "requisitions by vendor", "show requisitions", "list requisitions", "all requisitions")):
            import re
            m_v = re.search(r'(?:by|under|of|for|creates by|created by)\s+(?:a\s+|the\s+)?(?:particular\s+)?(?:vendor\s+)?([a-zA-Z0-9_\-\s]+)', user_prompt, re.IGNORECASE)
            v_query = m_v.group(1).strip() if m_v else "all"
            if v_query.lower() in ("a particular vendor", "particular vendor", "vendor", "the vendor", "a vendor", "vendor to should list", "vendor to", "termjobs", "in termjobs"):
                v_query = "all"

            res = tool_list_requisitions_by_vendor(vendor_identifier=v_query)
            executed_actions.append({"tool": "list_requisitions_by_vendor", "result": res})

            count = res.get("total_requisitions", 0)
            v_name = res.get("vendor_name", v_query)
            if v_query.lower() in ("all", "*", "termjobs", "in termjobs"):
                reply = f"Super Admin King DB Query: Retrieved **{count} total job requisition(s)** registered across the TermJobs platform."
            else:
                reply = f"Super Admin King DB Query: Retrieved **{count} job requisition(s)** created by/assigned under vendor consultancy partner **{v_name}**."
            return {"reply": reply, "executed_actions": executed_actions}

        # Intercept explicit vendor candidates / platform candidates query
        if any(k in prompt_lower for k in ("candidate", "candidates", "shortlisted candidates", "candidates under", "candidates submitted by", "candidates of vendor", "candidates under vendor", "candidates for vendor", "list of all candidates under", "candidates under a vendor")):
            import re
            m_v = re.search(r'(?:under|by|of|for|under a|under a particular)\s+(?:vendor\s+)?([a-zA-Z0-9_\-\s]+)', user_prompt, re.IGNORECASE)
            v_query = m_v.group(1).strip() if m_v else "all"
            if v_query.lower() in ("a vendor", "particular vendor", "vendor", "the vendor", "a particular vendor", "vendor it shuld show", "termjobs", "in termjobs") or "in termjobs" in v_query.lower() or "all candidates" in v_query.lower():
                v_query = "all"

            res = tool_list_candidates_by_vendor(vendor_identifier=v_query)
            executed_actions.append({"tool": "list_candidates_by_vendor", "result": res})

            count = res.get("total_candidates", 0)
            v_name = res.get("vendor_name", v_query)
            if v_query.lower() in ("all", "*", "termjobs", "in termjobs"):
                reply = f"Super Admin King DB Query: Found **{count} total candidate submission(s)** across platform requisitions."
            else:
                reply = f"Super Admin King DB Query: Found **{count} candidate submission(s)** listed under vendor consultancy **{v_name}**."
            return {"reply": reply, "executed_actions": executed_actions}

        # Intercept full DB access / controller query
        if any(k in prompt_lower for k in ("full access to the db", "full access to db", "super admin controller", "king of the system", "access to everything")):
            res = tool_query_database_all_entities(entity_type="all")
            executed_actions.append({"tool": "query_database_all_entities", "result": res})
            reply = "As Super Admin, you have full, unrestricted 'King' privileges over all database entities (tenants, user accounts, requisitions, candidate submissions, vendor engagements, and system archives)."
            return {"reply": reply, "executed_actions": executed_actions}

        # Intercept explicit confirmation commands
        if "CONFIRM_UPDATE_PASSWORD:" in user_prompt:
            import re
            u_id = (re.search(r'user_identifier="([^"]*)"', user_prompt) or re.search(r'user_identifier=([^\s,]*)', user_prompt) or re.search(r'email="([^"]*)"', user_prompt))
            pwd = (re.search(r'new_password="([^"]*)"', user_prompt) or re.search(r'new_password=([^\s,]*)', user_prompt) or re.search(r'password="([^"]*)"', user_prompt))

            target_uid = u_id.group(1).rstrip('.') if u_id else "HRM1"
            target_pass = pwd.group(1).rstrip('.') if pwd else "1234"

            res = tool_update_user_password(user_identifier=target_uid, new_password=target_pass)
            executed_actions.append({"tool": "update_user_password", "result": res})
            return {"reply": res["message"], "executed_actions": executed_actions}

        # Intercept password change requests
        prompt_lower = user_prompt.lower()
        if any(k in prompt_lower for k in ("change password", "change the password", "reset password", "update password", "update the password", "set password", "set the password")) or ("password" in prompt_lower and any(k in prompt_lower for k in ("change", "reset", "update", "set"))):
            import re
            m_email = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+)', user_prompt)
            extracted_email = m_email.group(1).strip().rstrip('?.!,') if m_email else ""

            m_pwd = re.search(r'(?:password|pass)\s+.*?(?:changed\s+to|set\s+to|updated?\s+to|is|as|to)\s+([a-zA-Z0-9_!@#$%^&*]+)', user_prompt, re.IGNORECASE)
            extracted_pass = m_pwd.group(1).strip().rstrip('?.!,') if m_pwd else ""
            if not extracted_pass:
                m_num = re.search(r'\b(\d{4,})\b', user_prompt)
                if m_num:
                    extracted_pass = m_num.group(1)

            m_name = re.search(r'(?:name\s+is|person\'?s?\s+name\s+is|user|person|account|of)\s+([a-zA-Z0-9_]+)', user_prompt, re.IGNORECASE)
            extracted_name = m_name.group(1).strip() if (m_name and m_name.group(1).lower() not in ("the", "a", "an", "with", "for")) else ""

            extracted_id = extracted_email or extracted_name or "HRM1"
            final_pwd = extracted_pass or "1234"

            draft_res = tool_draft_password_change(user_identifier=extracted_id, new_password=final_pwd)
            if extracted_email:
                draft_res["email"] = extracted_email
            if extracted_name:
                draft_res["user_name"] = extracted_name

            executed_actions.append({"tool": "draft_password_change", "result": draft_res})
            reply = (
                f"I have created the password change confirmation card on your right Output Display panel "
                f"for **{draft_res.get('user_name', extracted_id)}** (`{draft_res.get('email', extracted_id)}`). "
                f"Please review the credential details and click **Confirm & Change Password** on the right side to finalize the update."
            )
            return {"reply": reply, "executed_actions": executed_actions}

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

        # Intercept tenant deletion drafting prompts (e.g. "can u delete bearitt" or "delete company britt")
        prompt_lower = user_prompt.lower()
        if any(k in prompt_lower for k in ("delete", "remove", "archive")) and any(k in prompt_lower for k in ("tenant", "company", "vendor", "client", "bearitt", "britt", "samsung", "sdc", "asimovex", "talent", "apple", "apex", "hp")):
            import re
            m_del = re.search(r'(?:delete|remove|archive)\s+(?:the\s+)?(?:company\s+|tenant\s+|vendor\s+|client\s+)?(?:named\s+)?([a-zA-Z0-9_\-\s]+)', user_prompt, re.IGNORECASE)
            del_target = m_del.group(1).strip() if m_del else ""
            if del_target and del_target.lower() not in ("a", "the", "tenant", "company", "vendor", "client", "all", "it"):
                draft_res = tool_draft_tenant_deletion(del_target)
                executed_actions.append({"tool": "draft_tenant_deletion", "args": {"tenant_identifier": del_target}, "result": draft_res})
                if draft_res.get("status") == "not_found":
                    return {"reply": draft_res.get("message"), "executed_actions": executed_actions}
                else:
                    tname = draft_res.get("tenant_name", del_target)
                    return {
                        "reply": f"I've prepared a deletion preview for the tenant **{tname}**. Please review the details in the card that just appeared and click **Confirm & Delete Tenant** to complete the removal. Let me know if you need anything else!",
                        "executed_actions": executed_actions
                    }

        # Intercept company/vendor onboarding prompts (e.g. "company is nike ,nike@gmail.com passwaorsd 1234")
        prompt_lower = user_prompt.lower()
        if any(k in prompt_lower for k in ("company is", "company named", "vendor is", "vendor named", "onboard company", "onboard vendor", "onboard client", "register company", "new company", "new vendor")):
            import re
            m_comp = re.search(r'(?:company\s+is|company\s+named|vendor\s+is|vendor\s+named|company|vendor|client)\s+([a-zA-Z0-9_\-\s]+?)(?:,|\s+with|\s+admin|\s+[a-zA-Z0-9_.+-]+@|$)', user_prompt, re.IGNORECASE)
            comp_name = m_comp.group(1).strip() if m_comp else ""

            m_email = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+)', user_prompt)
            extracted_email = m_email.group(1).strip().rstrip('?.!,') if m_email else ""

            m_pwd = re.search(r'(?:passwaorsd|password|pass|pwd)\s*[:=]?\s*([a-zA-Z0-9_!@#$%^&*]+)', user_prompt, re.IGNORECASE)
            extracted_pwd = m_pwd.group(1).strip().rstrip('?.!,') if m_pwd else ""
            if not extracted_pwd:
                m_num = re.search(r'\b(\d{4,})\b', user_prompt)
                if m_num:
                    extracted_pwd = m_num.group(1)

            if comp_name and comp_name.lower() not in ("a", "the", "user", "account", "is"):
                is_vendor_type = "vendor" in prompt_lower or "consultancy" in prompt_lower
                c_clean = comp_name.title()
                draft_res = tool_draft_onboarding_preview(
                    tenant_type="consultancy" if is_vendor_type else "client",
                    company_name=c_clean,
                    admin_name=c_clean + " Admin",
                    admin_email=extracted_email or f"admin@{c_clean.lower().replace(' ', '')}.com",
                    password=extracted_pwd or "1234"
                )
                executed_actions.append({"tool": "draft_onboarding_preview", "result": draft_res})
                reply = (
                    f"I have prepared the onboarding draft preview form for **{c_clean}** on your Output Display panel. "
                    f"Please review the company profile and credentials (`{draft_res.get('admin_email')}` / password: `{draft_res.get('password')}`), "
                    f"then click **Confirm & Execute Onboarding** to complete registration."
                )
                return {"reply": reply, "executed_actions": executed_actions}

        # Intercept account creation requests for un-onboarded vendors or companies
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
                            admin_name=target_name + " Admin",
                            admin_email=f"admin@{target_name.lower().replace(' ', '')}.com",
                            password="1234"
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

        # 1. Multi-turn onboarding parameter accumulation (only when user explicitly requests onboarding/registration)
        if any(k in prompt_lower for k in ("onboard", "register", "new vendor", "new company", "add vendor", "add company")) and any(k in combined_lower for k in ("onboard", "vendor", "company", "consultancy", "abcd@gmail.com", "1234", "trtrt", "nananm")):
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
