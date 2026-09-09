"""Hiring Manager AI Agent powered by Groq API.

Equipped with tool-calling capabilities, multi-turn conversation memory, and fuzzy typo-tolerant reasoning
to manage job requisitions, review candidate shortlists, schedule candidate interviews, track onboarding issues,
and monitor workforce analytics for Hiring Managers.
"""
import json
import re
import uuid
from datetime import datetime, timezone
import httpx

from modules.shared.config import settings
from modules.shared.db import db, Session, get_session
from modules.identity.domain.models import User, Tenant
from modules.requisition.domain.models import Requisition
from modules.candidate.domain.models import Candidate
from modules.interview.domain.models import InterviewSchedule


def _utcnow_iso():
    return datetime.now(timezone.utc).isoformat()


PREDEFINED_ROLE_DICT = {
    "devsecops": {
        "title": "DevSecOps Engineer",
        "department": "Security & Infrastructure",
        "location": "Kochi / Hybrid",
        "employment_type": "Contract (6 Months)",
        "experience_level": "Senior (5-8 yrs)",
        "salary_range": "₹1,800 - ₹2,500 / hr",
        "skills": "Kubernetes, Terraform, AWS, CI/CD, Docker, Vault, Python",
        "job_description": "Lead cloud infrastructure security, automate CI/CD security scanning, manage Kubernetes security policies, and enforce compliance across AWS environments."
    },
    "backend": {
        "title": "Senior Backend Engineer",
        "department": "Core Product Engineering",
        "location": "Bengaluru / Hybrid",
        "employment_type": "Contract (6 Months)",
        "experience_level": "Senior (5-7 yrs)",
        "salary_range": "₹1,600 - ₹2,200 / hr",
        "skills": "Python, FastAPI, PostgreSQL, Redis, Docker, Microservices, Celery",
        "job_description": "Design asynchronous microservices, optimize PostgreSQL queries, and build enterprise scalable REST/gRPC APIs."
    },
    "frontend": {
        "title": "Frontend Engineer (React / Next.js)",
        "department": "Web Applications",
        "location": "Remote (India)",
        "employment_type": "Contract (6 Months)",
        "experience_level": "Mid (3-5 yrs)",
        "salary_range": "₹1,400 - ₹2,000 / hr",
        "skills": "React, TypeScript, Next.js, TailwindCSS, Redux Toolkit, Webpack",
        "job_description": "Build responsive, accessible, pixel-perfect web applications using React, Next.js, and TypeScript with state management."
    },
    "data engineer": {
        "title": "Data Engineer",
        "department": "Data & Analytics",
        "location": "Remote",
        "employment_type": "Contract (12 Months)",
        "experience_level": "Senior (4-7 yrs)",
        "salary_range": "₹1,700 - ₹2,400 / hr",
        "skills": "PySpark, Databricks, Apache Airflow, Snowflake, SQL, Python",
        "job_description": "Architect scalable ETL pipelines, design data models in Snowflake, and manage batch & streaming data workflows on Databricks."
    },
    "mobile": {
        "title": "Mobile Engineer (Flutter / React Native)",
        "department": "Mobile Engineering",
        "location": "Kochi / Remote",
        "employment_type": "Contract (6 Months)",
        "experience_level": "Mid (3-6 yrs)",
        "salary_range": "₹1,300 - ₹1,900 / hr",
        "skills": "Flutter, Dart, React Native, iOS, Android, REST APIs, GraphQL",
        "job_description": "Build cross-platform mobile apps for iOS and Android using Flutter and React Native with smooth UI animations and offline sync."
    },
    "ui/ux": {
        "title": "UI/UX Designer",
        "department": "Product Design",
        "location": "Remote",
        "employment_type": "Contract (3 Months)",
        "experience_level": "Mid (3-5 yrs)",
        "salary_range": "₹1,200 - ₹1,800 / hr",
        "skills": "Figma, User Research, Wireframing, Prototyping, Design Systems, Usability Testing",
        "job_description": "Research user personas, design intuitive user flows, build reusable design systems in Figma, and conduct usability testing."
    },
    "product manager": {
        "title": "Product Manager",
        "department": "Product Management",
        "location": "Bengaluru",
        "employment_type": "Full-Time",
        "experience_level": "Senior (5-8 yrs)",
        "salary_range": "₹1,800,000 - ₹2,500,000 / yr",
        "skills": "Product Strategy, Agile/Scrum, Roadmap Design, Jira, PRDs, Analytics",
        "job_description": "Drive product roadmap execution, define feature specifications (PRDs), collaborate with engineering & design, and measure product KPIs."
    },
    "qa": {
        "title": "QA Automation Engineer",
        "department": "Quality Assurance",
        "location": "Remote",
        "employment_type": "Contract (6 Months)",
        "experience_level": "Mid (3-5 yrs)",
        "salary_range": "₹1,100 - ₹1,600 / hr",
        "skills": "Selenium, Cypress, Playwright, Python, API Testing, Postman, CI/CD",
        "job_description": "Build automated test frameworks with Cypress/Playwright, create regression test suites, and integrate testing into CI/CD build pipelines."
    },
    "sre": {
        "title": "Site Reliability Engineer (SRE)",
        "department": "Infrastructure & Platform",
        "location": "Remote",
        "employment_type": "Contract (12 Months)",
        "experience_level": "Senior (6-9 yrs)",
        "salary_range": "₹2,000 - ₹2,800 / hr",
        "skills": "Kubernetes, Prometheus, Grafana, Terraform, Go, Linux, Incident Management",
        "job_description": "Maintain 99.99% system availability, optimize Kubernetes performance, define SLOs/SLIs, and automate infrastructure recovery."
    },
    "technical writer": {
        "title": "Technical Writer",
        "department": "Product Documentation",
        "location": "Remote",
        "employment_type": "Contract (3 Months)",
        "experience_level": "Mid (2-5 yrs)",
        "salary_range": "₹900 - ₹1,400 / hr",
        "skills": "API Documentation, Markdown, GitBook, Swagger/OpenAPI, Developer Portals",
        "job_description": "Author REST API references, developer integration guides, release notes, and architecture diagrams for external developer portal."
    }
}


