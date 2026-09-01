"""Seed comprehensive test data for all portals.

Creates tenants, users (all roles), vendor engagements, company profiles,
requisitions, candidate submissions, onboarding checklists, work orders,
timesheets, attendance, expenses, and issues.

All user passwords: 1234

Usage:
    cd backend && PYTHONPATH=. .venv/bin/python -m scripts.seed_test_data
"""
import uuid
import random
from datetime import datetime, timedelta, timezone
from modules.shared.db import db, get_session
from modules.identity.domain.models import Tenant, User
from modules.identity.services.auth_service import hash_password
from modules.requisition.domain.models import (
    Requisition,
    CompanyProfile,
    DecisionRecord,
)
from modules.candidate.domain.models import CandidateSubmission, Candidate

# ─── Helpers ────────────────────────────────────────────────────────────────
UTC = timezone.utc
_password_hash = hash_password("1234")


def _uid() -> str:
    return str(uuid.uuid4())[:8]


def _full_uid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


def _date_str(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def _week_monday(dt: datetime) -> datetime:
    return dt - timedelta(days=dt.weekday())


# ─── TENANTS ────────────────────────────────────────────────────────────────
def create_tenants():
    tenants = {}
    specs = [
        ("Acme Corp", "client"),
        ("TechVista Solutions", "client"),
        ("GlobalStaff Partners", "consultancy"),
        ("HireLink Agency", "consultancy"),
    ]
    with get_session() as session:
        for name, ttype in specs:
            existing = session.query(Tenant).filter(Tenant.name == name).first()
            if existing:
                tenants[name] = existing.id
                continue
            t = Tenant(name=name, tenant_type=ttype)
            session.add(t)
            session.flush()
            tenants[name] = t.id
        session.commit()
    print(f"✅ Tenants: {list(tenants.keys())}")
    return tenants


# ─── USERS ──────────────────────────────────────────────────────────────────
def create_users(tenants: dict) -> dict:
    """Returns {email: user_id}"""
    users = {}
    specs = [
        # Acme Corp (client)
        ("Acme Corp", "admin@acme.com", "Priya Sharma", "Admin"),
        ("Acme Corp", "director@acme.com", "Vikram Patel", "Director"),
        ("Acme Corp", "hr_acme@gmail.com", "Neha Gupta", "HR"),
        ("Acme Corp", "hm_eng@acme.com", "Ravi Kumar", "Hiring Manager"),
        ("Acme Corp", "hm_product@acme.com", "Anita Desai", "Hiring Manager"),
        # TechVista Solutions (client)
        ("TechVista Solutions", "admin@techvista.com", "Sanjay Mehta", "Admin"),
        ("TechVista Solutions", "director@techvista.com", "Kavitha Nair", "Director"),
        ("TechVista Solutions", "hr_techvista@gmail.com", "Arjun Rao", "HR"),
        ("TechVista Solutions", "hm_tech@techvista.com", "Deepa Menon", "Hiring Manager"),
        # GlobalStaff Partners (consultancy/vendor)
        ("GlobalStaff Partners", "recruiter@globalstaff.com", "Meera Joshi", "Recruiter"),
        ("GlobalStaff Partners", "recruiter2@globalstaff.com", "Rohan Verma", "Recruiter"),
        # HireLink Agency (consultancy/vendor)
        ("HireLink Agency", "recruiter@hirelink.com", "Pooja Singh", "Recruiter"),
    ]
    with get_session() as session:
        for tenant_name, email, name, role in specs:
            existing = session.query(User).filter(User.email == email).first()
            if existing:
                users[email] = existing.id
                continue
            u = User(
                tenant_id=tenants[tenant_name],
                email=email,
                name=name,
                password_hash=_password_hash,
                role=role,
                created_by="",
                is_active=True,
            )
            session.add(u)
            session.flush()
            users[email] = u.id
        session.commit()
    print(f"✅ Users: {len(users)} created/found")
    return users


# ─── VENDOR ENGAGEMENTS ────────────────────────────────────────────────────
def create_vendor_engagements(tenants: dict):
    pairs = [
        ("Acme Corp", "GlobalStaff Partners"),
        ("Acme Corp", "HireLink Agency"),
        ("TechVista Solutions", "GlobalStaff Partners"),
    ]
    count = 0
    with get_session() as session:
        for client_name, vendor_name in pairs:
            existing = session.query(
                *[
                    __import__("modules.identity.domain.models", fromlist=["VendorEngagement"]).VendorEngagement
                ]
            ).filter(
                __import__("modules.identity.domain.models", fromlist=["VendorEngagement"]).VendorEngagement.tenant_id == tenants[client_name],
                __import__("modules.identity.domain.models", fromlist=["VendorEngagement"]).VendorEngagement.vendor_tenant_id == tenants[vendor_name],
            ).first()
            if not existing:
                from modules.identity.domain.models import VendorEngagement
                ve = VendorEngagement(
                    tenant_id=tenants[client_name],
                    vendor_tenant_id=tenants[vendor_name],
                )
                session.add(ve)
                count += 1
        session.commit()
    print(f"✅ Vendor Engagements: {count} new")


# ─── COMPANY PROFILES ──────────────────────────────────────────────────────
def create_company_profiles(tenants: dict) -> dict:
    """Returns {tenant_id: profile_id}"""
    profiles = {}
    specs = [
        ("Acme Corp", "Technology", "500-1000", "Bangalore"),
        ("TechVista Solutions", "FinTech", "200-500", "Mumbai"),
    ]
    with get_session() as session:
        for tenant_name, industry, size, location in specs:
            existing = session.query(CompanyProfile).filter(
                CompanyProfile.tenant_id == tenants[tenant_name]
            ).first()
            if existing:
                profiles[tenants[tenant_name]] = existing.id
                continue
            cp = CompanyProfile(
                tenant_id=tenants[tenant_name],
                name=tenant_name,
                industry=industry,
                size=size,
                location=location,
                tech_stack=["Python", "React", "PostgreSQL", "AWS"],
                notes=f"Test company profile for {tenant_name}",
            )
            session.add(cp)
            session.flush()
            profiles[tenants[tenant_name]] = cp.id
        session.commit()
    print(f"✅ Company Profiles: {list(profiles.keys())}")
    return profiles


# ─── REQUISITIONS ──────────────────────────────────────────────────────────
def create_requisitions(tenants: dict, users: dict, profiles: dict) -> list:
    """Returns list of requisition docs"""
    roles = [
        {
            "title": "Senior Backend Engineer",
            "hm_email": "hm_eng@acme.com",
            "client": "Acme Corp",
            "status": "Published",
            "structured_role": {
                "title": "Senior Backend Engineer",
                "job_family": "Engineering / Platform",
                "must_have_skills": ["Python", "FastAPI", "PostgreSQL", "Redis"],
                "nice_to_have_skills": ["Docker", "Kubernetes", "GraphQL"],
                "seniority_level": "Senior",
                "experience": "5-8 years",
                "headcount": 2,
                "work_mode": "Hybrid",
                "location": ["Bangalore"],
                "engagement_type": "Time & Material",
                "duration": "12 months",
                "start_date": "2026-09-01",
                "ends_on": "2027-08-31",
                "weekly_hours": 40,
                "currency": "INR",
                "ceiling_internal": 2000000,
                "range_vendor_min": 1200000,
                "range_vendor_max": 1800000,
                "rate_card_cap": 1600000,
                "reporting_manager": "Ravi Kumar",
            },
        },
        {
            "title": "DevOps Engineer",
            "hm_email": "hm_eng@acme.com",
            "client": "Acme Corp",
            "status": "Published",
            "structured_role": {
                "title": "DevOps Engineer",
                "job_family": "Engineering / Infrastructure",
                "must_have_skills": ["AWS", "Terraform", "Docker", "CI/CD"],
                "nice_to_have_skills": ["Kubernetes", "Ansible", "Python"],
                "seniority_level": "Mid",
                "experience": "3-5 years",
                "headcount": 1,
                "work_mode": "Remote",
                "location": ["Bangalore"],
                "engagement_type": "Contract Staffing",
                "duration": "6 months",
                "start_date": "2026-09-15",
                "ends_on": "2027-03-14",
                "weekly_hours": 40,
                "currency": "INR",
                "ceiling_internal": 1500000,
                "range_vendor_min": 900000,
                "range_vendor_max": 1400000,
                "rate_card_cap": 1300000,
                "reporting_manager": "Ravi Kumar",
            },
        },
        {
            "title": "UI/UX Designer",
            "hm_email": "hm_product@acme.com",
            "client": "Acme Corp",
            "status": "Published",
            "structured_role": {
                "title": "UI/UX Designer",
                "job_family": "Design",
                "must_have_skills": ["Figma", "User Research", "Wireframing"],
                "nice_to_have_skills": ["Adobe XD", "Prototyping", "Design Systems"],
                "seniority_level": "Mid",
                "experience": "2-4 years",
                "headcount": 1,
                "work_mode": "Hybrid",
                "location": ["Mumbai"],
                "engagement_type": "Time & Material",
                "duration": "9 months",
                "start_date": "2026-09-01",
                "ends_on": "2027-05-31",
                "weekly_hours": 40,
                "currency": "INR",
                "ceiling_internal": 1200000,
                "range_vendor_min": 700000,
                "range_vendor_max": 1100000,
                "rate_card_cap": 1000000,
                "reporting_manager": "Anita Desai",
            },
        },
        {
            "title": "Senior Python Developer",
            "hm_email": "hm_tech@techvista.com",
            "client": "TechVista Solutions",
            "status": "Published",
            "structured_role": {
                "title": "Senior Python Developer",
                "job_family": "Engineering / Backend",
                "must_have_skills": ["Python", "Django", "REST API", "PostgreSQL"],
                "nice_to_have_skills": ["Celery", "Redis", "Docker"],
                "seniority_level": "Senior",
                "experience": "5-8 years",
                "headcount": 1,
                "work_mode": "On-site",
                "location": ["Mumbai"],
                "engagement_type": "Contract Staffing",
                "duration": "12 months",
                "start_date": "2026-08-15",
                "ends_on": "2027-08-14",
                "weekly_hours": 40,
                "currency": "INR",
                "ceiling_internal": 1800000,
                "range_vendor_min": 1100000,
                "range_vendor_max": 1700000,
                "rate_card_cap": 1500000,
                "reporting_manager": "Deepa Menon",
            },
        },
        {
            "title": "Frontend Developer",
            "hm_email": "hm_tech@techvista.com",
            "client": "TechVista Solutions",
            "status": "Completed",
            "structured_role": {
                "title": "Frontend Developer",
                "job_family": "Engineering / Frontend",
                "must_have_skills": ["React", "TypeScript", "HTML/CSS"],
                "nice_to_have_skills": ["Next.js", "Tailwind CSS", "Testing"],
                "seniority_level": "Mid",
                "experience": "3-5 years",
                "headcount": 1,
                "work_mode": "Hybrid",
                "location": ["Mumbai"],
                "engagement_type": "Time & Material",
                "duration": "6 months",
                "start_date": "2026-07-01",
                "ends_on": "2026-12-31",
                "weekly_hours": 40,
                "currency": "INR",
                "ceiling_internal": 1400000,
                "range_vendor_min": 800000,
                "range_vendor_max": 1300000,
                "rate_card_cap": 1200000,
                "reporting_manager": "Deepa Menon",
            },
        },
        {
            "title": "Data Analyst",
            "hm_email": "hm_eng@acme.com",
            "client": "Acme Corp",
            "status": "Completed",
            "structured_role": {
                "title": "Data Analyst",
                "job_family": "Data & Analytics",
                "must_have_skills": ["SQL", "Python", "Tableau"],
                "nice_to_have_skills": ["R", "Power BI", "Machine Learning"],
                "seniority_level": "Junior",
                "experience": "1-3 years",
                "headcount": 1,
                "work_mode": "On-site",
                "location": ["Bangalore"],
                "engagement_type": "Contract Staffing",
                "duration": "9 months",
                "start_date": "2026-06-01",
                "ends_on": "2027-02-28",
                "weekly_hours": 40,
                "currency": "INR",
                "ceiling_internal": 1000000,
                "range_vendor_min": 600000,
                "range_vendor_max": 900000,
                "rate_card_cap": 850000,
                "reporting_manager": "Ravi Kumar",
            },
        },
        {
            "title": "Mobile App Developer",
            "hm_email": "hm_product@acme.com",
            "client": "Acme Corp",
            "status": "Closed",
            "structured_role": {
                "title": "Mobile App Developer",
                "job_family": "Engineering / Mobile",
                "must_have_skills": ["React Native", "JavaScript", "iOS/Android"],
                "nice_to_have_skills": ["TypeScript", "Firebase", "CI/CD"],
                "seniority_level": "Mid",
                "experience": "3-5 years",
                "headcount": 1,
                "work_mode": "Remote",
                "location": ["Bangalore"],
                "engagement_type": "Time & Material",
                "duration": "6 months",
                "start_date": "2026-05-01",
                "ends_on": "2026-10-31",
                "weekly_hours": 40,
                "currency": "INR",
                "ceiling_internal": 1400000,
                "range_vendor_min": 800000,
                "range_vendor_max": 1300000,
                "rate_card_cap": 1200000,
                "reporting_manager": "Anita Desai",
            },
        },
        {
            "title": "QA Automation Engineer",
            "hm_email": "hm_eng@acme.com",
            "client": "Acme Corp",
            "status": "Closed",
            "structured_role": {
                "title": "QA Automation Engineer",
                "job_family": "Engineering / QA",
                "must_have_skills": ["Selenium", "Python", "REST API Testing"],
                "nice_to_have_skills": ["Cypress", "Jenkins", "Performance Testing"],
                "seniority_level": "Mid",
                "experience": "3-5 years",
                "headcount": 1,
                "work_mode": "Hybrid",
                "location": ["Bangalore"],
                "engagement_type": "Contract Staffing",
                "duration": "12 months",
                "start_date": "2026-04-01",
                "ends_on": "2027-03-31",
                "weekly_hours": 40,
                "currency": "INR",
                "ceiling_internal": 1300000,
                "range_vendor_min": 750000,
                "range_vendor_max": 1200000,
                "rate_card_cap": 1100000,
                "reporting_manager": "Ravi Kumar",
            },
        },
    ]

    requisitions = []
    with get_session() as session:
        for r in roles:
            tenant_id = tenants[r["client"]]
            hm_id = users[r["hm_email"]]
            cp_id = profiles.get(tenant_id)
            req_id = _full_uid()
            req = Requisition(
                id=req_id,
                tenant_id=tenant_id,
                company_profile_id=cp_id,
                created_by=hm_id,
                status=r["status"],
                title=r["title"],
                structured_role=r["structured_role"],
                intake_answers=[],
                refinement_log=[],
                intake_meta={},
                created_at=_now() - timedelta(days=random.randint(5, 30)),
            )
            session.add(req)
            requisitions.append({
                "id": req_id,
                "tenant_id": tenant_id,
                "hm_id": hm_id,
                "hm_email": r["hm_email"],
                "client": r["client"],
                "title": r["title"],
                "status": r["status"],
                "structured_role": r["structured_role"],
            })
        session.commit()
    print(f"✅ Requisitions: {len(requisitions)} created")
    return requisitions


# ─── CANDIDATES (MongoDB submissions + users) ──────────────────────────────
def create_candidate_submissions(requisitions: list, tenants: dict, users: dict) -> list:
    """Create candidate submissions and candidate user accounts. Returns list of sub docs."""
    first_names = [
        "Arjun", "Sneha", "Vikram", "Priya", "Rohan", "Kavya", "Aditya",
        "Deepika", "Karthik", "Neha", "Rahul", "Pooja", "Sanjay", "Meera",
        "Amit", "Divya", "Vijay", "Ananya", "Gaurav", "Shruti", "Nikhil",
        "Ishita", "Rajesh", "Swati", "Manish", "Kavita", "Suresh", "Ritu",
        "Vikash", "Prachi",
    ]
    last_names = [
        "Sharma", "Patel", "Kumar", "Gupta", "Singh", "Reddy", "Nair",
        "Menon", "Verma", "Joshi", "Rao", "Desai", "Iyer", "Mishra",
        "Bhat", "Kapoor", "Chowdhury", "Das", "Tiwari", "Mehta",
    ]
    skill_pool = [
        "Python", "React", "AWS", "Docker", "Kubernetes", "PostgreSQL",
        "FastAPI", "Django", "TypeScript", "Node.js", "Redis", "MongoDB",
        "Terraform", "CI/CD", "Figma", "GraphQL", "Java", "Go", "Rust",
        "Machine Learning", "TensorFlow", "SQL", "Tableau", "R",
    ]
    vendor_tenant_id = tenants["GlobalStaff Partners"]

    submissions = []
    name_idx = 0
    with get_session() as session:
        for req in requisitions:
            num_candidates = random.randint(2, 4)
            sr = req["structured_role"]
            req_skills = set(sr.get("must_have_skills", []) + sr.get("nice_to_have_skills", []))

            for i in range(num_candidates):
                cand_id = f"BEAR-{uuid.uuid4().hex[:8]}"
                fname = first_names[name_idx % len(first_names)]
                lname = last_names[name_idx % len(last_names)]
                name = f"{fname} {lname}"
                email = f"{fname.lower()}.{lname.lower()}@testcandidate.com"
                name_idx += 1

                # Pick 3-7 random skills, try to include some matching
                matched = list(req_skills & set(random.sample(skill_pool, min(len(skill_pool), 7))))
                extra = [s for s in random.sample(skill_pool, 4) if s not in matched]
                cand_skills = matched + extra[:3]
                missing = [s for s in req_skills if s not in cand_skills][:3]

                score = random.randint(45, 92)
                if req["status"] == "Closed":
                    status = random.choice(["Rejected", "Accepted"])
                elif req["status"] == "Completed":
                    status = random.choice(["Accepted", "Shortlisted"])
                else:
                    status = random.choice(["Screened", "Shortlisted", "Accepted", "Screened", "Screened"])

                sub_id = _full_uid()

                # Create submission
                sub = CandidateSubmission(
                    id=sub_id,
                    requisition_id=req["id"],
                    candidate_name=name,
                    candidate_email=email,
                    vendor_name="GlobalStaff Partners",
                    filename=f"{fname.lower()}_{lname.lower()}_resume.pdf",
                    match_score=score,
                    recommendation="Strong Match" if score > 75 else ("Match" if score > 60 else "Partial Match"),
                    status=status,
                    summary=f"{name} is a {sr.get('seniority_level', 'Mid')} level professional with experience in {', '.join(cand_skills[:3])}.",
                    details={
                        "experience_years": random.randint(1, 8),
                        "education": random.choice(["B.Tech", "M.Tech", "MCA", "B.Sc CS"]),
                        "current_company": random.choice(["TCS", "Infosys", "Wipro", "Startup X", "Freelance"]),
                    },
                    matched_skills=matched,
                    missing_skills=missing,
                    created_at=_now() - timedelta(days=random.randint(3, 25)),
                )
                session.add(sub)

                # Create candidate user account
                existing_user = session.query(User).filter(User.email == email).first()
                if not existing_user:
                    cu = User(
                        tenant_id=vendor_tenant_id,
                        email=email,
                        name=name,
                        password_hash=_password_hash,
                        role="Candidate",
                        candidate_id=cand_id,
                        created_by=users.get("recruiter@globalstaff.com", ""),
                        is_active=True,
                    )
                    session.add(cu)

                # Also create in candidates bank
                existing_bank = None  # skip complex check
                cand_bank = Candidate(
                    id=cand_id,
                    candidate_name=name,
                    candidate_title=sr.get("title", ""),
                    candidate_email=email,
                    candidate_phone=f"+91{random.randint(7000000000, 9999999999)}",
                    vendor_company_name="GlobalStaff Partners",
                    skills=cand_skills,
                    filename=f"{fname.lower()}_{lname.lower()}_resume.pdf",
                    summary=f"Experienced {sr.get('title', 'professional')} with {random.randint(1, 8)} years in {', '.join(cand_skills[:3])}.",
                    tenant_id=vendor_tenant_id,
                )
                session.add(cand_bank)

                submissions.append({
                    "sub_id": sub_id,
                    "cand_id": cand_id,
                    "candidate_name": name,
                    "candidate_email": email,
                    "requisition_id": req["id"],
                    "client": req["client"],
                    "hm_email": req["hm_email"],
                    "hm_id": req["hm_id"],
                    "vendor_tenant_id": vendor_tenant_id,
                    "title": req["title"],
                    "status": status,
                    "score": score,
                    "vendor_name": "GlobalStaff Partners",
                    "tenant_id": req["tenant_id"],
                    "structured_role": sr,
                    "skills": cand_skills,
                })

        session.commit()
    print(f"✅ Candidate Submissions: {len(submissions)} created")
    return submissions


# ─── ONBOARDING CHECKLISTS ─────────────────────────────────────────────────
def create_onboarding_checklists(submissions: list) -> list:
    """Create onboarding checklists for Accepted candidates. Returns list of checklist docs."""
    accepted = [s for s in submissions if s["status"] == "Accepted"]
    checklists = []

    default_sw = [
        {"name": "VS Code / IDE", "category": "IDE", "required": True},
        {"name": "Slack", "category": "Communication", "required": True},
        {"name": "GitHub Access", "category": "Source Control", "required": True},
        {"name": "AWS Console", "category": "Cloud", "required": False},
    ]
    default_training = [
        {"name": "Security Awareness", "type": "Mandatory", "status": "pending"},
        {"name": "Company Policies", "type": "Mandatory", "status": "pending"},
        {"name": "Team Intro", "type": "Optional", "status": "pending"},
    ]

    for s in accepted:
        checklist_id = _full_uid()
        num_done_sw = random.randint(0, len(default_sw))
        num_done_tr = random.randint(0, len(default_training))

        software = []
        for i, sw in enumerate(default_sw):
            item = dict(sw)
            item["id"] = f"sw_{_uid()}"
            item["status"] = "completed" if i < num_done_sw else "pending"
            software.append(item)

        training = []
        for i, tr in enumerate(default_training):
            item = dict(tr)
            item["id"] = f"tr_{_uid()}"
            item["status"] = "completed" if i < num_done_tr else "pending"
            training.append(item)

        # Activation gates
        gates = [
            {"id": f"g_{_uid()}", "label": "PAN, Aadhaar, bank details", "responsible": "Worker", "type": "blocking", "status": "cleared"},
            {"id": f"g_{_uid()}", "label": "NDA and IP assignment", "responsible": "Worker", "type": "blocking", "status": "cleared"},
            {"id": f"g_{_uid()}", "label": "PF and ESIC declaration", "responsible": "TalentBridge", "type": "blocking", "status": "cleared"},
            {"id": f"g_{_uid()}", "label": "Background verification pack", "responsible": "TalentBridge", "type": "blocking", "status": "cleared"},
            {"id": f"g_{_uid()}", "label": "Access provisioning — AD, VPN, badge", "responsible": "Buyer IT", "type": "blocking", "status": "cleared"},
            {"id": f"g_{_uid()}", "label": "Site safety induction", "responsible": "Buyer EHS", "type": "blocking", "status": "cleared"},
            {"id": f"g_{_uid()}", "label": "Laptop issuance", "responsible": "Buyer IT", "type": "warn_only", "status": "cleared"},
            {"id": f"g_{_uid()}", "label": "Manager orientation", "responsible": s["hm_email"].split("@")[0], "type": "warn_only", "status": "cleared"},
        ]

        all_blocking_cleared = all(g["status"] == "cleared" for g in gates if g["type"] == "blocking")
        total_items = len(software) + len(training)
        done_items = sum(1 for sw in software if sw["status"] == "completed") + sum(1 for tr in training if tr["status"] == "completed")
        completion_pct = round((done_items / total_items) * 100) if total_items else 0

        status = "Completed" if completion_pct == 100 else ("In Progress" if completion_pct > 0 else "Not Started")

        doc = {
            "candidate_id": s["cand_id"],
            "candidate_name": s["candidate_name"],
            "candidate_email": s["candidate_email"],
            "requisition_id": s["requisition_id"],
            "requisition_ref": f"REQ-{s['requisition_id'][:6].upper()}",
            "requisition_title": s["title"],
            "company_name": s["client"],
            "vendor_name": s["vendor_name"],
            "hm_id": s["hm_id"],
            "tenant_id": s["tenant_id"],
            "software": software,
            "training": training,
            "activation_gates": gates,
            "status": status,
            "completion_percentage": completion_pct,
            "created_at": _now() - timedelta(days=random.randint(2, 15)),
            "updated_at": _now(),
        }
        db["onboarding_checklists"].insert_one(doc)
        checklists.append(doc)

    print(f"✅ Onboarding Checklists: {len(checklists)} created")
    return checklists


# ─── WORK ORDERS ───────────────────────────────────────────────────────────
def create_work_orders(submissions: list, checklists: list) -> list:
    """Create work orders for accepted candidates. Returns list of wo docs."""
    accepted = [s for s in submissions if s["status"] == "Accepted"]
    checklist_map = {c["candidate_id"]: c for c in checklists}
    work_orders = []

    for s in accepted:
        sr = s["structured_role"]
        wo_id = _full_uid()
        start = datetime.strptime(sr.get("start_date", "2026-09-01"), "%Y-%m-%d").replace(tzinfo=UTC)
        end = datetime.strptime(sr.get("ends_on", "2027-02-28"), "%Y-%m-%d").replace(tzinfo=UTC)
        is_active = start <= _now()
        ob = checklist_map.get(s["cand_id"], {})
        gates = ob.get("activation_gates", [])
        all_blocking = all(g["status"] == "cleared" for g in gates if g.get("type") == "blocking")
        status = "ACTIVE" if is_active and all_blocking else "PENDING"

        wo = {
            "id": wo_id,
            "work_order_number": f"WO-2026-{uuid.uuid4().hex[:4].upper()}",
            "tenant_id": s["tenant_id"],
            "requisition_id": s["requisition_id"],
            "requisition_title": s["title"],
            "candidate_id": s["cand_id"],
            "candidate_name": s["candidate_name"],
            "candidate_email": s["candidate_email"],
            "vendor_name": s["vendor_name"],
            "company_name": s["client"],
            "bill_rate": random.choice([1200, 1500, 1800, 2200, 2500]),
            "rate_basis": "hourly",
            "currency": "INR",
            "start_date": _date_str(start),
            "end_date": _date_str(end),
            "weekly_hours": sr.get("weekly_hours", 40),
            "location": sr.get("location", ["Bangalore"])[0] if isinstance(sr.get("location"), list) else sr.get("location", "Bangalore"),
            "work_arrangement": sr.get("work_mode", "Hybrid"),
            "reporting_manager": sr.get("reporting_manager", s["hm_email"].split("@")[0]),
            "overtime_eligible": random.choice([True, False]),
            "overtime_policy": "Standard 40h/week cap, overtime requires prior manager approval",
            "engagement_type": sr.get("engagement_type", "Contract Staffing"),
            "status": status,
            "created_at": _now() - timedelta(days=random.randint(1, 10)),
            "updated_at": _now(),
        }
        db["work_orders"].insert_one(wo)
        work_orders.append(wo)

    print(f"✅ Work Orders: {len(work_orders)} created ({sum(1 for w in work_orders if w['status'] == 'ACTIVE')} active)")
    return work_orders


# ─── TIMESHEETS ────────────────────────────────────────────────────────────
def create_timesheets(work_orders: list) -> list:
    """Create realistic weekly timesheets for active work orders. Returns list of ts docs."""
    active_wos = [w for w in work_orders if w["status"] == "ACTIVE"]
    all_timesheets = []

    for wo in active_wos:
        start = datetime.strptime(wo["start_date"], "%Y-%m-%d")
        now = _now()
        # Go back up to 8 weeks
        weeks = []
        current = _week_monday(now - timedelta(weeks=7))
        while current <= now:
            weeks.append(current)
            current += timedelta(weeks=1)

        for i, monday in enumerate(weeks):
            sunday = monday + timedelta(days=6)
            # Skip future weeks
            if monday > now:
                break

            ts_id = _full_uid()
            # Realistic daily entries Mon-Fri
            daily = []
            total_hours = 0
            for day_offset in range(7):
                day = monday + timedelta(days=day_offset)
                is_weekend = day_offset >= 5
                if is_weekend:
                    hours = 0
                else:
                    # Most days 7.5-9h, occasional 6h or 10h
                    if random.random() < 0.1:
                        hours = random.choice([0, 6])  # leave day or half day
                    elif random.random() < 0.05:
                        hours = random.choice([10, 10.5, 11])  # overtime
                    else:
                        hours = round(random.uniform(7.5, 9), 1)
                total_hours += hours
                daily.append({
                    "date": _date_str(day),
                    "day": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day_offset],
                    "hours": hours,
                    "note": "" if hours > 0 else ("Weekend" if is_weekend else "Leave"),
                })

            overtime = max(0, total_hours - 40)
            regular = min(total_hours, 40)

            # Status progression: older weeks approved, recent ones submitted/draft
            weeks_ago = (now.date() - monday.date()).days // 7
            if weeks_ago >= 3:
                ts_status = "APPROVED"
            elif weeks_ago >= 1:
                ts_status = random.choice(["SUBMITTED", "APPROVED"])
            elif weeks_ago == 0:
                ts_status = random.choice(["DRAFT", "SUBMITTED"])
            else:
                continue

            wo_start = datetime.strptime(wo["start_date"], "%Y-%m-%d")
            wo_start_dt = wo_start.replace(tzinfo=UTC) if wo_start.tzinfo is None else wo_start
            if monday.date() < wo_start_dt.date():
                continue

            ts = {
                "id": ts_id,
                "timesheet_number": f"TS-{monday.year}-W{monday.isocalendar()[1]:02d}-{uuid.uuid4().hex[:4].upper()}",
                "type": "HOURLY_TIMESHEET",
                "work_order_id": wo["id"],
                "work_order_number": wo["work_order_number"],
                "tenant_id": wo["tenant_id"],
                "vendor_id": "",
                "vendor_name": wo.get("vendor_name", ""),
                "candidate_id": wo["candidate_id"],
                "worker_name": wo["candidate_name"],
                "week_start_date": _date_str(monday),
                "week_end_date": _date_str(sunday),
                "daily_entries": daily,
                "total_regular_hours": round(regular, 1),
                "total_overtime_hours": round(overtime, 1),
                "total_hours": round(total_hours, 1),
                "expected_hours": 40.0,
                "bill_rate": wo.get("bill_rate", 1500),
                "rate_basis": "hourly",
                "gross_amount": round(total_hours * wo.get("bill_rate", 1500), 2),
                "status": ts_status,
                "has_exceptions": overtime > 0 or any(d["hours"] == 0 and d["day"] in ["Mon","Tue","Wed","Thu","Fri"] for d in daily),
                "exception_flags": (['OVERTIME'] if overtime > 0 else []) + (['ABSENCE'] if any(d['hours'] == 0 and d['day'] in ['Mon','Tue','Wed','Thu','Fri'] for d in daily) else []),
                "ai_insights": {},
                "rejection_reason": "",
                "approved_by": wo["reporting_manager"] if ts_status == "APPROVED" else "",
                "approved_at": _date_str(now - timedelta(days=weeks_ago * 7)) if ts_status == "APPROVED" else "",
                "submitted_at": _date_str(now - timedelta(days=max(0, weeks_ago * 7 - 1))) if ts_status in ["SUBMITTED", "APPROVED"] else "",
                "created_at": _now() - timedelta(days=weeks_ago * 7),
                "updated_at": _now(),
            }
            db["timesheets"].insert_one(ts)
            all_timesheets.append(ts)

    print(f"✅ Timesheets: {len(all_timesheets)} created ({sum(1 for t in all_timesheets if t['status'] == 'APPROVED')} approved)")
    return all_timesheets


