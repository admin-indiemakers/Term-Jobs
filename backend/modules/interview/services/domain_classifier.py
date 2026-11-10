"""
Domain and Seniority Classifier for TermJobs AI Interview System.

Ensures role-aware question generation, domain-specific rubrics, and appropriate
seniority assessment (especially for Freshers and Interns).
"""
import re
from typing import Dict, Any, List, Tuple

# Domain Constants
DOMAIN_TECH = "tech"
DOMAIN_RESEARCH = "research"
DOMAIN_MARKETING = "marketing"
DOMAIN_SALES = "sales"
DOMAIN_HR = "hr"
DOMAIN_OPERATIONS = "operations"
DOMAIN_GENERAL = "general"

# Keywords & Regex for Domain Scoring
DOMAIN_RULES = {
    DOMAIN_RESEARCH: {
        "title_keywords": [
            "research", "analyst", "associate intern", "travel research", "market research",
            "data analyst", "content researcher", "insights", "intelligence", "investigator"
        ],
        "content_keywords": [
            "research", "itinerary", "destinations", "travel", "investigate", "fact-checking",
            "verify", "data collection", "survey", "market trends", "sources", "curate",
            "documentation", "synthesis", "benchmarking", "reports", "findings"
        ],
        "weight": 1.2
    },
    DOMAIN_MARKETING: {
        "title_keywords": [
            "marketing", "growth", "seo", "sem", "content creator", "copywriter",
            "social media", "brand", "digital marketing", "performance marketing", "campaign"
        ],
        "content_keywords": [
            "campaign", "funnel", "conversion", "retention", "acquisition", "roi", "cac", "ctr",
            "social media", "brand awareness", "audience", "copywriting", "organic reach", "leads"
        ],
        "weight": 1.0
    },
    DOMAIN_SALES: {
        "title_keywords": [
            "sales", "account manager", "key account", "business development", "bde", "bdm",
            "sdr", "bdr", "corporate accounts", "client relationship", "partnership"
        ],
        "content_keywords": [
            "pipeline", "closing", "quota", "negotiation", "prospecting", "cold call", "revenue",
            "client meeting", "pitch", "upsell", "deal", "stakeholders", "crm", "accounts"
        ],
        "weight": 1.0
    },
    DOMAIN_HR: {
        "title_keywords": [
            "hr", "human resources", "talent acquisition", "recruiter", "people ops",
            "people operations", "recruitment", "talent partner"
        ],
        "content_keywords": [
            "sourcing", "screening", "onboarding", "employee relations", "hiring", "interviews",
            "job postings", "talent pipeline", "workplace culture", "compliance", "payroll"
        ],
        "weight": 1.0
    },
    DOMAIN_OPERATIONS: {
        "title_keywords": [
            "operations", "supply chain", "logistics", "procurement", "inventory",
            "operations specialist", "facilities", "admin manager", "coordinator"
        ],
        "content_keywords": [
            "logistics", "supply chain", "vendor", "procurement", "dispatch", "inventory",
            "fulfillment", "process optimization", "sla", "operational efficiency", "vendor management"
        ],
        "weight": 1.0
    },
    DOMAIN_TECH: {
        "title_keywords": [
            "developer", "software engineer", "frontend", "backend", "full stack",
            "flutter", "mobile app", "devops", "cloud engineer", "architect",
            "qa engineer", "sre", "machine learning", "ai engineer", "systems"
        ],
        "content_keywords": [
            "python", "javascript", "react", "node", "flutter", "golang", "java", "sql", "nosql",
            "database", "api", "rest", "graphql", "docker", "kubernetes", "aws", "azure", "git",
            "ci/cd", "microservices", "frontend", "backend", "system design", "codebase", "debugging"
        ],
        "weight": 1.0
    },
}

