import fitz  # PyMuPDF


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text content from a PDF file using PyMuPDF (fitz).

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        Extracted text as a single string.
    """
    extracted_text = ""
    with fitz.open(pdf_path) as doc:
        for page in doc:
            # page.get_text() or page.get_text("text") returns a `str`.
            # Avoid page.get_text("dict") when concatenating directly to a string!
            extracted_text += page.get_text("text")
    return extracted_text


def extract_text_from_bytes(pdf_bytes: bytes) -> str:
    """Extract all text content from PDF bytes stream.

    Args:
        pdf_bytes: Raw bytes of the PDF file.

    Returns:
        Extracted text as a single string.
    """
    extracted_text = ""
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc:
            extracted_text += page.get_text("text")
    return extracted_text