# ─── ATTENDANCE ────────────────────────────────────────────────────────────
def create_attendance(work_orders: list):
    """Create monthly attendance for active work orders."""
    active_wos = [w for w in work_orders if w["status"] == "ACTIVE"]
    count = 0
    now = _now()
    month_str = now.strftime("%Y-%m")

    for wo in active_wos:
        existing = db["attendance_sheets"].find_one({
            "candidate_id": wo["candidate_id"],
            "month_year": month_str,
        })
        if existing:
            continue

        present = random.randint(18, 23)
        doc = {
            "id": _full_uid(),
            "attendance_number": f"ATT-{month_str}-{uuid.uuid4().hex[:4].upper()}",
            "type": "MONTHLY_ATTENDANCE",
            "work_order_id": wo["id"],
            "work_order_number": wo["work_order_number"],
            "tenant_id": wo["tenant_id"],
            "candidate_id": wo["candidate_id"],
            "worker_name": wo["candidate_name"],
            "month_year": month_str,
            "total_calendar_days": 30,
            "present_days": present,
            "paid_leave_days": random.randint(0, 2),
            "client_holidays": 1,
            "absent_days": 0,
            "payable_days": float(present + 1),
            "status": "ACTIVE",
            "created_at": _now(),
            "updated_at": _now(),
        }
        db["attendance_sheets"].insert_one(doc)
        count += 1

    print(f"✅ Attendance Sheets: {count} created")


