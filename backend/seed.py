"""
Realistic Stripe Payments Analyst data generator.
Models actual Stripe operational data: charges, payouts, balance transactions,
bank settlements, refunds, disputes, partner health, alerts.

Narrative embedded in data:
 - April 2026: EUR success rate dropped to 79% (Adyen routing issue)
 - May 2026: HDFC Bank settlement delays caused recon exceptions
 - Ongoing: ~3% dispute rate on USD marketplace merchants
 - June 2026: GBP FX mismatch in settlements due to rate timing
"""

import sqlite3, random, uuid, os
from datetime import datetime, timedelta, date
from db import get_conn, init_db

random.seed(42)

# ── Config ────────────────────────────────────────────────────────────────────

MERCHANTS = [
    {"id": "acct_001", "name": "Zomato India Pvt Ltd",       "country": "IN", "region": "APAC",  "currency": "INR", "mcc": "5812"},
    {"id": "acct_002", "name": "Deliveroo UK Ltd",            "country": "GB", "region": "EU",    "currency": "GBP", "mcc": "5812"},
    {"id": "acct_003", "name": "Shopify Merchant – DE",       "country": "DE", "region": "EU",    "currency": "EUR", "mcc": "5691"},
    {"id": "acct_004", "name": "Grab Holdings SEA",           "country": "SG", "region": "APAC",  "currency": "SGD", "mcc": "4121"},
    {"id": "acct_005", "name": "Noon.com MENA",               "country": "AE", "region": "MENA",  "currency": "AED", "mcc": "5065"},
    {"id": "acct_006", "name": "Stripe Atlas – US SaaS",      "country": "US", "region": "US",    "currency": "USD", "mcc": "7372"},
    {"id": "acct_007", "name": "Farfetch Europe",             "country": "PT", "region": "EU",    "currency": "EUR", "mcc": "5691"},
    {"id": "acct_008", "name": "Paidy Japan",                 "country": "JP", "region": "APAC",  "currency": "JPY", "mcc": "6012"},
    {"id": "acct_009", "name": "Mercado Pago LATAM",          "country": "BR", "region": "LATAM", "currency": "USD", "mcc": "6099"},
    {"id": "acct_010", "name": "Careem Networks FZ LLC",      "country": "AE", "region": "MENA",  "currency": "AED", "mcc": "4121"},
    {"id": "acct_011", "name": "WooCommerce – FR Store",      "country": "FR", "region": "EU",    "currency": "EUR", "mcc": "5045"},
    {"id": "acct_012", "name": "Razorpay Partner – IN",       "country": "IN", "region": "APAC",  "currency": "INR", "mcc": "7372"},
]

PARTNERS = [
    {"id": "bnk_001", "name": "HDFC Bank",          "type": "bank",         "region": "APAC",  "currencies": "INR,USD",     "health_score": 72,  "success_rate": 0.871, "avg_settlement_days": 2, "status": "degraded", "last_incident": "2026-05-18"},
    {"id": "bnk_002", "name": "Barclays UK",         "type": "bank",         "region": "EU",    "currencies": "GBP,EUR",     "health_score": 88,  "success_rate": 0.934, "avg_settlement_days": 1, "status": "healthy",  "last_incident": "2026-03-02"},
    {"id": "bnk_003", "name": "Deutsche Bank AG",    "type": "bank",         "region": "EU",    "currencies": "EUR,USD",     "health_score": 91,  "success_rate": 0.948, "avg_settlement_days": 1, "status": "healthy",  "last_incident": "2026-01-15"},
    {"id": "bnk_004", "name": "DBS Singapore",       "type": "bank",         "region": "APAC",  "currencies": "SGD,USD",     "health_score": 95,  "success_rate": 0.962, "avg_settlement_days": 1, "status": "healthy",  "last_incident": "2025-11-20"},
    {"id": "bnk_005", "name": "Emirates NBD",        "type": "bank",         "region": "MENA",  "currencies": "AED,USD",     "health_score": 83,  "success_rate": 0.891, "avg_settlement_days": 2, "status": "healthy",  "last_incident": "2026-04-10"},
    {"id": "bnk_006", "name": "JPMorgan Chase",      "type": "bank",         "region": "US",    "currencies": "USD",         "health_score": 97,  "success_rate": 0.971, "avg_settlement_days": 1, "status": "healthy",  "last_incident": "2025-09-05"},
    {"id": "net_001", "name": "Visa International",  "type": "card_network", "region": "GLOBAL","currencies": "MULTI",       "health_score": 99,  "success_rate": 0.981, "avg_settlement_days": 1, "status": "healthy",  "last_incident": "2025-07-12"},
    {"id": "net_002", "name": "Mastercard",          "type": "card_network", "region": "GLOBAL","currencies": "MULTI",       "health_score": 98,  "success_rate": 0.976, "avg_settlement_days": 1, "status": "healthy",  "last_incident": "2025-08-30"},
    {"id": "prc_001", "name": "Adyen N.V.",          "type": "processor",    "region": "EU",    "currencies": "EUR,GBP,USD", "health_score": 79,  "success_rate": 0.891, "avg_settlement_days": 2, "status": "degraded", "last_incident": "2026-04-14"},
    {"id": "prc_002", "name": "Worldpay",            "type": "processor",    "region": "US",    "currencies": "USD,GBP",     "health_score": 92,  "success_rate": 0.941, "avg_settlement_days": 1, "status": "healthy",  "last_incident": "2026-02-28"},
]