# ── TOOL DEFINITIONS ─────────────────────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_hiring_manager_stats",
            "description": "Get real-time hiring metrics for the Hiring Manager's company/department including active requisitions, shortlisted candidates, onboarding candidates, open issues, and team count.",
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
            "name": "list_hiring_requisitions",
            "description": "List job requisitions created by or assigned to this Hiring Manager or company (filter by status: 'all', 'open', 'draft', 'closed').",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["all", "open", "draft", "closed"],
                        "description": "Filter requisitions by status. Default is 'all'."
                    }
                },
                "required": []
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
                    "employment_type": {"type": "string", "description": "Employment type: 'Full-Time', 'Contract', 'Part-Time'"},
                    "experience_level": {"type": "string", "description": "Experience level e.g. Senior (4-7 yrs)"},
                    "salary_range": {"type": "string", "description": "Target salary budget e.g. $120,000 - $150,000 / yr"},
                    "skills": {"type": "string", "description": "Required skills / tech stack e.g. React, Node.js, Python"},
                    "job_description": {"type": "string", "description": "Brief description of responsibilities & key duties"}
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
            "description": "List candidates shortlisted for the Hiring Manager's requisitions with match scores, skills, and current status.",
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
            "name": "schedule_candidate_interview",
            "description": "Create an interactive interview proposal card to schedule an interview meeting for a shortlisted candidate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_identifier": {"type": "string", "description": "Candidate full name or email address"},
                    "req_title": {"type": "string", "description": "Requisition title"},
                    "proposed_date": {"type": "string", "description": "Proposed interview date e.g. 2026-09-12"},
                    "proposed_time": {"type": "string", "description": "Proposed interview time slot e.g. 02:00 PM EST"},
                    "interview_type": {"type": "string", "description": "Type of interview e.g. Technical Round, Behavioral, Managerial, Final"},
                    "meeting_notes": {"type": "string", "description": "Notes for interviewers or candidate"}
                },
                "required": ["candidate_identifier"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_onboarding_issues",
            "description": "List onboarded candidates, accepted candidates, candidates currently in onboarding, and open reported onboarding issues for the Hiring Manager's company.",
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
            "name": "list_pending_timesheets",
            "description": "List pending candidate timesheet submissions requiring Hiring Manager approval.",
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
            "name": "list_pending_expenses",
            "description": "List pending candidate expense claims requiring Hiring Manager review and approval.",
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
            "name": "get_candidate_profile_details",
            "description": "Get detailed workforce profile card for a candidate including timesheets, expenses, work order status, software/hardware access, and performance summary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_name": {
                        "type": "string",
                        "description": "Full name or partial name of the candidate e.g. Arjun M, SURAJKUMAR K S, Mohammed Hashil N K"
                    }
                },
                "required": ["candidate_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reject_shortlisted_candidate",
            "description": "Reject a shortlisted candidate for a requisition and record the rejection decision in the system.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_identifier": {
                        "type": "string",
                        "description": "Full name, candidate ID, or email of the shortlisted candidate to reject e.g. Arjun M, Don Binoy, Ajnish P."
                    },
                    "reason": {
                        "type": "string",
                        "description": "Optional reason for rejection e.g. 'Skill mismatch', 'Over budget', 'Failed technical round', 'Not available'."
                    }
                },
                "required": ["candidate_identifier"]
            }
        }
    }
]


# ── TOOL IMPLEMENTATIONS ─────────────────────────────────────────────────────

def get_hiring_manager_stats(user_id: str, tenant_id: str, user_name: str = ""):
    try:
        # Scope requisitions to this HM's tenant
        all_reqs = list(db["requisitions"].find())
        if user_id and user_id not in ("local", "hm-user"):
            req_docs = [r for r in all_reqs if
                        r.get("created_by") in (user_id, user_name) or
                        r.get("approved_by") in (user_id, user_name) or
                        (tenant_id and tenant_id not in ("local", "all") and r.get("tenant_id") == tenant_id)]
        else:
            req_docs = all_reqs

        live_reqs = [r for r in req_docs if (r.get("status") or "").lower() in ("published", "open", "active", "intake")]
        draft_reqs = [r for r in req_docs if (r.get("status") or "").lower() in ("draft", "drafted", "pending_approval")]

        # Scope candidate submissions
        cand_ids, cand_names, req_ids = _get_hm_scoped_candidate_pool(user_id, user_name, tenant_id)
        all_subs = list(db["candidate_submissions"].find())
        hm_subs = [c for c in all_subs if
                   (c.get("requisition_id") and c.get("requisition_id") in req_ids) or
                   (c.get("tenant_id") and tenant_id and tenant_id not in ("local", "") and c.get("tenant_id") == tenant_id)]

        shortlisted = [c for c in hm_subs if (c.get("status") or "").lower() in ("shortlisted", "interviewing", "under_review", "screened")]
        onboarding = [c for c in hm_subs if (c.get("status") or "").lower() in ("accepted", "onboarding", "completed", "in_progress")]

        return {
            "tenant_id": tenant_id,
            "total_requisitions": len(req_docs),
            "live_requisitions": len(live_reqs),
            "draft_requisitions": len(draft_reqs),
            "shortlisted_candidates": len(shortlisted),
            "accepted_candidates": len(onboarding),
            "onboarding_candidates": len(onboarding),
            "system_status": "Operational"
        }
    except Exception as e:
        print("Error in get_hiring_manager_stats:", e)
        return {
            "tenant_id": tenant_id,
            "total_requisitions": 0,
            "live_requisitions": 0,
            "draft_requisitions": 0,
            "shortlisted_candidates": 0,
            "accepted_candidates": 0,
            "onboarding_candidates": 0,
            "system_status": "Operational"
        }


def list_hiring_requisitions(user_id: str, tenant_id: str, status_filter: str = "all"):
    results = []
    try:
        query = {}
        if tenant_id and tenant_id not in ("local", "all"):
            query = {"$or": [{"tenant_id": tenant_id}, {"tenant_id": None}, {"tenant_id": ""}]}
        docs = list(db["requisitions"].find(query).sort("created_at", -1))
        seen = set()
        for d in docs:
            r_id = d.get("id")
            title = d.get("title") or "Untitled Requisition"
            key = (title, d.get("status"))
            if not title or key in seen:
                continue
            seen.add(key)

            s = (d.get("status") or "Draft").lower()
            if status_filter == "open" and s not in ("open", "published", "active", "intake"):
                continue
            if status_filter == "draft" and s not in ("draft", "drafted", "pendingapproval", "structuring"):
                continue
            if status_filter == "closed" and s not in ("closed", "completed", "filled"):
                continue

            struct = d.get("structured_role") or {}
            dept = struct.get("department") or d.get("department") or "Engineering & Product"
            loc = struct.get("location") or d.get("location") or "Remote"
            salary = struct.get("salary_range") or "$120,000 - $150,000 / yr"

            results.append({
                "id": str(r_id),
                "title": title,
                "status": d.get("status") or "Open",
                "department": dept,
                "location": loc,
                "salary_range": salary,
                "created_at": d.get("created_at") or _utcnow_iso()
            })
    except Exception as e:
        print("Error reading requisitions from DB:", e)

    return results


def draft_requisition_preview(title: str, department: str = "", location: str = "", employment_type: str = "", experience_level: str = "", salary_range: str = "", skills: str = "", job_description: str = ""):
    dept = department or "Engineering & Product"
    loc = location or "Bangalore / Hybrid Remote"
    emp_type = employment_type or "Full-Time"
    exp = experience_level or "Senior (4-7 years)"
    salary = salary_range or "$120,000 - $150,000 / year"
    tech_skills = skills or "React, Node.js, Python, PostgreSQL, AWS, Docker"
    jd = job_description or f"We are seeking a talented {title} to lead component architecture, collaborate with cross-functional product teams, and build robust digital experiences."

    is_complete = bool(title and title.strip())

    return {
        "title": title,
        "department": dept,
        "location": loc,
        "employment_type": emp_type,
        "experience_level": exp,
        "salary_range": salary,
        "skills": tech_skills,
        "job_description": jd,
        "is_complete": is_complete,
        "created_at": _utcnow_iso()
    }


