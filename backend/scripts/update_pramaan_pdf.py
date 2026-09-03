import os
import sys
import base64

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.shared.db import db

def main():
    pdf_path = "/Users/mac/Downloads/pramaan-writeup.md.pdf"
    if not os.path.exists(pdf_path):
        print("PDF path not found!")
        return

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
    data_url = f"data:application/pdf;base64,{pdf_b64}"

    res = db["candidate_expenses"].update_many(
        {"receipt_name": {"$regex": "pramaan", "$options": "i"}},
        {"$set": {"receipt_url": data_url}}
    )
    print(f"Updated pramaan-writeup.md.pdf Data URL in MongoDB!")
    print(f"Matched: {res.matched_count}, Modified: {res.modified_count}, Size: {len(pdf_bytes)} bytes")

if __name__ == "__main__":
    main()