# Realistic success rates per currency (with April EUR dip narrative)
BASE_SUCCESS = {"USD": 0.944, "EUR": 0.912, "GBP": 0.931, "INR": 0.871, "SGD": 0.952, "AED": 0.891, "JPY": 0.963}

DECLINE_CODES = [
    ("insufficient_funds",    "Insufficient funds",                    0.34),
    ("do_not_honor",          "Do not honor",                          0.19),
    ("card_declined",         "Card declined (generic)",               0.14),
    ("expired_card",          "Card has expired",                      0.12),
    ("incorrect_cvc",         "Incorrect CVC",                         0.08),
    ("lost_card",             "Card reported lost",                    0.05),
    ("stolen_card",           "Card reported stolen",                  0.04),
    ("card_velocity_exceeded","Velocity limit exceeded",               0.02),
    ("fraudulent",            "Suspected fraud",                       0.02),
]

CARD_BRANDS   = [("visa",0.48),("mastercard",0.32),("amex",0.14),("discover",0.04),("unionpay",0.02)]
PAY_METHODS   = [("card",0.79),("bank_transfer",0.12),("wallet",0.07),("bnpl",0.02)]
DISPUTE_REASONS = ["fraudulent","duplicate","product_not_received","product_unacceptable","credit_not_processed","subscription_canceled"]

START_DATE = datetime(2026, 1, 1)
END_DATE   = datetime(2026, 6, 24)

def weighted(choices):
    items, weights = zip(*choices)
    return random.choices(items, weights=weights)[0]

def rand_id(prefix, n=12):
    return prefix + uuid.uuid4().hex[:n]

def rand_dt(start=START_DATE, end=END_DATE):
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))

