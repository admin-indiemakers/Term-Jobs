import json
import os
from typing import Any

import psycopg2

DEFAULT_DB_URL = "postgresql://termjobs_remote:d391bc9337f16d2a5a54e4b1@192.168.29.120:5432/termejobs"


def get_db_connection():
    """Establish a connection to the PostgreSQL database."""
    db_url = os.getenv("DATABASE_URL", DEFAULT_DB_URL)
    return psycopg2.connect(db_url)


def fetch_published_requisitions() -> list[dict[str, Any]]:
    """Fetch all published requisitions from PostgreSQL database."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, status, generated_jd_markdown, structured_role, created_at 
            FROM requisitions 
            ORDER BY created_at DESC;
        """)
        rows = cur.fetchall()
        conn.close()

        results = []
        for r in rows:
            req_id, title, status, markdown_jd, structured_role, created_at = r
            
            # Format JD text
            jd_text = ""
            if markdown_jd:
                try:
                    # Parse if stored as JSON string or raw markdown
                    parsed = json.loads(markdown_jd)
                    if isinstance(parsed, dict):
                        jd_text = "\n".join([f"{k.replace('_', ' ').title()}:\n{v}" for k, v in parsed.items()])
                    else:
                        jd_text = str(parsed)
                except Exception:
                    jd_text = markdown_jd
            elif structured_role:
                jd_text = json.dumps(structured_role, indent=2)

            results.append({
                "id": req_id,
                "title": title or "Untitled Role",
                "status": status,
                "jd_text": jd_text,
                "created_at": created_at.isoformat() if created_at else None
            })
        return results
    except Exception as e:
        print(f"Error fetching requisitions from PostgreSQL: {e}")
        return []


def fetch_requisition_by_id(req_id: str) -> dict[str, Any] | None:
    """Fetch a specific requisition by ID from PostgreSQL."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, status, generated_jd_markdown, structured_role 
            FROM requisitions 
            WHERE id = %s;
        """, (req_id,))
        row = cur.fetchone()
        conn.close()

        if not row:
            return None

        r_id, title, status, markdown_jd, structured_role = row
        jd_text = ""
        if markdown_jd:
            try:
                parsed = json.loads(markdown_jd)
                if isinstance(parsed, dict):
                    jd_text = "\n".join([f"{k.replace('_', ' ').title()}:\n{v}" for k, v in parsed.items()])
                else:
                    jd_text = str(parsed)
            except Exception:
                jd_text = markdown_jd
        elif structured_role:
            jd_text = json.dumps(structured_role, indent=2)

        return {
            "id": r_id,
            "title": title or "Untitled Role",
            "status": status,
            "jd_text": jd_text
        }
    except Exception as e:
        print(f"Error fetching requisition '{req_id}': {e}")
        return None
