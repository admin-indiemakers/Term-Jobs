import io
import re
from typing import Dict, Any
from pypdf import PdfReader

class PDFParser:
    """Helper tool for extracting text and basic metadata from PDF resume files."""

    @staticmethod
    def extract_text(pdf_bytes: bytes) -> str:
        """Extract all text content from raw PDF bytes."""
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text_pages = [page.extract_text() for page in reader.pages if page.extract_text()]
            return "\n".join(text_pages).strip()
        except Exception as e:
            raise ValueError(f"Failed to parse PDF resume: {str(e)}")

    @classmethod
    def parse_resume(cls, pdf_bytes: bytes, filename: str) -> Dict[str, Any]:
        """Extract text, email, phone, and guess candidate name from PDF."""
        raw_text = cls.extract_text(pdf_bytes)

        # Extract Email using Regex
        email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', raw_text)
        email = email_match.group(0) if email_match else f"unknown_{filename.replace(' ', '_')}@candidate.com"

        # Extract Phone using Regex
        phone_match = re.search(r'(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}', raw_text)
        phone = phone_match.group(0) if phone_match else "+910000000000"

        # Candidate Name from Filename or first line
        clean_name = filename.rsplit('.', 1)[0].replace('_', ' ').replace('-', ' ').title()
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        candidate_name = lines[0] if (lines and len(lines[0].split()) <= 4) else clean_name

        return {
            "name": candidate_name,
            "email": email,
            "phone": phone,
            "resume_text": raw_text
        }
