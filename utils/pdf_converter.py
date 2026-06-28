import io

from pdf2image import convert_from_bytes


def pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Convert each page of a PDF to JPEG bytes for Qwen."""
    pages = convert_from_bytes(pdf_bytes, dpi=200)
    result = []
    for page in pages:
        buf = io.BytesIO()
        page.save(buf, format="JPEG")
        result.append(buf.getvalue())
    return result