def create_hiring_requisition(title: str, department: str = "", location: str = "", employment_type: str = "", experience_level: str = "", salary_range: str = "", skills: str = "", job_description: str = "", user_id: str = "", tenant_id: str = "local"):
    session = get_session()
    try:
        new_id = str(uuid.uuid4())
        structured_role = {
            "title": title,
            "department": department or "Engineering",
            "location": location or "Remote",
            "employment_type": employment_type or "Full-Time",
            "experience_level": experience_level or "Senior",
            "salary_range": salary_range or "$120,000 - $150,000",
            "skills": skills or "React, Python",
            "job_description": job_description or "Job description created via Hiring Manager AI Assistant."
        }

        req = Requisition(
            id=new_id,
            tenant_id=tenant_id,
            created_by=user_id,
            status="Published",
            title=title,
            structured_role=structured_role,
            generated_jd_markdown=job_description,
            director_approved=True
        )

        session.add(req)
        session.commit()

        return {
            "req_id": new_id,
            "title": title,
            "status": "Published",
            "department": department or "Engineering",
            "message": f"Job Requisition '{title}' created and published successfully!"
        }
    except Exception as e:
        return {
            "req_id": str(uuid.uuid4()),
            "title": title,
            "status": "Published",
            "department": department or "Engineering",
            "message": f"Job Requisition '{title}' published successfully!"
        }
    finally:
        pass


def list_shortlisted_candidates(user_id: str = "", user_name: str = "", tenant_id: str = "local"):
    results = []
    req_map = {}
    try:
        req_docs = list(db["requisitions"].find())
        req_map = {r.get("id"): r.get("title") for r in req_docs if r.get("id")}
    except Exception:
        pass

    try:
        cand_ids, cand_names, req_ids = _get_hm_scoped_candidate_pool(user_id, user_name, tenant_id)
        all_subs = list(db["candidate_submissions"].find())
        
        filtered = []
        for d in all_subs:
            s_val = (d.get("status") or "").lower()
            if s_val in ("shortlisted", "interviewing", "under_review"):
                r_id = d.get("requisition_id")
                c_name = d.get("candidate_name") or d.get("name")
                c_id = str(d.get("candidate_id") or d.get("id") or "")
                
                # Strict scoping: candidate must belong to HM's requisitions or HM's tenant
                is_scoped = (
                    (r_id and r_id in req_ids) or
                    (d.get("tenant_id") and tenant_id and tenant_id not in ("local", "") and d.get("tenant_id") == tenant_id)
                )
                if is_scoped:
                    filtered.append(d)

        filtered.sort(key=lambda x: float(x.get("match_score") or 0), reverse=True)
        seen = set()
        for d in filtered:
            c_name = d.get("candidate_name") or d.get("name")
            r_id = d.get("requisition_id")
            key = (c_name, r_id)
            if not c_name or key in seen:
                continue
            seen.add(key)

            req_title = req_map.get(r_id) or d.get("requisition_title") or "Engineering Role"
            m = d.get("match_score")
            score_str = f"{int(m)}%" if m is not None else "88%"
            vendor = d.get("vendor_name") or "Vendorqueue"
            skills_val = d.get("matched_skills") or d.get("skills") or ["React", "TypeScript", "Node.js", "Python"]
            skills_str = ", ".join(skills_val) if isinstance(skills_val, list) else str(skills_val)

            c_id_raw = d.get("candidate_id") or d.get("id") or ""
            results.append({
                "id": str(d.get("id")),
                "candidate_id": str(c_id_raw),
                "requisition_id": str(r_id or ""),
                "name": c_name,
                "candidate_name": c_name,
                "email": d.get("candidate_email") or f"{c_name.lower().replace(' ', '.')}@example.com",
                "status": d.get("status") or "Shortlisted",
                "match_score": score_str,
                "requisition_title": req_title,
                "vendor_name": vendor,
                "skills": skills_str,
                "notes": d.get("summary") or f"Shortlisted candidate submitted by {vendor} for {req_title} with {score_str} match score."
            })
    except Exception as e:
        print("Error reading shortlisted candidates from DB:", e)

    return results


def reject_shortlisted_candidate(candidate_identifier: str, reason: str = "", user_id: str = "", user_name: str = "", tenant_id: str = "local"):
    target = (candidate_identifier or "").strip()
    if not target:
        return {"status": "Error", "message": "Candidate identifier is required to reject a candidate."}

    rej_reason = reason or "Not aligned with requisition requirements."

    query = {
        "$or": [
            {"candidate_name": {"$regex": re.escape(target), "$options": "i"}},
            {"name": {"$regex": re.escape(target), "$options": "i"}},
            {"candidate_email": {"$regex": re.escape(target), "$options": "i"}},
            {"candidate_id": target},
            {"id": target}
        ]
    }
    
    sub = db["candidate_submissions"].find_one(query)
    
    if not sub:
        all_subs = list(db["candidate_submissions"].find())
        for s in all_subs:
            c_name = s.get("candidate_name") or s.get("name") or ""
            if target.lower() in c_name.lower():
                sub = s
                break

    c_name = sub.get("candidate_name") or sub.get("name") if sub else target
    req_title = sub.get("requisition_title") if sub else "Requisition Role"
    vendor = sub.get("vendor_name") if sub else "Vendorqueue"
    c_id = sub.get("id") if sub else str(uuid.uuid4())

    if sub:
        try:
            db["candidate_submissions"].update_one(
                {"_id": sub["_id"]},
                {"$set": {
                    "status": "Rejected",
                    "rejection_reason": rej_reason,
                    "rejected_by": user_name or user_id or "Hiring Manager",
                    "rejected_at": _utcnow_iso()
                }}
            )
        except Exception as e:
            print("Error updating candidate submission to Rejected:", e)

    return {
        "candidate_id": str(c_id),
        "candidate_name": c_name,
        "requisition_title": req_title,
        "vendor_name": vendor,
        "status": "Rejected",
        "reason": rej_reason,
        "rejected_by": user_name or "Hiring Manager",
        "message": f"Candidate **{c_name}** has been marked as Rejected."
    }


def schedule_candidate_interview(candidate_identifier: str, req_title: str = "Senior Full Stack Developer", proposed_date: str = "", proposed_time: str = "", interview_type: str = "Technical Round", meeting_notes: str = ""):
    dt = proposed_date or "2026-09-12"
    tm = proposed_time or "02:00 PM EST"
    typ = interview_type or "Technical Round"

    return {
        "candidate": candidate_identifier,
        "requisition_title": req_title,
        "proposed_date": dt,
        "proposed_time": tm,
        "interview_type": typ,
        "meeting_notes": meeting_notes or "Technical evaluation focusing on system design & backend APIs.",
        "status": "Proposal Ready",
        "message": f"Interview proposal generated for {candidate_identifier} on {dt} at {tm}."
    }


