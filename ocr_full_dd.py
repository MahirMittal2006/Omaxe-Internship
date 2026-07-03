from __future__ import annotations

import os
from pathlib import Path

import fitz
import pytesseract
from pdf2image import convert_from_path

ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
DEFAULT_POPPLER = r"C:\Users\omaxe\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin"
DEFAULT_ROOTS = [
    Path(r"D:\ClaudeDocs\473"),
    Path(r"D:\ClaudeDocs\474"),
    Path(r"D:\ClaudeDocs\475"),
    Path(r"D:\ClaudeDocs\476"),
    Path(r"D:\ClaudeDocs\477"),
]

def read_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding='utf-8', errors='ignore').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values

def split_paths(raw_value: str) -> list[Path]:
    paths: list[Path] = []
    for part in raw_value.replace(';', ',').split(','):
        cleaned = part.strip()
        if cleaned:
            paths.append(Path(cleaned))
    return paths

def load_roots() -> list[Path]:
    env_values = read_env_file(ROOT_DIR / 'server' / '.env')
    raw_value = os.getenv('DOCUMENT_ROOTS') or os.getenv('DOCUMENT_ROOT') or env_values.get('DOCUMENT_ROOTS') or env_values.get('DOCUMENT_ROOT') or ''
    roots = [path.resolve() for path in split_paths(raw_value) if path]
    return roots or DEFAULT_ROOTS

def load_tesseract_cmd() -> str:
    return os.getenv('TESSERACT_CMD', DEFAULT_TESSERACT)

def load_poppler_path() -> str:
    return os.getenv('POPPLER_PATH', DEFAULT_POPPLER)

def load_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        return max(1, int(raw_value))
    except ValueError:
        return default

def should_force_ocr() -> bool:
    return os.getenv('OCR_FORCE', '0').strip().lower() in {'1', 'true', 'yes', 'y'}

def output_path_for(pdf_path: Path) -> Path:
    return pdf_path.with_name(f'{pdf_path.stem}.ocr.txt')

def contiguous_ranges(page_numbers: list[int]) -> list[tuple[int, int]]:
    if not page_numbers:
        return []

    ranges: list[tuple[int, int]] = []
    start = previous = page_numbers[0]

    for page_number in page_numbers[1:]:
        if page_number == previous + 1:
            previous = page_number
            continue

        ranges.append((start, previous))
        start = previous = page_number

    ranges.append((start, previous))
    return ranges

def ocr_page_range(pdf_path: Path, start_page: int, end_page: int, dpi: int, poppler_path: str) -> list[str]:
    images = convert_from_path(
        str(pdf_path),
        first_page=start_page,
        last_page=end_page,
        dpi=dpi,
        poppler_path=poppler_path,
    )
    return [pytesseract.image_to_string(image).strip() for image in images]

def process_pdf(pdf_path: Path, dpi: int, poppler_path: str, batch_size: int, force: bool) -> bool:
    out_path = output_path_for(pdf_path)
    if out_path.exists() and not force and out_path.stat().st_mtime >= pdf_path.stat().st_mtime:
        print(f'SKIP {pdf_path}')
        return False

    print(f'PROCESS {pdf_path}')

    doc = fitz.open(str(pdf_path))
    page_count = doc.page_count
    page_texts: list[str] = [''] * page_count
    missing_pages: list[int] = []

    for index in range(page_count):
        text = doc.load_page(index).get_text('text').strip()
        if text:
            page_texts[index] = text
        else:
            missing_pages.append(index + 1)

    doc.close()

    for start_page, end_page in contiguous_ranges(missing_pages):
        print(f'  OCR pages {start_page}-{end_page}')
        for batch_start in range(start_page, end_page + 1, batch_size):
            batch_end = min(batch_start + batch_size - 1, end_page)
            texts = ocr_page_range(pdf_path, batch_start, batch_end, dpi, poppler_path)
            for offset, text in enumerate(texts):
                page_number = batch_start + offset
                page_texts[page_number - 1] = text

    output_lines = [f'=== {pdf_path.name} ===']
    for page_number, text in enumerate(page_texts, start=1):
        output_lines.append(f'--- Page {page_number} ---')
        output_lines.append(text)
        output_lines.append('')

    out_path.write_text('\n'.join(output_lines), encoding='utf-8')
    print(f'  SAVED {out_path}')
    return True

def main() -> None:
    pytesseract.pytesseract.tesseract_cmd = load_tesseract_cmd()
    poppler_path = load_poppler_path()
    dpi = load_int('OCR_DPI', 150)
    batch_size = load_int('OCR_BATCH_SIZE', 10)
    force = should_force_ocr()

    roots = load_roots()
    pdf_files: list[Path] = []
    for root in roots:
        if not root.exists():
            print(f'MISSING ROOT {root}')
            continue

        pdf_files.extend(sorted(root.rglob('*.pdf')))

    if not pdf_files:
        print('No PDFs found.')
        return

    processed = 0
    for pdf_path in pdf_files:
        try:
            if process_pdf(pdf_path, dpi, poppler_path, batch_size, force):
                processed += 1
        except Exception as error:
            print(f'ERROR {pdf_path}: {error}')

    print(f'DONE. Processed {processed} PDF files.')

if __name__ == '__main__':
    main()
import pytesseract
from pdf2image import convert_from_path
import os

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
poppler_path = r'C:\Users\omaxe\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin'

pdf_dir = r"D:\Work Order"
files = [
    "DD Constructipon Company 11084108862.pdf",
    "DD Constructipon Company 11084108863.pdf",
]

for filename in files:
    filepath = os.path.join(pdf_dir, filename)
    out_path = os.path.join(r"D:\ClaudeDocs", filename.replace(".pdf", "_full.txt"))
    print("Processing " + filename + " ...")

    import fitz
    doc = fitz.open(filepath)
    total_pages = len(doc)
    doc.close()

    output = []
    batch_size = 10
    for start in range(1, total_pages + 1, batch_size):
        end = min(start + batch_size - 1, total_pages)
        images = convert_from_path(filepath, first_page=start, last_page=end, dpi=150, poppler_path=poppler_path)
        for idx, img in enumerate(images):
            page_num = start + idx
            text = pytesseract.image_to_string(img)
            output.append("--- Page " + str(page_num) + " ---")
            output.append(text)
        print("  done pages " + str(start) + "-" + str(end) + " / " + str(total_pages))

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output))
    print("Saved: " + out_path)

print("ALL DONE")
