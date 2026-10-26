"""Authorized TermJobs Knowledge and Policy Retrieval Repository.

Provides structured access to company hiring policies, playbooks, guidelines,
and interview governance for knowledge-retrieval and hybrid query answering.
"""
import re
from typing import Any, Dict, List, Optional

AUTHORIZED_KNOWLEDGE_DOCS = [
    {
        "id": "policy_employment_model",
        "title": "TermJobs Employment Model & Engagement Policy",
        "category": "employment_policy",
        "keywords": ["employment", "contract", "full-time", "permanent", "vendor", "agency", "duration"],
        "content": (
            "TermJobs operates exclusively on a contract staffing model. All requisitions and placements "
            "are structured as contract engagements (e.g. Contract 3 Months, 6 Months, or 12 Months). "
            "Permanent and direct full-time employment contracts are strictly not supported on the platform. "
            "All candidate talent is sourced and submitted through approved partner staffing agencies and vendors."
        ),
        "source": "TermJobs Operating Policy §1.1"
    },
    {
        "id": "policy_requisition_governance",
        "title": "Job Requisition Creation & Director Approval Governance",
        "category": "requisition_policy",
        "keywords": ["requisition", "create", "draft", "publish", "director", "approval", "headcount", "openings"],
        "content": (
            "Hiring Managers have authority to draft custom requisitions, specify required tech stacks, "
            "adjust headcount/openings, and configure target salary budgets. However, direct public posting "
            "or vendor dispatch by a Hiring Manager is strictly forbidden. Every job requisition requires "
            "mandatory Director Approval before becoming active and being dispatched to recruitment agencies."
        ),
        "source": "TermJobs Governance Framework §2.3"
    },
    {
        "id": "policy_interview_scheduling",
        "title": "Interview Scheduling, Rounds & Assessment Policy",
        "category": "interview_policy",
        "keywords": ["interview", "schedule", "calendar", "round", "rubric", "video", "technical", "assessment"],
        "content": (
            "Interviews can be proposed directly from chat or requisition cards. The standard interview sequence "
            "includes: 1) Initial Screening, 2) Technical Round / Coding Assessment, 3) System Architecture / Cultural Fit, "
            "and 4) Director Final Sign-off. Integrated Google Calendar synchronizes manager availability, "
            "and candidate video links are automatically generated upon dispatch."
        ),
        "source": "TermJobs Interview Playbook §4.0"
    },
    {
        "id": "policy_timesheet_expense",
        "title": "Contractor Timesheet & Expense Reimbursement Policy",
        "category": "timesheet_expense_policy",
        "keywords": ["timesheet", "expense", "hours", "reimbursement", "approval", "contractor", "billing"],
        "content": (
            "Contractors log billable hours weekly for approved work orders. Hiring Managers must review and "
            "approve or reject submitted timesheets weekly. Expense reimbursement claims require itemized receipts "
            "and project attribution. Approved timesheets and expenses are routed to Finance for billing and invoice settlement."
        ),
        "source": "Workforce & Billing Regulations §5.2"
    },
    {
        "id": "policy_onboarding_offboarding",
        "title": "Contractor Onboarding, Compliance & Offboarding Policy",
        "category": "onboarding_policy",
        "keywords": ["onboarding", "offboarding", "bgv", "clearance", "provisioning", "equipment", "exit"],
        "content": (
            "Upon offer acceptance, contractors undergo identity and Background Verification (BGV) checks. "
            "IT equipment and credential provisioning must be verified before work order activation. "
            "For offboarding, Hiring Managers initiate exit clearance to revoke system access, settle outstanding "
            "timesheets/expenses, and arrange asset recovery."
        ),
        "source": "Contractor Operations Manual §6.1"
    },
    {
        "id": "guide_hiring_manager_playbook",
        "title": "Hiring Manager Platform Navigation & Capabilities",
        "category": "hiring_manager_guide",
        "keywords": ["guide", "help", "role", "permissions", "navigate", "capabilities", "playbook"],
        "content": (
            "Hiring Managers use the TermJobs Copilot to: 1) Draft and refine contract job requisitions, "
            "2) Screen candidate submissions and review AI match scores, 3) Schedule interviews, "
            "4) Approve contractor timesheets and expenses, and 5) Monitor workforce pipeline analytics."
        ),
        "source": "Hiring Manager Copilot User Guide"
    }
]


