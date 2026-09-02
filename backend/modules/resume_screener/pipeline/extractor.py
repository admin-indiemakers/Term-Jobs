"""
Stage 2 â€” Text Extraction
Strategy:
  1. PyMuPDF per-page (primary) â€” fast, handles native PDFs
  2. pdfplumber selective (secondary) â€” for table-heavy pages
  3. Tesseract OCR (fallback) â€” for image-only pages
  4. python-docx for DOCX files
  5. Merge, dedupe, and normalize output
"""
import re
import unicodedata
from pathlib import Path
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

# â”€â”€ Normalization helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

BULLET_CHARS = {"â€¢", "â—¦", "â–ª", "â–¸", "â–¶", "â–º", "âž¤", "â€£", "âƒ", "âˆ™", "Â·"}
BULLET_PATTERN = re.compile(r"[â€¢â—¦â–ªâ–¸â–¶â–ºâž¤â€£âƒâˆ™Â·]")
WHITESPACE_PATTERN = re.compile(r"[ \t]+")
MULTI_NEWLINE_PATTERN = re.compile(r"\n{3,}")


def normalize_text(text: str) -> str:
    """Normalize whitespace, bullets, and Unicode characters."""
    # Unicode normalization (handles ligatures, curly quotes, NBSP, etc.)
    text = unicodedata.normalize("NFKC", text)

    # Curly quotes â†’ straight
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')

    # Non-breaking space â†’ regular space
    text = text.replace("\u00a0", " ").replace("\u200b", "")

    # Normalize bullets to â€¢
    text = BULLET_PATTERN.sub("â€¢", text)

    # Collapse horizontal whitespace
    text = WHITESPACE_PATTERN.sub(" ", text)

    # Collapse 3+ newlines to 2
    text = MULTI_NEWLINE_PATTERN.sub("\n\n", text)

    return text.strip()


def is_image_page(page_text: str, threshold: int = 80) -> bool:
    """Return True if the page has too little text to be native PDF text."""
    return len(page_text.strip()) < threshold


def dedupe_lines(base_lines: List[str], ocr_lines: List[str]) -> List[str]:
    """
    Merge two sets of lines, skipping OCR lines that are near-duplicates
    of what PyMuPDF already extracted.
    """
    base_set = {line.strip().lower() for line in base_lines if len(line.strip()) > 20}
    merged = list(base_lines)
    for line in ocr_lines:
        if line.strip().lower() not in base_set:
            merged.append(line)
    return merged


# â”€â”€ PDF extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def extract_pdf(file_path: str) -> str:
    """
    Full PDF extraction pipeline:
    1. PyMuPDF per-page
    2. pdfplumber for tables
    3. Tesseract OCR for image pages
    """
    import fitz  # PyMuPDF
    import pdfplumber

    all_pages_text: List[str] = []

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        raise RuntimeError(f"Failed to open PDF: {e}")

    try:
        plumber_doc = pdfplumber.open(file_path)
    except Exception:
        plumber_doc = None

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_text = page.get_text("text")

        if is_image_page(page_text):
            # â”€â”€ OCR fallback â”€â”€
            logger.info(f"Page {page_idx + 1}: image-only, using OCR")
            ocr_text = _ocr_page(page)
            if plumber_doc:
                table_text = _extract_tables_plumber(plumber_doc, page_idx)
                combined = dedupe_lines(table_text.splitlines(), ocr_text.splitlines())
                all_pages_text.append("\n".join(combined))
            else:
                all_pages_text.append(ocr_text)
        else:
            # â”€â”€ Native text + optional table extraction â”€â”€
            base_lines = page_text.splitlines()
            if plumber_doc:
                table_text = _extract_tables_plumber(plumber_doc, page_idx)
                if table_text.strip():
                    merged = dedupe_lines(base_lines, table_text.splitlines())
                    all_pages_text.append("\n".join(merged))
                else:
                    all_pages_text.append(page_text)
            else:
                all_pages_text.append(page_text)

    doc.close()
    if plumber_doc:
        plumber_doc.close()

    raw = "\n\n".join(all_pages_text)
    return normalize_text(raw)


def _extract_tables_plumber(plumber_doc, page_idx: int) -> str:
    """Extract tables from a pdfplumber page as pipe-delimited text."""
    try:
        page = plumber_doc.pages[page_idx]
        tables = page.extract_tables()
        if not tables:
            return ""
        rows = []
        for table in tables:
            for row in table:
                cleaned = [str(cell or "").strip() for cell in row]
                rows.append(" | ".join(cleaned))
        return "\n".join(rows)
    except Exception as e:
        logger.warning(f"pdfplumber table extraction failed for page {page_idx}: {e}")
        return ""


def _ocr_page(page) -> str:
    """Run Tesseract OCR on a PyMuPDF page rendered at 200dpi."""
    try:
        import pytesseract
        from PIL import Image
        import io
        from modules.resume_screener.config import get_settings

        settings = get_settings()
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

        # Render at 200 DPI for good OCR accuracy
        mat = page.get_pixmap(dpi=200)  # type: ignore[attr-defined]
        img_bytes = mat.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes))

        text = pytesseract.image_to_string(img, config="--psm 6")
        return text
    except Exception as e:
        logger.warning(f"OCR failed: {e}")
        return ""


# â”€â”€ DOCX extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def extract_docx(file_path: str) -> str:
    """Extract text from a DOCX file including tables."""
    from docx import Document
    from docx.oxml.ns import qn

    try:
        doc = Document(file_path)
    except Exception as e:
        raise RuntimeError(f"Failed to open DOCX: {e}")

    parts: List[str] = []

    for element in doc.element.body:
        tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag

        if tag == "p":
            # Regular paragraph
            text = "".join(
                run.text for run in element.findall(f".//{qn('w:r')}/{qn('w:t')}")
            )
            if text.strip():
                parts.append(text.strip())

        elif tag == "tbl":
            # Table â€” extract as pipe-delimited rows
            for row in element.findall(f".//{qn('w:tr')}"):
                cells = []
                for cell in row.findall(f".//{qn('w:tc')}"):
                    cell_text = " ".join(
                        t.text or ""
                        for t in cell.findall(f".//{qn('w:t')}")
                    ).strip()
                    cells.append(cell_text)
                if any(cells):
                    parts.append(" | ".join(cells))

    raw = "\n".join(parts)
    return normalize_text(raw)


# â”€â”€ Public entrypoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def extract_text(file_path: str, file_type: str) -> str:
    """
    Extract and normalize text from a resume file.
    file_type: 'pdf' or 'docx'
    """
    if file_type == "pdf":
        return extract_pdf(file_path)
    elif file_type == "docx":
        return extract_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type for extraction: {file_type}")