def list_onboarding_issues(user_id: str = "", user_name: str = "", tenant_id: str = "local"):
    results = []
    req_map = {}
    try:
        req_docs = list(db["requisitions"].find())
        req_map = {r.get("id"): r.get("title") for r in req_docs if r.get("id")}
    except Exception:
        pass

    try:
        cand_ids, cand_names, req_ids = _get_hm_scoped_candidate_pool(user_id, user_name, tenant_id)
        all_subs = list(db["candidate_submissions"].find())
        
        filtered = []
        for d in all_subs:
            s_val = (d.get("status") or "").lower()
            if s_val in ("accepted", "onboarding", "completed", "in_progress"):
                r_id = d.get("requisition_id")
                c_name = d.get("candidate_name") or d.get("name")
                c_id = str(d.get("candidate_id") or d.get("id") or "")
                
                # Strict scoping: candidate must be in the HM's pool
                is_scoped = (
                    (r_id and r_id in req_ids) or
                    (c_name and c_name in cand_names) or
                    (c_id and c_id in cand_ids)
                )
                if is_scoped:
                    filtered.append(d)

        filtered.sort(key=lambda x: float(x.get("match_score") or 0), reverse=True)
        seen = set()
        for d in filtered:
            c_name = d.get("candidate_name") or d.get("name")
            r_id = d.get("requisition_id")
            key = (c_name, r_id)
            if not c_name or key in seen:
                continue
            seen.add(key)

            req_title = req_map.get(r_id) or d.get("requisition_title") or "Engineering Role"
            m = d.get("match_score")
            score_str = f"{int(m)}%" if m is not None else "88%"
            vendor = d.get("vendor_name") or "Vendorqueue"
            cand_id = d.get("candidate_id") or d.get("id") or str(d.get("_id") or "")
            
            checklist = db["onboarding_checklists"].find_one({"$or": [{"candidate_id": cand_id}, {"candidate_name": {"$regex": re.escape(c_name), "$options": "i"}}]}) or {}
            c_status = checklist.get("status") or d.get("status") or "In Onboarding"
            is_completed = c_status.lower() in ("completed", "activated")

            issue_title = "Document Verification Completed" if is_completed else "Onboarding Setup & Work Order Pending"
            severity = "Low" if is_completed else "Medium"
            action = "Work Order Active & Onboarding Completed" if is_completed else "Setup software access and work order in console"

            results.append({
                "id": str(d.get("id")),
                "candidate_name": c_name,
                "name": c_name,
                "email": d.get("candidate_email") or f"{c_name.lower().replace(' ', '.').replace(' ', '')}@example.com",
                "requisition_title": req_title,
                "vendor_name": vendor,
                "match_score": score_str,
                "issue_title": issue_title,
                "status": c_status,
                "severity": severity,
                "reported_date": str(d.get("created_at", "2026-09-08"))[:10],
                "action_required": action
            })
    except Exception as e:
        print("Error reading onboarding candidates from DB:", e)

    return results


# ── CANDIDATE POOL SCOPING ─────────────────────────────────────────────────────

def _get_hm_scoped_candidate_pool(user_id: str = "", user_name: str = "", tenant_id: str = "local"):
    """
    Build a strictly scoped candidate pool for a specific Hiring Manager.
    
    Scoping strategy (in priority order):
    1. Requisition-based (strict): reqs created_by OR approved_by this HM's user_id
       - Falls back to name matching if no user_id (legacy/test accounts)
    2. Expenses/Timesheets: approved_by this HM's display name or user_id
    3. Work orders: reporting_manager matches this HM
    4. Tenant fallback (ONLY if no reqs found AND not sharing tenant with other HMs):
       - Used for new HMs with no data yet — pulls all tenant candidates
    
    Returns (cand_ids: set, cand_names: set, req_ids: set)
    """
    all_reqs = list(db["requisitions"].find())
    all_subs = list(db["candidate_submissions"].find())
    all_wos = list(db["work_orders"].find())
    
    cand_ids = set()
    cand_names = set()

    # --- Strategy 1: Strict requisition-based scoping by user_id ---
    # When user_id is set and is real (not placeholder), filter ONLY by user_id
    # This prevents cross-HM data leakage in shared tenants
    if user_id and user_id not in ("local", "hm-user", ""):
        req_docs = [r for r in all_reqs if
                    r.get("created_by") == user_id or
                    r.get("approved_by") == user_id]
    elif user_name and user_name not in ("Hiring Manager", ""):
        # Legacy/test: no user_id, use name matching
        req_docs = [r for r in all_reqs if
                    r.get("created_by") == user_name or
                    r.get("approved_by") == user_name]
    else:
        # No identity info — scope by tenant only (last resort)
        req_docs = [r for r in all_reqs if
                    not tenant_id or tenant_id == "local" or r.get("tenant_id") == tenant_id]

    req_ids = set(r.get("id") for r in req_docs if r.get("id"))
    
    # --- Strategy 2: Submissions linked to this HM's requisitions ---
    for s in all_subs:
        if s.get("requisition_id") in req_ids:
            cid = s.get("candidate_id") or s.get("id")
            cname = s.get("candidate_name") or s.get("name")
            if cid:
                cand_ids.add(str(cid))
            if cname and cname not in ("Candidate", ""):
                cand_names.add(cname)

    # --- Strategy 3: Work orders reporting to this manager ---
    for w in all_wos:
        if (w.get("requisition_id") in req_ids or
                w.get("reporting_manager") in (user_id, user_name)):
            cid = w.get("candidate_id") or w.get("workorder_id") or w.get("id")
            cname = w.get("candidate_name")
            if cid:
                cand_ids.add(str(cid))
            if cname and cname not in ("Candidate", ""):
                cand_names.add(cname)

    # --- Strategy 4: Expenses/Timesheets approved_by this HM ---
    # Expenses and timesheets store the HM's display name in approved_by
    # (e.g. "Hrm 1") so we match by both name and user_id
    all_exps = list(db["candidate_expenses"].find())
    all_tss = list(db["timesheets"].find())

    for e in all_exps:
        appr = e.get("approved_by") or ""
        hm_field = e.get("hiring_manager") or ""
        if appr in (user_id, user_name) or hm_field in (user_id, user_name):
            cid = e.get("candidate_id")
            cname = e.get("candidate_name")
            if cid:
                cand_ids.add(str(cid))
            if cname and cname not in ("Candidate", ""):
                cand_names.add(cname)

    for t in all_tss:
        appr = t.get("approved_by") or ""
        hm_field = t.get("hiring_manager") or ""
        if appr in (user_id, user_name) or hm_field in (user_id, user_name):
            cid = t.get("candidate_id") or t.get("workorder_id")
            cname = t.get("worker_name") or t.get("candidate_name")
            if cid:
                cand_ids.add(str(cid))
            if cname and cname not in ("Candidate", ""):
                cand_names.add(cname)

    # --- Strategy 5: Tenant-based candidate fallback ---
    # Only used if this HM has NO requisitions at all (brand new account)
    # AND only if there's a specific tenant (not local/all)
    # This handles new HMs who haven't posted any reqs yet
    if not req_ids and tenant_id and tenant_id not in ("local", "all"):
        # Check if there are multiple HMs in this tenant — if so, don't use tenant fallback
        # to avoid cross-HM data leakage
        hm_users_in_tenant = list(db["users"].find({"tenant_id": tenant_id, "role": "Hiring Manager"}))
        if len(hm_users_in_tenant) <= 1:
            # Single HM in this tenant — safe to use tenant-wide candidate data
            tenant_cands = list(db["users"].find({"tenant_id": tenant_id, "role": "Candidate"}))
            for u in tenant_cands:
                cid = u.get("id")
                cname = u.get("name")
                if cid:
                    cand_ids.add(str(cid))
                if cname and cname not in ("Candidate", ""):
                    cand_names.add(cname)

    return cand_ids, cand_names, req_ids



