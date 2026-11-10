"""
Regression tests for Role-Aware AI Interview System.

Verifies:
1. Non-technical roles (e.g. Travel Research Associate Intern) never receive software/coding questions.
2. Job description and title take priority over candidate resume background (a technical resume cannot cause tech questions in a non-tech interview).
3. Fresher/Intern seniority logic asks appropriate foundational/methodology questions instead of assuming 5 years of production architecture experience.
4. Fallback questions across Azure, Groq, and Assessment follow the same role-relevance and domain rules.
5. Technical roles still receive rigorous technical delivery and problem-solving questions.
"""
import pytest
from modules.interview.services.domain_classifier import (
    classify_job_domain,
    classify_seniority,
    get_fallback_questions,
    get_domain_competencies,
    DOMAIN_RESEARCH,
    DOMAIN_TECH,
    DOMAIN_MARKETING,
    DOMAIN_SALES,
    DOMAIN_HR,
    DOMAIN_OPERATIONS,
    DOMAIN_DESIGN,
    DOMAIN_GENERAL,
)
from modules.interview.services.azure_ai_interview import (
    extract_resume_facts,
    generate_custom_interview_plan,
)
from modules.interview.services.assessment import build_questions, validate_assessment


# Sample Resumes
TECHNICAL_RESUME = {
    "resume_text": "Experienced Software Engineer. 5 years building scalable distributed microservices, Python, FastAPI, Docker, Kubernetes, PostgreSQL, AWS Cloud infrastructure.",
    "skills": ["Python", "Docker", "Kubernetes", "AWS", "FastAPI", "Microservices", "System Architecture"],
    "experience": [{"title": "Senior Backend Developer", "company": "Tech Corp", "highlights": ["Built distributed backend"]}],
    "projects": [{"name": "Distributed Kafka Pipeline", "technologies": ["Python", "Kafka"], "description": "High-throughput messaging system"}]
}

EMPTY_RESUME = {
    "resume_text": "",
    "skills": [],
    "experience": [],
    "projects": []
}

RESEARCH_INTERN_RESUME = {
    "resume_text": "Recent graduate in English Literature and Geography. Conducted independent academic research, synthesized secondary sources, coordinated campus club travel trips.",
    "skills": ["Internet Research", "Fact-Checking", "Content Writing", "Synthesis", "Communication"],
    "experience": [],
    "projects": [{"name": "Campus Travel Guide", "description": "Curated offbeat student travel itineraries across Kerala"}]
}


class TestDomainClassifier:
    def test_travel_research_associate_intern_classification(self):
        title = "Travel Research Associate Intern"
        dept = "Content & Research"
        desc = "Research unique travel destinations, curate itineraries, verify local pricing and transport details, write comprehensive guides."
        domain, confidence = classify_job_domain(title, dept, desc, ["Online Research", "Fact Checking"])
        assert domain == DOMAIN_RESEARCH
        assert confidence >= 0.8
        
        seniority = classify_seniority(title, "entry", desc)
        assert seniority == "fresher"

    def test_technical_role_classification(self):
        title = "Flutter Developer"
        desc = "Build cross-platform mobile applications using Flutter and Dart. Integrate REST APIs and state management."
        domain, confidence = classify_job_domain(title, "Engineering", desc, ["Flutter", "Dart", "REST API"])
        assert domain == DOMAIN_TECH
        assert confidence >= 0.7

    def test_sales_role_classification(self):
        title = "Key Account Manager – Corporate Accounts"
        desc = "Drive B2B sales pipelines, manage corporate client accounts, negotiate agreements, and close enterprise deals."
        domain, confidence = classify_job_domain(title, "Sales", desc, ["B2B Sales", "Account Management", "Negotiation"])
        assert domain == DOMAIN_SALES
        assert confidence >= 0.7

    def test_marketing_role_classification(self):
        title = "Marketing & Growth Specialist"
        desc = "Manage digital marketing campaigns, monitor CAC/LTV, optimize conversion funnels, drive organic and paid growth."
        domain, confidence = classify_job_domain(title, "Marketing", desc, ["Growth Marketing", "SEO", "Analytics"])
        assert domain == DOMAIN_MARKETING
        assert confidence >= 0.7


