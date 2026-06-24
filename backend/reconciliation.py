"""
Reconciliation Engine — mirrors what a Stripe Payments Analyst does manually.

Matching logic:
  1. For every payout, find the corresponding bank settlement
  2. If no bank settlement: timing_gap (settlement not yet received)
  3. If amount matches within tolerance: matched
  4. If amount differs: amount_mismatch (FX drift, fee dispute, partial)
  5. Bank records with no payout: ghost_record (fraud signal or duplicate)
"""

from db import get_conn
import uuid
from datetime import datetime

TOLERANCE_PCT = 0.005   # 0.5% FX tolerance — standard in payment ops

ROOT_CAUSES = {
    "timing_gap":      "Settlement not yet received from bank partner. T+1/T+2 lag expected. Monitor for 48h.",
    "amount_mismatch": "Amount differs between Stripe ledger and bank statement. Possible causes: FX rate difference, fee dispute, partial settlement, or bank charges. Investigate with partner.",
    "ghost_record":    "Bank settlement references a payout ID not found in Stripe. Possible duplicate settlement, incorrect reference, or fraud. Escalate immediately.",
    "matched":         "Stripe record and bank settlement agree within tolerance.",
}

def run_reconciliation():
    conn = get_conn()
    now  = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    results = []

    # Fetch all payouts
    payouts = conn.execute("SELECT * FROM payouts WHERE status='paid'").fetchall()

    for p in payouts:
        # Find matching bank settlement
        settlement = conn.execute(
            "SELECT * FROM bank_settlements WHERE payout_id=?", (p["id"],)
        ).fetchone()

        if not settlement:
            # Timing gap — payout exists in Stripe, missing in bank
            status        = "timing_gap"
            bank_amount   = None
            disc_amount   = p["amount"]
            root_cause    = ROOT_CAUSES["timing_gap"]
        else:
            stripe_amt = p["amount"]
            bank_amt   = settlement["amount"]
            diff       = abs(stripe_amt - bank_amt)
            tol        = int(stripe_amt * TOLERANCE_PCT)

            if diff <= tol:
                status      = "matched"
                bank_amount = bank_amt
                disc_amount = 0
                root_cause  = ROOT_CAUSES["matched"]
            else:
                status      = "amount_mismatch"
                bank_amount = bank_amt
                disc_amount = stripe_amt - bank_amt
                root_cause  = ROOT_CAUSES["amount_mismatch"]

        results.append({
            "id":               "rec_" + uuid.uuid4().hex[:10],
            "run_date":         now,
            "payout_id":        p["id"],
            "charge_id":        None,
            "stripe_amount":    p["amount"],
            "bank_amount":      bank_amount,
            "currency":         p["currency"],
            "merchant_id":      p["merchant_id"],
            "status":           status,
            "discrepancy_amount": disc_amount,
            "root_cause":       root_cause,
            "resolved":         0,
            "notes":            None,
            "created_at":       now,
        })

    # Ghost records — in bank but no payout in Stripe
    ghosts = conn.execute(
        "SELECT * FROM bank_settlements WHERE discrepancy_type='ghost_record'"
    ).fetchall()

    for g in ghosts:
        results.append({
            "id":               "rec_" + uuid.uuid4().hex[:10],
            "run_date":         now,
            "payout_id":        g["payout_id"],
            "charge_id":        None,
            "stripe_amount":    0,
            "bank_amount":      g["amount"],
            "currency":         g["currency"],
            "merchant_id":      None,
            "status":           "ghost_record",
            "discrepancy_amount": g["amount"],
            "root_cause":       ROOT_CAUSES["ghost_record"],
            "resolved":         0,
            "notes":            None,
            "created_at":       now,
        })

    # Clear old results and insert fresh
    conn.execute("DELETE FROM reconciliation_results")
    conn.executemany(
        "INSERT INTO reconciliation_results VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(r["id"],r["run_date"],r["payout_id"],r["charge_id"],r["stripe_amount"],
          r["bank_amount"],r["currency"],r["merchant_id"],r["status"],
          r["discrepancy_amount"],r["root_cause"],r["resolved"],r["notes"],r["created_at"])
         for r in results]
    )
    conn.commit()

    summary = {
        "total_payouts":   len(payouts),
        "matched":         sum(1 for r in results if r["status"]=="matched"),
        "timing_gap":      sum(1 for r in results if r["status"]=="timing_gap"),
        "amount_mismatch": sum(1 for r in results if r["status"]=="amount_mismatch"),
        "ghost_record":    sum(1 for r in results if r["status"]=="ghost_record"),
        "match_rate":      round(sum(1 for r in results if r["status"]=="matched") / len(results) * 100, 1) if results else 0,
        "total_unreconciled": sum(abs(r["discrepancy_amount"] or 0) for r in results if r["status"]!="matched"),
        "run_at":          now,
    }

    conn.close()
    return summary, results


def get_results(status_filter=None, currency=None, limit=500):
    conn = get_conn()
    q  = "SELECT r.*, m.name as merchant_name, p.bank_name, p.arrival_date FROM reconciliation_results r LEFT JOIN payouts p ON r.payout_id=p.id LEFT JOIN merchants m ON r.merchant_id=m.id"
    wh, args = [], []
    if status_filter:
        wh.append("r.status=?"); args.append(status_filter)
    if currency:
        wh.append("r.currency=?"); args.append(currency)
    if wh:
        q += " WHERE " + " AND ".join(wh)
    q += " ORDER BY r.created_at DESC LIMIT ?"
    args.append(limit)
    rows = conn.execute(q, args).fetchall()
    conn.close()
    return [dict(r) for r in rows]
