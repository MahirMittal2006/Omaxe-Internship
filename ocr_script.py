import pytesseract
from pdf2image import convert_from_path
import os

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
poppler_path = r'C:\Users\omaxe\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin'

pdf_dir = r"D:\Work Order"
files = [
    "Complete Waterproofing System 11294100755.pdf",
    "DD Constructipon Company 11084108862.pdf",
    "DD Constructipon Company 11084108863.pdf",
    "Jain Construction 11084108933.pdf",
    "Jain Construction 11084108937.pdf"
]

output = []
for filename in files:
    filepath = os.path.join(pdf_dir, filename)
    output.append("=== " + filename + " ===")
    try:
        images = convert_from_path(filepath, first_page=1, last_page=2, dpi=150, poppler_path=poppler_path)
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img)
            output.append("--- Page " + str(i + 1) + " ---")
            output.append(text[:1500])
    except Exception as e:
        output.append("ERROR: " + str(e))
    output.append("")

result = "\n".join(output)
with open(r"D:\work_order_ocr_text.txt", "w", encoding="utf-8") as f:
    f.write(result)
print("DONE")