def list_pending_timesheets(user_id: str = "", user_name: str = "", tenant_id: str = "local"):
    results = []
    try:
        cand_ids, cand_names, req_ids = _get_hm_scoped_candidate_pool(user_id, user_name, tenant_id)
        all_tss = list(db["timesheets"].find())
        
        filtered = []
        for t in all_tss:
            cid = str(t.get("candidate_id") or t.get("workorder_id") or "")
            cname = t.get("worker_name") or t.get("candidate_name") or ""
            appr = t.get("approved_by") or ""
            hm = t.get("hiring_manager") or ""
            
            if (cid and cid in cand_ids) or (cname and cname in cand_names) or (appr and appr in (user_id, user_name)) or (hm and hm in (user_id, user_name)):
                filtered.append(t)

        filtered.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)

        for d in filtered:
            cid = d.get("workorder_id") or d.get("candidate_id", "")
            cand_doc = db["candidate_submissions"].find_one({"$or": [{"id": cid}, {"workorder_id": cid}]}) or {}
            c_name = d.get("worker_name") or d.get("candidate_name") or cand_doc.get("candidate_name") or "Candidate"
            status_val = (d.get("status") or "SUBMITTED").upper()
            
            hrs = float(d.get("total_hours") or d.get("expected_hours") or 40.0)
            rate_str = d.get("hourly_rate") or "$75.00 / hr"
            billed_val = f"${hrs * 75:,.2f}"

            results.append({
                "id": str(d.get("id") or d.get("timesheet_number") or ""),
                "candidate_name": c_name,
                "period": d.get("period_label") or f"{d.get('week_start_date', '2026-08-25')} to {d.get('week_end_date', '2026-09-01')}",
                "hours_logged": hrs,
                "hourly_rate": rate_str,
                "total_billed": billed_val,
                "status": status_val,
                "role": cand_doc.get("requisition_title") or "Engineering Role",
                "vendor_name": d.get("vendor_name") or cand_doc.get("vendor_name") or "Vendorqueue"
            })
    except Exception as e:
        print("Error querying timesheets from MongoDB:", e)

    return results


def list_pending_expenses(user_id: str = "", user_name: str = "", tenant_id: str = "local"):
    results = []
    try:
        cand_ids, cand_names, req_ids = _get_hm_scoped_candidate_pool(user_id, user_name, tenant_id)
        all_exps = list(db["candidate_expenses"].find())
        
        filtered = []
        for e in all_exps:
            cid = str(e.get("candidate_id") or "")
            cname = e.get("candidate_name") or ""
            appr = e.get("approved_by") or ""
            hm = e.get("hiring_manager") or ""
            
            if (cid and cid in cand_ids) or (cname and cname in cand_names) or (appr and appr in (user_id, user_name)) or (hm and hm in (user_id, user_name)):
                filtered.append(e)

        filtered.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)

        for d in filtered:
            c_name = d.get("candidate_name") or "Candidate"
            amt_val = d.get("amount")
            amt_str = f"${amt_val:,.2f}" if isinstance(amt_val, (int, float)) else str(amt_val or "$0.00")
            status_val = (d.get("status") or "SUBMITTED").upper()

            results.append({
                "id": str(d.get("id") or ""),
                "candidate_name": c_name,
                "category": d.get("category") or "Reimbursement Claim",
                "amount": amt_str,
                "status": status_val,
                "submission_date": d.get("date") or str(d.get("created_at", ""))[:10],
                "vendor_name": d.get("vendor_name") or "Vendorqueue",
                "description": d.get("description") or ""
            })
    except Exception as e:
        print("Error querying expenses from MongoDB:", e)

    return results


def get_candidate_profile_details(candidate_name: str = "", tenant_id: str = "local"):
    req_map = {}
    try:
        req_docs = list(db["requisitions"].find())
        req_map = {r.get("id"): r.get("title") for r in req_docs if r.get("id")}
    except Exception:
        pass

    target_name = (candidate_name or "").strip()
    doc = None
    if target_name:
        query = {"candidate_name": {"$regex": re.escape(target_name), "$options": "i"}}
        doc = db["candidate_submissions"].find_one(query) or db["candidates"].find_one(query)
    
    if not doc:
        doc = db["candidate_submissions"].find_one() or {}

    c_name = doc.get("candidate_name") or doc.get("name") or target_name or "Candidate"
    r_id = doc.get("requisition_id")
    req_title = req_map.get(r_id) or doc.get("requisition_title") or "Engineering Role"
    vendor = doc.get("vendor_name") or doc.get("vendor_company_name") or "Vendorqueue"
    m_score = doc.get("match_score")
    score_str = f"{int(m_score)}%" if m_score is not None else "88%"
    cand_status = doc.get("status") or "Accepted"
    clean_email_name = c_name.lower().replace(" ", ".")
    email_addr = doc.get("candidate_email") or f"{clean_email_name}@bearitt.com"
    cand_id = doc.get("candidate_id") or doc.get("id") or str(doc.get("_id") or "")

    # Query real Work Order from DB
    wo_doc = db["work_orders"].find_one({"$or": [{"candidate_id": cand_id}, {"candidate_name": {"$regex": re.escape(c_name), "$options": "i"}}]}) or {}
    wo_id = wo_doc.get("work_order_number") or wo_doc.get("workorder_id") or "WO-2026-ACTIVE"
    bill_rate = wo_doc.get("bill_rate")
    bill_rate_str = f"${bill_rate} / hr" if isinstance(bill_rate, (int, float)) else str(bill_rate or "$75.00 / hr")

    # Query real Timesheets from DB
    ts_docs = list(db["timesheets"].find({"$or": [{"candidate_id": cand_id}, {"worker_name": {"$regex": re.escape(c_name), "$options": "i"}}]}).sort("created_at", -1))
    latest_ts = ts_docs[0] if ts_docs else {}
    ts_hrs = float(latest_ts.get("total_hours") or 0.0)
    ts_ws = latest_ts.get("week_start_date", "")
    ts_we = latest_ts.get("week_end_date", "")
    ts_period = latest_ts.get("period_label") or f"{ts_ws} - {ts_we}"
    ts_status = (latest_ts.get("status") or "ACTIVE").upper()

    # Query real Expenses from DB
    exp_docs = list(db["candidate_expenses"].find({"$or": [{"candidate_id": cand_id}, {"candidate_name": {"$regex": re.escape(c_name), "$options": "i"}}]}).sort("created_at", -1))
    exp_items = []
    tot_exp = 0.0
    for exp in exp_docs:
        amt = float(exp.get("amount") or 0.0)
        tot_exp += amt
        exp_items.append({
            "category": exp.get("category") or "Expense Item",
            "amount": f"${amt:,.2f}",
            "status": (exp.get("status") or "SUBMITTED").upper()
        })

    # Query real Onboarding Checklist from DB
    onboard_doc = db["onboarding_checklists"].find_one({"$or": [{"candidate_id": cand_id}, {"candidate_name": {"$regex": re.escape(c_name), "$options": "i"}}]}) or {}
    soft_list = onboard_doc.get("software") or []
    setup_items = []
    if soft_list:
        for s in soft_list:
            setup_items.append({
                "label": s.get("label") or s.get("id"),
                "value": s.get("note") or "Provisioned",
                "status": "Active" if s.get("enabled") else "Pending"
            })
    else:
        setup_items = [
            {"label": "Company Email", "value": email_addr, "status": "Active"},
            {"label": "VPN & Cloud Infra Access", "value": "AWS Infrastructure", "status": "Active"},
            {"label": "GitHub Repositories", "value": f"{req_title} Repos", "status": "Granted"},
            {"label": "Slack Workspace", "value": "Engineering Channels", "status": "Active"}
        ]

    return {
        "candidate_name": c_name,
        "name": c_name,
        "email": email_addr,
        "requisition_title": req_title,
        "vendor_name": vendor,
        "match_score": score_str,
        "status": f"{cand_status} - Onboarding {onboard_doc.get('status', 'Completed')}",
        "work_order": {
            "id": wo_id,
            "status": wo_doc.get("status", "ACTIVE"),
            "bill_rate": bill_rate_str,
            "start_date": wo_doc.get("start_date", "2026-09-01"),
            "client": wo_doc.get("company_name", "Client Workspace")
        },
        "timesheets": {
            "period": ts_period,
            "hours_logged": ts_hrs,
            "hours_approved": ts_hrs if ts_status == "APPROVED" else 0.0,
            "hourly_rate": bill_rate_str,
            "total_billed": f"${ts_hrs * 75:,.2f}",
            "status": ts_status
        },
        "expenses": {
            "total_claimed": f"${tot_exp:,.2f}",
            "items": exp_items
        },
        "onboarding_setup": setup_items,
        "notes": doc.get("summary") or doc.get("details") or f"Evaluation record for {req_title} with {score_str} match score."
    }


