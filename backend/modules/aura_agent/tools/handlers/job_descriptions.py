"""Job description generation and skill taxonomy tools."""
from ..registry import hiring_tool, ToolResult
from ..context import ToolExecutionContext
from ..schemas import GenerateEnterpriseJDInput, RefineSkillRequirementsInput


@hiring_tool(
    name="generate_enterprise_jd",
    description="Generate enterprise-grade Job Description markdown based on role requirements.",
    domain="job_descriptions",
    input_model=GenerateEnterpriseJDInput,
    read_only=True
)
async def generate_enterprise_jd_handler(args: GenerateEnterpriseJDInput, ctx: ToolExecutionContext) -> ToolResult:
    skills_list = ", ".join(args.skills)
    jd_markdown = f"""# {args.title}
**Location / Arrangement:** {args.work_mode}
**Minimum Experience:** {args.experience_years}+ years

## Role Overview
We are seeking an experienced **{args.title}** to join our team. {args.role_context or ''}

## Key Responsibilities
- Architect, build, and maintain production-grade services.
- Collaborate with cross-functional product and engineering stakeholders.
- Enforce enterprise standards for testability, code quality, and performance.

## Core Qualifications
- Proven track record with: {skills_list}.
- Deep understanding of clean architectural principles and asynchronous patterns.
- Strong problem-solving and proactive communication skills.
"""
    return ToolResult(
        success=True,
        data={"title": args.title, "job_description": jd_markdown},
        message=f"Generated enterprise JD for {args.title}.",
        ui_card="markdown_preview_card"
    )


@hiring_tool(
    name="refine_skill_requirements",
    description="Analyze and structure raw skill keywords into standardized primary and secondary requirements.",
    domain="job_descriptions",
    input_model=RefineSkillRequirementsInput,
    read_only=True
)
async def refine_skill_requirements_handler(args: RefineSkillRequirementsInput, ctx: ToolExecutionContext) -> ToolResult:
    primary = [s.strip().title() for s in args.raw_skills[:3]]
    secondary = [s.strip().title() for s in args.raw_skills[3:]] if len(args.raw_skills) > 3 else ["Git", "Agile"]
    return ToolResult(
        success=True,
        data={"primary_skills": primary, "secondary_skills": secondary, "role_title": args.role_title},
        message=f"Refined skills for {args.role_title}.",
        ui_card="skill_taxonomy_chip_group"
    )
