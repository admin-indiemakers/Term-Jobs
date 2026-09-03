import os
import sys
import base64

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.shared.db import db

def main():
    downloads_dir = "/Users/mac/Downloads"
    desktop_dir = "/Users/mac/Desktop"
    
    expenses = list(db["candidate_expenses"].find())
    print(f"Checking {len(expenses)} candidate expenses for PDF attachment files...")

    for exp in expenses:
        exp_id = exp.get("id")
        rname = exp.get("receipt_name", "")
        if not rname:
            continue

        # Look for matching file in Downloads or Desktop
        file_path = None
        for folder in [downloads_dir, desktop_dir]:
            target = os.path.join(folder, rname)
            if os.path.exists(target):
                file_path = target
                break

        if file_path:
            with open(file_path, "rb") as f:
                content_bytes = f.read()

            b64 = base64.b64encode(content_bytes).decode("ascii")
            ext = rname.rsplit(".", 1)[-1].lower() if "." in rname else ""
            mime = "application/pdf" if ext == "pdf" else ("image/jpeg" if ext in ["jpg", "jpeg"] else f"image/{ext}")
            data_url = f"data:{mime};base64,{b64}"

            db["candidate_expenses"].update_one(
                {"_id": exp["_id"]},
                {"$set": {"receipt_url": data_url}}
            )
            print(f"✅ Synced actual file ({len(content_bytes)} bytes) for expense '{rname}' ({exp_id})")
        else:
            print(f"⚠️ File '{rname}' not found in Downloads/Desktop.")

if __name__ == "__main__":
    main()
