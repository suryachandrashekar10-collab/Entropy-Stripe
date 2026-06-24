from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os, uuid
from datetime import datetime
from db import get_conn, init_db
from reconciliation import run_reconciliation, get_results
from monitoring import (success_rate_by_currency, success_rate_trend,
                        decline_code_breakdown, regional_performance,
                        partner_health, dispute_summary, kpi_summary)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
app = FastAPI(title="TechOps Payments Platform", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── KPIs ──────────────────────────────────────────────────────────────────────
@app.get("/api/kpis")
def get_kpis():
    return kpi_summary()

# ── Reconciliation ────────────────────────────────────────────────────────────
@app.post("/api/reconcile/run")
def trigger_reconciliation():
    summary, _ = run_reconciliation()
    return summary

@app.get("/api/reconcile/summary")
def recon_summary():
    conn = get_conn()
    rows = conn.execute("""
        SELECT status, currency, COUNT(*) as count,
               SUM(ABS(discrepancy_amount)) as total_disc
        FROM reconciliation_results
        GROUP BY status, currency
    """).fetchall()
    total   = conn.execute("SELECT COUNT(*) FROM reconciliation_results").fetchone()[0]
    matched = conn.execute("SELECT COUNT(*) FROM reconciliation_results WHERE status='matched'").fetchone()[0]
    conn.close()
    return {
        "total": total,
        "matched": matched,
        "match_rate": round(matched/total*100,1) if total else 0,
        "by_status": [dict(r) for r in rows]
    }

@app.get("/api/reconcile/results")
def recon_results(status: str = None, currency: str = None, limit: int = 200):
    return get_results(status, currency, limit)

@app.patch("/api/reconcile/{rec_id}/resolve")
def resolve_exception(rec_id: str, notes: str = ""):
    conn = get_conn()
    conn.execute("UPDATE reconciliation_results SET resolved=1, notes=? WHERE id=?", (notes, rec_id))
    conn.commit(); conn.close()
    return {"ok": True}

# ── Performance Monitoring ────────────────────────────────────────────────────
@app.get("/api/performance/currencies")
def perf_currencies(days: int = 30):
    return success_rate_by_currency(days)

@app.get("/api/performance/trend")
def perf_trend(currency: str = None, days: int = 90):
    return success_rate_trend(currency, days)

@app.get("/api/performance/decline-codes")
def perf_declines(days: int = 30):
    return decline_code_breakdown(days)

@app.get("/api/performance/regions")
def perf_regions(days: int = 30):
    return regional_performance(days)

# ── Alerts ────────────────────────────────────────────────────────────────────
@app.get("/api/alerts")
def get_alerts(status: str = None):
    conn = get_conn()
    q = "SELECT * FROM alerts"
    args = []
    if status:
        q += " WHERE status=?"; args.append(status)
    q += " ORDER BY created_at DESC"
    rows = conn.execute(q, args).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/alerts")
def create_alert(body: dict):
    conn = get_conn()
    alert_id = "alrt_" + uuid.uuid4().hex[:10]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("INSERT INTO alerts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (alert_id, body.get("alert_type","manual"), body.get("severity","medium"),
         body.get("title",""), body.get("description",""),
         body.get("affected_currency"), body.get("affected_region"),
         body.get("affected_volume",0), body.get("affected_amount",0),
         "open", now, None, None, 0))
    conn.commit(); conn.close()
    return {"id": alert_id, "created_at": now}

@app.patch("/api/alerts/{alert_id}")
def update_alert(alert_id: str, body: dict):
    conn = get_conn()
    fields, vals = [], []
    for f in ["status","resolution_notes","resolved_at"]:
        if f in body:
            fields.append(f"{f}=?"); vals.append(body[f])
    if fields:
        vals.append(alert_id)
        conn.execute(f"UPDATE alerts SET {','.join(fields)} WHERE id=?", vals)
        conn.commit()
    conn.close()
    return {"ok": True}

# ── Partners ──────────────────────────────────────────────────────────────────
@app.get("/api/partners")
def get_partners():
    return partner_health()

# ── Disputes ──────────────────────────────────────────────────────────────────
@app.get("/api/disputes")
def get_disputes():
    return dispute_summary()

# ── n8n Webhook — performance check trigger ───────────────────────────────────
@app.post("/api/webhooks/n8n/check-performance")
def n8n_performance_check():
    """Called by n8n every 15 min. Checks if any currency is below threshold, creates alert."""
    rates = success_rate_by_currency(days=1)
    triggered = []
    conn = get_conn()
    for r in rates:
        if r["success_rate"] < 88 and r["total"] > 10:
            existing = conn.execute(
                "SELECT id FROM alerts WHERE affected_currency=? AND alert_type='success_rate_drop' AND status IN ('open','investigating') AND DATE(created_at)=DATE('now')",
                (r["currency"],)
            ).fetchone()
            if not existing:
                alert_id = "alrt_" + uuid.uuid4().hex[:10]
                now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
                conn.execute("INSERT INTO alerts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (alert_id,"success_rate_drop",
                     "critical" if r["success_rate"] < 82 else "high",
                     f"{r['currency']} Success Rate Below Threshold",
                     f"Current rate: {r['success_rate']}% (threshold: 88%). {r['failed']} failed out of {r['total']} attempts. Immediate investigation required.",
                     r["currency"], None, r["failed"], r["volume"],
                     "open", now, None, None, 1))
                conn.commit()
                triggered.append({"currency": r["currency"], "rate": r["success_rate"], "alert_id": alert_id})
    conn.close()
    return {"checked": len(rates), "alerts_triggered": triggered}

@app.get("/api/health")
def health():
    conn = get_conn()
    charge_count = conn.execute("SELECT COUNT(*) FROM charges").fetchone()[0]
    conn.close()
    return {"status": "ok", "total_charges": charge_count}
