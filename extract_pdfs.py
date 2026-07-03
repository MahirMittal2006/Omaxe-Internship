import os
import PyPDF2
import json
from pathlib import Path

# Path to your ClaudeDocs folder
base_path = r"D:\ClaudeDocs"
folders = ["477", "476", "475", "474", "473"]

all_data = {}

for folder in folders:
    folder_path = os.path.join(base_path, folder)
    all_data[folder] = []

    if os.path.exists(folder_path):
        # Get all PDF files in the folder
        for file in os.listdir(folder_path):
            if file.lower().endswith('.pdf'):
                file_path = os.path.join(folder_path, file)
                try:
                    with open(file_path, 'rb') as pdf_file:
                        pdf_reader = PyPDF2.PdfReader(pdf_file)
                        text = ""
                        for page in pdf_reader.pages:
                            text += page.extract_text()

                        all_data[folder].append({
                            "filename": file,
                            "content": text
                        })
                except Exception as e:
                    all_data[folder].append({
                        "filename": file,
                        "error": str(e)
                    })

# Save to a text file
with open(r"D:\ClaudeDocs_extracted.txt", "w", encoding="utf-8") as f:
    json.dump(all_data, f, indent=2, ensure_ascii=False)

print("Extraction complete! Check D:\ClaudeDocs_extracted.txt")