# ─── EXPENSES ──────────────────────────────────────────────────────────────
def create_expenses(work_orders: list):
    """Create expense claims for active work orders."""
    active_wos = [w for w in work_orders if w["status"] == "ACTIVE"]
    count = 0
    categories = [
        ("Travel", "Auto/cab to office", (150, 800)),
        ("Food", "Team lunch", (200, 600)),
        ("Accommodation", "Client site stay", (2000, 5000)),
        ("Software", "Annual license", (500, 3000)),
        ("Internet", "Home broadband", (500, 1200)),
        ("Training", "Online course", (1000, 5000)),
    ]

    for wo in active_wos:
        num_expenses = random.randint(1, 3)
        for _ in range(num_expenses):
            cat = random.choice(categories)
            amt = round(random.uniform(cat[2][0], cat[2][1]), 2)
            exp_status = random.choice(["Pending", "Pending", "Approved", "Rejected"])

            doc = {
                "id": f"exp_{uuid.uuid4().hex[:10]}",
                "candidate_id": wo["candidate_id"],
                "candidate_name": wo["candidate_name"],
                "work_order_number": wo["work_order_number"],
                "date": _date_str(_now() - timedelta(days=random.randint(1, 25))),
                "date_label": "",
                "category": cat[0],
                "description": cat[1],
                "amount": amt,
                "currency": "INR",
                "receipt_name": f"receipt_{uuid.uuid4().hex[:6]}.pdf",
                "status": exp_status,
                "notes": "",
                "tenant_id": wo["tenant_id"],
                "rejection_reason": "Receipt not provided" if exp_status == "Rejected" else "",
                "approved_by": wo["reporting_manager"] if exp_status == "Approved" else "",
                "approved_at": _date_str(_now() - timedelta(days=random.randint(0, 5))) if exp_status == "Approved" else "",
                "rejected_by": wo["reporting_manager"] if exp_status == "Rejected" else "",
                "rejected_at": _date_str(_now() - timedelta(days=random.randint(0, 5))) if exp_status == "Rejected" else "",
                "created_at": _now() - timedelta(days=random.randint(1, 25)),
            }
            db["candidate_expenses"].insert_one(doc)
            count += 1

    print(f"✅ Expenses: {count} created ({sum(1 for _ in db['candidate_expenses'].find({'status': 'Pending'}))} pending)")