# Domain-Specific Competencies and Indicators
DOMAIN_COMPETENCIES: Dict[str, Dict[str, Any]] = {
    DOMAIN_RESEARCH: {
        "research_methodology": {
            "name": "Research Methodology",
            "weight": 0.30,
            "indicators": ["Information discovery methods", "Critical source evaluation", "Structured investigative process", "Fact verification"],
        },
        "synthesis_and_accuracy": {
            "name": "Synthesis & Accuracy",
            "weight": 0.25,
            "indicators": ["Translates raw data into insights", "Detail-oriented validation", "Eliminates inaccuracies", "Clear documentation"],
        },
        "problem_solving": {
            "name": "Analytical Problem Solving",
            "weight": 0.25,
            "indicators": ["Handles missing or conflicting data", "Compares alternative sources", "Validates assumptions", "Methodical resolution"],
        },
        "communication": {
            "name": "Communication & Reporting",
            "weight": 0.20,
            "indicators": ["Structured written/oral reporting", "Communicates key findings concisely", "Stakeholder clarity", "Actionable recommendations"],
        },
    },
    DOMAIN_MARKETING: {
        "campaign_strategy": {
            "name": "Marketing & Campaign Strategy",
            "weight": 0.30,
            "indicators": ["Audience targeting", "Channel selection", "Messaging alignment", "Creative problem solving"],
        },
        "analytics_and_roi": {
            "name": "Analytics & Impact",
            "weight": 0.25,
            "indicators": ["Conversion tracking", "CAC/LTV metrics", "Data-driven optimization", "Experimentation mindset"],
        },
        "creative_execution": {
            "name": "Execution & Content",
            "weight": 0.25,
            "indicators": ["Quality execution", "Asset creation", "Consistency in brand voice", "Deadline discipline"],
        },
        "collaboration": {
            "name": "Stakeholder Collaboration",
            "weight": 0.20,
            "indicators": ["Cross-functional alignment", "Vendor/partner coordination", "Incorporates feedback", "Team communication"],
        },
    },
    DOMAIN_SALES: {
        "relationship_and_discovery": {
            "name": "Discovery & Relationship Management",
            "weight": 0.30,
            "indicators": ["Needs analysis", "Active listening", "Trust-building", "Account mapping"],
        },
        "negotiation_and_closing": {
            "name": "Negotiation & Commercial Acumen",
            "weight": 0.25,
            "indicators": ["Overcomes objections", "Value-based selling", "Contract closing", "Win-win solutions"],
        },
        "prospecting_and_pipeline": {
            "name": "Pipeline & Goal Orientation",
            "weight": 0.25,
            "indicators": ["Target discipline", "Lead qualification", "CRM hygiene", "Resilience & consistency"],
        },
        "communication": {
            "name": "Persuasive Communication",
            "weight": 0.20,
            "indicators": ["Articulate executive pitch", "Clarity under pressure", "Prompt follow-ups", "Empathetic alignment"],
        },
    },
    DOMAIN_HR: {
        "talent_and_people": {
            "name": "People Operations & Sourcing",
            "weight": 0.30,
            "indicators": ["Talent identification", "Candidate experience", "Structured interviewing", "Process integrity"],
        },
        "workplace_relations": {
            "name": "Employee Relations & Culture",
            "weight": 0.25,
            "indicators": ["Conflict de-escalation", "Policy understanding", "Empathy & confidentiality", "Equitable treatment"],
        },
        "problem_solving": {
            "name": "Operational Problem Solving",
            "weight": 0.25,
            "indicators": ["Process improvement", "Handles ambiguities", "Regulatory awareness", "Methodical resolution"],
        },
        "communication": {
            "name": "Interpersonal Communication",
            "weight": 0.20,
            "indicators": ["Clear, compassionate messaging", "Active listening", "Stakeholder management", "Professionalism"],
        },
    },
    DOMAIN_OPERATIONS: {
        "process_execution": {
            "name": "Process Execution & SLAs",
            "weight": 0.30,
            "indicators": ["Standard operating procedures", "Workflow efficiency", "SLA adherence", "Resource optimization"],
        },
        "problem_solving": {
            "name": "Root Cause Analysis & Fixes",
            "weight": 0.25,
            "indicators": ["Bottleneck detection", "Contingency planning", "Hands-on troubleshooting", "Data tracking"],
        },
        "vendor_and_stakeholder": {
            "name": "Coordination & Vendor Management",
            "weight": 0.25,
            "indicators": ["Vendor accountability", "Cross-department synchronization", "Clear instructions", "Dispute resolution"],
        },
        "ownership": {
            "name": "Operational Accountability",
            "weight": 0.20,
            "indicators": ["Proactive risk mitigation", "Follow-through on delivery", "Attention to detail", "Measurable outcomes"],
        },
    },
    DOMAIN_TECH: {
        "technical_delivery": {
            "name": "Technical Delivery",
            "weight": 0.35,
            "indicators": ["Relevant technical decisions", "Explains trade-offs", "Own contribution", "Verifiable outcomes"],
        },
        "problem_solving": {
            "name": "Problem Solving",
            "weight": 0.30,
            "indicators": ["Diagnoses constraints", "Compares alternatives", "Explains implementation", "Measures results"],
        },
        "collaboration": {
            "name": "Collaboration",
            "weight": 0.20,
            "indicators": ["Identifies stakeholder needs", "Communicates reasoning", "Resolves disagreements", "Reflects on outcome"],
        },
        "ownership": {
            "name": "Ownership",
            "weight": 0.15,
            "indicators": ["Defines responsibility", "Acts on risk", "Follows through", "Reflects on measurable impact"],
        },
    },
    DOMAIN_GENERAL: {
        "role_knowledge": {
            "name": "Role & Domain Knowledge",
            "weight": 0.30,
            "indicators": ["Understands role objectives", "Relevant subject matter skills", "Application of fundamentals", "Practical outcomes"],
        },
        "problem_solving": {
            "name": "Problem Solving & Analysis",
            "weight": 0.30,
            "indicators": ["Structured thinking", "Assesses options", "Practical solution design", "Measurable results"],
        },
        "collaboration": {
            "name": "Collaboration & Teamwork",
            "weight": 0.20,
            "indicators": ["Clear communication", "Stakeholder alignment", "Resolves friction", "Constructive engagement"],
        },
        "ownership": {
            "name": "Ownership & Accountability",
            "weight": 0.20,
            "indicators": ["Personal responsibility", "Proactive execution", "Handles deadlines", "Measurable follow-through"],
        },
    },
}

