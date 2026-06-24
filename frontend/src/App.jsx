import { useEffect, useState } from "react";

// Stripe brand palette
const S = {
  purple:     "#635BFF",
  purpleDark: "#4F46E5",
  purpleGlow: "#635BFF22",
  navy:       "#0A2540",
  navyCard:   "#0D2F50",
  navyRow:    "#0F3460",
  slate:      "#1A3A5C",
  border:     "#1E3A5F",
  text:       "#FFFFFF",
  textMuted:  "#8898AA",
  textDim:    "#425466",
  green:      "#00D924",
  greenSoft:  "#00D92422",
  amber:      "#F5A623",
  amberSoft:  "#F5A62322",
  red:        "#FF4D4D",
  redSoft:    "#FF4D4D22",
  violet:     "#A78BFA",
  violetSoft: "#A78BFA22",
};

const COLORS = {
  matched:           S.green,
  missing_in_bank:   S.amber,
  amount_mismatch:   S.red,
  missing_in_stripe: S.violet,
};

function fmt(cents) {
  return "$" + (cents / 100).toFixed(2);
}

function SummaryCard({ label, value, color, subtitle }) {
  return (
    <div style={{
      background: S.navyCard,
      border: `1px solid ${color}44`,
      borderRadius: 12,
      padding: "22px 24px",
      flex: 1,
      minWidth: 150,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: color, borderRadius: "12px 12px 0 0",
      }} />
      <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 38, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: S.textDim, marginTop: 6 }}>{subtitle}</div>}
    </div>
  );
}

