import json
import os
import uuid
from typing import Any, Dict, List, Optional
import psycopg2

DEFAULT_DB_URL = "postgresql://termjobs_remote:d391bc9337f16d2a5a54e4b1@192.168.29.120:5432/termejobs"


def get_db_connection():
    """Establish a connection to the PostgreSQL database."""
    db_url = os.getenv("DATABASE_URL", DEFAULT_DB_URL)
    return psycopg2.connect(db_url)


def init_db():
    """Ensure candidate_submissions table exists in PostgreSQL."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS candidate_submissions (
                id VARCHAR(100) PRIMARY KEY,
                requisition_id VARCHAR(100),
                candidate_name VARCHAR(255) NOT NULL,
                candidate_email VARCHAR(255),
                vendor_name VARCHAR(255) DEFAULT 'Vendor A',
                filename VARCHAR(255),
                fingerprint VARCHAR(100),
                match_score NUMERIC(5, 2),
                recommendation VARCHAR(100),
                status VARCHAR(100) DEFAULT 'Screened',
                summary TEXT,
                details JSONB,
                matched_skills JSONB,
                missing_skills JSONB,
                hiring_manager_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database init warning: {e}")


def save_candidate_submission(cand: Dict[str, Any], requisition_id: Optional[str] = None, vendor_name: str = "Vendor A") -> str:
    """Save or update candidate submission record directly in PostgreSQL."""
    init_db()
    submission_id = cand.get("submission_id") or str(uuid.uuid4())[:8]
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO candidate_submissions (
                id, requisition_id, candidate_name, candidate_email, vendor_name, 
                filename, fingerprint, match_score, recommendation, status, 
                summary, details, matched_skills, missing_skills
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                match_score = EXCLUDED.match_score,
                recommendation = EXCLUDED.recommendation,
                summary = EXCLUDED.summary,
                updated_at = CURRENT_TIMESTAMP;
        """, (
            submission_id,
            requisition_id or cand.get("requisition_id"),
            cand["candidate_name"],
            cand.get("candidate_email"),
            vendor_name or cand.get("vendor_name", "Vendor A"),
            cand.get("filename"),
            cand.get("fingerprint"),
            cand.get("match_score"),
            cand.get("recommendation"),
            cand.get("status", "Screened"),
            cand.get("summary"),
            json.dumps(cand.get("details", {})),
            json.dumps(cand.get("matched_skills", [])),
            json.dumps(cand.get("missing_skills", []))
        ))
        
        conn.commit()
        conn.close()
        return submission_id
    except Exception as e:
        print(f"Error saving candidate submission to PostgreSQL: {e}")
        return submission_id


def update_candidate_status_in_db(submission_id: str, status: str, notes: Optional[str] = None) -> bool:
    """Update candidate state in PostgreSQL (Screened -> Shortlisted / Rejected / InterviewScheduled)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE candidate_submissions 
            SET status = %s, hiring_manager_notes = %s, updated_at = CURRENT_TIMESTAMP 
            WHERE id = %s;
        """, (status, notes or "", submission_id))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating candidate status in PostgreSQL: {e}")
        return False


def fetch_candidates_from_db(requisition_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch stored candidate submissions from PostgreSQL sorted by match_score DESC."""
    init_db()
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = "SELECT id, requisition_id, candidate_name, candidate_email, vendor_name, filename, fingerprint, match_score, recommendation, status, summary, details, matched_skills, missing_skills, hiring_manager_notes, created_at FROM candidate_submissions"
        params = []
        conditions = []
        
        if requisition_id:
            conditions.append("requisition_id = %s")
            params.append(requisition_id)
        if status:
            conditions.append("status = %s")
            params.append(status)
            
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        query += " ORDER BY match_score DESC, created_at DESC;"
        
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        conn.close()
        
        results = []
        for r in rows:
            results.append({
                "submission_id": r[0],
                "requisition_id": r[1],
                "candidate_name": r[2],
                "candidate_email": r[3],
                "vendor_name": r[4] or "Vendor A",
                "filename": r[5],
                "fingerprint": r[6],
                "match_score": float(r[7]) if r[7] is not None else 0.0,
                "recommendation": r[8],
                "status": r[9],
                "summary": r[10],
                "details": r[11] if isinstance(r[11], dict) else json.loads(r[11] or "{}"),
                "matched_skills": r[12] if isinstance(r[12], list) else json.loads(r[12] or "[]"),
                "missing_skills": r[13] if isinstance(r[13], list) else json.loads(r[13] or "[]"),
                "hiring_manager_notes": r[14],
                "created_at": r[15].isoformat() if r[15] else None
            })
        return results
    except Exception as e:
        print(f"Error fetching candidate submissions from PostgreSQL: {e}")
        return []


def fetch_published_requisitions() -> List[Dict[str, Any]]:
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


def fetch_requisition_by_id(req_id: str) -> Optional[Dict[str, Any]]:
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