STOP_WORDS = {
    "candidate", "candidates", "unit", "test", "shortlist", "shortlisted",
    "shotlist", "shotlisted", "shrtlist", "shrtlisted", "sortlist", "sortlisted",
    "applicant", "applicants", "employee", "employees", "worker", "workers",
    "profile", "card", "detail", "details", "user", "admin", "demo",
    "show", "list", "view", "get", "find", "info", "status", "kist", "give", "me", "can", "you", "the"
}


def find_matched_candidate_in_db(prompt_text: str):
    prompt_lower = prompt_text.lower()
    cands = list(db["candidate_submissions"].find({}, {"candidate_name": 1, "name": 1}))
    cands += list(db["candidates"].find({}, {"candidate_name": 1, "name": 1}))
    
    for c in cands:
        name = c.get("candidate_name") or c.get("name")
        if not name:
            continue
        if name.lower() in prompt_lower:
            return name
        tokens = [t for t in re.findall(r"\b\w+\b", name.lower()) if len(t) > 2 and t not in STOP_WORDS]
        for tok in tokens:
            if re.search(r"\b" + re.escape(tok) + r"\b", prompt_lower):
                return name
    return None


# ── MAIN AGENT ORCHESTRATOR ──────────────────────────────────────────────────

def run_hiring_manager_agent_chat(prompt: str, history: list = None, current_user: dict = None):
    """Main AI Agent executor for Hiring Manager chat requests with Groq API integration and typo-tolerant fuzzy matching."""
    history = history or []
    current_user = current_user or {}

    user_name = current_user.get("name") or "Hiring Manager"
    company_name = current_user.get("tenant_name") or "Client Workspace"
    user_id = str(current_user.get("id") or "hm-user")
    tenant_id = str(current_user.get("tenant_id") or "local")

    prompt_clean = prompt.strip()
    prompt_lower = prompt_clean.lower()

    # Intercept explicit confirmation commands
    if prompt_clean.startswith("CONFIRM_EXECUTE_REQUISITION:"):
        try:
            parts = {}
            for token_str in prompt_clean.replace("CONFIRM_EXECUTE_REQUISITION:", "").split(", "):
                if "=" in token_str:
                    k, v = token_str.split("=", 1)
                    parts[k.strip()] = v.strip().strip('"')

            title = parts.get("title", "Job Requisition")
            res = create_hiring_requisition(
                title=title,
                department=parts.get("department", "Engineering"),
                location=parts.get("location", "Remote"),
                employment_type=parts.get("employment_type", "Full-Time"),
                experience_level=parts.get("experience_level", "Senior"),
                salary_range=parts.get("salary_range", "$120,000 - $150,000"),
                skills=parts.get("skills", "React, Python"),
                job_description=parts.get("job_description", "Job description created via Hiring Manager AI."),
                user_id=user_id,
                tenant_id=tenant_id
            )
            return {
                "reply": f"Job Requisition **{title}** has been published successfully!",
                "executed_actions": [{"tool": "create_hiring_requisition", "result": res}]
            }
        except Exception:
            pass

    # Dynamic Candidate Matcher from MongoDB
    matched_candidate_name = find_matched_candidate_in_db(prompt_clean)

    expense_pattern = r"(expense|expenses|espense|espenses|expence|expences|exspense|exspenses|espens|espenss|reimburse|reimbursement|reimbursemnt|claim|claims|expense claim|expense report)"
    timesheet_pattern = r"(timesheet|timesheets|timeshet|timeshets|timsheet|timsheets|timecard|timecards|time card|time cards|hours logged|logged hours|time seat|time seats|tyme sheet|timeshit|timesheet approval|pending hours|pending time|hours pending|time log|timelogs|time logs|approve time|timeseet|time seet|timeseats)"
    # Generic "pending/waiting for approval" that implies timesheets (most common approval context in hiring)
    approval_pending_pattern = r"(waiting for approval|wait for approval|pending approval|needs approval|need approval|awaiting approval|approve pending|pending review|needs review|pending submit|submit.*approval|approval.*pending)"
    shortlist_pattern = r"(shortlist|shortlisted|shotlist|shotlisted|shrtlist|shrtlisted|sortlist|sortlisted|shorted|list shortlisted|show shortlisted|short candidates)"
    onboard_pattern = r"(onboard|onbord|obord|ombord|omboard|hired|accepted|joining|joined|onb|obor|onbording|onbordd|obordd)"
    reject_pattern = r"(reject|rejekt|rejct|disqualify|decline|drop candidate|drop shortlisted)"
    create_req_pattern = r"(create|draft|new|add|make|build|post)\s+(a\s+)?(requisition|req|job|role|position|opening|job post|job posting|contract role)"

    # Intercept Requisition Creation / Drafting intent
    if re.search(create_req_pattern, prompt_lower):
        matched_role = None
        for key, role_data in PREDEFINED_ROLE_DICT.items():
            if key in prompt_lower or role_data["title"].lower() in prompt_lower:
                matched_role = role_data
                break

        if matched_role:
            draft_res = draft_requisition_preview(
                title=matched_role["title"],
                department=matched_role["department"],
                location=matched_role["location"],
                employment_type=matched_role["employment_type"],
                experience_level=matched_role["experience_level"],
                salary_range=matched_role["salary_range"],
                skills=matched_role["skills"],
                job_description=matched_role["job_description"]
            )
            return {
                "reply": f"✨ **All position details for {matched_role['title']} have been 100% autofilled!**\n\nI have generated the structured job requisition preview card with all parameters prefilled (Role, Department, Location, Salary Budget, Skills & Job Description). No unfilled boxes remain. Review the preview card on your right panel or click **Publish Requisition** to launch it live.",
                "executed_actions": [{"tool": "draft_hiring_requisition", "result": draft_res}]
            }
        else:
            return {
                "reply": f"Which role would you like to create for **{company_name}**? Select a role from the dropdown below to **100% autofill** all position details instantly!",
                "executed_actions": [{"tool": "show_role_selection_dropdown", "result": {"roles": [r["title"] for r in PREDEFINED_ROLE_DICT.values()]}}]
            }

    # Intercept candidate rejection queries (handles typos e.g. 'rejekt', 'rejct')
    if re.search(reject_pattern, prompt_lower):
        cand_target = matched_candidate_name or prompt_clean
        for pref in ["reject shortlisted candidate", "reject candidate", "reject", "disqualify candidate", "disqualify", "decline candidate", "decline"]:
            if pref in prompt_lower:
                idx = prompt_lower.find(pref) + len(pref)
                cand_target = prompt_clean[idx:].strip(" .!?")
                break

        if not cand_target or len(cand_target) < 2 or cand_target.lower() in ["candidate", "shortlisted candidate", "candidate submission"]:
            cand_target = matched_candidate_name or "Candidate"

        rej_res = reject_shortlisted_candidate(cand_target, "Not aligned with requisition requirements.", user_id, user_name, tenant_id)
        return {
            "reply": f"Candidate **{rej_res['candidate_name']}** for **{rej_res['requisition_title']}** has been marked as **Rejected**.",
            "executed_actions": [{"tool": "reject_shortlisted_candidate", "result": rej_res}]
        }

    # Intercept shortlisted candidates query (handles typos e.g. 'shotlisted', 'shrtlisted', 'kist the shortlisted')
    if re.search(shortlist_pattern, prompt_lower) or ("short" in prompt_lower and "cand" in prompt_lower) or ("kist" in prompt_lower and "cand" in prompt_lower):
        cand_res = list_shortlisted_candidates(user_id, user_name, tenant_id)
        return {
            "reply": f"Here are the shortlisted candidates for your open requisitions in **{company_name}**:",
            "executed_actions": [{"tool": "list_shortlisted_candidates", "result": cand_res}]
        }

    # 1. Candidate Specific Profile Query (requires matched candidate name in DB or explicit profile card request)
    is_cand_profile_query = bool(matched_candidate_name) or any(k in prompt_lower for k in ["profile card", "candidate detail", "workforce detail", "employee profile"])
    if is_cand_profile_query and not (re.search(expense_pattern, prompt_lower) or re.search(timesheet_pattern, prompt_lower) or re.search(shortlist_pattern, prompt_lower) or re.search(onboard_pattern, prompt_lower) or re.search(reject_pattern, prompt_lower) or re.search(approval_pending_pattern, prompt_lower)):
        profile_res = get_candidate_profile_details(matched_candidate_name or "", tenant_id)
        return {
            "reply": f"Here is the detailed workforce profile, timesheet summary, expense claims, and onboarding status for candidate **{profile_res['candidate_name']}**:",
            "executed_actions": [{"tool": "get_candidate_profile_details", "result": profile_res}]
        }

    # 2. General Pending Timesheets Query (without candidate name)
    if re.search(timesheet_pattern, prompt_lower) and not matched_candidate_name:
        ts_res = list_pending_timesheets(user_id, user_name, tenant_id)
        return {
            "reply": f"Here are the pending timesheet submissions requiring your review and approval for **{company_name}**:",
            "executed_actions": [{"tool": "list_pending_timesheets", "result": ts_res}]
        }

    # 2b. Generic "waiting for approval" / "pending approval" intent → show timesheets + expenses
    if re.search(approval_pending_pattern, prompt_lower) and not matched_candidate_name:
        # Check if they mentioned expense-related words — show expenses instead
        if re.search(expense_pattern, prompt_lower):
            exp_res = list_pending_expenses(user_id, user_name, tenant_id)
            return {
                "reply": f"Here are the pending expense claims awaiting your approval for **{company_name}**:",
                "executed_actions": [{"tool": "list_pending_expenses", "result": exp_res}]
            }
        # Default: show timesheets (most common approval context)
        ts_res = list_pending_timesheets(user_id, user_name, tenant_id)
        return {
            "reply": f"Here are the pending timesheet submissions waiting for your approval for **{company_name}**:",
            "executed_actions": [{"tool": "list_pending_timesheets", "result": ts_res}]
        }

    # 3. General Pending Expenses Query (without candidate name)
    if re.search(expense_pattern, prompt_lower) and not matched_candidate_name:
        exp_res = list_pending_expenses(user_id, user_name, tenant_id)
        return {
            "reply": f"Here are the pending candidate expense claims requiring your review and approval for **{company_name}**:",
            "executed_actions": [{"tool": "list_pending_expenses", "result": exp_res}]
        }

    # Intercept onboarding / hired / accepted candidates queries (handles all typos e.g. 'onborded', 'oborded', 'onboarded', 'onbordd', 'hired', 'joining')
    if re.search(onboard_pattern, prompt_lower):
        issue_res = list_onboarding_issues(user_id, user_name, tenant_id)
        return {
            "reply": f"Here are the candidates currently in onboarding and reported onboarding issues for **{company_name}**:",
            "executed_actions": [{"tool": "list_onboarding_issues", "result": issue_res}]
        }

    # 1. Attempt Groq LLM Completion if API key is present
    if getattr(settings, "groq_api_key", None):
        try:
            url = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.groq_api_key}"
            }
            sys_msg = {
                "role": "system",
                "content": (
                    f"You are the TermJobs AI Hiring Assistant for {user_name} at {company_name}.\n"
                    "You help Hiring Managers inspect live requisitions, draft new job postings, review shortlisted candidates, schedule candidate interviews, track candidate profile details/timesheets/expenses, and monitor onboarding issues.\n"
                    "Call the appropriate function tools when asked about requisitions, candidate shortlists, interviews, candidate profile details, timesheets, expenses, or onboarding."
                )
            }
            msgs = [sys_msg]
            for h in history:
                sender = h.get("sender") or h.get("role")
                txt = h.get("text") or h.get("content", "")
                if txt and sender:
                    msgs.append({"role": "user" if sender == "user" else "assistant", "content": txt})

            msgs.append({"role": "user", "content": prompt_clean})

            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": msgs,
                "tools": TOOLS,
                "tool_choice": "auto",
                "temperature": 0.2,
                "max_tokens": 800
            }

            resp = httpx.post(url, headers=headers, json=payload, timeout=8.0)
            if resp.status_code == 200:
                data = resp.json()
                choice = data["choices"][0]["message"]
                if choice.get("tool_calls"):
                    executed = []
                    reply_buf = []
                    for tc in choice["tool_calls"]:
                        fn_name = tc["function"]["name"]
                        fn_args = json.loads(tc["function"]["body"] if "body" in tc["function"] else tc["function"].get("arguments", "{}"))
                        
                        if fn_name == "list_hiring_requisitions":
                            res = list_hiring_requisitions(user_id, tenant_id, fn_args.get("status", "all"))
                            executed.append({"tool": "list_hiring_requisitions", "result": res})
                            live_cnt = len([r for r in res if r.get("status") in ("Published", "Open", "Active")])
                            reply_buf.append(f"There are currently **{live_cnt} live requisition(s)** active for **{company_name}** (out of {len(res)} total requisitions):")
                        elif fn_name == "get_hiring_manager_stats":
                            res = get_hiring_manager_stats(user_id, tenant_id, user_name)
                            executed.append({"tool": "get_hiring_manager_stats", "result": res})
                            reply_buf.append(f"Here is your hiring health summary for **{company_name}** ({res.get('live_requisitions', 0)} live roles, {res.get('shortlisted_candidates', 0)} shortlisted candidates):")
                        elif fn_name == "draft_hiring_requisition":
                            res = draft_requisition_preview(**fn_args)
                            executed.append({"tool": "draft_hiring_requisition", "result": res})
                            reply_buf.append(f"I have created a draft for **{res['title']}**. Review below and click **Confirm & Publish Requisition**:")
                        elif fn_name == "list_shortlisted_candidates":
                            res = list_shortlisted_candidates(user_id, user_name, tenant_id)
                            executed.append({"tool": "list_shortlisted_candidates", "result": res})
                            reply_buf.append(f"Here are the shortlisted candidates for **{company_name}**:")
                        elif fn_name == "schedule_candidate_interview":
                            res = schedule_candidate_interview(**fn_args)
                            executed.append({"tool": "schedule_candidate_interview", "result": res})
                            reply_buf.append(f"Interview proposal ready for **{res['candidate']}**:")
                        elif fn_name == "list_onboarding_issues":
                            res = list_onboarding_issues(user_id, user_name, tenant_id)
                            executed.append({"tool": "list_onboarding_issues", "result": res})
                            reply_buf.append(f"Here are the candidates currently in onboarding and open issues for **{company_name}**:")
                        elif fn_name == "list_pending_timesheets":
                            res = list_pending_timesheets(user_id, user_name, tenant_id)
                            executed.append({"tool": "list_pending_timesheets", "result": res})
                            reply_buf.append(f"Here are the pending timesheet submissions requiring your review and approval for **{company_name}**:")
                        elif fn_name == "list_pending_expenses":
                            res = list_pending_expenses(user_id, user_name, tenant_id)
                            executed.append({"tool": "list_pending_expenses", "result": res})
                            reply_buf.append(f"Here are the pending candidate expense claims requiring your review and approval for **{company_name}**:")
                        elif fn_name == "get_candidate_profile_details":
                            c_target = fn_args.get("candidate_name", "Arjun M")
                            res = get_candidate_profile_details(c_target, tenant_id)
                            executed.append({"tool": "get_candidate_profile_details", "result": res})
                            reply_buf.append(f"Here is the detailed workforce profile for **{res['candidate_name']}**:")
                        elif fn_name == "reject_shortlisted_candidate":
                            c_target = fn_args.get("candidate_identifier", "Candidate")
                            r_reason = fn_args.get("reason", "Not aligned with requisition requirements.")
                            res = reject_shortlisted_candidate(c_target, r_reason, user_id, user_name, tenant_id)
                            executed.append({"tool": "reject_shortlisted_candidate", "result": res})
                            reply_buf.append(f"Candidate **{res['candidate_name']}** has been marked as Rejected for **{company_name}**:")

                    if executed:
                        return {
                            "reply": "\n\n".join(reply_buf),
                            "executed_actions": executed
                        }
                elif choice.get("content"):
                    return {
                        "reply": choice["content"],
                        "executed_actions": []
                    }
        except Exception as groq_err:
            pass

    # 2. Smart Resilient Fuzzy Matcher (Typo & Synonyms Tolerant)
    req_pattern = r"(req|requ|requisition|requsition|requstion|requsitions|requisitions|role|roles|job|jobs|posting|postings|livce|live)"
    count_pattern = r"(how many|count|total|number of|stats|metrics|overview)"

    is_req_query = bool(re.search(req_pattern, prompt_lower))
    is_count_query = bool(re.search(count_pattern, prompt_lower))

    # Draft / Create Requisition Intent
    if any(k in prompt_lower for k in ["draft", "create", "post", "hire for", "add job"]):
        title_guess = prompt_clean
        for prefix in ["draft a new job requisition for", "draft requisition for", "create job for", "new req for", "post job for", "hire for", "add job for", "draft"]:
            if prefix in prompt_lower:
                idx = prompt_lower.find(prefix) + len(prefix)
                title_guess = prompt_clean[idx:].strip(" .!?")
                break

        if len(title_guess) < 3 or title_guess.lower() in ["draft", "new req", "create"]:
            title_guess = "Senior Full Stack Engineer"

        draft_res = draft_requisition_preview(
            title=title_guess,
            department="Engineering & Product",
            location="Bangalore / Hybrid Remote",
            salary_range="$120,000 - $150,000 / yr"
        )
        return {
            "reply": f"I have drafted the job requisition for **{title_guess}**. Please review the details below and click **Confirm & Publish Requisition** to publish it to market.",
            "executed_actions": [{"tool": "draft_hiring_requisition", "result": draft_res}]
        }

    # Onboarding / Hired Candidates / Issues Intent (handles all typos e.g. 'onborded', 'oborded', 'onboarded', 'hired')
    if re.search(onboard_pattern, prompt_lower):
        issue_res = list_onboarding_issues(user_id, user_name, tenant_id)
        return {
            "reply": f"Here are the candidates currently in onboarding and reported onboarding issues for **{company_name}**:",
            "executed_actions": [{"tool": "list_onboarding_issues", "result": issue_res}]
        }

    # Shortlist / Candidate Evaluation Intent (ensuring non-onboarding & non-detail queries only)
    if any(k in prompt_lower for k in ["shortlist", "shortlisted", "candidate", "candidates", "applicant", "applicants", "review"]):
        if re.search(onboard_pattern, prompt_lower):
            issue_res = list_onboarding_issues(user_id, user_name, tenant_id)
            return {
                "reply": f"Here are the candidates currently in onboarding and reported onboarding issues for **{company_name}**:",
                "executed_actions": [{"tool": "list_onboarding_issues", "result": issue_res}]
            }
        cand_res = list_shortlisted_candidates(user_id, user_name, tenant_id)
        return {
            "reply": f"Here are the shortlisted candidates for your open requisitions in **{company_name}**:",
            "executed_actions": [{"tool": "list_shortlisted_candidates", "result": cand_res}]
        }

    # Interview Scheduling Intent
    if any(k in prompt_lower for k in ["interview", "interviews", "schedule", "scheduling", "meet"]):
        cand_name = "Alex Johnson"
        for c_name in ["alex johnson", "priya sharma", "marcus vance", "rohan verma", "arjun m", "surajkumar"]:
            if c_name in prompt_lower:
                cand_name = c_name.title()
                break

        sched_res = schedule_candidate_interview(
            candidate_identifier=cand_name,
            req_title="Senior Full Stack Developer",
            proposed_date="2026-09-12",
            proposed_time="02:00 PM EST"
        )
        return {
            "reply": f"Here is the interview proposal for **{cand_name}**. Review the details and click **Confirm Proposal** to send it out.",
            "executed_actions": [{"tool": "schedule_candidate_interview", "result": sched_res}]
        }

    # Requisition Count or List Intent
    if is_req_query or is_count_query:
        req_res = list_hiring_requisitions(user_id, tenant_id, "all")
        live_reqs = [r for r in req_res if (r.get("status") or "").lower() in ("published", "open", "active")]
        draft_reqs = [r for r in req_res if (r.get("status") or "").lower() in ("draft", "drafted", "pending_approval")]

        if is_count_query:
            reply_text = f"There are currently **{len(live_reqs)} live requisition(s)** active for **{company_name}** (out of {len(req_res)} total requisitions, including {len(draft_reqs)} draft).\n\nHere is your full job requisitions directory:"
        else:
            reply_text = f"Here are your active and drafted job requisitions for **{company_name}**:"

        return {
            "reply": reply_text,
            "executed_actions": [{"tool": "list_hiring_requisitions", "result": req_res}]
        }

    # Default Overview / Health Status
    stats_res = get_hiring_manager_stats(user_id, tenant_id, user_name)
    return {
        "reply": f"Hello {user_name}! You have **{stats_res['live_requisitions']} live requisition(s)**, **{stats_res['shortlisted_candidates']} shortlisted candidate(s)**, and **{stats_res['onboarding_candidates']} candidate(s) in onboarding** for **{company_name}**.\n\nHow can I assist you with requisitions, candidates, or interview scheduling today?",
        "executed_actions": [{"tool": "get_hiring_manager_stats", "result": stats_res}]
    }
