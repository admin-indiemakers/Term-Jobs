import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.shared.db import db

def main():
    print("Checking onboarding checklists and updating work orders...")
    for ob in db["onboarding_checklists"].find():
        cid = ob.get("candidate_id", "")
        gates = ob.get("activation_gates", [])
        blocking = [g for g in gates if g.get("type") == "blocking"]
        
        if blocking and all(g.get("status") == "cleared" for g in blocking):
            cemail = (ob.get("candidate_email") or "").strip()
            cname = (ob.get("candidate_name") or "").strip()
            cid_clean = cid.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip() if cid else ""

            or_conds = []
            if cid:
                or_conds.append({"candidate_id": cid})
            if cid_clean:
                or_conds.extend([
                    {"candidate_id": cid_clean},
                    {"candidate_id": f"SDC-{cid_clean}"},
                    {"candidate_id": f"SDC -{cid_clean}"},
                ])
            if cemail:
                or_conds.append({"candidate_email": cemail})
            if cname:
                or_conds.append({"candidate_name": cname})

            if not or_conds:
                continue

            res = db["work_orders"].update_many(
                {
                    "$or": or_conds,
                    "status": {"$ne": "CLOSED"}
                },
                {
                    "$set": {
                        "status": "ACTIVE",
                        "activation_gates_cleared": True
                    }
                }
            )
            print(f"Candidate '{cname}' ({cid}): matched {res.matched_count}, modified {res.modified_count}")

if __name__ == "__main__":
    main()