function Table({ title, data, color, columns }) {
  const [open, setOpen] = useState(true);
  if (!data || data.length === 0) return null;
  return (
    <div style={{
      marginBottom: 24,
      background: S.navyCard,
      borderRadius: 12,
      border: `1px solid ${S.border}`,
      overflow: "hidden",
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          cursor: "pointer", padding: "16px 20px",
          borderBottom: open ? `1px solid ${S.border}` : "none",
          background: S.navy,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ fontWeight: 600, fontSize: 14, color: S.text }}>{title}</span>
        <span style={{
          background: color + "22", color, fontSize: 11,
          padding: "2px 8px", borderRadius: 20, fontWeight: 700,
        }}>{data.length}</span>
        <span style={{ marginLeft: "auto", color: S.textMuted, fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0A2540CC" }}>
                {columns.map(c => (
                  <th key={c.key} style={{
                    textAlign: "left", padding: "10px 16px",
                    color: S.textMuted, borderBottom: `1px solid ${S.border}`,
                    fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={{
                  borderBottom: `1px solid ${S.border}`,
                  background: i % 2 === 0 ? "transparent" : "#0A254008",
                }}>
                  {columns.map(c => (
                    <td key={c.key} style={{
                      padding: "11px 16px",
                      color: c.highlight ? color : S.text,
                      fontFamily: c.mono ? "'SF Mono', 'Fira Code', monospace" : "inherit",
                      fontSize: c.mono ? 11 : 13,
                      fontWeight: c.highlight ? 600 : 400,
                    }}>
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch("http://localhost:8000/api/reconcile")
      .then(r => r.json())
      .then(d => { setData(d); setLastRefresh(new Date().toLocaleTimeString()); setLoading(false); })
      .catch(() => { setError("Cannot connect to backend on port 8000."); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const matchRate = data?.summary?.match_rate ?? 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: S.navy,
      color: S.text,
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      {/* Top nav bar — Stripe style */}
      <div style={{
        background: "#0A2540F0",
        backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${S.border}`,
        padding: "0 40px",
        display: "flex",
        alignItems: "center",
        height: 56,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Stripe-style logo mark */}
          <div style={{
            width: 28, height: 28, background: S.purple,
            borderRadius: 6, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 14, fontWeight: 700,
          }}>S</div>
          <span style={{ fontWeight: 600, fontSize: 15, color: S.text }}>Entropy Solutions</span>
          <span style={{ color: S.border, fontSize: 18, margin: "0 4px" }}>|</span>
          <span style={{ fontSize: 14, color: S.textMuted }}>Reconciliation</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 12, color: S.textDim }}>Updated {lastRefresh}</span>
          )}
          <button
            onClick={fetchData}
            style={{
              background: S.purple, border: "none", color: "#fff",
              borderRadius: 6, padding: "7px 14px", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding: "36px 40px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: S.text }}>
            Payment Reconciliation
          </h1>
          <p style={{ fontSize: 14, color: S.textMuted, margin: "6px 0 0" }}>
            Stripe API vs Bank Settlement File · Sandbox
          </p>
        </div>

        {loading && (
          <div style={{ color: S.textMuted, textAlign: "center", marginTop: 80, fontSize: 14 }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⟳</div>
            Fetching from Stripe API...
          </div>
        )}

        {error && (
          <div style={{
            background: S.redSoft, border: `1px solid ${S.red}`,
            borderRadius: 10, padding: 20, color: S.red,
          }}>{error}</div>
        )}

        {data && <>
          {/* Summary Cards */}
          <div style={{ display: "flex", gap: 14, marginBottom: 32, flexWrap: "wrap" }}>
            <SummaryCard
              label="Match Rate"
              value={`${matchRate}%`}
              color={matchRate >= 90 ? S.green : matchRate >= 70 ? S.amber : S.red}
              subtitle={`${data.summary.matched} of ${data.summary.total_stripe_charges} charges`}
            />
            <SummaryCard label="Matched" value={data.summary.matched} color={COLORS.matched} subtitle="Stripe = Bank ✓" />
            <SummaryCard label="Missing in Bank" value={data.summary.missing_in_bank} color={COLORS.missing_in_bank} subtitle="Revenue at risk" />
            <SummaryCard label="Amount Mismatch" value={data.summary.amount_mismatch} color={COLORS.amount_mismatch} subtitle="Fee or FX drift" />
            <SummaryCard label="Ghost Records" value={data.summary.missing_in_stripe} color={COLORS.missing_in_stripe} subtitle="In bank, not Stripe" />
          </div>

          {/* Discrepancy Tables */}
          <Table
            title="Missing in Bank Settlement"
            data={data.missing_in_bank}
            color={COLORS.missing_in_bank}
            columns={[
              { key: "charge_id", label: "Charge ID", mono: true },
              { key: "description", label: "Description" },
              { key: "amount", label: "Stripe Amount", render: r => fmt(r.amount), highlight: true },
              { key: "created", label: "Created" },
              { key: "issue", label: "Issue", highlight: true },
            ]}
          />

          <Table
            title="Amount Mismatch"
            data={data.amount_mismatch}
            color={COLORS.amount_mismatch}
            columns={[
              { key: "charge_id", label: "Charge ID", mono: true },
              { key: "stripe_amount", label: "Stripe Amount", render: r => fmt(r.stripe_amount) },
              { key: "bank_amount", label: "Bank Amount", render: r => fmt(r.bank_amount), highlight: true },
              { key: "diff", label: "Difference", render: r => fmt(Math.abs(r.diff)), highlight: true },
              { key: "created", label: "Created" },
            ]}
          />

          <Table
            title="Ghost Records — In Bank, Not in Stripe"
            data={data.missing_in_stripe}
            color={COLORS.missing_in_stripe}
            columns={[
              { key: "charge_id", label: "Charge ID", mono: true },
              { key: "amount", label: "Amount", render: r => fmt(r.amount), highlight: true },
              { key: "currency", label: "Currency" },
              { key: "status", label: "Bank Status" },
              { key: "issue", label: "Issue", highlight: true },
            ]}
          />

          <Table
            title="Matched Records"
            data={data.matched}
            color={COLORS.matched}
            columns={[
              { key: "charge_id", label: "Charge ID", mono: true },
              { key: "description", label: "Description" },
              { key: "amount", label: "Amount", render: r => fmt(r.amount), highlight: true },
              { key: "currency", label: "Currency" },
              { key: "status", label: "Status" },
              { key: "created", label: "Created" },
            ]}
          />
        </>}
      </div>
    </div>
  );
}