class TestRolePriorityOverResume:
    def test_technical_candidate_applying_to_travel_research_intern_never_gets_tech_questions(self):
        """
        CRITICAL REGRESSION TEST:
        When a software engineer with Docker, Python, and Kafka applies for a Travel Research role,
        the generated interview questions MUST remain strictly about travel research, NOT coding/software architecture.
        """
        job = {
            "title": "Travel Research Associate Intern",
            "company": "Little Known Planet",
            "department": "Research",
            "seniority": "intern",
            "description": "Conduct deep internet research on destinations, verify offbeat itineraries, contact local operators, fact-check travel guides."
        }
        
        # Test Azure Plan Fallback
        plan = generate_custom_interview_plan(job, TECHNICAL_RESUME)
        questions = plan["questions"]
        assert len(questions) >= 4
        
        forbidden_tech_terms = [
            "system architecture", "scalable systems", "database trade-off",
            "api design", "cloud infrastructure", "microservices", "code review", "debugging"
        ]
        
        for q in questions:
            prompt_lower = q["prompt"].lower()
            for forbidden in forbidden_tech_terms:
                assert forbidden not in prompt_lower, f"Forbidden term '{forbidden}' leaked into research interview prompt: {q['prompt']}"
                
            # Verify the question aligns with research/curiosity/verification
            assert any(topic in prompt_lower for topic in ["research", "information", "accurate", "facts", "approach", "findings", "destination"])

    def test_technical_candidate_applying_to_research_in_assessment_module(self):
        """Verify the assessment.py fallback path also preserves role relevance."""
        requisition = {
            "title": "Travel Research Associate Intern",
            "department": "Editorial & Research",
            "structured_role": {
                "title": "Travel Research Associate Intern",
                "must_have_skills": ["Online Research", "Fact-Checking", "Written Communication"],
                "job_description": "Curate and verify hidden gem travel destinations and offbeat cultural spots.",
                "seniority": "fresher"
            }
        }
        
        questions = build_questions(TECHNICAL_RESUME, requisition)
        assert len(questions) == 4
        
        # Competencies should be from RESEARCH domain, not technical_delivery
        comp_ids = [q["competency"] for q in questions]
        assert "technical_delivery" not in comp_ids
        assert any(c in ["research_methodology", "synthesis_and_accuracy", "problem_solving", "communication"] for c in comp_ids)
        
        for q in questions:
            prompt_lower = q["prompt"].lower()
            assert "technical problem" not in prompt_lower
            assert "system architecture" not in prompt_lower


class TestFresherVsExperiencedAdaptation:
    def test_fresher_questions_do_not_demand_multi_year_enterprise_experience(self):
        fallback_q = get_fallback_questions(domain=DOMAIN_RESEARCH, seniority="fresher", focus_topic="Travel Research")
        for q in fallback_q:
            prompt = q["prompt"].lower()
            assert "production" not in prompt
            assert "enterprise" not in prompt
            assert "led a team" not in prompt
            # Ensures inquiry into method, curiosity, or academic/personal work
            assert any(word in prompt for word in ["approach", "project", "assignment", "paper", "step", "findings"])

    def test_technical_fresher_questions_focus_on_coursework_fundamentals(self):
        fallback_q = get_fallback_questions(domain=DOMAIN_TECH, seniority="fresher", focus_topic="Flutter Development")
        assert len(fallback_q) == 4
        assert "coursework" in fallback_q[0]["prompt"].lower() or "programming project" in fallback_q[0]["prompt"].lower()


