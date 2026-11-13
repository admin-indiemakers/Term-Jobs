from typing import ClassVar, Dict, Any, List
from modules.shared.db import Model, Column, _uuid, _utcnow


class TeamReport(Model):
    """
    Manual and team-aggregated report log for TermJobs operations, growth,
    marketing performance, and operational progress.
    """
    __tablename__ = "team_reports"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "report_type": "daily",  # daily, weekly, monthly
        "report_date": "",       # YYYY-MM-DD
        "period_start": "",      # YYYY-MM-DD
        "period_end": "",        # YYYY-MM-DD
        "author_id": "",
        "author_name": "",
        "author_email": "",
        "author_role": "",
        "status": "draft",       # draft, submitted
        
        # 1. Business Metrics
        "metrics": dict,
        
        # 2. Daily Work & Progress items
        "work_progress": list,
        
        # 3. Content & Marketing Activities
        "marketing_activities": list,
        
        # 4. Observations & Insights
        "observations": dict,
        
        # 5. Next Steps / Action Items
        "action_items": list,
        
        # 6. Audit Trail
        "audit_trail": list,
        
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    report_type = Column("report_type")
    report_date = Column("report_date")
    status = Column("status")
    author_id = Column("author_id")
    created_at = Column("created_at")
    updated_at = Column("updated_at")
