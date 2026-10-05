"""Adaptive Cards 1.5 Builder for Microsoft Teams Hiring Manager AI Assistant.

Produces rich, native Microsoft Teams Adaptive Cards with:
- Fluent Design dark/light mode compatibility
- Visual banners, badges, and FactSets
- Action.Submit and Action.OpenUrl buttons
"""
from typing import Dict, Any, List, Optional


def build_teams_adaptive_card_attachment(card_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Wrap Adaptive Card body/actions into a Microsoft Bot Framework attachment."""
    return {
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.5",
            **card_payload
        }
    }


def build_welcome_card(user_name: str, company_name: str) -> Dict[str, Any]:
    """Generate welcome and quick action card for MS Teams."""
    return build_teams_adaptive_card_attachment({
        "body": [
            {
                "type": "Container",
                "style": "emphasis",
                "bleed": True,
                "items": [
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": "https://img.icons8.com/fluency/96/artificial-intelligence.png",
                                        "size": "Medium",
                                        "style": "Person"
                                    }
                                ]
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": f"Welcome, {user_name}!",
                                        "weight": "Bolder",
                                        "size": "Large",
                                        "color": "Accent"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": f"TermJobs AI Hiring Assistant • {company_name}",
                                        "spacing": "None",
                                        "isSubtle": True
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "type": "TextBlock",
                "text": "How can I assist your engineering and talent pipeline today? You can type any instruction naturally or tap a quick action below:",
                "wrap": True,
                "spacing": "Medium"
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Pending Works:", "value": "Inspect approvals, contracts & alerts"},
                    {"title": "Role Drafting:", "value": "\"Draft a React dev with 4 yrs exp\""},
                    {"title": "Calendar:", "value": "\"Show upcoming interviews\""},
                    {"title": "Candidates:", "value": "\"Show candidates working under me\""}
                ]
            }
        ],
        "actions": [
            {
                "type": "Action.Submit",
                "title": "⚡ Pending Works",
                "data": {"action": "pending_works"}
            },
            {
                "type": "Action.Submit",
                "title": "📅 Upcoming Meetings",
                "data": {"action": "upcoming_meetings"}
            },
            {
                "type": "Action.Submit",
                "title": "👥 Shortlisted Candidates",
                "data": {"action": "shortlisted_candidates"}
            },
            {
                "type": "Action.Submit",
                "title": "📋 Live Requisitions",
                "data": {"action": "list_requisitions"}
            }
        ]
    })


def build_account_linked_card(user_name: str, company_name: str) -> Dict[str, Any]:
    """Generate account paired success card."""
    return build_teams_adaptive_card_attachment({
        "body": [
            {
                "type": "Container",
                "style": "good",
                "bleed": True,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "🎉 Microsoft Teams Account Linked!",
                        "weight": "Bolder",
                        "size": "Large",
                        "color": "Good"
                    },
                    {
                        "type": "TextBlock",
                        "text": f"Connected to {company_name} Workspace",
                        "isSubtle": True,
                        "spacing": "None"
                    }
                ]
            },
            {
                "type": "TextBlock",
                "text": f"Hello **{user_name}**! Your Microsoft Teams account has been authenticated and linked directly to your Hiring Manager workspace.",
                "wrap": True,
                "spacing": "Medium"
            },
            {
                "type": "TextBlock",
                "text": "All interview updates, candidate reviews, timesheet approvals, and requisition drafts will now sync in real time directly inside this chat.",
                "wrap": True,
                "isSubtle": True
            }
        ],
        "actions": [
            {
                "type": "Action.Submit",
                "title": "⚡ View My Pending Works",
                "data": {"action": "pending_works"}
            },
            {
                "type": "Action.Submit",
                "title": "🎯 Draft a New Job Requisition",
                "data": {"action": "start_requisition_draft"}
            }
        ]
    })


def build_profile_card(user_name: str, company_name: str, email: str, role: str) -> Dict[str, Any]:
    """Card confirming hiring manager identity."""
    return build_teams_adaptive_card_attachment({
        "body": [
            {
                "type": "Container",
                "style": "emphasis",
                "bleed": True,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": f"👤 Profile: {user_name}",
                        "weight": "Bolder",
                        "size": "Medium"
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Name:", "value": user_name},
                    {"title": "Role:", "value": role or "Hiring Manager"},
                    {"title": "Company:", "value": company_name},
                    {"title": "Email:", "value": email or "Not configured"}
                ]
            },
            {
                "type": "TextBlock",
                "text": "All requisitions, candidates, and approvals in this chat are paired directly to your profile.",
                "isSubtle": True,
                "wrap": True
            }
        ],
        "actions": [
            {
                "type": "Action.Submit",
                "title": "⚡ Pending Tasks",
                "data": {"action": "pending_works"}
            }
        ]
    })


def build_pending_works_card(pending_res: Dict[str, Any], company_name: str) -> Dict[str, Any]:
    """Generate executive Pending Works Action Center card for MS Teams."""
    counts = pending_res.get("counts", {})
    details = pending_res.get("details", {})
    total = sum(counts.values()) if counts else 0

    body: List[Dict[str, Any]] = [
        {
            "type": "Container",
            "style": "emphasis",
            "bleed": True,
            "items": [
                {
                    "type": "TextBlock",
                    "text": "⚡ Hiring Manager Pending Works Action Center",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Accent"
                },
                {
                    "type": "TextBlock",
                    "text": f"{company_name} Workspace • {total} Action Items Requiring Attention",
                    "isSubtle": True,
                    "spacing": "None"
                }
            ]
        },
        {
            "type": "FactSet",
            "facts": [
                {"title": "📋 Draft Requisitions:", "value": str(counts.get("requisition_drafts", 0))},
                {"title": "👥 Shortlisted Review:", "value": str(counts.get("shortlisted_candidates", 0))},
                {"title": "⏳ Pending Timesheets:", "value": str(counts.get("pending_timesheets", 0))},
                {"title": "💵 Expense Claims:", "value": str(counts.get("pending_expenses", 0))},
                {"title": "📅 Interviews Today:", "value": str(counts.get("interviews_today", 0))}
            ]
        }
    ]

    actions: List[Dict[str, Any]] = [
        {
            "type": "Action.Submit",
            "title": "👥 Shortlisted Candidates",
            "data": {"action": "shortlisted_candidates"}
        },
        {
            "type": "Action.Submit",
            "title": "⏳ Timesheets & Expenses",
            "data": {"action": "review_timesheets"}
        },
        {
            "type": "Action.Submit",
            "title": "📅 Today's Interviews",
            "data": {"action": "upcoming_meetings"}
        }
    ]

    return build_teams_adaptive_card_attachment({
        "body": body,
        "actions": actions
    })


def build_requisition_draft_card(draft: Dict[str, Any]) -> Dict[str, Any]:
    """Generate interactive Requisition Draft card with submit/edit actions."""
    title = draft.get("title", "Engineering Role")
    dept = draft.get("department", "Engineering")
    loc = draft.get("location", "Remote")
    exp = draft.get("experience_level", "Mid-Level")
    salary = draft.get("salary_range", "Competitive")
    skills = draft.get("skills", "")
    if isinstance(skills, list):
        skills = ", ".join(skills)
    jd = draft.get("job_description", "")

    body: List[Dict[str, Any]] = [
        {
            "type": "Container",
            "style": "emphasis",
            "bleed": True,
            "items": [
                {
                    "type": "TextBlock",
                    "text": f"📋 Requisition Draft: {title}",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Accent"
                },
                {
                    "type": "TextBlock",
                    "text": "Review all parameters before forwarding to Director for approval",
                    "isSubtle": True,
                    "spacing": "None"
                }
            ]
        },
        {
            "type": "FactSet",
            "facts": [
                {"title": "Role Title:", "value": title},
                {"title": "Department:", "value": dept},
                {"title": "Location:", "value": loc},
                {"title": "Experience:", "value": exp},
                {"title": "Salary / Budget:", "value": salary},
                {"title": "Tech Stack:", "value": skills or "Full Stack"}
            ]
        }
    ]

    if jd:
        body.append({
            "type": "TextBlock",
            "text": f"**Summary:** {jd[:240]}..." if len(jd) > 240 else f"**Summary:** {jd}",
            "wrap": True,
            "isSubtle": True
        })

    actions = [
        {
            "type": "Action.Submit",
            "title": "✅ Submit to Director",
            "style": "positive",
            "data": {
                "action": "submit_to_director",
                "title": title,
                "department": dept,
                "location": loc,
                "experience_level": exp,
                "salary_range": salary,
                "skills": skills,
                "job_description": jd
            }
        },
        {
            "type": "Action.Submit",
            "title": "✏️ Edit Parameters",
            "data": {"action": "edit_draft", "title": title}
        },
        {
            "type": "Action.Submit",
            "title": "❌ Cancel Draft",
            "style": "destructive",
            "data": {"action": "cancel_draft"}
        }
    ]

    return build_teams_adaptive_card_attachment({
        "body": body,
        "actions": actions
    })


def build_upcoming_meetings_card(meetings: List[Dict[str, Any]], company_name: str) -> Dict[str, Any]:
    """Generate upcoming meetings and scheduled interview list card."""
    body: List[Dict[str, Any]] = [
        {
            "type": "Container",
            "style": "emphasis",
            "bleed": True,
            "items": [
                {
                    "type": "TextBlock",
                    "text": "📅 Scheduled Interviews & Meetings",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Accent"
                },
                {
                    "type": "TextBlock",
                    "text": f"{company_name} • {len(meetings)} Upcoming Session(s)",
                    "isSubtle": True,
                    "spacing": "None"
                }
            ]
        }
    ]

    actions: List[Dict[str, Any]] = []

    if not meetings:
        body.append({
            "type": "TextBlock",
            "text": "🎉 No upcoming interviews scheduled today. You're all caught up!",
            "wrap": True,
            "spacing": "Medium"
        })
    else:
        for idx, m in enumerate(meetings[:4], 1):
            cand = m.get("candidate_name", "Candidate")
            role = m.get("role") or m.get("requisition_title") or "Engineering Position"
            d = m.get("date", "Today")
            t = m.get("time", "03:00 PM")
            link = m.get("meeting_link") or "https://termjobs.in"
            passcode = m.get("passcode") or "TERM2026"

            item_container = {
                "type": "Container",
                "separator": True,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": f"**{idx}. {cand}** — {role}",
                        "weight": "Bolder"
                    },
                    {
                        "type": "FactSet",
                        "facts": [
                            {"title": "Schedule:", "value": f"{d} at {t}"},
                            {"title": "Passcode:", "value": passcode}
                        ]
                    }
                ]
            }
            body.append(item_container)

            if idx == 1 and link:
                actions.append({
                    "type": "Action.OpenUrl",
                    "title": f"🎥 Join {cand}'s Interview",
                    "url": link
                })

    actions.append({
        "type": "Action.Submit",
        "title": "⚡ Pending Tasks",
        "data": {"action": "pending_works"}
    })

    return build_teams_adaptive_card_attachment({
        "body": body,
        "actions": actions
    })


def build_candidate_action_card(candidate: Dict[str, Any]) -> Dict[str, Any]:
    """Generate candidate review card with Schedule Interview & Reject actions."""
    name = candidate.get("candidate_name") or candidate.get("name") or "Candidate"
    role = candidate.get("requisition_title") or candidate.get("role") or "Software Engineer"
    score = candidate.get("match_score") or candidate.get("screening_score") or "92%"
    exp = candidate.get("experience_years") or "4+ years"
    skills = candidate.get("key_skills") or "React, Python, TypeScript"
    vendor = candidate.get("vendor_name") or "Vendorqueue"

    body: List[Dict[str, Any]] = [
        {
            "type": "Container",
            "style": "emphasis",
            "bleed": True,
            "items": [
                {
                    "type": "TextBlock",
                    "text": f"👤 Candidate: {name}",
                    "weight": "Bolder",
                    "size": "Medium"
                },
                {
                    "type": "TextBlock",
                    "text": f"Shortlisted for {role} • AI Match: {score}",
                    "isSubtle": True,
                    "spacing": "None"
                }
            ]
        },
        {
            "type": "FactSet",
            "facts": [
                {"title": "Experience:", "value": str(exp)},
                {"title": "Skills:", "value": str(skills)},
                {"title": "Vendor:", "value": str(vendor)}
            ]
        }
    ]

    actions = [
        {
            "type": "Action.Submit",
            "title": f"📅 Schedule Interview",
            "style": "positive",
            "data": {
                "action": "schedule_interview_prompt",
                "candidate_name": name,
                "role": role
            }
        },
        {
            "type": "Action.Submit",
            "title": f"🚫 Reject",
            "style": "destructive",
            "data": {
                "action": "reject_candidate_prompt",
                "candidate_name": name
            }
        }
    ]

    return build_teams_adaptive_card_attachment({
        "body": body,
        "actions": actions
    })


def build_timesheet_review_card(timesheets: List[Dict[str, Any]], expenses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate timesheet & expense review card."""
    body: List[Dict[str, Any]] = [
        {
            "type": "Container",
            "style": "emphasis",
            "bleed": True,
            "items": [
                {
                    "type": "TextBlock",
                    "text": "⏳ Pending Timesheets & Expenses",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Accent"
                },
                {
                    "type": "TextBlock",
                    "text": f"{len(timesheets)} Timesheet(s) • {len(expenses)} Expense Claim(s) awaiting approval",
                    "isSubtle": True,
                    "spacing": "None"
                }
            ]
        }
    ]

    actions: List[Dict[str, Any]] = []

    if not timesheets and not expenses:
        body.append({
            "type": "TextBlock",
            "text": "✅ All timesheets and expense claims have been reviewed and approved!",
            "wrap": True,
            "spacing": "Medium"
        })
    else:
        for ts in timesheets[:2]:
            ts_id = str(ts.get("id") or ts.get("_id") or "ts_1")
            c_name = ts.get("candidate_name", "Contractor")
            hrs = ts.get("total_hours", 40)
            week = ts.get("week_period", "Current Week")
            body.append({
                "type": "Container",
                "separator": True,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": f"⏱️ **{c_name}** — {hrs} hrs ({week})",
                        "weight": "Bolder"
                    }
                ]
            })
            actions.append({
                "type": "Action.Submit",
                "title": f"✅ Approve {c_name}'s Timesheet",
                "data": {"action": "approve_timesheet", "timesheet_id": ts_id, "candidate_name": c_name}
            })

    actions.append({
        "type": "Action.Submit",
        "title": "⚡ Pending Tasks",
        "data": {"action": "pending_works"}
    })

    return build_teams_adaptive_card_attachment({
        "body": body,
        "actions": actions
    })
