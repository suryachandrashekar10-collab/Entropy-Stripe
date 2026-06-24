from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import stripe
import csv
import os
from datetime import datetime

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
if not stripe.api_key:
    raise RuntimeError("STRIPE_SECRET_KEY not set in .env")

def load_bank_settlement():
    settlement = {}
    path = os.path.join(os.path.dirname(__file__), "bank_settlement.csv")
    with open(path) as f:
        for row in csv.DictReader(f):
            settlement[row["charge_id"]] = {
                "charge_id": row["charge_id"],
                "amount": int(row["amount"]),
                "currency": row["currency"],
                "status": row["status"],
            }
    return settlement

@app.get("/api/reconcile")
def reconcile():
    # Fetch from Stripe
    charges = stripe.Charge.list(limit=50)
    stripe_records = {
        c.id: {
            "charge_id": c.id,
            "amount": c.amount,
            "currency": c.currency,
            "status": c.status,
            "description": c.description or "",
            "created": datetime.fromtimestamp(c.created).strftime("%Y-%m-%d %H:%M:%S"),
        }
        for c in charges.auto_paging_iter()
    }

    bank_records = load_bank_settlement()

    matched = []
    missing_in_bank = []
    amount_mismatch = []
    missing_in_stripe = []

    for charge_id, stripe_data in stripe_records.items():
        if charge_id not in bank_records:
            missing_in_bank.append({**stripe_data, "issue": "Not found in bank settlement"})
        elif bank_records[charge_id]["amount"] != stripe_data["amount"]:
            amount_mismatch.append({
                **stripe_data,
                "bank_amount": bank_records[charge_id]["amount"],
                "stripe_amount": stripe_data["amount"],
                "diff": stripe_data["amount"] - bank_records[charge_id]["amount"],
                "issue": f"Amount mismatch: Stripe={stripe_data['amount']} Bank={bank_records[charge_id]['amount']}"
            })
        else:
            matched.append(stripe_data)

    for charge_id, bank_data in bank_records.items():
        if charge_id not in stripe_records:
            missing_in_stripe.append({**bank_data, "issue": "In bank but not in Stripe"})

    total = len(stripe_records)
    return {
        "summary": {
            "total_stripe_charges": total,
            "total_bank_records": len(bank_records),
            "matched": len(matched),
            "missing_in_bank": len(missing_in_bank),
            "amount_mismatch": len(amount_mismatch),
            "missing_in_stripe": len(missing_in_stripe),
            "match_rate": round(len(matched) / total * 100, 1) if total else 0,
        },
        "matched": matched,
        "missing_in_bank": missing_in_bank,
        "amount_mismatch": amount_mismatch,
        "missing_in_stripe": missing_in_stripe,
    }

@app.get("/api/health")
def health():
    return {"status": "ok"}