# Domain & Seniority-Aware Question Templates for Fallbacks
FALLBACK_QUESTION_TEMPLATES: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
    DOMAIN_RESEARCH: {
        "fresher": [
            {
                "id": "q1_research_discovery",
                "competency": "research_methodology",
                "title": "Information Discovery & Methodology",
                "prompt": "When you need to research a topic or destination where information is scarce or contradictory, what step-by-step approach do you take to find accurate, credible information?",
                "hint": "Explain the sources, search strategies, or tools you use, and how you evaluate source credibility.",
                "indicators": ["Methodical search strategy", "Cross-checking sources", "Source credibility awareness"]
            },
            {
                "id": "q2_data_accuracy",
                "competency": "synthesis_and_accuracy",
                "title": "Data Verification & Accuracy",
                "prompt": "Can you describe a past project, paper, or assignment where accuracy was vital? How did you verify your facts before finalizing your work?",
                "hint": "Walk through your verification process and how you prevented errors or misleading data.",
                "indicators": ["Attention to detail", "Systematic verification", "High quality bar"]
            },
            {
                "id": "q3_problem_solving",
                "competency": "problem_solving",
                "title": "Overcoming Research Obstacles",
                "prompt": "Tell me about a time you hit a dead end while looking for information. How did you adapt your approach to solve the problem?",
                "hint": "Explain the obstacle, alternative avenues explored, and how you reached a conclusion.",
                "indicators": ["Intellectual adaptability", "Resourcefulness", "Critical thinking"]
            },
            {
                "id": "q4_reporting",
                "competency": "communication",
                "title": "Synthesis & Presentation",
                "prompt": "Once you have gathered lots of raw data and notes, how do you structure and summarize your findings so someone else can easily make decisions?",
                "hint": "Describe how you format, organize, and highlight the most actionable points.",
                "indicators": ["Clear structuring", "Conciseness", "Reader-centric communication"]
            }
        ],
        "experienced": [
            {
                "id": "q1_research_methodology",
                "competency": "research_methodology",
                "title": "Comprehensive Research Process",
                "prompt": "Can you walk me through a research project or investigation you led involving {focus}? What was your methodology for discovering non-obvious insights?",
                "hint": "Use STAR: Situation, Task, your specific methodology, and the final deliverable.",
                "indicators": ["Rigorous methodology", "Primary/secondary source balance", "Depth of investigation"]
            },
            {
                "id": "q2_data_accuracy",
                "competency": "synthesis_and_accuracy",
                "title": "Information Verification & Auditing",
                "prompt": "Describe a scenario where you uncovered misleading, outdated, or conflicting findings during your research. How did you resolve the discrepancy and ensure accuracy?",
                "hint": "Detail your validation criteria, cross-referencing steps, and the final impact on the report.",
                "indicators": ["Fact-checking rigor", "Critical evaluation", "Quality control"]
            },
            {
                "id": "q3_problem_solving",
                "competency": "problem_solving",
                "title": "Handling Complex Constraints",
                "prompt": "Tell me about a time you had to deliver comprehensive findings under tight deadlines or with limited access to data. What trade-offs did you make?",
                "hint": "Explain how you prioritized critical signals over noise and managed delivery risks.",
                "indicators": ["Prioritization", "Pragmatic decision making", "Risk management"]
            },
            {
                "id": "q4_communication",
                "competency": "communication",
                "title": "Stakeholder Reporting & Impact",
                "prompt": "How did you present complex research findings to stakeholders with different expectations? What changed as a result of your work?",
                "hint": "Highlight how you tailored the communication and influenced the resulting decision.",
                "indicators": ["Persuasive communication", "Stakeholder management", "Demonstrated impact"]
            }
        ]
    },
    DOMAIN_MARKETING: {
        "fresher": [
            {
                "id": "q1_campaign_concept",
                "competency": "campaign_strategy",
                "title": "Campaign Ideation & Audience",
                "prompt": "If you were tasked with introducing {focus} to a new audience, what steps would you take to understand their needs and craft an engaging message?",
                "hint": "Discuss target audience research, key hooks, and the channels you would explore.",
                "indicators": ["Audience empathy", "Creative thinking", "Channel awareness"]
            },
            {
                "id": "q2_analytics",
                "competency": "analytics_and_roi",
                "title": "Measuring Success & Learning",
                "prompt": "Tell me about a creative project, social campaign, or presentation you produced. How did you gauge whether it was successful or received well?",
                "hint": "Explain what signals or metrics you monitored and what you learned.",
                "indicators": ["Feedback orientation", "Basic metric understanding", "Desire to iterate"]
            },
            {
                "id": "q3_execution",
                "competency": "creative_execution",
                "title": "Creative Execution & Quality",
                "prompt": "Walk me through how you plan and produce content or marketing assets from initial idea to final publication.",
                "hint": "Share how you organize drafts, handle revisions, and ensure quality standards.",
                "indicators": ["Process discipline", "Eye for quality", "Consistency"]
            },
            {
                "id": "q4_collaboration",
                "competency": "collaboration",
                "title": "Feedback & Teamwork",
                "prompt": "Tell me about a time someone gave critical feedback on your creative work or writing. How did you incorporate their suggestions?",
                "hint": "Explain your reaction, adjustments made, and the resulting improvement.",
                "indicators": ["Receptiveness to feedback", "Constructive mindset", "Team alignment"]
            }
        ],
        "experienced": [
            {
                "id": "q1_campaign_strategy",
                "competency": "campaign_strategy",
                "title": "Growth & Campaign Strategy",
                "prompt": "Can you walk me through a key campaign or growth initiative you spearheaded involving {focus}? What was your strategy and the final outcome?",
                "hint": "Use STAR: Detail the goal, target audience, execution channels, and measurable result.",
                "indicators": ["Strategic thinking", "Clear channel tactics", "Targeting clarity"]
            },
            {
                "id": "q2_analytics_roi",
                "competency": "analytics_and_roi",
                "title": "Analytics & Performance Optimization",
                "prompt": "Describe a campaign or experiment that underperformed initial expectations. How did you diagnose the friction and optimize the funnel?",
                "hint": "Detail the metrics tracked, A/B testing or pivot made, and final recovery numbers.",
                "indicators": ["Data-driven diagnosis", "Analytical rigor", "Hypothesis testing"]
            },
            {
                "id": "q3_creative_execution",
                "competency": "creative_execution",
                "title": "High-Impact Execution",
                "prompt": "Tell me about an initiative where you had to coordinate multiple content streams or creative deliverables simultaneously under strict deadlines.",
                "hint": "Highlight your workflow, brand governance, and on-time delivery.",
                "indicators": ["Operational cadence", "Brand integrity", "Project governance"]
            },
            {
                "id": "q4_collaboration",
                "competency": "collaboration",
                "title": "Cross-Functional Alignment",
                "prompt": "Describe how you aligned marketing goals with sales, product, or leadership priorities when opinions on messaging or budget differed.",
                "hint": "Share how you used data to resolve disagreements and establish shared ownership.",
                "indicators": ["Stakeholder alignment", "Negotiation", "Leadership presence"]
            }
        ]
    },
    DOMAIN_SALES: {
        "fresher": [
            {
                "id": "q1_discovery",
                "competency": "relationship_and_discovery",
                "title": "Customer Empathy & Active Listening",
                "prompt": "How do you prepare before speaking with a prospective client or customer to understand what challenges they might be facing?",
                "hint": "Describe your background research and the questions you ask to uncover real needs.",
                "indicators": ["Curiosity", "Preparation habit", "Customer empathy"]
            },
            {
                "id": "q2_communication",
                "competency": "communication",
                "title": "Persuasion & Communication",
                "prompt": "Tell me about a time you had to persuade someone—such as a peer, professor, or customer—to adopt your idea or purchase a solution.",
                "hint": "Explain how you framed your points and addressed their hesitations.",
                "indicators": ["Clarity", "Value proposition framing", "Confidence"]
            },
            {
                "id": "q3_resilience",
                "competency": "prospecting_and_pipeline",
                "title": "Handling Rejection & Persistence",
                "prompt": "In client-facing and sales roles, hearing 'no' is common. How do you maintain enthusiasm and discipline when things don't go as planned?",
                "hint": "Provide a real example of handling setbacks or persistence through a challenging task.",
                "indicators": ["Resilience", "Self-motivation", "Positive outlook"]
            },
            {
                "id": "q4_objections",
                "competency": "negotiation_and_closing",
                "title": "Addressing Doubts & Objections",
                "prompt": "If a potential customer tells you that a service is too expensive or not a priority right now, how would you respond?",
                "hint": "Explain how you explore their underlying concern rather than simply giving up or arguing.",
                "indicators": ["Consultative approach", "Composure", "Problem-solving"]
            }
        ],
        "experienced": [
            {
                "id": "q1_relationship_discovery",
                "competency": "relationship_and_discovery",
                "title": "Key Account Management & Discovery",
                "prompt": "Can you walk me through a major client relationship or enterprise deal you managed involving {focus}? How did you identify their core business drivers?",
                "hint": "Use STAR: Explain the account context, stakeholder mapping, and how you built trust.",
                "indicators": ["Enterprise discovery", "Executive presence", "Strategic relationship building"]
            },
            {
                "id": "q2_negotiation_closing",
                "competency": "negotiation_and_closing",
                "title": "High-Stakes Negotiation",
                "prompt": "Describe a difficult commercial negotiation where pricing, terms, or competitor presence threatened the deal. How did you close it successfully?",
                "hint": "Detail your concessions strategy, value defense, and the final contract outcome.",
                "indicators": ["Commercial firmness", "Creative deal structuring", "Win-win closing"]
            },
            {
                "id": "q3_pipeline",
                "competency": "prospecting_and_pipeline",
                "title": "Pipeline Strategy & Target Achievement",
                "prompt": "Tell me about a quarter or period where your pipeline was behind target. What concrete actions did you take to turn around the numbers?",
                "hint": "Share your prospecting mix, velocity acceleration tactics, and final attainment.",
                "indicators": ["Quota accountability", "Proactive pipeline generation", "Urgency"]
            },
            {
                "id": "q4_communication",
                "competency": "communication",
                "title": "Executive Presentation & Retention",
                "prompt": "Describe how you handled an at-risk client or escalations from key decision makers. What steps did you take to protect and grow the account?",
                "hint": "Highlight your communication strategy and retention results.",
                "indicators": ["Crisis communication", "Client retention", "Account growth"]
            }
        ]
    },
    DOMAIN_HR: {
        "fresher": [
            {
                "id": "q1_sourcing",
                "competency": "talent_and_people",
                "title": "Talent Sourcing & Candidate Engagement",
                "prompt": "When looking to attract great candidates for an open position, how would you go about sourcing and crafting an engaging outreach message?",
                "hint": "Describe where you would look and how you make communications personal and clear.",
                "indicators": ["Resourcefulness", "Personalized outreach", "Clarity"]
            },
            {
                "id": "q2_relations",
                "competency": "workplace_relations",
                "title": "Empathy & Confidentiality",
                "prompt": "Human resources requires handling sensitive personal details. How do you ensure confidentiality and build trust with individuals?",
                "hint": "Discuss your principles around discretion, ethics, and empathetic listening.",
                "indicators": ["Integrity", "Discretion", "Active listening"]
            },
            {
                "id": "q3_problem_solving",
                "competency": "problem_solving",
                "title": "Managing Ambiguity & Coordination",
                "prompt": "Tell me about a time you had to schedule or coordinate an event or process involving multiple people with conflicting schedules.",
                "hint": "Explain how you resolved the logjam and kept everyone informed.",
                "indicators": ["Organizational skills", "Follow-through", "Calm coordination"]
            },
            {
                "id": "q4_communication",
                "competency": "communication",
                "title": "Professional Communication",
                "prompt": "How do you deliver polite, clear, and constructive updates when giving disappointing news, such as a candidate rejection?",
                "hint": "Discuss maintaining a positive brand impression while being honest and direct.",
                "indicators": ["Constructive tact", "Brand ambassador mindset", "Clarity"]
            }
        ],
        "experienced": [
            {
                "id": "q1_talent_strategy",
                "competency": "talent_and_people",
                "title": "Talent Strategy & Pipeline",
                "prompt": "Can you describe a challenging hiring ramp or people initiative you led involving {focus}? What was your strategy and the quantifiable outcome?",
                "hint": "Use STAR: Detail the hiring bar, sourcing channels, time-to-hire, and retention.",
                "indicators": ["Talent strategy", "Sourcing efficiency", "Quality-of-hire bar"]
            },
            {
                "id": "q2_employee_relations",
                "competency": "workplace_relations",
                "title": "Conflict Resolution & People Ops",
                "prompt": "Describe a complex employee grievance or team conflict you mediated. How did you balance fairness, policy, and interpersonal empathy?",
                "hint": "Explain the investigative process, confidentiality maintenance, and resolution outcome.",
                "indicators": ["Equitable judgment", "De-escalation", "Policy adherence"]
            },
            {
                "id": "q3_process_improvement",
                "competency": "problem_solving",
                "title": "People Process Improvement",
                "prompt": "Tell me about an HR workflow or onboarding system that was inefficient. What changes did you introduce, and how did you measure the impact?",
                "hint": "Share before-and-after metrics, automation or streamlining, and employee feedback.",
                "indicators": ["Process engineering", "Change management", "Measurable efficiency"]
            },
            {
                "id": "q4_communication",
                "competency": "communication",
                "title": "Executive Alignment & Culture",
                "prompt": "How have you partnered with senior business leaders to advise them on organizational changes, compensation, or performance management?",
                "hint": "Highlight your consultative advisory role and leadership communication.",
                "indicators": ["Business partnering", "Influencing skills", "Leadership clarity"]
            }
        ]
    },
    DOMAIN_OPERATIONS: {
        "fresher": [
            {
                "id": "q1_process",
                "competency": "process_execution",
                "title": "Process Organization & Attention to Detail",
                "prompt": "When managing multiple operational tasks or checklist items simultaneously, how do you organize your work to ensure zero errors?",
                "hint": "Describe the tools, checklists, or personal routines you rely on.",
                "indicators": ["Systematic approach", "Attention to detail", "Prioritization"]
            },
            {
                "id": "q2_problem_solving",
                "competency": "problem_solving",
                "title": "Handling Sudden Disruptions",
                "prompt": "Tell me about a situation where a delivery, schedule, or project was suddenly disrupted at the last minute. What did you do to fix it?",
                "hint": "Explain your immediate reaction, containment steps, and the final result.",
                "indicators": ["Composure under pressure", "Resourcefulness", "Action orientation"]
            },
            {
                "id": "q3_coordination",
                "competency": "vendor_and_stakeholder",
                "title": "Stakeholder & Vendor Follow-ups",
                "prompt": "How do you effectively follow up with external parties or vendors when they are slow to reply or provide required materials?",
                "hint": "Discuss polite firmness, clear expectations, and escalation.",
                "indicators": ["Clear communication", "Assertiveness", "Accountability"]
            },
            {
                "id": "q4_ownership",
                "competency": "ownership",
                "title": "Accountability & Thoroughness",
                "prompt": "Describe a project or responsibility where you caught a mistake before it caused a serious problem. What did you do?",
                "hint": "Highlight your proactive vigilance and sense of ownership.",
                "indicators": ["Proactive vigilance", "Accountability", "Quality standard"]
            }
        ],
        "experienced": [
            {
                "id": "q1_process_execution",
                "competency": "process_execution",
                "title": "Operations & SLA Optimization",
                "prompt": "Can you walk me through an operational system or workflow you optimized involving {focus}? What was the bottleneck and the measured improvement?",
                "hint": "Use STAR: Quantify improvements in turnaround time, error reduction, or cost savings.",
                "indicators": ["Process optimization", "SLA management", "Measurable productivity"]
            },
            {
                "id": "q2_problem_solving",
                "competency": "problem_solving",
                "title": "Root Cause Analysis & Incident Management",
                "prompt": "Describe a major supply chain, vendor, or operational breakdown you resolved. What root cause did you uncover and what preventative controls did you institute?",
                "hint": "Explain your diagnostic steps, mitigation, and post-mortem improvements.",
                "indicators": ["Root cause analysis", "Systemic solutions", "Crisis response"]
            },
            {
                "id": "q3_vendor_management",
                "competency": "vendor_and_stakeholder",
                "title": "Vendor Accountability & Contract SLAs",
                "prompt": "Tell me about a time an essential vendor or external partner failed to meet SLA commitments. How did you remediate the issue?",
                "hint": "Highlight commercial leverage, remediation plans, and stakeholder communication.",
                "indicators": ["Vendor governance", "Contract enforcement", "Pragmatism"]
            },
            {
                "id": "q4_ownership",
                "competency": "ownership",
                "title": "End-to-End Operational Ownership",
                "prompt": "Describe an operational risk or regulatory challenge you proactively identified and eliminated before it affected business operations.",
                "hint": "Detail your foresight, cross-functional orchestration, and verifiable impact.",
                "indicators": ["Proactive governance", "Risk reduction", "Executive accountability"]
            }
        ]
    },
    DOMAIN_TECH: {
        "fresher": [
            {
                "id": "q1_technical_fundamentals",
                "competency": "technical_delivery",
                "title": "Core Technical Fundamentals",
                "prompt": "Can you walk me through a programming project or coursework implementation you built using {focus}? What was your approach to designing the solution?",
                "hint": "Explain the architecture, libraries chosen, and what you personally coded.",
                "indicators": ["Code comprehension", "Architectural clarity", "Foundational knowledge"]
            },
            {
                "id": "q2_problem_solving",
                "competency": "problem_solving",
                "title": "Debugging & Diagnostic Approach",
                "prompt": "Tell me about a difficult bug or unexpected error you encountered while building or testing a project. How did you diagnose and resolve it?",
                "hint": "Explain your debugging steps, logging/tools used, and how you verified the fix.",
                "indicators": ["Methodical debugging", "Root cause understanding", "Test verification"]
            },
            {
                "id": "q3_collaboration",
                "competency": "collaboration",
                "title": "Technical Collaboration & Code Review",
                "prompt": "Describe a project where you collaborated with others or received feedback during code review. How did you incorporate suggestions?",
                "hint": "Discuss git workflows, open communication, and learning from peers.",
                "indicators": ["Receptiveness to feedback", "Version control habits", "Team alignment"]
            },
            {
                "id": "q4_ownership",
                "competency": "ownership",
                "title": "Engineering Curiosity & Quality",
                "prompt": "When adopting a new framework, language, or tool for a project, what steps do you take to learn it quickly and write reliable code?",
                "hint": "Detail your learning resources, small experiments, and how you ensure code cleanliness.",
                "indicators": ["Self-directed learning", "Code hygiene", "Engineering passion"]
            }
        ],
        "experienced": [
            {
                "id": "q1_technical_delivery",
                "competency": "technical_delivery",
                "title": "System Architecture & Delivery",
                "prompt": "Can you walk me through a system, component, or application you built involving {focus}? What major architectural trade-offs did you make?",
                "hint": "Use STAR: Detail the technical constraints, trade-offs (e.g. latency, consistency, simplicity), and measurable outcome.",
                "indicators": ["Component modularity", "Trade-off analysis", "Production scalability"]
            },
            {
                "id": "q2_problem_solving",
                "competency": "problem_solving",
                "title": "Technical Bottleneck & Root Cause",
                "prompt": "Describe a critical production bug, performance bottleneck, or outage you diagnosed and resolved. What was your diagnostic path?",
                "hint": "Explain profiling tools, root cause discovery, and how you validated the solution.",
                "indicators": ["Rigorous profiling", "Root cause identification", "Verifiable impact"]
            },
            {
                "id": "q3_collaboration",
                "competency": "collaboration",
                "title": "Technical Disagreements & Consensus",
                "prompt": "Tell me about a technical disagreement you had with an engineer or stakeholder regarding architectural design or technical debt. How was it resolved?",
                "hint": "Highlight data-driven decision making and how you reached consensus.",
                "indicators": ["Constructive communication", "Data-driven trade-offs", "Team alignment"]
            },
            {
                "id": "q4_ownership",
                "competency": "ownership",
                "title": "Production Ownership & Risk Mitigation",
                "prompt": "Describe a high-risk release or critical deadline you took personal ownership of. How did you mitigate delivery risks?",
                "hint": "Detail your automated testing, rollout strategy, and post-launch monitoring.",
                "indicators": ["Proactive risk mitigation", "Operational accountability", "Production stewardship"]
            }
        ]
    },
    DOMAIN_GENERAL: {
        "fresher": [
            {
                "id": "q1_role_knowledge",
                "competency": "role_knowledge",
                "title": "Understanding the Role & Preparedness",
                "prompt": "What drew you to this position, and how have your academic studies or personal projects prepared you to succeed in {focus}?",
                "hint": "Share specific examples of coursework, personal initiatives, or transferable skills.",
                "indicators": ["Role motivation", "Foundational preparation", "Clarity of intent"]
            },
            {
                "id": "q2_problem_solving",
                "competency": "problem_solving",
                "title": "Problem Solving & Analysis",
                "prompt": "Tell me about a complex assignment or task where instructions were ambiguous. How did you clarify expectations and deliver results?",
                "hint": "Explain how you analyzed requirements and verified your output.",
                "indicators": ["Resourcefulness", "Structured thinking", "Clarifying assumptions"]
            },
            {
                "id": "q3_collaboration",
                "competency": "collaboration",
                "title": "Teamwork & Communication",
                "prompt": "Describe a situation where you worked in a group and team members had conflicting priorities. How did you keep the project on track?",
                "hint": "Discuss active listening, compromising, and keeping focus on the goal.",
                "indicators": ["Team alignment", "Constructive dialogue", "Reliability"]
            },
            {
                "id": "q4_ownership",
                "competency": "ownership",
                "title": "Personal Initiative & Reliability",
                "prompt": "Give an example of a project or deadline where you took personal responsibility to ensure high quality before final submission.",
                "hint": "Explain your personal standards, checking mechanisms, and the outcome.",
                "indicators": ["Personal accountability", "Thoroughness", "Follow-through"]
            }
        ],
        "experienced": [
            {
                "id": "q1_role_knowledge",
                "competency": "role_knowledge",
                "title": "Domain Mastery & Delivery",
                "prompt": "Can you walk me through a major initiative or deliverable you led involving {focus}? What was your approach and the measurable outcome?",
                "hint": "Use STAR: Situation, Task, your specific actions, and the quantifiable results.",
                "indicators": ["Domain mastery", "Execution competence", "Measurable outcome"]
            },
            {
                "id": "q2_problem_solving",
                "competency": "problem_solving",
                "title": "Strategic Problem Solving",
                "prompt": "Describe a difficult obstacle or constraint you encountered during an important project. What alternatives did you evaluate and why?",
                "hint": "Detail the decision criteria, trade-offs made, and subsequent results.",
                "indicators": ["Analytical depth", "Pragmatic decision making", "Adaptability"]
            },
            {
                "id": "q3_collaboration",
                "competency": "collaboration",
                "title": "Stakeholder Collaboration",
                "prompt": "Tell me about a time you had to align different departments or leaders behind an initiative. How did you overcome skepticism?",
                "hint": "Highlight relationship building, data presentation, and consensus building.",
                "indicators": ["Stakeholder influence", "Effective alignment", "Diplomacy"]
            },
            {
                "id": "q4_ownership",
                "competency": "ownership",
                "title": "Leadership & Ownership",
                "prompt": "Describe a critical deliverable or crisis where you took end-to-end accountability. How did you manage risks to ensure success?",
                "hint": "Detail your mitigation steps, contingency plans, and final results.",
                "indicators": ["Accountability", "Risk mitigation", "Reliable execution"]
            }
        ]
    }
}


