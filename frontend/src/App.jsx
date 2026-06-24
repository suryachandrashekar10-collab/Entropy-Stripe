import { useEffect, useState } from "react";

const S = {
  purple:     "#635BFF",
  purpleDark: "#4F46E5",
  navy:       "#0A2540",
  navySide:   "#0A2540",
  white:      "#FFFFFF",
  bgPage:     "#F6F9FC",
  bgCard:     "#FFFFFF",
  border:     "#E0E6EB",
  borderDark: "#C4CEDD",
  text:       "#1A1A2E",
  textMuted:  "#425466",
  textDim:    "#8898AA",
  green:      "#0BBF6A",
  greenSoft:  "#0BBF6A18",
  amber:      "#D97706",
  amberSoft:  "#D9770618",
  red:        "#DF1B41",
  redSoft:    "#DF1B4118",
  violet:     "#7C3AED",
  violetSoft: "#7C3AED18",
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
      background: S.bgCard,
      border: `1px solid ${S.border}`,
      borderRadius: 8,
      padding: "20px 24px",
      flex: 1,
      minWidth: 150,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontSize: 12, color: S.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: S.textMuted, marginTop: 6 }}>{subtitle}</div>}
    </div>
  );
}

function Table({ title, data, color, columns }) {
  const [open, setOpen] = useState(true);
  if (!data || data.length === 0) return null;
  return (
    <div style={{
      marginBottom: 20,
      background: S.bgCard,
      borderRadius: 8,
      border: `1px solid ${S.border}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      overflow: "hidden",
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          cursor: "pointer", padding: "14px 20px",
          borderBottom: open ? `1px solid ${S.border}` : "none",
          background: S.bgCard,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ fontWeight: 600, fontSize: 14, color: S.text }}>{title}</span>
        <span style={{
          background: color + "18", color,
          fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
        }}>{data.length}</span>
        <span style={{ marginLeft: "auto", color: S.textDim, fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: S.bgPage }}>
                {columns.map(c => (
                  <th key={c.key} style={{
                    textAlign: "left", padding: "10px 16px",
                    color: S.textDim, borderBottom: `1px solid ${S.border}`,
                    fontWeight: 500, fontSize: 11,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={{
                  borderBottom: i < data.length - 1 ? `1px solid ${S.border}` : "none",
                }}>
                  {columns.map(c => (
                    <td key={c.key} style={{
                      padding: "12px 16px",
                      color: c.highlight ? color : S.text,
                      fontFamily: c.mono ? "'SF Mono','Fira Code',monospace" : "inherit",
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
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Sidebar — Stripe navy */}
      <div style={{
        width: 220, background: S.navySide, flexShrink: 0,
        display: "flex", flexDirection: "column", padding: "20px 0",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #1E3A5F" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, background: S.purple,
              borderRadius: 6, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff",
            }}>E</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Entropy Solutions</div>
              <div style={{ fontSize: 11, color: "#8898AA" }}>Sandbox</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          {[
            { icon: "⊞", label: "Home" },
            { icon: "↕", label: "Balances" },
            { icon: "≡", label: "Transactions" },
            { icon: "♦", label: "Payments", active: true },
            { icon: "◎", label: "Reconciliation", highlight: true },
            { icon: "📊", label: "Reporting" },
          ].map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 6, marginBottom: 2,
              background: item.highlight ? S.purple + "33" : item.active ? "#ffffff18" : "transparent",
              cursor: "pointer",
            }}>
              <span style={{ fontSize: 13, color: item.highlight ? S.purple : "#8898AA" }}>{item.icon}</span>
              <span style={{
                fontSize: 13, fontWeight: item.highlight || item.active ? 600 : 400,
                color: item.highlight ? "#fff" : item.active ? "#fff" : "#8898AA",
              }}>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding: "16px 12px", borderTop: "1px solid #1E3A5F" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: S.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>SC</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#fff" }}>Surya C.</div>
              <div style={{ fontSize: 11, color: "#8898AA" }}>Analyst</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content — white */}
      <div style={{ flex: 1, background: S.bgPage, display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <div style={{
          background: S.bgCard, borderBottom: `1px solid ${S.border}`,
          padding: "0 32px", height: 56,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <span style={{ fontSize: 14, color: S.textMuted }}>Payments</span>
          <span style={{ color: S.border }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: S.text }}>Reconciliation</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {lastRefresh && <span style={{ fontSize: 12, color: S.textDim }}>Updated {lastRefresh}</span>}
            <button onClick={fetchData} style={{
              background: S.purple, border: "none", color: "#fff",
              borderRadius: 6, padding: "7px 16px", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
            }}>↻ Refresh</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "32px", maxWidth: 1100, width: "100%" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: S.text }}>Payment Reconciliation</h1>
            <p style={{ fontSize: 13, color: S.textMuted, margin: "4px 0 0" }}>Stripe API vs Bank Settlement File</p>
          </div>

          {loading && (
            <div style={{ color: S.textMuted, textAlign: "center", marginTop: 80 }}>Fetching from Stripe API...</div>
          )}
          {error && (
            <div style={{ background: S.redSoft, border: `1px solid ${S.red}`, borderRadius: 8, padding: 16, color: S.red, fontSize: 13 }}>{error}</div>
          )}

          {data && <>
            <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
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

            <Table title="Missing in Bank Settlement" data={data.missing_in_bank} color={COLORS.missing_in_bank}
              columns={[
                { key: "charge_id", label: "Charge ID", mono: true },
                { key: "description", label: "Description" },
                { key: "amount", label: "Stripe Amount", render: r => fmt(r.amount), highlight: true },
                { key: "created", label: "Created" },
                { key: "issue", label: "Issue", highlight: true },
              ]} />

            <Table title="Amount Mismatch" data={data.amount_mismatch} color={COLORS.amount_mismatch}
              columns={[
                { key: "charge_id", label: "Charge ID", mono: true },
                { key: "stripe_amount", label: "Stripe Amount", render: r => fmt(r.stripe_amount) },
                { key: "bank_amount", label: "Bank Amount", render: r => fmt(r.bank_amount), highlight: true },
                { key: "diff", label: "Difference", render: r => fmt(Math.abs(r.diff)), highlight: true },
                { key: "created", label: "Created" },
              ]} />

            <Table title="Ghost Records — In Bank, Not in Stripe" data={data.missing_in_stripe} color={COLORS.missing_in_stripe}
              columns={[
                { key: "charge_id", label: "Charge ID", mono: true },
                { key: "amount", label: "Amount", render: r => fmt(r.amount), highlight: true },
                { key: "currency", label: "Currency" },
                { key: "status", label: "Bank Status" },
                { key: "issue", label: "Issue", highlight: true },
              ]} />

            <Table title="Matched Records" data={data.matched} color={COLORS.matched}
              columns={[
                { key: "charge_id", label: "Charge ID", mono: true },
                { key: "description", label: "Description" },
                { key: "amount", label: "Amount", render: r => fmt(r.amount), highlight: true },
                { key: "currency", label: "Currency" },
                { key: "status", label: "Status" },
                { key: "created", label: "Created" },
              ]} />
          </>}
        </div>
      </div>
    </div>
  );
}
