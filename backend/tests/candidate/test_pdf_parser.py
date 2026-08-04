import io
import pytest
from pypdf import PdfWriter
from backend.modules.candidate.tools.pdf_parser import PDFParser

def create_sample_pdf_bytes(text: str) -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    # We can test extracting text or basic PDF stream
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()

def test_pdf_parser_basic_metadata():
    pdf_bytes = create_sample_pdf_bytes("Dummy content")
    parsed = PDFParser.parse_resume(pdf_bytes, "Rahul_Sharma_Resume.pdf")
    assert parsed["name"] == "Rahul Sharma Resume"
    assert "email" in parsed
    assert "phone" in parsed
