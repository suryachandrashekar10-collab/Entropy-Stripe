import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "techops.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

SCHEMA = """
CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT,
    country TEXT,
    region TEXT,
    currency TEXT,
    mcc TEXT,
    status TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS charges (
    id TEXT PRIMARY KEY,
    merchant_id TEXT,
    amount INTEGER,
    currency TEXT,
    status TEXT,
    failure_code TEXT,
    failure_message TEXT,
    payment_method TEXT,
    card_brand TEXT,
    card_country TEXT,
    created_at TEXT,
    description TEXT,
    customer_id TEXT,
    FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE TABLE IF NOT EXISTS balance_transactions (
    id TEXT PRIMARY KEY,
    type TEXT,
    amount INTEGER,
    currency TEXT,
    net INTEGER,
    fee INTEGER,
    source_id TEXT,
    payout_id TEXT,
    status TEXT,
    created_at TEXT,
    available_on TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    merchant_id TEXT,
    amount INTEGER,
    currency TEXT,
    status TEXT,
    arrival_date TEXT,
    bank_name TEXT,
    bank_account_last4 TEXT,
    transaction_count INTEGER,
    created_at TEXT,
    FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    charge_id TEXT,
    amount INTEGER,
    currency TEXT,
    status TEXT,
    reason TEXT,
    created_at TEXT,
    FOREIGN KEY(charge_id) REFERENCES charges(id)
);

CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    charge_id TEXT,
    merchant_id TEXT,
    amount INTEGER,
    currency TEXT,
    status TEXT,
    reason TEXT,
    severity TEXT,
    evidence_due_by TEXT,
    created_at TEXT,
    FOREIGN KEY(charge_id) REFERENCES charges(id)
);

CREATE TABLE IF NOT EXISTS bank_settlements (
    id TEXT PRIMARY KEY,
    payout_id TEXT,
    bank_reference TEXT,
    amount INTEGER,
    currency TEXT,
    value_date TEXT,
    settlement_date TEXT,
    status TEXT,
    bank_name TEXT,
    discrepancy_type TEXT
);

CREATE TABLE IF NOT EXISTS reconciliation_results (
    id TEXT PRIMARY KEY,
    run_date TEXT,
    payout_id TEXT,
    charge_id TEXT,
    stripe_amount INTEGER,
    bank_amount INTEGER,
    currency TEXT,
    merchant_id TEXT,
    status TEXT,
    discrepancy_amount INTEGER,
    root_cause TEXT,
    resolved INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    alert_type TEXT,
    severity TEXT,
    title TEXT,
    description TEXT,
    affected_currency TEXT,
    affected_region TEXT,
    affected_volume INTEGER,
    affected_amount INTEGER,
    status TEXT,
    created_at TEXT,
    resolved_at TEXT,
    resolution_notes TEXT,
    auto_generated INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    region TEXT,
    currencies TEXT,
    health_score INTEGER,
    success_rate REAL,
    avg_settlement_days INTEGER,
    total_volume INTEGER,
    last_incident TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS daily_metrics (
    id TEXT PRIMARY KEY,
    date TEXT,
    currency TEXT,
    region TEXT,
    total_charges INTEGER,
    succeeded INTEGER,
    failed INTEGER,
    success_rate REAL,
    total_volume INTEGER,
    refund_count INTEGER,
    dispute_count INTEGER,
    avg_amount INTEGER
);
"""

def init_db():
    conn = get_conn()
    for stmt in SCHEMA.strip().split(";"):
        s = stmt.strip()
        if s:
            conn.execute(s)
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("DB initialized at", DB_PATH)