def classify_job_domain(title: str, department: str = "", description: str = "", required_skills: List[str] = None) -> Tuple[str, float]:
    """
    Classifies a job into a standard domain based on title, department, description, and required skills.
    Returns (domain, confidence_score: 0.0 to 1.0).
    Title and department carry the highest weight to prevent candidate resume cross-talk.
    """
    clean_title = (title or "").lower()
    clean_dept = (department or "").lower()
    clean_desc = (description or "").lower()
    skills_text = " ".join(required_skills or []).lower()
    
    # Combined texts
    headline_text = f"{clean_title} {clean_dept}"
    full_text = f"{headline_text} {skills_text} {clean_desc}"
    
    scores = {d: 0.0 for d in DOMAIN_RULES}
    
    for domain, rules in DOMAIN_RULES.items():
        weight = rules.get("weight", 1.0)
        # 1. Check title keywords (highest signal: +4.0 each)
        for kw in rules["title_keywords"]:
            if re.search(r'\b' + re.escape(kw) + r'\b', headline_text):
                scores[domain] += 4.0 * weight
                
        # 2. Check required skills (medium-high signal: +1.5 each)
        for kw in rules["content_keywords"]:
            if re.search(r'\b' + re.escape(kw) + r'\b', skills_text):
                scores[domain] += 1.5 * weight
                
        # 3. Check full JD body (context signal: +0.2 each, max 3.0)
        body_hits = 0
        for kw in rules["content_keywords"]:
            if re.search(r'\b' + re.escape(kw) + r'\b', clean_desc):
                body_hits += 1
                if body_hits <= 15:
                    scores[domain] += 0.2 * weight

    best_domain = max(scores, key=scores.get)
    best_score = scores[best_domain]
    
    # If no strong match exists, default to general
    if best_score < 1.0:
        return DOMAIN_GENERAL, 0.4
        
    total_score = sum(scores.values()) or 1.0
    confidence = min(1.0, round(best_score / total_score, 2) if total_score > 0 else 0.5)
    return best_domain, confidence