# ─── ONBOARDING ISSUES ────────────────────────────────────────────────────
def create_issues(submissions: list):
    """Create onboarding issues for accepted candidates."""
    accepted = [s for s in submissions if s["status"] == "Accepted"]
    issues = [
        ("Badge / ID Card", "Badge not provided yet", "Open"),
        ("Laptop Setup", "VPN client not installing on M1 Mac", "Open"),
        ("Slack Access", "Cannot join #engineering channel", "Resolved"),
        ("VPN Configuration", "Unable to connect to office network", "Open"),
        ("Parking Pass", "Need visitor parking for first week", "Resolved"),
    ]

    count = 0
    for s in accepted[:4]:
        issue = random.choice(issues)
        doc = {
            "id": f"issue_{uuid.uuid4().hex[:8]}",
            "candidate_id": s["cand_id"],
            "candidate_name": s["candidate_name"],
            "requisition_id": s["requisition_id"],
            "title": issue[0],
            "description": issue[1],
            "status": issue[2],
            "priority": random.choice(["Low", "Medium", "High"]),
            "resolution_notes": "Fixed — check your email" if issue[2] == "Resolved" else "",
            "resolved_by": s["hm_email"] if issue[2] == "Resolved" else "",
            "resolved_at": _date_str(_now() - timedelta(days=1)) if issue[2] == "Resolved" else "",
            "tenant_id": s["tenant_id"],
            "created_at": _now() - timedelta(days=random.randint(1, 10)),
        }
        db["onboarding_issues"].insert_one(doc)
        count += 1

    print(f"✅ Onboarding Issues: {count} created")


