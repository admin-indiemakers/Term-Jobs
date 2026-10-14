"""Seed 9 Standard Pre-Approved Role Templates for Buyer Company PEAR"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from modules.shared.db import get_session, db as mongo_db
from modules.requisition.domain import models
from modules.identity.domain.models import Tenant, User

PEAR_TENANT_ID = "5539fe83-b044-48a5-8711-4e811f4f9a1c"

TEMPLATES = [
    {
        "name": "Senior Frontend React Engineer",
        "title": "Senior React Developer",
        "job_family": "Engineering / Frontend",
        "priority": "Normal",
        "must_have_skills": ["React.js", "TypeScript", "Redux Toolkit", "REST APIs", "Tailwind CSS"],
        "nice_to_have_skills": ["Next.js", "GraphQL", "Docker", "Jest / React Testing Library"],
        "experience": "3-5 years",
        "headcount": 1,
        "certifications": ["Meta Certified Frontend Developer", "AWS Certified Cloud Practitioner"],
        "engagement_type": "Contract",
        "duration": "6 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 800,
        "vendor_cap": 1200,
        "ceiling_internal": 1400,
        "work_mode": "Remote",
        "primary_location": "Bangalore / Remote",
        "equipment_provided": "Company-provided",
        "bgv_required": "Standard",
        "nda_required": "Yes",
        "description": "Pre-approved profile for UI engineering pods. Candidates must have extensive experience in state management, responsive UI systems, and component testing.",
    },
    {
        "name": "Senior Backend Python / FastAPI Engineer",
        "title": "Senior Python Backend Developer",
        "job_family": "Engineering / Backend",
        "priority": "High",
        "must_have_skills": ["Python 3.11+", "FastAPI", "PostgreSQL", "Redis", "AsyncIO", "Docker"],
        "nice_to_have_skills": ["Celery", "Kafka", "SQLAlchemy ORM", "AWS ECS", "Kubernetes"],
        "experience": "5-8 years",
        "headcount": 2,
        "certifications": ["AWS Certified Solutions Architect Associate", "Python Institute PCAP"],
        "engagement_type": "Contract",
        "duration": "12 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 1100,
        "vendor_cap": 1600,
        "ceiling_internal": 1800,
        "work_mode": "Hybrid",
        "primary_location": "Bangalore / Hybrid (2 days)",
        "equipment_provided": "Company-provided",
        "bgv_required": "Comprehensive",
        "nda_required": "Yes",
        "description": "Core platform microservices engineering. Strong async patterns, high-concurrency API architectures, and robust relational data modeling required.",
    },
    {
        "name": "Cloud DevOps & Platform SRE Lead",
        "title": "Senior DevOps / SRE Engineer",
        "job_family": "Infrastructure / Cloud",
        "priority": "High",
        "must_have_skills": ["Kubernetes", "Terraform", "AWS", "GitHub Actions CI/CD", "Docker", "Linux Shell"],
        "nice_to_have_skills": ["Prometheus & Grafana", "ArgoCD", "Helm", "Datadog", "Istio Service Mesh"],
        "experience": "5-8 years",
        "headcount": 1,
        "certifications": ["CKA (Certified Kubernetes Administrator)", "AWS DevOps Engineer Professional"],
        "engagement_type": "Contract",
        "duration": "12 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 1300,
        "vendor_cap": 1850,
        "ceiling_internal": 2100,
        "work_mode": "Remote",
        "primary_location": "Remote (India)",
        "equipment_provided": "Company-provided",
        "bgv_required": "Comprehensive",
        "nda_required": "Yes",
        "description": "Infrastructure automation and resilient container orchestration. Deep proficiency with GitOps, Terraform module patterns, and zero-downtime releases.",
    },
    {
        "name": "Data & AI Platform Engineer",
        "title": "Lead Data & Machine Learning Engineer",
        "job_family": "Data & Analytics",
        "priority": "Normal",
        "must_have_skills": ["Apache Spark / PySpark", "Python", "SQL", "Databricks", "Delta Lake", "Airflow"],
        "nice_to_have_skills": ["Snowflake", "dbt", "LangChain / LLM APIs", "Kafka", "MLflow"],
        "experience": "5-8 years",
        "headcount": 1,
        "certifications": ["Databricks Certified Data Engineer Associate", "Google Professional Data Engineer"],
        "engagement_type": "Contract",
        "duration": "6 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 1200,
        "vendor_cap": 1750,
        "ceiling_internal": 1950,
        "work_mode": "Remote",
        "primary_location": "Hyderabad / Remote",
        "equipment_provided": "Company-provided",
        "bgv_required": "Standard",
        "nda_required": "Yes",
        "description": "Architecting scalable data lake pipelines and productionizing model inference features across large batch and streaming datasets.",
    },
    {
        "name": "Full Stack Node.js & React Specialist",
        "title": "Full Stack Software Engineer",
        "job_family": "Engineering / Full Stack",
        "priority": "Normal",
        "must_have_skills": ["Node.js", "Express", "React", "TypeScript", "MongoDB", "REST APIs"],
        "nice_to_have_skills": ["Next.js", "Tailwind CSS", "Redis", "Jest", "Microservices"],
        "experience": "3-5 years",
        "headcount": 2,
        "certifications": ["OpenJS Certified Application Developer (JSNAD)"],
        "engagement_type": "Contract",
        "duration": "6 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 850,
        "vendor_cap": 1250,
        "ceiling_internal": 1450,
        "work_mode": "Remote",
        "primary_location": "Bangalore / Remote",
        "equipment_provided": "Company-provided",
        "bgv_required": "Standard",
        "nda_required": "Yes",
        "description": "End-to-end full stack development for internal customer portal pods. Strong TypeScript capabilities on both client and server layers.",
    },
    {
        "name": "QA Automation Lead (Playwright / Cypress)",
        "title": "Lead SDET / QA Automation Engineer",
        "job_family": "Quality Assurance",
        "priority": "Normal",
        "must_have_skills": ["Playwright", "TypeScript", "Postman", "CI/CD Test Pipelines", "REST API Testing"],
        "nice_to_have_skills": ["Cypress", "Selenium", "JMeter / k6", "Docker", "Allure Reporting"],
        "experience": "3-5 years",
        "headcount": 1,
        "certifications": ["ISTQB Advanced Level Test Automation Engineer"],
        "engagement_type": "Contract",
        "duration": "6 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 750,
        "vendor_cap": 1100,
        "ceiling_internal": 1300,
        "work_mode": "Remote",
        "primary_location": "Remote (India)",
        "equipment_provided": "Company-provided",
        "bgv_required": "Standard",
        "nda_required": "Yes",
        "description": "Standardized automation framework maintenance. Must write robust end-to-end browser tests in TypeScript and maintain regression suites in CI/CD.",
    },
    {
        "name": "Mobile Engineer (React Native / iOS & Android)",
        "title": "Senior React Native Mobile Developer",
        "job_family": "Engineering / Mobile",
        "priority": "Normal",
        "must_have_skills": ["React Native", "TypeScript", "iOS Swift basics", "Android Kotlin basics", "Redux"],
        "nice_to_have_skills": ["Fastlane", "Firebase App Distribution", "Push Notifications", "App Store Deployment"],
        "experience": "3-5 years",
        "headcount": 1,
        "certifications": ["Meta Certified Mobile Developer"],
        "engagement_type": "Contract",
        "duration": "6 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 950,
        "vendor_cap": 1400,
        "ceiling_internal": 1600,
        "work_mode": "Remote",
        "primary_location": "Bangalore / Remote",
        "equipment_provided": "Company-provided",
        "bgv_required": "Standard",
        "nda_required": "Yes",
        "description": "Cross-platform mobile application development with smooth 60fps native gestures, offline caching, and biometric authentication.",
    },
    {
        "name": "UI/UX Product Designer",
        "title": "Senior Product Designer",
        "job_family": "Product & Design",
        "priority": "Normal",
        "must_have_skills": ["Figma", "Design Systems", "UX Research", "Wireframing", "Interactive Prototyping"],
        "nice_to_have_skills": ["Usability Testing", "Design Tokens", "HTML/CSS fundamentals", "Micro-interactions"],
        "experience": "3-5 years",
        "headcount": 1,
        "certifications": ["Nielsen Norman UX Certification"],
        "engagement_type": "Contract",
        "duration": "6 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 800,
        "vendor_cap": 1200,
        "ceiling_internal": 1400,
        "work_mode": "Remote",
        "primary_location": "Remote (India)",
        "equipment_provided": "Company-provided",
        "bgv_required": "Standard",
        "nda_required": "Yes",
        "description": "Leading product UI design and component library maintenance in Figma. Translating complex B2B workflows into sleek, frictionless user journeys.",
    },
    {
        "name": "Technical Solutions Architect (Enterprise / Cloud)",
        "title": "Enterprise Cloud Solutions Architect",
        "job_family": "Architecture & Strategy",
        "priority": "Critical",
        "must_have_skills": ["System Design", "Microservices Architecture", "AWS / Multi-Cloud", "Distributed Systems", "Security & Compliance"],
        "nice_to_have_skills": ["Event-Driven Architectures", "TOGAF", "Cost Optimization FinOps", "Zero Trust Security"],
        "experience": "8+ years",
        "headcount": 1,
        "certifications": ["AWS Solutions Architect Professional", "TOGAF 9+ Certified"],
        "engagement_type": "Contract",
        "duration": "12 Months",
        "rate_basis": "Hourly",
        "budget_cap_currency": "INR",
        "vendor_floor": 1800,
        "vendor_cap": 2500,
        "ceiling_internal": 2800,
        "work_mode": "Hybrid",
        "primary_location": "Bangalore / Hybrid (1 day)",
        "equipment_provided": "Company-provided",
        "bgv_required": "Comprehensive",
        "nda_required": "Yes",
        "description": "High-level architectural oversight, technical governance, cross-pod alignment, and security compliance for enterprise buyer initiatives.",
    },
]


def seed():
    with get_session() as session:
        # Check tenant exists
        tenant = session.query(Tenant).filter(Tenant.id == PEAR_TENANT_ID).first()
        if not tenant:
            # find by name PEAR
            tenant = session.query(Tenant).filter(Tenant.name.ilike("PEAR")).first()
        tenant_id = tenant.id if tenant else PEAR_TENANT_ID
        print(f"Targeting tenant: {tenant.name if tenant else 'PEAR'} ({tenant_id})")

        # Find creator user
        user = session.query(User).filter(User.email == "don@pear.com").first()
        user_id = user.id if user else "director"

        created_count = 0
        updated_count = 0

        for t_data in TEMPLATES:
            name = t_data["name"]
            title = t_data["title"]
            skills_must = t_data["must_have_skills"]
            skills_nice = t_data["nice_to_have_skills"]
            certs = t_data["certifications"]
            vendor_range = [t_data["vendor_floor"], t_data["vendor_cap"]]

            structured_role = {
                "title": title,
                "job_family": t_data["job_family"],
                "department": t_data["job_family"],
                "must_have_skills": skills_must,
                "nice_to_have_skills": skills_nice,
                "experience": t_data["experience"],
                "experience_band": t_data["experience"],
                "headcount": t_data["headcount"],
                "certifications": certs,
                "engagement_type": t_data["engagement_type"],
                "duration": t_data["duration"],
                "extension_likely": True,
                "rate_basis": t_data["rate_basis"],
                "budget_cap_currency": t_data["budget_cap_currency"],
                "vendor_floor": t_data["vendor_floor"],
                "vendor_cap": t_data["vendor_cap"],
                "ceiling_internal": t_data["ceiling_internal"],
                "rate_band": vendor_range,
                "range_vendors_see": vendor_range,
                "work_mode": t_data["work_mode"],
                "primary_location": t_data["primary_location"],
                "equipment_provided": t_data["equipment_provided"],
                "equipment_provisioning": t_data["equipment_provided"],
                "bgv_required": t_data["bgv_required"],
                "background_check": t_data["bgv_required"],
                "nda_required": t_data["nda_required"],
                "priority": t_data["priority"],
                "notes": t_data["description"],
            }

            # Check if template already exists
            existing = session.query(models.RoleTemplate).filter(
                models.RoleTemplate.tenant_id == tenant_id,
                models.RoleTemplate.name == name
            ).first()

            if existing:
                existing.structured_role = structured_role
                existing.description = t_data["description"]
                existing_id = existing.id
                updated_count += 1
            else:
                new_tpl = models.RoleTemplate(
                    tenant_id=tenant_id,
                    created_by=user_id,
                    name=name,
                    description=t_data["description"],
                    structured_role=structured_role,
                )
                session.add(new_tpl)
                session.flush()
                existing_id = new_tpl.id
                created_count += 1

            # Sync to MongoDB role_templates collection
            try:
                mongo_db["role_templates"].update_one(
                    {"id": existing_id},
                    {"$set": {
                        "id": existing_id,
                        "tenant_id": tenant_id,
                        "created_by": user_id,
                        "name": name,
                        "description": t_data["description"],
                        "structured_role": structured_role,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
            except Exception as e:
                print(f"Mongo sync note for {name}: {e}")

        session.commit()
        print(f"Successfully processed templates: {created_count} created, {updated_count} updated.")

if __name__ == "__main__":
    seed()
