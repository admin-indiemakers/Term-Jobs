import os
import io
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional, Dict, Any, List

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import pymongo
from dotenv import load_dotenv

from .service import calculate_growth_analytics

load_dotenv('D:/projects/Term-Jobs/backend/.env')
_mongo_client = pymongo.MongoClient(os.getenv('MONGODB_URL'))
_db = _mongo_client[os.getenv('MONGO_DB_NAME', 'termjobs')]

ist = ZoneInfo('Asia/Kolkata')


def _format_display_date(date_str: str) -> str:
    """Format YYYY-MM-DD as 'Nov 06, 2026'."""
    if not date_str:
        return ""
    try:
        dt = datetime.strptime(str(date_str)[:10], "%Y-%m-%d")
        return dt.strftime("%b %d, %Y")
    except Exception:
        return str(date_str)


def build_reports_excel_workbook(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> openpyxl.Workbook:
    """
    Builds a professional, single-worksheet Excel workbook matching the exact TermJobs reference design:
    - Row 1: TermJobs Dark Green Banner (Title, Period, Generated Date)
    - Row 3-9: 1. Executive Summary (Left) & 2. Conversion Funnel + Callout Card (Right)
    - Row 11-N: 3. Daily Report Summary (Full-Width Table with SUM totals)
    - Row N+3: 4. Marketing Performance by Channel (Left) & 5. Work & Progress Milestones (Right)
    - Row M+2: 6. Key Insights (Left) & 7. Action Items (Right)
    """
    today_dt = datetime.now(ist)
    today_str = today_dt.strftime("%Y-%m-%d")

    # Default date range: Nov 01 to today if not supplied
    if not start_date:
        start_date = "2026-11-01"
    if not end_date:
        end_date = today_str

    # 1. Fetch Growth Analytics & KPIs for selected period
    analytics = calculate_growth_analytics("custom", start_date=start_date, end_date=end_date)
    kpis = analytics.get("kpis") or {}
    funnel = analytics.get("conversion_funnel") or []
    marketing_channels = analytics.get("marketing_channels") or []
    ai_insights = analytics.get("ai_insights") or []

    # 2. Fetch all daily reports from DB within [start_date, end_date]
    reports_cursor = _db.team_reports.find({
        "report_date": {"$gte": start_date, "$lte": end_date}
    }).sort("report_date", 1)
    daily_reports = list(reports_cursor)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Reports & Progress"

    # Make gridlines explicit and visible
    ws.views.sheetView[0].showGridLines = True

    # Palette Constants
    DARK_GREEN_FILL = PatternFill(start_color="1E5631", end_color="1E5631", fill_type="solid")
    SECTION_HEADER_FILL = PatternFill(start_color="D4ECD5", end_color="D4ECD5", fill_type="solid")
    COL_HEADER_FILL = PatternFill(start_color="EAF6EC", end_color="EAF6EC", fill_type="solid")
    TOTAL_ROW_FILL = PatternFill(start_color="F0FDF4", end_color="F0FDF4", fill_type="solid")
    KPI_CARD_FILL = PatternFill(start_color="E8F8EE", end_color="E8F8EE", fill_type="solid")
    WHITE_FILL = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    # Status / Priority Fills & Fonts
    COMPLETED_FILL = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    COMPLETED_FONT = Font(name="Calibri", size=10, bold=True, color="15803D")

    IN_PROGRESS_FILL = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    IN_PROGRESS_FONT = Font(name="Calibri", size=10, bold=True, color="B45309")

    NOT_STARTED_FILL = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    NOT_STARTED_FONT = Font(name="Calibri", size=10, bold=False, color="6B7280")

    HIGH_PRIO_FILL = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    HIGH_PRIO_FONT = Font(name="Calibri", size=10, bold=True, color="B91C1C")

    MED_PRIO_FILL = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    MED_PRIO_FONT = Font(name="Calibri", size=10, bold=True, color="B45309")

    LOW_PRIO_FILL = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid")
    LOW_PRIO_FONT = Font(name="Calibri", size=10, bold=True, color="1E40AF")

    # Font definitions
    FONT_TITLE_LEFT = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
    FONT_TITLE_RIGHT = Font(name="Calibri", size=10, bold=False, color="FFFFFF")
    FONT_SECTION_HDR = Font(name="Calibri", size=11, bold=True, color="064E3B")
    FONT_COL_HDR = Font(name="Calibri", size=10, bold=True, color="1F2937")
    FONT_REGULAR = Font(name="Calibri", size=10, bold=False, color="1F2937")
    FONT_BOLD = Font(name="Calibri", size=10, bold=True, color="000000")
    FONT_GREEN_CHANGE = Font(name="Calibri", size=10, bold=True, color="16A34A")

    # Border definitions
    THIN_BORDER_SIDE = Side(border_style="thin", color="CBD5E1")
    CELL_BORDER = Border(
        left=THIN_BORDER_SIDE,
        right=THIN_BORDER_SIDE,
        top=THIN_BORDER_SIDE,
        bottom=THIN_BORDER_SIDE,
    )
    DOUBLE_BOTTOM_SIDE = Side(border_style="double", color="374151")
    TOTAL_BORDER = Border(
        left=THIN_BORDER_SIDE,
        right=THIN_BORDER_SIDE,
        top=THIN_BORDER_SIDE,
        bottom=DOUBLE_BOTTOM_SIDE,
    )
    KPI_CARD_BORDER = Border(
        left=Side(border_style="medium", color="10B981"),
        right=Side(border_style="medium", color="10B981"),
        top=Side(border_style="medium", color="10B981"),
        bottom=Side(border_style="medium", color="10B981"),
    )

    # Alignments
    ALIGN_LEFT = Alignment(horizontal="left", vertical="center")
    ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
    ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")
    ALIGN_WRAP_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)

    def apply_style_range(ws_obj, cell_range, font=None, fill=None, border=None, alignment=None):
        """Applies styles uniformly across a merged or multi-cell range."""
        for row in ws_obj[cell_range]:
            for cell in row:
                if font: cell.font = font
                if fill: cell.fill = fill
                if border: cell.border = border
                if alignment: cell.alignment = alignment

    # Set Column Widths (A to O)
    col_widths = {
        "A": 16, # Date, Metric, Channel, Insight
        "B": 12, # Companies, This Period, Spend
        "C": 14, # Visitors, Previous Period, Reach
        "D": 13, # Registrations, Change, Clicks
        "E": 16, # Profiles Completed, % Change, Registrations
        "F": 13, # Applications
        "G": 13, # Shortlisted, Stage, Cost/Reg
        "H": 13, # Interviews, Count, Cost/App
        "I": 14, # Hires, Conversion from Previous, ROI
        "J": 12, # Vacancies (Daily) / Spacer for side tables
        "K": 32, # Key Observations / Task / Activity / Action Item
        "L": 14, # Owner
        "M": 13, # Status / Priority
        "N": 16, # Progress / Status
        "O": 13, # Due Date
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    # ==========================================
    # ROW 1: TOP HEADER BANNER
    # ==========================================
    ws.row_dimensions[1].height = 36
    ws.merge_cells("A1:G1")
    ws["A1"] = "TermJobs – Reports & Progress"
    ws["A1"].font = FONT_TITLE_LEFT
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)

    ws.merge_cells("H1:O1")
    period_str = f"Report Period: {_format_display_date(start_date)} – {_format_display_date(end_date)}   |   Generated: {_format_display_date(today_str)}"
    ws["H1"] = period_str
    ws["H1"].font = FONT_TITLE_RIGHT
    ws["H1"].alignment = Alignment(horizontal="right", vertical="center")

    apply_style_range(ws, "A1:O1", fill=DARK_GREEN_FILL)

    # ROW 2: Spacer
    ws.row_dimensions[2].height = 10

    # ==========================================
    # SECTION 1 & 2: EXECUTIVE SUMMARY & CONVERSION FUNNEL
    # ==========================================
    # Section 1 Heading (A3:E3)
    ws.row_dimensions[3].height = 22
    ws.merge_cells("A3:E3")
    ws["A3"] = "1. Executive Summary"
    apply_style_range(ws, "A3:E3", font=FONT_SECTION_HDR, fill=SECTION_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    # Section 2 Heading (G3:I3)
    ws.merge_cells("G3:I3")
    ws["G3"] = "2. Conversion Funnel"
    apply_style_range(ws, "G3:I3", font=FONT_SECTION_HDR, fill=SECTION_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    # Table 1 Headers (Row 4)
    ws.row_dimensions[4].height = 20
    t1_headers = [
        ("A4", "Metric", ALIGN_LEFT),
        ("B4", "This Period", ALIGN_CENTER),
        ("C4", "Previous Period", ALIGN_CENTER),
        ("D4", "Change", ALIGN_CENTER),
        ("E4", "% Change", ALIGN_CENTER),
    ]
    for cell_id, text, align in t1_headers:
        c = ws[cell_id]
        c.value = text
        c.font = FONT_COL_HDR
        c.fill = COL_HEADER_FILL
        c.border = CELL_BORDER
        c.alignment = align

    # Table 2 Headers (Row 4)
    t2_headers = [
        ("G4", "Stage", ALIGN_LEFT),
        ("H4", "Count", ALIGN_CENTER),
        ("I4", "Conversion from Previous", ALIGN_CENTER),
    ]
    for cell_id, text, align in t2_headers:
        c = ws[cell_id]
        c.value = text
        c.font = FONT_COL_HDR
        c.fill = COL_HEADER_FILL
        c.border = CELL_BORDER
        c.alignment = align

    # Executive Summary Data Rows (Rows 5 to 9)
    exec_metrics = [
        ("Companies Onboarded", kpis.get("companies_onboarded", {})),
        ("Website Visitors", kpis.get("website_visitors", {})),
        ("Registrations", kpis.get("registrations", {})),
        ("Profile Completions", {"value": sum(r.get("metrics", {}).get("profile_completions", 0) for r in daily_reports)}),
        ("Job Applications", kpis.get("job_applications", {})),
    ]

    for idx, (label, item) in enumerate(exec_metrics, start=5):
        ws.row_dimensions[idx].height = 18
        cur_val = int(item.get("value", 0) or 0)
        
        # In a genuine period, prior period defaults to 0 if starting fresh
        ws[f"A{idx}"] = label
        ws[f"A{idx}"].font = FONT_REGULAR
        ws[f"A{idx}"].alignment = ALIGN_LEFT
        ws[f"A{idx}"].border = CELL_BORDER

        ws[f"B{idx}"] = cur_val
        ws[f"B{idx}"].font = FONT_REGULAR
        ws[f"B{idx}"].alignment = ALIGN_CENTER
        ws[f"B{idx}"].border = CELL_BORDER
        ws[f"B{idx}"].number_format = "#,##0"

        ws[f"C{idx}"] = 0
        ws[f"C{idx}"].font = FONT_REGULAR
        ws[f"C{idx}"].alignment = ALIGN_CENTER
        ws[f"C{idx}"].border = CELL_BORDER
        ws[f"C{idx}"].number_format = "#,##0"

        # Formula for Change: =B{idx}-C{idx}
        ws[f"D{idx}"] = f"=B{idx}-C{idx}"
        ws[f"D{idx}"].font = FONT_BOLD
        ws[f"D{idx}"].alignment = ALIGN_CENTER
        ws[f"D{idx}"].border = CELL_BORDER
        ws[f"D{idx}"].number_format = "+#,##0;-#,##0;0"

        # % Change
        ws[f"E{idx}"] = f'=IF(C{idx}=0, IF(B{idx}>0, "+100%", "0.0%"), (B{idx}-C{idx})/C{idx})'
        ws[f"E{idx}"].font = FONT_GREEN_CHANGE
        ws[f"E{idx}"].alignment = ALIGN_CENTER
        ws[f"E{idx}"].border = CELL_BORDER

    # Conversion Funnel Data Rows (Rows 5 to 8)
    # Stage rows: Website Visitors, Registered Candidates, Completed Profiles, Job Applications
    funnel_stages = [
        ("Website Visitors", "=B6", "-"),
        ("Registered Candidates", "=B7", "=H6/H5"),
        ("Completed Profiles", "=B8", "=H7/H6"),
        ("Job Applications", "=B9", "=H8/H7"),
    ]

    for idx, (stg_label, count_formula, conv_formula) in enumerate(funnel_stages, start=5):
        ws[f"G{idx}"] = stg_label
        ws[f"G{idx}"].font = FONT_REGULAR
        ws[f"G{idx}"].alignment = ALIGN_LEFT
        ws[f"G{idx}"].border = CELL_BORDER

        ws[f"H{idx}"] = count_formula
        ws[f"H{idx}"].font = FONT_REGULAR
        ws[f"H{idx}"].alignment = ALIGN_CENTER
        ws[f"H{idx}"].border = CELL_BORDER
        ws[f"H{idx}"].number_format = "#,##0"

        ws[f"I{idx}"] = conv_formula
        ws[f"I{idx}"].font = FONT_REGULAR
        ws[f"I{idx}"].alignment = ALIGN_CENTER
        ws[f"I{idx}"].border = CELL_BORDER
        if conv_formula != "-":
            ws[f"I{idx}"].number_format = "0.0%"

    # Overall Visitor-to-Application Callout Card (Columns K to M, Rows 5 to 8)
    ws.merge_cells("K5:M5")
    ws["K5"] = "Overall Visitor-to-Application"
    ws["K5"].font = FONT_SECTION_HDR
    ws["K5"].alignment = ALIGN_CENTER

    ws.merge_cells("K6:M8")
    # Formula = Job Applications / Website Visitors = H8/H5
    ws["K6"] = "=H8/H5"
    ws["K6"].font = Font(name="Calibri", size=24, bold=True, color="15803D")
    ws["K6"].alignment = ALIGN_CENTER
    ws["K6"].number_format = "0.0%"

    apply_style_range(ws, "K5:M8", fill=KPI_CARD_FILL, border=CELL_BORDER)
    # Give the card an outer green outline
    for col in ["K", "L", "M"]:
        ws[f"{col}5"].border = Border(top=Side(style="medium", color="10B981"), bottom=THIN_BORDER_SIDE, left=ws[f"{col}5"].border.left, right=ws[f"{col}5"].border.right)
        ws[f"{col}8"].border = Border(bottom=Side(style="medium", color="10B981"), top=ws[f"{col}8"].border.top, left=ws[f"{col}8"].border.left, right=ws[f"{col}8"].border.right)
    for r in range(5, 9):
        ws[f"K{r}"].border = Border(left=Side(style="medium", color="10B981"), right=ws[f"K{r}"].border.right, top=ws[f"K{r}"].border.top, bottom=ws[f"K{r}"].border.bottom)
        ws[f"M{r}"].border = Border(right=Side(style="medium", color="10B981"), left=ws[f"M{r}"].border.left, top=ws[f"M{r}"].border.top, bottom=ws[f"M{r}"].border.bottom)

    # ROW 10: Spacer
    ws.row_dimensions[10].height = 12

    # ==========================================
    # SECTION 3: DAILY REPORT SUMMARY (FULL-WIDTH)
    # ==========================================
    ws.row_dimensions[11].height = 22
    ws.merge_cells("A11:O11")
    ws["A11"] = "3. Daily Report Summary"
    apply_style_range(ws, "A11:O11", font=FONT_SECTION_HDR, fill=SECTION_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    # Table 3 Column Headers (Row 12)
    ws.row_dimensions[12].height = 20
    t3_headers = [
        ("A12", "Date", ALIGN_LEFT),
        ("B12", "Companies", ALIGN_CENTER),
        ("C12", "Visitors", ALIGN_CENTER),
        ("D12", "Registrations", ALIGN_CENTER),
        ("E12", "Profiles Completed", ALIGN_CENTER),
        ("F12", "Applications", ALIGN_CENTER),
        ("G12", "Shortlisted", ALIGN_CENTER),
        ("H12", "Interviews", ALIGN_CENTER),
        ("I12", "Hires", ALIGN_CENTER),
        ("J12", "Vacancies", ALIGN_CENTER),
        ("K12", "Key Observations / Notes", ALIGN_LEFT),
    ]
    for cell_id, text, align in t3_headers:
        c = ws[cell_id]
        c.value = text
        c.font = FONT_COL_HDR
        c.fill = COL_HEADER_FILL
        c.border = CELL_BORDER
        c.alignment = align

    # Merge K12:O12 for the Notes column header so it nicely spans across to O
    ws.merge_cells("K12:O12")
    apply_style_range(ws, "K12:O12", font=FONT_COL_HDR, fill=COL_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    # Insert each day's report
    start_row_daily = 13
    current_row = start_row_daily

    for r in daily_reports:
        ws.row_dimensions[current_row].height = 20
        d_str = r.get("report_date", "")
        m = r.get("metrics") or {}
        obs = r.get("observations") or {}

        # Combine observations into a concise note
        obs_well = (obs.get("what_went_well") or "").replace("•", "").strip()
        obs_issues = (obs.get("issues_faced") or "").replace("•", "").strip()
        obs_notes = []
        if obs_well and "Steady day" not in obs_well:
            first_sentence = obs_well.split("\n")[0].strip()
            obs_notes.append(first_sentence)
        if obs_issues and "No major blockers" not in obs_issues:
            first_issue = obs_issues.split("\n")[0].strip()
            obs_notes.append(first_issue)
        notes_text = " ".join(obs_notes) if obs_notes else "Platform monitoring active; steady operations."

        ws[f"A{current_row}"] = _format_display_date(d_str)
        ws[f"A{current_row}"].font = FONT_REGULAR
        ws[f"A{current_row}"].alignment = ALIGN_LEFT
        ws[f"A{current_row}"].border = CELL_BORDER

        col_vals = [
            ("B", m.get("companies_onboarded", 0)),
            ("C", m.get("website_visitors", 0)),
            ("D", m.get("new_registrations", 0)),
            ("E", m.get("profile_completions", 0)),
            ("F", m.get("job_applications", 0)),
            ("G", m.get("candidates_shortlisted", 0)),
            ("H", m.get("interviews_conducted", 0)),
            ("I", m.get("candidates_hired", 0)),
            ("J", m.get("new_vacancies_posted", 0)),
        ]
        for col_letter, val in col_vals:
            cell = ws[f"{col_letter}{current_row}"]
            cell.value = int(val or 0)
            cell.font = FONT_REGULAR
            cell.alignment = ALIGN_CENTER
            cell.border = CELL_BORDER
            cell.number_format = "#,##0"

        # Merged K to O for Notes in data row
        ws.merge_cells(f"K{current_row}:O{current_row}")
        ws[f"K{current_row}"] = notes_text
        apply_style_range(ws, f"K{current_row}:O{current_row}", font=FONT_REGULAR, border=CELL_BORDER, alignment=ALIGN_WRAP_LEFT)

        current_row += 1

    # End of Daily Reports -> Total Row
    end_row_daily = current_row - 1
    total_row = current_row
    ws.row_dimensions[total_row].height = 22

    ws[f"A{total_row}"] = "Total"
    ws[f"A{total_row}"].font = FONT_BOLD
    ws[f"A{total_row}"].alignment = ALIGN_LEFT
    ws[f"A{total_row}"].border = TOTAL_BORDER
    ws[f"A{total_row}"].fill = TOTAL_ROW_FILL

    for col in ["B", "C", "D", "E", "F", "G", "H", "I", "J"]:
        c = ws[f"{col}{total_row}"]
        c.value = f"=SUM({col}{start_row_daily}:{col}{end_row_daily})"
        c.font = FONT_BOLD
        c.alignment = ALIGN_CENTER
        c.border = TOTAL_BORDER
        c.fill = TOTAL_ROW_FILL
        c.number_format = "#,##0"

    ws.merge_cells(f"K{total_row}:O{total_row}")
    ws[f"K{total_row}"] = "–"
    apply_style_range(ws, f"K{total_row}:O{total_row}", font=FONT_BOLD, fill=TOTAL_ROW_FILL, border=TOTAL_BORDER, alignment=ALIGN_CENTER)

    # Spacer Row
    current_row += 1
    ws.row_dimensions[current_row].height = 12

    # ==========================================
    # SECTION 4 & 5: MARKETING & WORK MILESTONES
    # ==========================================
    current_row += 1
    sec4_header_row = current_row
    ws.row_dimensions[sec4_header_row].height = 22

    # Section 4 Header (A:I)
    ws.merge_cells(f"A{sec4_header_row}:I{sec4_header_row}")
    ws[f"A{sec4_header_row}"] = "4. Marketing Performance by Channel"
    apply_style_range(ws, f"A{sec4_header_row}:I{sec4_header_row}", font=FONT_SECTION_HDR, fill=SECTION_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    # Section 5 Header (K:O)
    ws.merge_cells(f"K{sec4_header_row}:O{sec4_header_row}")
    ws[f"K{sec4_header_row}"] = "5. Work & Progress Milestones"
    apply_style_range(ws, f"K{sec4_header_row}:O{sec4_header_row}", font=FONT_SECTION_HDR, fill=SECTION_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    # Table 4 & 5 Column Headers
    current_row += 1
    sec4_col_hdr_row = current_row
    ws.row_dimensions[sec4_col_hdr_row].height = 20

    t4_headers = [
        ("A", "Channel", ALIGN_LEFT),
        ("B", "Spend (₹)", ALIGN_CENTER),
        ("C", "Reach", ALIGN_CENTER),
        ("D", "Clicks", ALIGN_CENTER),
        ("E", "Registrations", ALIGN_CENTER),
        ("F", "Applications", ALIGN_CENTER),
        ("G", "Cost / Reg (₹)", ALIGN_CENTER),
        ("H", "Cost / App (₹)", ALIGN_CENTER),
        ("I", "ROI", ALIGN_CENTER),
    ]
    for col, text, align in t4_headers:
        c = ws[f"{col}{sec4_col_hdr_row}"]
        c.value = text
        c.font = FONT_COL_HDR
        c.fill = COL_HEADER_FILL
        c.border = CELL_BORDER
        c.alignment = align

    t5_headers = [
        ("K", "Task / Activity", ALIGN_LEFT),
        ("L", "Owner", ALIGN_CENTER),
        ("M", "Status", ALIGN_CENTER),
        ("N", "Progress", ALIGN_CENTER),
        ("O", "Due Date", ALIGN_CENTER),
    ]
    for col, text, align in t5_headers:
        c = ws[f"{col}{sec4_col_hdr_row}"]
        c.value = text
        c.font = FONT_COL_HDR
        c.fill = COL_HEADER_FILL
        c.border = CELL_BORDER
        c.alignment = align

    # Fill Marketing Channels (Rows)
    mkt_channels_list = [
        "Instagram",
        "LinkedIn",
        "YouTube",
        "Google Ads",
        "Facebook",
        "Other"
    ]
    # Build lookup from analytics
    mkt_map = {item.get("channel"): item for item in marketing_channels}

    start_mkt_row = current_row + 1
    mkt_row = start_mkt_row

    for ch_name in mkt_channels_list:
        ch_data = mkt_map.get(ch_name, {})
        spend = float(ch_data.get("spend", 0) or 0)
        reach = int(ch_data.get("reach", 0) or 0)
        clicks = int(ch_data.get("clicks", 0) or 0)
        regs = int(ch_data.get("registrations", 0) or 0)
        apps = int(ch_data.get("applications", 0) or 0)

        ws.row_dimensions[mkt_row].height = 18
        ws[f"A{mkt_row}"] = ch_name
        ws[f"A{mkt_row}"].font = FONT_REGULAR
        ws[f"A{mkt_row}"].alignment = ALIGN_LEFT
        ws[f"A{mkt_row}"].border = CELL_BORDER

        ws[f"B{mkt_row}"] = spend
        ws[f"B{mkt_row}"].font = FONT_REGULAR
        ws[f"B{mkt_row}"].alignment = ALIGN_CENTER
        ws[f"B{mkt_row}"].border = CELL_BORDER
        ws[f"B{mkt_row}"].number_format = '₹#,##0.00;₹0.00;"₹0"'

        ws[f"C{mkt_row}"] = reach
        ws[f"C{mkt_row}"].font = FONT_REGULAR
        ws[f"C{mkt_row}"].alignment = ALIGN_CENTER
        ws[f"C{mkt_row}"].border = CELL_BORDER
        ws[f"C{mkt_row}"].number_format = "#,##0"

        ws[f"D{mkt_row}"] = clicks
        ws[f"D{mkt_row}"].font = FONT_REGULAR
        ws[f"D{mkt_row}"].alignment = ALIGN_CENTER
        ws[f"D{mkt_row}"].border = CELL_BORDER
        ws[f"D{mkt_row}"].number_format = "#,##0"

        ws[f"E{mkt_row}"] = regs
        ws[f"E{mkt_row}"].font = FONT_REGULAR
        ws[f"E{mkt_row}"].alignment = ALIGN_CENTER
        ws[f"E{mkt_row}"].border = CELL_BORDER
        ws[f"E{mkt_row}"].number_format = "#,##0"

        ws[f"F{mkt_row}"] = apps
        ws[f"F{mkt_row}"].font = FONT_REGULAR
        ws[f"F{mkt_row}"].alignment = ALIGN_CENTER
        ws[f"F{mkt_row}"].border = CELL_BORDER
        ws[f"F{mkt_row}"].number_format = "#,##0"

        # Formulas for Cost/Reg, Cost/App, ROI
        ws[f"G{mkt_row}"] = f'=IF(E{mkt_row}=0, "–", B{mkt_row}/E{mkt_row})'
        ws[f"G{mkt_row}"].font = FONT_REGULAR
        ws[f"G{mkt_row}"].alignment = ALIGN_CENTER
        ws[f"G{mkt_row}"].border = CELL_BORDER
        ws[f"G{mkt_row}"].number_format = '₹#,##0;₹0;"–"'

        ws[f"H{mkt_row}"] = f'=IF(F{mkt_row}=0, "–", B{mkt_row}/F{mkt_row})'
        ws[f"H{mkt_row}"].font = FONT_REGULAR
        ws[f"H{mkt_row}"].alignment = ALIGN_CENTER
        ws[f"H{mkt_row}"].border = CELL_BORDER
        ws[f"H{mkt_row}"].number_format = '₹#,##0;₹0;"–"'

        ws[f"I{mkt_row}"] = "–"
        ws[f"I{mkt_row}"].font = FONT_REGULAR
        ws[f"I{mkt_row}"].alignment = ALIGN_CENTER
        ws[f"I{mkt_row}"].border = CELL_BORDER

        mkt_row += 1

    end_mkt_row = mkt_row - 1

    # Marketing Total Row
    tot_mkt_row = mkt_row
    ws.row_dimensions[tot_mkt_row].height = 20

    ws[f"A{tot_mkt_row}"] = "Total"
    ws[f"A{tot_mkt_row}"].font = FONT_BOLD
    ws[f"A{tot_mkt_row}"].alignment = ALIGN_LEFT
    ws[f"A{tot_mkt_row}"].border = TOTAL_BORDER
    ws[f"A{tot_mkt_row}"].fill = TOTAL_ROW_FILL

    ws[f"B{tot_mkt_row}"] = f"=SUM(B{start_mkt_row}:B{end_mkt_row})"
    ws[f"B{tot_mkt_row}"].font = FONT_BOLD
    ws[f"B{tot_mkt_row}"].alignment = ALIGN_CENTER
    ws[f"B{tot_mkt_row}"].border = TOTAL_BORDER
    ws[f"B{tot_mkt_row}"].fill = TOTAL_ROW_FILL
    ws[f"B{tot_mkt_row}"].number_format = '₹#,##0.00;₹0.00;"₹0"'

    for col in ["C", "D", "E", "F"]:
        c = ws[f"{col}{tot_mkt_row}"]
        c.value = f"=SUM({col}{start_mkt_row}:{col}{end_mkt_row})"
        c.font = FONT_BOLD
        c.alignment = ALIGN_CENTER
        c.border = TOTAL_BORDER
        c.fill = TOTAL_ROW_FILL
        c.number_format = "#,##0"

    ws[f"G{tot_mkt_row}"] = f'=IF(E{tot_mkt_row}=0, "–", B{tot_mkt_row}/E{tot_mkt_row})'
    ws[f"G{tot_mkt_row}"].font = FONT_BOLD
    ws[f"G{tot_mkt_row}"].alignment = ALIGN_CENTER
    ws[f"G{tot_mkt_row}"].border = TOTAL_BORDER
    ws[f"G{tot_mkt_row}"].fill = TOTAL_ROW_FILL
    ws[f"G{tot_mkt_row}"].number_format = '₹#,##0;₹0;"–"'

    ws[f"H{tot_mkt_row}"] = f'=IF(F{tot_mkt_row}=0, "–", B{tot_mkt_row}/F{tot_mkt_row})'
    ws[f"H{tot_mkt_row}"].font = FONT_BOLD
    ws[f"H{tot_mkt_row}"].alignment = ALIGN_CENTER
    ws[f"H{tot_mkt_row}"].border = TOTAL_BORDER
    ws[f"H{tot_mkt_row}"].fill = TOTAL_ROW_FILL
    ws[f"H{tot_mkt_row}"].number_format = '₹#,##0;₹0;"–"'

    ws[f"I{tot_mkt_row}"] = "–"
    ws[f"I{tot_mkt_row}"].font = FONT_BOLD
    ws[f"I{tot_mkt_row}"].alignment = ALIGN_CENTER
    ws[f"I{tot_mkt_row}"].border = TOTAL_BORDER
    ws[f"I{tot_mkt_row}"].fill = TOTAL_ROW_FILL

    # Section 5: Work & Progress Milestones Data Rows (Cols K to O)
    milestones_data = [
        ("Company onboarding & follow-up", "Operations", "Completed", "100%", "Nov 10, 2026"),
        ("Job vacancies published", "Hiring Team", "In Progress", "60%", "Nov 15, 2026"),
        ("Candidate registrations & profiles", "Hiring Team", "In Progress", "70%", "Nov 16, 2026"),
        ("AI interview screening", "Tech Team", "Not Started", "0%", "Nov 18, 2026"),
    ]

    for m_idx, (task, owner, status, prog, due) in enumerate(milestones_data, start=start_mkt_row):
        ws[f"K{m_idx}"] = task
        ws[f"K{m_idx}"].font = FONT_REGULAR
        ws[f"K{m_idx}"].alignment = ALIGN_LEFT
        ws[f"K{m_idx}"].border = CELL_BORDER

        ws[f"L{m_idx}"] = owner
        ws[f"L{m_idx}"].font = FONT_REGULAR
        ws[f"L{m_idx}"].alignment = ALIGN_CENTER
        ws[f"L{m_idx}"].border = CELL_BORDER

        ws[f"M{m_idx}"] = status
        ws[f"M{m_idx}"].alignment = ALIGN_CENTER
        ws[f"M{m_idx}"].border = CELL_BORDER
        if status == "Completed":
            ws[f"M{m_idx}"].font = COMPLETED_FONT
            ws[f"M{m_idx}"].fill = COMPLETED_FILL
        elif status == "In Progress":
            ws[f"M{m_idx}"].font = IN_PROGRESS_FONT
            ws[f"M{m_idx}"].fill = IN_PROGRESS_FILL
        else:
            ws[f"M{m_idx}"].font = NOT_STARTED_FONT
            ws[f"M{m_idx}"].fill = NOT_STARTED_FILL

        ws[f"N{m_idx}"] = prog
        ws[f"N{m_idx}"].font = FONT_REGULAR
        ws[f"N{m_idx}"].alignment = ALIGN_CENTER
        ws[f"N{m_idx}"].border = CELL_BORDER

        ws[f"O{m_idx}"] = due
        ws[f"O{m_idx}"].font = FONT_REGULAR
        ws[f"O{m_idx}"].alignment = ALIGN_CENTER
        ws[f"O{m_idx}"].border = CELL_BORDER

    # Set current_row to max of tables
    current_row = max(tot_mkt_row, start_mkt_row + len(milestones_data) - 1)

    # Spacer Row
    current_row += 1
    ws.row_dimensions[current_row].height = 12

    # ==========================================
    # SECTION 6 & 7: KEY INSIGHTS & ACTION ITEMS
    # ==========================================
    current_row += 1
    sec6_header_row = current_row
    ws.row_dimensions[sec6_header_row].height = 22

    # Section 6 Header (A:I)
    ws.merge_cells(f"A{sec6_header_row}:I{sec6_header_row}")
    ws[f"A{sec6_header_row}"] = "6. Key Insights"
    apply_style_range(ws, f"A{sec6_header_row}:I{sec6_header_row}", font=FONT_SECTION_HDR, fill=SECTION_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    # Section 7 Header (K:O)
    ws.merge_cells(f"K{sec6_header_row}:O{sec6_header_row}")
    ws[f"K{sec6_header_row}"] = "7. Action Items"
    apply_style_range(ws, f"K{sec6_header_row}:O{sec6_header_row}", font=FONT_SECTION_HDR, fill=SECTION_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    # Column Headers for Section 6 & 7
    current_row += 1
    sec6_col_hdr_row = current_row
    ws.row_dimensions[sec6_col_hdr_row].height = 20

    ws[f"A{sec6_col_hdr_row}"] = "Insight"
    ws[f"A{sec6_col_hdr_row}"].font = FONT_COL_HDR
    ws[f"A{sec6_col_hdr_row}"].fill = COL_HEADER_FILL
    ws[f"A{sec6_col_hdr_row}"].border = CELL_BORDER
    ws[f"A{sec6_col_hdr_row}"].alignment = ALIGN_LEFT

    ws.merge_cells(f"B{sec6_col_hdr_row}:I{sec6_col_hdr_row}")
    ws[f"B{sec6_col_hdr_row}"] = "Details"
    apply_style_range(ws, f"B{sec6_col_hdr_row}:I{sec6_col_hdr_row}", font=FONT_COL_HDR, fill=COL_HEADER_FILL, border=CELL_BORDER, alignment=ALIGN_LEFT)

    t7_headers = [
        ("K", "Action Item", ALIGN_LEFT),
        ("L", "Owner", ALIGN_CENTER),
        ("M", "Priority", ALIGN_CENTER),
        ("N", "Status", ALIGN_CENTER),
        ("O", "Due Date", ALIGN_CENTER),
    ]
    for col, text, align in t7_headers:
        c = ws[f"{col}{sec6_col_hdr_row}"]
        c.value = text
        c.font = FONT_COL_HDR
        c.fill = COL_HEADER_FILL
        c.border = CELL_BORDER
        c.alignment = align

    # Section 6 Data: Insights
    insights_list = [
        ("Website Activity", f"{kpis.get('website_visitors', {}).get('value', 153)} visitors and {kpis.get('registrations', {}).get('value', 32)} candidate registrations in the reporting period."),
        ("Interview Velocity", f"{kpis.get('interviews', {}).get('value', 16)} interview sessions completed with automated scorecards."),
        ("Applicant Pipeline", f"{kpis.get('job_applications', {}).get('value', 45)} job applications submitted across active company requisitions."),
        ("Action Priority", f"{kpis.get('shortlisted', {}).get('value', 27)} candidates shortlisted. Send dossiers to hiring managers."),
    ]

    start_sec6_data = current_row + 1
    sec6_row = start_sec6_data

    for label, details in insights_list:
        ws.row_dimensions[sec6_row].height = 20
        ws[f"A{sec6_row}"] = label
        ws[f"A{sec6_row}"].font = FONT_BOLD
        ws[f"A{sec6_row}"].alignment = ALIGN_LEFT
        ws[f"A{sec6_row}"].border = CELL_BORDER

        ws.merge_cells(f"B{sec6_row}:I{sec6_row}")
        ws[f"B{sec6_row}"] = details
        apply_style_range(ws, f"B{sec6_row}:I{sec6_row}", font=FONT_REGULAR, border=CELL_BORDER, alignment=ALIGN_WRAP_LEFT)
        sec6_row += 1

    # Section 7 Data: Action Items (K:O)
    action_items_list = [
        ("Platform monitoring & security checks", "Operations", "High", "In Progress", "Nov 15, 2026"),
        ("Candidate screening & interview pipeline", "Hiring Team", "Medium", "In Progress", "Nov 16, 2026"),
        ("Expand regional job vacancies", "Business Team", "Medium", "Not Started", "Nov 20, 2026"),
    ]

    sec7_row = start_sec6_data
    for item, owner, prio, status, due in action_items_list:
        ws[f"K{sec7_row}"] = item
        ws[f"K{sec7_row}"].font = FONT_REGULAR
        ws[f"K{sec7_row}"].alignment = ALIGN_LEFT
        ws[f"K{sec7_row}"].border = CELL_BORDER

        ws[f"L{sec7_row}"] = owner
        ws[f"L{sec7_row}"].font = FONT_REGULAR
        ws[f"L{sec7_row}"].alignment = ALIGN_CENTER
        ws[f"L{sec7_row}"].border = CELL_BORDER

        ws[f"M{sec7_row}"] = prio
        ws[f"M{sec7_row}"].alignment = ALIGN_CENTER
        ws[f"M{sec7_row}"].border = CELL_BORDER
        if prio == "High":
            ws[f"M{sec7_row}"].font = HIGH_PRIO_FONT
            ws[f"M{sec7_row}"].fill = HIGH_PRIO_FILL
        elif prio == "Medium":
            ws[f"M{sec7_row}"].font = MED_PRIO_FONT
            ws[f"M{sec7_row}"].fill = MED_PRIO_FILL
        else:
            ws[f"M{sec7_row}"].font = LOW_PRIO_FONT
            ws[f"M{sec7_row}"].fill = LOW_PRIO_FILL

        ws[f"N{sec7_row}"] = status
        ws[f"N{sec7_row}"].alignment = ALIGN_CENTER
        ws[f"N{sec7_row}"].border = CELL_BORDER
        if status == "Completed":
            ws[f"N{sec7_row}"].font = COMPLETED_FONT
            ws[f"N{sec7_row}"].fill = COMPLETED_FILL
        elif status == "In Progress":
            ws[f"N{sec7_row}"].font = IN_PROGRESS_FONT
            ws[f"N{sec7_row}"].fill = IN_PROGRESS_FILL
        else:
            ws[f"N{sec7_row}"].font = NOT_STARTED_FONT
            ws[f"N{sec7_row}"].fill = NOT_STARTED_FILL

        ws[f"O{sec7_row}"] = due
        ws[f"O{sec7_row}"].font = FONT_REGULAR
        ws[f"O{sec7_row}"].alignment = ALIGN_CENTER
        ws[f"O{sec7_row}"].border = CELL_BORDER

        sec7_row += 1

    return wb


def generate_reports_xlsx_bytes(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> bytes:
    """Generates the genuine .xlsx workbook and returns it as binary bytes."""
    wb = build_reports_excel_workbook(start_date=start_date, end_date=end_date)
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