# ─── MAIN ──────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("🌱 SEEDING TEST DATA")
    print("=" * 60)

    tenants = create_tenants()
    users = create_users(tenants)
    create_vendor_engagements(tenants)
    profiles = create_company_profiles(tenants)
    requisitions = create_requisitions(tenants, users, profiles)
    submissions = create_candidate_submissions(requisitions, tenants, users)
    checklists = create_onboarding_checklists(submissions)
    work_orders = create_work_orders(submissions, checklists)
    create_timesheets(work_orders)
    create_attendance(work_orders)
    create_expenses(work_orders)
    create_issues(submissions)

    print()
    print("=" * 60)
    print("🎉 SEED COMPLETE")
    print("=" * 60)
    print()
    print("LOGIN CREDENTIALS (password: 1234 for all):")
    print("-" * 50)
    print("  Acme Corp (Client):")
    print("    Admin:      admin@acme.com")
    print("    Director:   director@acme.com")
    print("    HR:         hr_acme@gmail.com")
    print("    HM (Eng):   hm_eng@acme.com")
    print("    HM (Prod):  hm_product@acme.com")
    print()
    print("  TechVista Solutions (Client):")
    print("    Admin:      admin@techvista.com")
    print("    Director:   director@techvista.com")
    print("    HR:         hr_techvista@gmail.com")
    print("    HM (Tech):  hm_tech@techvista.com")
    print()
    print("  GlobalStaff Partners (Vendor):")
    print("    Recruiter:  recruiter@globalstaff.com")
    print("    Recruiter:  recruiter2@globalstaff.com")
    print()
    print("  HireLink Agency (Vendor):")
    print("    Recruiter:  recruiter@hirelink.com")
    print()
    print("  Old accounts still work:")
    print("    Super Admin: ADMIN / ADMIN")
    print("    Bearitt HM:  hr@gmail.com")
    print("    Bridgeon:    hashil@gmail.com")


if __name__ == "__main__":
    main()
