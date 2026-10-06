"""Database Backup Engine & Router.

Provides automated SQL dump generation of all MongoDB collections for Admin and Super Admin.
Outputs an ANSI/PostgreSQL/SQLite-compatible .sql file ready for download.
"""
import io
import re
import json
import datetime
from typing import Dict, Any, List
from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, Response

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db as mongo_db

router = APIRouter(prefix="/api/backup", tags=["Database Backup"])


def _sanitize_ident(name: str) -> str:
    """Sanitize table/column identifiers for SQL standards."""
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", str(name).strip())
    if not clean or clean[0].isdigit():
        clean = f"col_{clean}"
    return clean


def _sql_escape_value(val: Any) -> str:
    """Format and escape values into ANSI-compliant SQL literals."""
    if val is None:
        return "NULL"
    elif isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    elif isinstance(val, (int, float)):
        return str(val)
    elif isinstance(val, (datetime.datetime, datetime.date)):
        return f"'{val.isoformat()}'"
    elif isinstance(val, ObjectId):
        return f"'{str(val)}'"
    elif isinstance(val, (dict, list)):
        dumped = json.dumps(val, default=str, ensure_ascii=False).replace("'", "''")
        return f"'{dumped}'"
    else:
        escaped = str(val).replace("'", "''")
        return f"'{escaped}'"


def _infer_sql_type(sample_values: list) -> str:
    """Infer appropriate SQL data type from sampled document values."""
    types_found = set()
    for v in sample_values:
        if v is not None:
            types_found.add(type(v))

    if not types_found:
        return "TEXT"
    if bool in types_found:
        return "BOOLEAN"
    if int in types_found and float not in types_found and str not in types_found:
        return "BIGINT"
    if float in types_found and str not in types_found:
        return "NUMERIC(15, 2)"
    if any(t in (datetime.datetime, datetime.date) for t in types_found):
        return "TIMESTAMP WITH TIME ZONE"
    return "TEXT"


def generate_sql_dump(admin_user: User) -> str:
    """Generate complete ANSI SQL DDL and INSERT statements for all database collections."""
    buffer = io.StringIO()
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    now_str = now_utc.strftime("%Y-%m-%d %H:%M:%S UTC")

    # Header
    buffer.write("-- ============================================================================\n")
    buffer.write("-- TERMJOB PLATFORM — DATABASE BACKUP (SQL DUMP)\n")
    buffer.write(f"-- Generated At  : {now_str}\n")
    buffer.write(f"-- Exported By   : {admin_user.name} ({admin_user.email}) [{admin_user.role}]\n")
    buffer.write(f"-- Source System : TermJob MongoDB Atlas Cluster\n")
    buffer.write("-- Target Dialect: ANSI SQL / PostgreSQL / SQLite Compatible\n")
    buffer.write("-- ============================================================================\n\n")

    buffer.write("BEGIN TRANSACTION;\n\n")

    # Retrieve all collections
    all_collections = sorted(mongo_db.list_collection_names())
    # Exclude internal binary chunk collections if any
    filtered_collections = [c for c in all_collections if not c.startswith("fs.") and not c.startswith("system.")]

    total_records = 0
    exported_collections = 0

    for col_name in filtered_collections:
        cursor = mongo_db[col_name].find({})
        docs = list(cursor)
        doc_count = len(docs)
        total_records += doc_count
        exported_collections += 1

        sanitized_table = _sanitize_ident(col_name)

        buffer.write(f"-- ----------------------------------------------------------------------------\n")
        buffer.write(f"-- Collection / Table: {sanitized_table} ({doc_count} records)\n")
        buffer.write(f"-- ----------------------------------------------------------------------------\n")

        if doc_count == 0:
            buffer.write(f'DROP TABLE IF EXISTS "{sanitized_table}" CASCADE;\n')
            buffer.write(f'CREATE TABLE "{sanitized_table}" (\n')
            buffer.write('    "id" VARCHAR(64) PRIMARY KEY\n')
            buffer.write(');\n\n')
            continue

        # Inspect all fields across all docs in collection
        field_samples: Dict[str, list] = {}
        for doc in docs:
            for k, v in doc.items():
                if k not in field_samples:
                    field_samples[k] = []
                if len(field_samples[k]) < 50:
                    field_samples[k].append(v)

        columns = list(field_samples.keys())

        # Generate CREATE TABLE DDL
        buffer.write(f'DROP TABLE IF EXISTS "{sanitized_table}" CASCADE;\n')
        buffer.write(f'CREATE TABLE "{sanitized_table}" (\n')

        col_defs = []
        for col in columns:
            sql_col = _sanitize_ident(col)
            sql_type = _infer_sql_type(field_samples[col])
            if col in ("_id", "id"):
                col_defs.append(f'    "{sql_col}" {sql_type} PRIMARY KEY' if col == "_id" else f'    "{sql_col}" {sql_type}')
            else:
                col_defs.append(f'    "{sql_col}" {sql_type}')

        buffer.write(",\n".join(col_defs))
        buffer.write("\n);\n\n")

        # Generate INSERT INTO statements
        sanitized_col_names = [_sanitize_ident(c) for c in columns]
        col_list_str = ", ".join(f'"{c}"' for c in sanitized_col_names)

        for doc in docs:
            val_strs = [_sql_escape_value(doc.get(c)) for c in columns]
            vals_str = ", ".join(val_strs)
            buffer.write(f'INSERT INTO "{sanitized_table}" ({col_list_str}) VALUES ({vals_str});\n')

        buffer.write("\n")

    buffer.write("COMMIT;\n\n")
    buffer.write("-- ============================================================================\n")
    buffer.write(f"-- DATABASE BACKUP COMPLETED\n")
    buffer.write(f"-- Total Collections Exported: {exported_collections}\n")
    buffer.write(f"-- Total Records Exported    : {total_records}\n")
    buffer.write("-- ============================================================================\n")

    return buffer.getvalue()


@router.get("/sql")
def download_database_sql_backup(
    current_user: User = Depends(get_current_user),
):
    """Generate and download a complete .sql backup of the entire TermJob database (Super Admin only)."""
    if current_user.role != "Super Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrators can download entire database backups.",
        )

    sql_dump = generate_sql_dump(current_user)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"termjob_entire_db_backup_{timestamp}.sql"

    return Response(
        content=sql_dump,
        media_type="application/sql",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/summary")
def get_backup_summary(
    current_user: User = Depends(get_current_user),
):
    """Retrieve statistical summary of database records for the backup UI (Super Admin only)."""
    if current_user.role != "Super Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Super Admin access required.",
        )

    all_collections = sorted(mongo_db.list_collection_names())
    filtered = [c for c in all_collections if not c.startswith("fs.") and not c.startswith("system.")]

    counts = {}
    total_records = 0
    for c in filtered:
        cnt = mongo_db[c].count_documents({})
        counts[c] = cnt
        total_records += cnt

    return {
        "ok": True,
        "total_collections": len(filtered),
        "total_records": total_records,
        "collections": counts,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
