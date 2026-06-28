import io

import pdfplumber


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts text directly from a born-digital PDF's text layer (no OCR)."""
    pages = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)
    return "\n\n".join(pages).strip()