def retrieve_knowledge(
    query: str,
    hyde_doc: Optional[str] = None,
    max_results: int = 2,
    tenant_id: Optional[str] = None
) -> Dict[str, Any]:
    """Search authorized knowledge documents matching query keywords and optional HyDE passage.

    Searches global platform policies plus custom tenant-specific uploaded policies from MongoDB.
    """
    search_text = f"{query} {hyde_doc or ''}".lower()
    tokens = set(re.findall(r"\b[a-z]{3,}\b", search_text))

    candidate_docs: List[Dict[str, Any]] = list(AUTHORIZED_KNOWLEDGE_DOCS)

    # 1. Fetch dynamic tenant-specific custom documents if tenant_id provided
    if tenant_id and tenant_id not in ("local", "all", ""):
        try:
            from modules.shared.db import db
            custom_cursor = db["company_knowledge_docs"].find({
                "tenant_id": tenant_id,
                "active": {"$ne": False}
            })
            for c_doc in custom_cursor:
                candidate_docs.append({
                    "id": str(c_doc.get("id") or c_doc.get("_id")),
                    "title": c_doc.get("title", "Custom Company Policy"),
                    "category": c_doc.get("category", "company_policy"),
                    "keywords": c_doc.get("keywords") or [],
                    "content": c_doc.get("content", ""),
                    "source": c_doc.get("source", "Company Handbook"),
                    "tenant_id": tenant_id
                })
        except Exception:
            pass

    scored_docs: List[tuple[int, Dict[str, Any]]] = []
    for doc in candidate_docs:
        score = 0
        doc_text = f"{doc['title']} {doc['category']} {' '.join(doc['keywords'])} {doc['content']}".lower()
        for token in tokens:
            if token in doc_text:
                score += 2 if token in doc.get("keywords", []) else 1
        if score > 0:
            scored_docs.append((score, doc))

    scored_docs.sort(key=lambda x: x[0], reverse=True)
    results = [doc for _, doc in scored_docs[:max_results]]

    if not results:
        return {
            "found": False,
            "documents": [],
            "summary": "No matching authorized policy or guideline found."
        }

    summary_lines = []
    for d in results:
        summary_lines.append(f"**{d['title']}** ({d['source']}):\n{d['content']}")

    return {
        "found": True,
        "documents": results,
        "summary": "\n\n".join(summary_lines)
    }


def upsert_custom_knowledge_doc(
    tenant_id: str,
    title: str,
    content: str,
    category: str = "company_policy",
    keywords: Optional[List[str]] = None,
    source: str = "Company Handbook",
    doc_id: Optional[str] = None
) -> Dict[str, Any]:
    """Upload or update a tenant-specific authorized knowledge/policy document."""
    import uuid
    from datetime import datetime, timezone
    from modules.shared.db import db

    target_id = doc_id or f"doc_{uuid.uuid4().hex[:12]}"
    kw_list = [k.strip().lower() for k in (keywords or []) if k]
    if not kw_list:
        kw_list = list(dict.fromkeys(re.findall(r"\b[a-z]{4,}\b", f"{title} {content}".lower())))[:8]

    doc_data = {
        "id": target_id,
        "tenant_id": tenant_id,
        "title": title.strip(),
        "content": content.strip(),
        "category": category.strip(),
        "keywords": kw_list,
        "source": source.strip(),
        "active": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    db["company_knowledge_docs"].update_one(
        {"id": target_id, "tenant_id": tenant_id},
        {"$set": doc_data},
        upsert=True
    )
    return doc_data


def list_custom_knowledge_docs(tenant_id: str) -> List[Dict[str, Any]]:
    """List all custom uploaded policy documents for a specific tenant."""
    try:
        from modules.shared.db import db
        return list(db["company_knowledge_docs"].find(
            {"tenant_id": tenant_id, "active": {"$ne": False}},
            {"_id": 0}
        ))
    except Exception:
        return []


def delete_custom_knowledge_doc(tenant_id: str, doc_id: str) -> bool:
    """Soft-delete or deactivate a custom knowledge document for a tenant."""
    try:
        from modules.shared.db import db
        res = db["company_knowledge_docs"].update_one(
            {"id": doc_id, "tenant_id": tenant_id},
            {"$set": {"active": False}}
        )
        return res.modified_count > 0
    except Exception:
        return False