class TestExtractResumeFactsSafety:
    def test_empty_resume_does_not_fabricate_software_engineering_skills(self):
        facts = extract_resume_facts("", candidate_name="Jane Doe")
        assert facts["skills"] == []
        assert facts["total_years_experience"] == 0
        assert facts["projects"] == []
        assert "Software Engineering" not in facts["skills"]


class TestAllJobScenariosAndControlledVariation:
    """
    Test 6 core audit scenarios:
    1. Two different Full Stack Developer candidates
    2. Two different UI/UX Designer candidates
    3. Travel Research Associate Intern
    4. Marketing Intern
    5. Experienced HR Recruiter
    6. Fresh graduate applying for a technical position
    """

    def test_scenario_1_two_different_full_stack_developers_get_varied_questions(self):
        job = {
            "title": "Full Stack Developer",
            "company": "Tech Corp",
            "seniority": "mid",
            "description": "Develop full-stack web applications using React, Node.js, REST APIs, and relational databases.",
        }
        cand1 = {
            "name": "Arun Kumar",
            "skills": ["React", "TypeScript", "Node.js", "PostgreSQL"],
            "projects": [{"name": "Fintech Dashboard", "description": "Payment checkout service with Stripe"}],
            "experience": [{"title": "Web Developer", "company": "Alpha Tech", "highlights": ["Built checkout engine"]}]
        }
        cand2 = {
            "name": "Priya Sharma",
            "skills": ["Vue.js", "Python", "FastAPI", "MongoDB"],
            "projects": [{"name": "Telemetry Ingestion Service", "description": "IoT monitoring system"}],
            "experience": [{"title": "Backend Engineer", "company": "Beta Cloud", "highlights": ["Async queue processing"]}]
        }

        plan1 = generate_custom_interview_plan(job, cand1)
        plan2 = generate_custom_interview_plan(job, cand2)

        prompts1 = [q["prompt"] for q in plan1["questions"]]
        prompts2 = [q["prompt"] for q in plan2["questions"]]

        assert len(prompts1) >= 4
        assert len(prompts2) >= 4
        # Controlled variation: prompts should personalize to individual project/skill contexts
        assert prompts1 != prompts2

    def test_scenario_2_two_different_ui_ux_designers(self):
        job = {
            "title": "UI/UX Designer",
            "company": "Design Studio",
            "seniority": "mid",
            "description": "Create intuitive user journeys, interactive wireframes, and design systems in Figma. Conduct usability testing.",
        }
        cand1 = {
            "name": "Elena Rostova",
            "skills": ["Figma", "User Research", "Wireframing", "Design Systems"],
            "projects": [{"name": "Banking Mobile App", "description": "Simplified complex financial onboarding"}],
            "experience": [{"title": "Product Designer", "company": "BankX", "highlights": ["Created design system"]}]
        }
        cand2 = {
            "name": "Karthik Menon",
            "skills": ["Figma", "Interaction Design", "Prototyping", "Design Tokens"],
            "projects": [{"name": "SaaS Analytics Web", "description": "High-density data visualization interfaces"}],
            "experience": [{"title": "UI Designer", "company": "DataViz", "highlights": ["Accessibility compliance"]}]
        }

        plan1 = generate_custom_interview_plan(job, cand1)
        plan2 = generate_custom_interview_plan(job, cand2)

        prompts1 = [q["prompt"] for q in plan1["questions"]]
        prompts2 = [q["prompt"] for q in plan2["questions"]]

        assert len(prompts1) >= 4
        assert len(prompts2) >= 4
        for p in prompts1 + prompts2:
            p_lower = p.lower()
            # Must be design-centric, never software coding/backend
            assert "database" not in p_lower
            assert "api" not in p_lower
            assert "microservice" not in p_lower

    def test_scenario_3_travel_research_associate_intern(self):
        job = {
            "title": "Travel Research Associate Intern",
            "company": "Little Known Planet",
            "seniority": "intern",
            "description": "Research unique destinations, compile itineraries, verify transit routes and pricing, create guides.",
        }
        cand = {
            "name": "Rhea Sen",
            "skills": ["Research", "Fact-Checking", "Writing"],
            "projects": [{"name": "Heritage Trail Guide", "description": "Curated historic trails"}],
            "experience": []
        }
        plan = generate_custom_interview_plan(job, cand)
        for q in plan["questions"]:
            p_lower = q["prompt"].lower()
            assert "software" not in p_lower
            assert "architecture" not in p_lower
            assert not any(phrase in p_lower for phrase in ["in your previous job as a travel research associate intern", "when you were employed as"])

    def test_scenario_4_marketing_intern(self):
        job = {
            "title": "Marketing Intern",
            "company": "GrowthWorks",
            "seniority": "intern",
            "description": "Support social media campaigns, draft newsletters, analyze audience engagement metrics.",
        }
        cand = {
            "name": "Amit Roy",
            "skills": ["Social Media", "Copywriting", "Canva"],
            "projects": [{"name": "University Fest Promo", "description": "Managed social media channels"}],
            "experience": []
        }
        plan = generate_custom_interview_plan(job, cand)
        assert len(plan["questions"]) >= 4
        for q in plan["questions"]:
            p_lower = q["prompt"].lower()
            assert "software" not in p_lower
            assert "production codebase" not in p_lower
            # Validates that every question is marketing, social, communication, or student-project related
            assert any(term in p_lower for term in [
                "approach", "campaign", "audience", "learning", "project", "steps",
                "engagement", "feedback", "social", "media", "post", "newsletter", "promo", "writing", "event"
            ])

    def test_scenario_5_experienced_hr_recruiter(self):
        job = {
            "title": "Senior Talent Acquisition Specialist",
            "company": "Global Corp",
            "seniority": "senior",
            "description": "Lead end-to-end talent acquisition, manage executive candidate pipelines, partner with business leaders.",
        }
        cand = {
            "name": "Sarah Jenkins",
            "skills": ["Headhunting", "ATS", "Talent Sourcing", "Stakeholder Management"],
            "projects": [],
            "experience": [{"title": "Recruiter", "company": "Staffing Pro", "highlights": ["Closed 50+ roles annually"]}]
        }
        plan = generate_custom_interview_plan(job, cand)
        assert len(plan["questions"]) >= 4
        for q in plan["questions"]:
            p_lower = q["prompt"].lower()
            assert "technical architecture" not in p_lower
            # Validates that every question is HR, talent acquisition, recruiting, or search related
            assert any(term in p_lower for term in [
                "talent", "sourcing", "pipeline", "stakeholder", "candidate", "negotiat",
                "hiring", "experience", "metric", "disagreement", "role", "search", "recruiting",
                "close", "leader", "ats", "intake", "staffing"
            ])

    def test_scenario_6_fresh_graduate_applying_for_technical_role(self):
        job = {
            "title": "Junior Python Developer",
            "company": "Cloud Innovators",
            "seniority": "entry",
            "description": "Build backend APIs with Python and FastAPI, write unit tests, collaborate in Agile sprints.",
        }
        cand = {
            "name": "Dev Patel",
            "skills": ["Python", "FastAPI", "Git", "SQL"],
            "projects": [{"name": "College Library Management", "description": "Student book issue web service"}],
            "experience": []  # No prior employment
        }
        plan = generate_custom_interview_plan(job, cand)
        for q in plan["questions"]:
            p_lower = q["prompt"].lower()
            # Does not demand 5 years of production or enterprise architecture
            assert "in your previous senior developer role" not in p_lower
            assert "scalable systems in production" not in p_lower
            # Focuses on fundamentals, college projects, or diagnostic approach
            assert any(term in p_lower for term in ["project", "approach", "diagnos", "debug", "coursework", "code", "learn", "built", "fastapi", "library"])


