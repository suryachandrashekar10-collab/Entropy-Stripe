"""
Performance monitoring engine.
Tracks success rates, decline codes, volume trends — the analyst's live view.
"""

from db import get_conn
from datetime import datetime, timedelta

def success_rate_by_currency(days=30):
    conn = get_conn()
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    rows = conn.execute("""
        SELECT currency,
               COUNT(*) as total,
               SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) as succeeded,
               SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) as failed,
               SUM(CASE WHEN status='succeeded' THEN amount ELSE 0 END) as volume
        FROM charges WHERE created_at >= ?
        GROUP BY currency ORDER BY total DESC
    """, (since,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        rate = round(r["succeeded"] / r["total"] * 100, 2) if r["total"] else 0
        result.append({**dict(r), "success_rate": rate,
                       "alert": rate < 88})
    return result

def success_rate_trend(currency=None, days=90):
    conn = get_conn()
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    q = "SELECT date, currency, SUM(succeeded) as s, SUM(total_charges) as t, SUM(total_volume) as v FROM daily_metrics WHERE date >= ?"
    args = [since]
    if currency:
        q += " AND currency=?"; args.append(currency)
    q += " GROUP BY date, currency ORDER BY date"
    rows = conn.execute(q, args).fetchall()
    conn.close()
    return [{"date":r["date"],"currency":r["currency"],
             "success_rate":round(r["s"]/r["t"]*100,2) if r["t"] else 0,
             "volume":r["v"],"total":r["t"]} for r in rows]

def decline_code_breakdown(days=30):
    conn = get_conn()
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    rows = conn.execute("""
        SELECT failure_code, COUNT(*) as count,
               SUM(amount) as volume, currency
        FROM charges
        WHERE status='failed' AND created_at >= ? AND failure_code IS NOT NULL
        GROUP BY failure_code ORDER BY count DESC LIMIT 15
    """, (since,)).fetchall()
    conn.close()
    total = sum(r["count"] for r in rows)
    return [{"code":r["failure_code"],"count":r["count"],
             "pct":round(r["count"]/total*100,1) if total else 0,
             "volume":r["volume"]} for r in rows]

def regional_performance(days=30):
    conn = get_conn()
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    rows = conn.execute("""
        SELECT m.region,
               COUNT(c.id) as total,
               SUM(CASE WHEN c.status='succeeded' THEN 1 ELSE 0 END) as succeeded,
               SUM(CASE WHEN c.status='succeeded' THEN c.amount ELSE 0 END) as volume
        FROM charges c JOIN merchants m ON c.merchant_id=m.id
        WHERE c.created_at >= ?
        GROUP BY m.region ORDER BY volume DESC
    """, (since,)).fetchall()
    conn.close()
    return [{"region":r["region"],"total":r["total"],"succeeded":r["succeeded"],
             "success_rate":round(r["succeeded"]/r["total"]*100,2) if r["total"] else 0,
             "volume":r["volume"]} for r in rows]

def partner_health():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM partners ORDER BY health_score").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def dispute_summary():
    conn = get_conn()
    rows = conn.execute("""
        SELECT d.*, c.amount as charge_amount, m.name as merchant_name
        FROM disputes d
        JOIN charges c ON d.charge_id=c.id
        JOIN merchants m ON d.merchant_id=m.id
        ORDER BY d.created_at DESC LIMIT 200
    """).fetchall()
    total_vol = conn.execute("SELECT SUM(amount) FROM disputes WHERE status IN ('needs_response','warning_needs_response')").fetchone()[0] or 0
    open_cnt  = conn.execute("SELECT COUNT(*) FROM disputes WHERE status IN ('needs_response','warning_needs_response')").fetchone()[0]
    conn.close()
    return {
        "disputes": [dict(r) for r in rows],
        "open_count":       open_cnt,
        "total_at_risk":    total_vol,
        "overdue_count":    sum(1 for r in rows if r["status"]=="needs_response" and r["evidence_due_by"] < datetime.utcnow().strftime("%Y-%m-%d")),
    }

def kpi_summary():
    conn = get_conn()
    last30 = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    total      = conn.execute("SELECT COUNT(*) FROM charges WHERE created_at>=?",(last30,)).fetchone()[0]
    succeeded  = conn.execute("SELECT COUNT(*) FROM charges WHERE status='succeeded' AND created_at>=?",(last30,)).fetchone()[0]
    volume     = conn.execute("SELECT SUM(amount) FROM charges WHERE status='succeeded' AND created_at>=?",(last30,)).fetchone()[0] or 0
    refunds    = conn.execute("SELECT COUNT(*) FROM refunds WHERE created_at>=?",(last30,)).fetchone()[0]
    disputes   = conn.execute("SELECT COUNT(*) FROM disputes WHERE created_at>=?",(last30,)).fetchone()[0]
    open_alerts= conn.execute("SELECT COUNT(*) FROM alerts WHERE status IN ('open','investigating')").fetchone()[0]
    recon_exc  = conn.execute("SELECT COUNT(*) FROM reconciliation_results WHERE status!='matched' AND resolved=0").fetchone()[0]
    conn.close()
    return {
        "success_rate":    round(succeeded/total*100,2) if total else 0,
        "total_charges":   total,
        "total_volume":    volume,
        "refund_count":    refunds,
        "dispute_count":   disputes,
        "open_alerts":     open_alerts,
        "recon_exceptions":recon_exc,
        "period_days":     30,
    }