def to_s(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def stripe_fee(amount):
    return int(amount * 0.029 + 30)  # 2.9% + $0.30

# ── Generators ────────────────────────────────────────────────────────────────

def gen_charges(n=14000):
    charges = []
    for i in range(n):
        m   = random.choice(MERCHANTS)
        cur = m["currency"]
        cdt = rand_dt()

        # April EUR incident: success rate drops to 79%
        if cur == "EUR" and cdt.month == 4:
            success_prob = 0.79
        elif cur == "INR" and cdt.month == 5:
            success_prob = 0.83   # HDFC issues in May
        else:
            success_prob = BASE_SUCCESS.get(cur, 0.92)

        succeeded = random.random() < success_prob

        # Realistic amount ranges per currency
        amount_ranges = {"USD":(500,25000),"EUR":(500,22000),"GBP":(400,18000),
                         "INR":(5000,250000),"SGD":(700,30000),"AED":(1800,90000),"JPY":(500,300000)}
        lo, hi = amount_ranges.get(cur, (500, 20000))
        amount = random.randint(lo, hi)

        code, msg = (None, None)
        if not succeeded:
            chosen = random.choices(DECLINE_CODES, weights=[w for _,_,w in DECLINE_CODES])[0]
            code, msg = chosen[0], chosen[1]

        charges.append({
            "id":             rand_id("ch_"),
            "merchant_id":    m["id"],
            "amount":         amount,
            "currency":       cur,
            "status":         "succeeded" if succeeded else "failed",
            "failure_code":   code,
            "failure_message":msg,
            "payment_method": weighted(PAY_METHODS),
            "card_brand":     weighted(CARD_BRANDS),
            "card_country":   m["country"],
            "created_at":     to_s(cdt),
            "description":    f"Payment from {m['name']}",
            "customer_id":    rand_id("cus_"),
        })
    return charges

def gen_balance_transactions(charges, payouts_map):
    txns = []
    for c in charges:
        if c["status"] != "succeeded":
            continue
        fee = stripe_fee(c["amount"])
        txns.append({
            "id":          rand_id("txn_"),
            "type":        "charge",
            "amount":      c["amount"],
            "currency":    c["currency"],
            "net":         c["amount"] - fee,
            "fee":         fee,
            "source_id":   c["id"],
            "payout_id":   payouts_map.get(c["id"]),
            "status":      "available",
            "created_at":  c["created_at"],
            "available_on": to_s(datetime.strptime(c["created_at"], "%Y-%m-%d %H:%M:%S") + timedelta(days=2)),
            "description": f"Charge for {c['description']}",
        })
    return txns

def gen_payouts(succeeded_charges):
    """Batch succeeded charges into payouts — mimics Stripe's daily payout batching."""
    payouts = []
    charge_to_payout = {}

    # Group by merchant + currency + day
    from collections import defaultdict
    groups = defaultdict(list)
    for c in succeeded_charges:
        day = c["created_at"][:10]
        key = (c["merchant_id"], c["currency"], day)
        groups[key].append(c)

    partner_map = {
        "acct_001": ("HDFC Bank", "bnk_001", "4823"),
        "acct_002": ("Barclays UK", "bnk_002", "7741"),
        "acct_003": ("Deutsche Bank AG", "bnk_003", "2291"),
        "acct_004": ("DBS Singapore", "bnk_004", "5519"),
        "acct_005": ("Emirates NBD", "bnk_005", "3308"),
        "acct_006": ("JPMorgan Chase", "bnk_006", "9912"),
        "acct_007": ("Deutsche Bank AG", "bnk_003", "6647"),
        "acct_008": ("DBS Singapore", "bnk_004", "1134"),
        "acct_009": ("JPMorgan Chase", "bnk_006", "7725"),
        "acct_010": ("Emirates NBD", "bnk_005", "8863"),
        "acct_011": ("Deutsche Bank AG", "bnk_003", "4412"),
        "acct_012": ("HDFC Bank", "bnk_001", "2256"),
    }

    for (merchant_id, currency, day), charges in groups.items():
        total = sum(c["amount"] for c in charges)
        bank, _, last4 = partner_map.get(merchant_id, ("JPMorgan Chase", "bnk_006", "0000"))
        payout_dt = datetime.strptime(day, "%Y-%m-%d") + timedelta(days=1, hours=random.randint(8,16))

        # May HDFC delays — some payouts marked in_transit
        if merchant_id in ("acct_001","acct_012") and payout_dt.month == 5:
            status = random.choice(["paid","paid","in_transit","failed"])
        else:
            status = random.choices(["paid","paid","paid","in_transit","failed"], weights=[80,80,80,10,5])[0]

        po_id = rand_id("po_")
        payouts.append({
            "id":                  po_id,
            "merchant_id":         merchant_id,
            "amount":              total,
            "currency":            currency,
            "status":              status,
            "arrival_date":        (payout_dt + timedelta(days=1)).strftime("%Y-%m-%d"),
            "bank_name":           bank,
            "bank_account_last4":  last4,
            "transaction_count":   len(charges),
            "created_at":          to_s(payout_dt),
        })
        for c in charges:
            charge_to_payout[c["id"]] = po_id

    return payouts, charge_to_payout

def gen_bank_settlements(payouts):
    settlements = []
    for p in payouts:
        if p["status"] == "failed":
            continue

        arrival = datetime.strptime(p["arrival_date"], "%Y-%m-%d")
        roll = random.random()

        # May HDFC delays — settlement timing issues
        if p["bank_name"] == "HDFC Bank" and arrival.month == 5:
            roll = random.choices([0.05, 0.15, 0.85], weights=[40, 30, 30])[0]

        # June GBP FX mismatch narrative
        if p["currency"] == "GBP" and arrival.month == 6:
            roll = random.choices([0.05, 0.92], weights=[50, 50])[0]

        if roll < 0.04:
            # Missing in bank (timing gap — settlement not yet received)
            disc_type = "timing_gap"
            bank_amount = None
        elif roll < 0.08:
            # Amount mismatch (FX rate diff or fee dispute)
            disc_type = "amount_mismatch"
            variance = int(p["amount"] * random.uniform(-0.015, 0.015))
            bank_amount = p["amount"] + variance
        elif roll < 0.10:
            # Ghost record — in bank but not in Stripe
            disc_type = None
            bank_amount = p["amount"]
        else:
            disc_type = None
            bank_amount = p["amount"]

        if disc_type == "timing_gap":
            continue  # No settlement row created — this IS the discrepancy

        settlements.append({
            "id":              rand_id("stl_"),
            "payout_id":       p["id"],
            "bank_reference":  f"REF{random.randint(100000,999999)}",
            "amount":          bank_amount,
            "currency":        p["currency"],
            "value_date":      p["arrival_date"],
            "settlement_date": (arrival + timedelta(days=random.randint(0,1))).strftime("%Y-%m-%d"),
            "status":          "settled",
            "bank_name":       p["bank_name"],
            "discrepancy_type": disc_type,
        })

    # Add a handful of ghost records (in bank, no payout in Stripe)
    for _ in range(8):
        settlements.append({
            "id":              rand_id("stl_"),
            "payout_id":       rand_id("po_ghost_"),
            "bank_reference":  f"REF{random.randint(100000,999999)}",
            "amount":          random.randint(50000, 500000),
            "currency":        random.choice(["USD","EUR","GBP"]),
            "value_date":      to_s(rand_dt())[:10],
            "settlement_date": to_s(rand_dt())[:10],
            "status":          "settled",
            "bank_name":       random.choice(["Deutsche Bank AG","Barclays UK","JPMorgan Chase"]),
            "discrepancy_type":"ghost_record",
        })

    return settlements

def gen_refunds(succeeded_charges):
    refunds = []
    eligible = [c for c in succeeded_charges if c["status"] == "succeeded"]
    sample = random.sample(eligible, min(900, len(eligible)))
    reasons = ["duplicate","fraudulent","requested_by_customer","product_unacceptable"]
    for c in sample:
        refund_amount = c["amount"] if random.random() > 0.2 else int(c["amount"] * random.uniform(0.3, 0.9))
        refunds.append({
            "id":         rand_id("re_"),
            "charge_id":  c["id"],
            "amount":     refund_amount,
            "currency":   c["currency"],
            "status":     "succeeded",
            "reason":     random.choice(reasons),
            "created_at": to_s(datetime.strptime(c["created_at"], "%Y-%m-%d %H:%M:%S") + timedelta(hours=random.randint(2,72))),
        })
    return refunds

def gen_disputes(succeeded_charges):
    disputes = []
    usd_charges = [c for c in succeeded_charges if c["currency"] == "USD"]
    sample = random.sample(usd_charges, min(220, len(usd_charges)))
    for c in sample:
        created = datetime.strptime(c["created_at"], "%Y-%m-%d %H:%M:%S") + timedelta(days=random.randint(7,45))
        due = created + timedelta(days=7)
        amount = c["amount"]
        severity = "critical" if amount > 10000 else "high" if amount > 5000 else "medium" if amount > 2000 else "low"
        disputes.append({
            "id":             rand_id("dp_"),
            "charge_id":      c["id"],
            "merchant_id":    c["merchant_id"],
            "amount":         amount,
            "currency":       c["currency"],
            "status":         random.choices(["needs_response","under_review","won","lost","warning_needs_response"],
                                             weights=[30,25,20,15,10])[0],
            "reason":         random.choice(DISPUTE_REASONS),
            "severity":       severity,
            "evidence_due_by":due.strftime("%Y-%m-%d"),
            "created_at":     to_s(created),
        })
    return disputes

def gen_daily_metrics(charges):
    from collections import defaultdict
    metrics = []
    daily = defaultdict(lambda: {"total":0,"succeeded":0,"failed":0,"volume":0,"refunds":0,"disputes":0,"amounts":[]})
    for c in charges:
        key = (c["created_at"][:10], c["currency"], next(m["region"] for m in MERCHANTS if m["id"]==c["merchant_id"]))
        daily[key]["total"] += 1
        daily[key]["amounts"].append(c["amount"])
        if c["status"] == "succeeded":
            daily[key]["succeeded"] += 1
            daily[key]["volume"] += c["amount"]
        else:
            daily[key]["failed"] += 1

    for (day, currency, region), d in daily.items():
        metrics.append({
            "id":            rand_id("met_"),
            "date":          day,
            "currency":      currency,
            "region":        region,
            "total_charges": d["total"],
            "succeeded":     d["succeeded"],
            "failed":        d["failed"],
            "success_rate":  round(d["succeeded"] / d["total"], 4) if d["total"] else 0,
            "total_volume":  d["volume"],
            "refund_count":  0,
            "dispute_count": 0,
            "avg_amount":    int(sum(d["amounts"]) / len(d["amounts"])) if d["amounts"] else 0,
        })
    return metrics

def gen_alerts():
    return [
        {"id": rand_id("alrt_"), "alert_type":"success_rate_drop",    "severity":"critical","title":"EUR Success Rate Degradation — April 2026",
         "description":"EUR authorization rate dropped to 79.2% (baseline 91.2%). Root cause: Adyen N.V. routing configuration change on April 14. 3,847 failed transactions. Affected merchants: acct_003, acct_007, acct_011.",
         "affected_currency":"EUR","affected_region":"EU","affected_volume":3847,"affected_amount":18420000,
         "status":"resolved","created_at":"2026-04-14 09:22:00","resolved_at":"2026-04-14 17:45:00",
         "resolution_notes":"Adyen reconfigured EUR routing. Rolled back to previous ruleset. Affected merchants notified.","auto_generated":1},

        {"id": rand_id("alrt_"), "alert_type":"payout_failure",        "severity":"high","title":"HDFC Bank Settlement Delays — May 2026",
         "description":"47 payouts marked in_transit for >48h. HDFC Bank maintenance window extended unexpectedly. INR reconciliation exceptions: ₹12.4M outstanding.",
         "affected_currency":"INR","affected_region":"APAC","affected_volume":47,"affected_amount":124000000,
         "status":"resolved","created_at":"2026-05-18 06:30:00","resolved_at":"2026-05-19 14:20:00",
         "resolution_notes":"HDFC Bank confirmed delayed settlement. Funds credited 2026-05-19. Reconciliation closed.","auto_generated":1},

        {"id": rand_id("alrt_"), "alert_type":"reconciliation_exception","severity":"medium","title":"GBP FX Mismatch — June 2026",
         "description":"28 GBP settlements showing amount discrepancies of £2–£15. FX rate applied by Barclays differs from Stripe's rate by 0.8%. Total unreconciled: £1,847.",
         "affected_currency":"GBP","affected_region":"EU","affected_volume":28,"affected_amount":184700,
         "status":"investigating","created_at":"2026-06-10 11:15:00","resolved_at":None,
         "resolution_notes":None,"auto_generated":1},

        {"id": rand_id("alrt_"), "alert_type":"dispute_rate_spike",    "severity":"medium","title":"USD Dispute Rate Elevated — Marketplace Merchants",
         "description":"USD dispute rate at 3.1% (Visa threshold: 1.0%). Concentrated in acct_006 (Stripe Atlas SaaS). Primary reason: product_not_received (41%).",
         "affected_currency":"USD","affected_region":"US","affected_volume":89,"affected_amount":4450000,
         "status":"open","created_at":"2026-06-20 08:00:00","resolved_at":None,
         "resolution_notes":None,"auto_generated":1},

        {"id": rand_id("alrt_"), "alert_type":"success_rate_drop",    "severity":"low","title":"INR Success Rate — Minor Dip",
         "description":"INR authorization rate at 83.4% vs baseline 87.1%. Likely HDFC residual impact. Monitoring.",
         "affected_currency":"INR","affected_region":"APAC","affected_volume":312,"affected_amount":8200000,
         "status":"open","created_at":"2026-06-23 14:00:00","resolved_at":None,
         "resolution_notes":None,"auto_generated":1},
    ]

# ── Main ──────────────────────────────────────────────────────────────────────

def seed():
    init_db()
    conn = get_conn()

    print("Seeding merchants and partners...")
    for m in MERCHANTS:
        conn.execute("INSERT OR IGNORE INTO merchants VALUES (?,?,?,?,?,?,?,?)",
            (m["id"],m["name"],m["country"],m["region"],m["currency"],m["mcc"],"active","2025-01-01 00:00:00"))

    for p in PARTNERS:
        conn.execute("INSERT OR IGNORE INTO partners VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (p["id"],p["name"],p["type"],p["region"],p["currencies"],
             p["health_score"],p["success_rate"],p["avg_settlement_days"],
             random.randint(5000000,500000000), p["last_incident"],p["status"]))

    conn.commit()

    print("Generating 14,000 charges...")
    charges = gen_charges(14000)
    conn.executemany("INSERT OR IGNORE INTO charges VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(c["id"],c["merchant_id"],c["amount"],c["currency"],c["status"],
          c["failure_code"],c["failure_message"],c["payment_method"],
          c["card_brand"],c["card_country"],c["created_at"],c["description"],c["customer_id"])
         for c in charges])
    conn.commit()
    print(f"  {len(charges)} charges inserted")

    succeeded = [c for c in charges if c["status"] == "succeeded"]
    print(f"  {len(succeeded)} succeeded, {len(charges)-len(succeeded)} failed")

    print("Generating payouts (daily batch)...")
    payouts, charge_to_payout = gen_payouts(succeeded)
    conn.executemany("INSERT OR IGNORE INTO payouts VALUES (?,?,?,?,?,?,?,?,?,?)",
        [(p["id"],p["merchant_id"],p["amount"],p["currency"],p["status"],
          p["arrival_date"],p["bank_name"],p["bank_account_last4"],p["transaction_count"],p["created_at"])
         for p in payouts])
    conn.commit()
    print(f"  {len(payouts)} payouts inserted")

    print("Generating balance transactions...")
    btxns = gen_balance_transactions(charges, charge_to_payout)
    conn.executemany("INSERT OR IGNORE INTO balance_transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [(t["id"],t["type"],t["amount"],t["currency"],t["net"],t["fee"],
          t["source_id"],t["payout_id"],t["status"],t["created_at"],t["available_on"],t["description"])
         for t in btxns])
    conn.commit()
    print(f"  {len(btxns)} balance transactions inserted")

    print("Generating bank settlements...")
    settlements = gen_bank_settlements(payouts)
    conn.executemany("INSERT OR IGNORE INTO bank_settlements VALUES (?,?,?,?,?,?,?,?,?,?)",
        [(s["id"],s["payout_id"],s["bank_reference"],s["amount"],s["currency"],
          s["value_date"],s["settlement_date"],s["status"],s["bank_name"],s["discrepancy_type"])
         for s in settlements])
    conn.commit()
    print(f"  {len(settlements)} bank settlement records inserted")

    print("Generating refunds...")
    refunds = gen_refunds(succeeded)
    conn.executemany("INSERT OR IGNORE INTO refunds VALUES (?,?,?,?,?,?,?)",
        [(r["id"],r["charge_id"],r["amount"],r["currency"],r["status"],r["reason"],r["created_at"])
         for r in refunds])
    conn.commit()
    print(f"  {len(refunds)} refunds inserted")

    print("Generating disputes...")
    disputes = gen_disputes(succeeded)
    conn.executemany("INSERT OR IGNORE INTO disputes VALUES (?,?,?,?,?,?,?,?,?,?)",
        [(d["id"],d["charge_id"],d["merchant_id"],d["amount"],d["currency"],
          d["status"],d["reason"],d["severity"],d["evidence_due_by"],d["created_at"])
         for d in disputes])
    conn.commit()
    print(f"  {len(disputes)} disputes inserted")

    print("Generating daily metrics...")
    metrics = gen_daily_metrics(charges)
    conn.executemany("INSERT OR IGNORE INTO daily_metrics VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [(m["id"],m["date"],m["currency"],m["region"],m["total_charges"],
          m["succeeded"],m["failed"],m["success_rate"],m["total_volume"],
          m["refund_count"],m["dispute_count"],m["avg_amount"])
         for m in metrics])
    conn.commit()
    print(f"  {len(metrics)} daily metric rows inserted")

    print("Seeding alerts...")
    alerts = gen_alerts()
    conn.executemany("INSERT OR IGNORE INTO alerts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(a["id"],a["alert_type"],a["severity"],a["title"],a["description"],
          a["affected_currency"],a["affected_region"],a["affected_volume"],a["affected_amount"],
          a["status"],a["created_at"],a["resolved_at"],a["resolution_notes"],a["auto_generated"])
         for a in alerts])
    conn.commit()

    # Summary
    total = sum(conn.execute("SELECT COUNT(*) FROM " + t).fetchone()[0]
                for t in ["charges","balance_transactions","payouts","refunds","disputes","bank_settlements","daily_metrics"])
    print(f"\nSeed complete. Total records across all tables: {total:,}")
    conn.close()

if __name__ == "__main__":
    seed()