def classify_seniority(title: str, seniority_hint: str = "", experience_text: str = "") -> str:
    """
    Determines if a role is a fresher/intern or experienced position.
    Returns 'fresher' or 'experienced'.
    """
    combined = f"{title or ''} {seniority_hint or ''} {experience_text or ''}".lower()
    fresher_triggers = [
        "intern", "internship", "fresher", "entry", "entry-level", "graduate",
        "0-1", "0 to 1", "no experience required", "associate intern", "trainee"
    ]
    for trigger in fresher_triggers:
        if re.search(r'\b' + re.escape(trigger) + r'\b', combined):
            return "fresher"
            
    return "experienced"


def get_domain_competencies(domain: str) -> Dict[str, Dict[str, Any]]:
    """Returns the rubric competencies dictionary for a given domain."""
    return DOMAIN_COMPETENCIES.get(domain, DOMAIN_COMPETENCIES[DOMAIN_GENERAL])


def get_fallback_questions(domain: str, seniority: str, focus_topic: str = "") -> List[Dict[str, Any]]:
    """
    Generates domain-appropriate fallback questions when LLMs fail or return empty sets.
    Never defaults to technical/software engineering unless domain is TECH.
    """
    domain_templates = FALLBACK_QUESTION_TEMPLATES.get(domain, FALLBACK_QUESTION_TEMPLATES[DOMAIN_GENERAL])
    level = "fresher" if seniority == "fresher" else "experienced"
    templates = domain_templates.get(level, domain_templates["experienced"])
    
    safe_focus = focus_topic.strip() if focus_topic else "the required core responsibilities"
    
    questions = []
    for idx, t in enumerate(templates):
        formatted_prompt = t["prompt"].replace("{focus}", safe_focus)
        questions.append({
            "id": t["id"],
            "competency": t["competency"],
            "category": t["title"],
            "phase": f"Phase {idx + 1} of {len(templates)}",
            "title": t["title"],
            "prompt": formatted_prompt,
            "hint": t.get("hint", "Use STAR: Situation, Task, Action, Result. Detail your own actions and outcomes."),
            "durationGuide": "2 - 3 mins",
            "expected_evidence": t.get("indicators", ["Clear rationale", "Specific actions taken", "Measurable outcomes"]),
            "scoring_criteria": {"0": "No evidence", "1": "Vague", "2": "Clear relevant response", "3": "Exemplary depth and impact"},
            "uses_star": True,
            "max_follow_ups": 2,
            "question_style_version": "domain-aware-v2",
        })
    return questions

