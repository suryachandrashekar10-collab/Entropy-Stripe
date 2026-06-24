import { useEffect, useState, useCallback } from "react";

const API = "http://localhost:8000/api";

const S = {
  purple: "#635BFF", navy: "#0A2540", white: "#FFFFFF",
  bgPage: "#F6F9FC", bgCard: "#FFFFFF", border: "#E0E6EB",
  text: "#1A1A2E", textMuted: "#425466", textDim: "#8898AA",
  green: "#0BBF6A", amber: "#D97706", red: "#DF1B41", violet: "#7C3AED",
};

const SEV = { critical: S.red, high: S.amber, medium: "#F59E0B", low: S.green };
const STA = {
  matched: S.green, timing_gap: S.amber, amount_mismatch: S.red,
  ghost_record: S.violet, open: S.red, investigating: S.amber, resolved: S.green,
  healthy: S.green, degraded: S.amber, needs_response: S.red,
  under_review: S.amber, won: S.green, lost: "#64748b",
  warning_needs_response: S.red,
};

const sym = { USD:"$", EUR:"€", GBP:"£", INR:"₹", SGD:"S$", AED:"AED ", JPY:"¥" };
const div = { JPY:1, INR:100, AED:100, SGD:100, GBP:100, EUR:100, USD:100 };

function fmt(cents, cur="USD") {
  const val = (cents||0) / (div[cur]||100);
  return (sym[cur]||"$") + val.toLocaleString(undefined,{maximumFractionDigits:0});
}
function pct(v) { return `${(v||0).toFixed(1)}%`; }
function ago(dt) {
  if (!dt) return "—";
  const d = new Date(dt.replace(" ","T")+"Z");
  const m = Math.floor((Date.now()-d)/60000);
  if (m<60) return `${m}m ago`;
  if (m<1440) return `${Math.floor(m/60)}h ago`;
  return `${Math.floor(m/1440)}d ago`;
}

function Badge({ label, color }) {
  return (
    <span style={{background:(color||"#666")+"18",color:color||"#666",
      fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,
      textTransform:"capitalize",whiteSpace:"nowrap"}}>
      {(label||"").replace(/_/g," ")}
    </span>
  );
}

function KpiCard({ label, value, sub, color, alert }) {
  return (
    <div style={{background:S.bgCard,border:`1px solid ${alert?S.red:S.border}`,
      borderRadius:8,padding:"18px 20px",flex:1,minWidth:140,
      boxShadow:alert?`0 0 0 2px ${S.red}22`:"0 1px 3px rgba(0,0,0,0.06)"}}>
      <div style={{fontSize:11,color:S.textDim,textTransform:"uppercase",
        letterSpacing:"0.06em",marginBottom:6}}>{label}</div>
      <div style={{fontSize:28,fontWeight:700,color:color||S.text,lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:S.textMuted,marginTop:4}}>{sub}</div>}
    </div>
  );
}

// ── Tiny inline SVG line chart ────────────────────────────────────────────────
function MiniLineChart({ data, valueKey, color, height=140 }) {
  if (!data||data.length<2) return null;
  const vals = data.map(d=>d[valueKey]||0);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max-min||1;
  const W=600, H=height;
  const pts = vals.map((v,i)=>`${(i/(vals.length-1))*W},${H-((v-min)/range)*(H-10)-5}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color||S.purple} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={color||S.purple} opacity="0.08"/>
    </svg>
  );
}

function Sec({ children, style }) {
  return <div style={{fontSize:15,fontWeight:700,color:S.text,marginBottom:16,...style}}>{children}</div>;
}

// ── PERFORMANCE TAB ───────────────────────────────────────────────────────────
function PerformanceTab() {
  const [currencies, setCurrencies] = useState([]);
  const [trend, setTrend] = useState([]);
  const [declines, setDeclines] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedCur, setSelectedCur] = useState(null);

  useEffect(() => {
    fetch(`${API}/performance/currencies?days=30`).then(r=>r.json()).then(setCurrencies);
    fetch(`${API}/performance/decline-codes?days=30`).then(r=>r.json()).then(setDeclines);
    fetch(`${API}/performance/regions?days=30`).then(r=>r.json()).then(setRegions);
  }, []);

  useEffect(() => {
    const cur = selectedCur||"";
    fetch(`${API}/performance/trend?days=90${cur?`&currency=${cur}`:""}`).then(r=>r.json()).then(data=>{
      if (cur) {
        setTrend(data.map(d=>({...d,date:d.date.slice(5)})));
      } else {
        const byDate={};
        data.forEach(d=>{
          if(!byDate[d.date]) byDate[d.date]={date:d.date.slice(5),total:0,succeeded:0};
          byDate[d.date].total+=d.total;
          byDate[d.date].succeeded+=Math.round(d.total*d.success_rate/100);
        });
        setTrend(Object.values(byDate).map(d=>({
          ...d,success_rate:d.total?+((d.succeeded/d.total)*100).toFixed(1):0
        })));
      }
    });
  }, [selectedCur]);

  return (
    <div>
      <Sec>Success Rate by Currency — Last 30 Days</Sec>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24}}>
        {currencies.map(c=>(
          <div key={c.currency} onClick={()=>setSelectedCur(c.currency===selectedCur?null:c.currency)}
            style={{background:S.bgCard,border:`2px solid ${c.alert?S.red:selectedCur===c.currency?S.purple:S.border}`,
              borderRadius:8,padding:"14px 18px",cursor:"pointer",minWidth:130,
              boxShadow:c.alert?`0 0 0 3px ${S.red}22`:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:13,fontWeight:600,color:S.text}}>{c.currency}</div>
            <div style={{fontSize:26,fontWeight:700,color:c.alert?S.red:c.success_rate>93?S.green:S.amber}}>
              {pct(c.success_rate)}
            </div>
            <div style={{fontSize:11,color:S.textDim}}>{c.total?.toLocaleString()} charges</div>
            {c.alert&&<div style={{fontSize:10,color:S.red,fontWeight:600,marginTop:4}}>BELOW THRESHOLD</div>}
          </div>
        ))}
      </div>

      <div style={{background:S.bgCard,border:`1px solid ${S.border}`,borderRadius:8,padding:20,marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:600,color:S.text,marginBottom:8}}>
          Authorization Rate Trend — 90 Days {selectedCur?`(${selectedCur})`:"(All Currencies)"}
          {selectedCur&&<span onClick={()=>setSelectedCur(null)} style={{marginLeft:12,fontSize:11,color:S.purple,cursor:"pointer"}}>Clear</span>}
        </div>
        <div style={{position:"relative"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:S.textDim,marginBottom:4}}>
            <span>{trend[0]?.date}</span>
            <span>{trend[Math.floor(trend.length/2)]?.date}</span>
            <span>{trend[trend.length-1]?.date}</span>
          </div>
          <MiniLineChart data={trend} valueKey="success_rate" color={S.purple} height={140}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:S.textDim,marginTop:2}}>
            <span>70%</span>
            <span style={{color:S.red,fontWeight:600}}>Apr dip → 79.2% EUR</span>
            <span>100%</span>
          </div>
        </div>
        <div style={{fontSize:11,color:S.red,marginTop:12,background:"#DF1B4108",padding:"8px 12px",borderRadius:6,border:`1px solid ${S.red}22`}}>
          April 2026: EUR dropped to 79.2% (Adyen routing incident). Resolved 2026-04-14 17:45 UTC. 3,847 failed transactions.
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:S.bgCard,border:`1px solid ${S.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:S.text,marginBottom:14}}>Top Decline Codes</div>
          {declines.slice(0,8).map(d=>(
            <div key={d.code} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:500,color:S.text}}>{d.code?.replace(/_/g," ")}</div>
                <div style={{height:4,background:S.border,borderRadius:4,marginTop:4}}>
                  <div style={{height:4,width:`${d.pct}%`,background:S.purple,borderRadius:4}}/>
                </div>
              </div>
              <div style={{fontSize:12,fontWeight:600,color:S.textMuted,minWidth:40,textAlign:"right"}}>{d.pct}%</div>
              <div style={{fontSize:11,color:S.textDim,minWidth:50,textAlign:"right"}}>{d.count?.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div style={{background:S.bgCard,border:`1px solid ${S.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:S.text,marginBottom:14}}>Regional Performance</div>
          {regions.map(r=>(
            <div key={r.region} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${S.border}`}}>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:S.text}}>{r.region}</div>
                <div style={{fontSize:11,color:S.textDim}}>{r.total?.toLocaleString()} transactions</div>
              </div>
              <div style={{fontSize:18,fontWeight:700,color:r.success_rate>92?S.green:r.success_rate>86?S.amber:S.red}}>
                {pct(r.success_rate)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RECONCILIATION TAB ────────────────────────────────────────────────────────
function ReconciliationTab() {
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState([]);
  const [filter, setFilter] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/reconcile/summary`).then(r=>r.json()).then(setSummary);
    const q = filter?`?status=${filter}&limit=100`:"?limit=100";
    fetch(`${API}/reconcile/results${q}`).then(r=>r.json()).then(setResults);
  }, [filter]);

  useEffect(()=>{ load(); },[load]);

  const runRecon = async() => {
    setRunning(true);
    await fetch(`${API}/reconcile/run`,{method:"POST"});
    load();
    setRunning(false);
  };

  const resolve = async(id) => {
    await fetch(`${API}/reconcile/${id}/resolve`,{method:"PATCH"});
    load();
  };

  const buckets=[
    {key:"matched",        label:"Matched",        color:S.green},
    {key:"timing_gap",     label:"Timing Gap",     color:S.amber},
    {key:"amount_mismatch",label:"Amount Mismatch",color:S.red},
    {key:"ghost_record",   label:"Ghost Record",   color:S.violet},
  ];

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",marginBottom:20}}>
        <Sec style={{margin:0}}>Reconciliation Engine — Payouts vs Bank</Sec>
        <button onClick={runRecon} disabled={running} style={{marginLeft:"auto",background:S.purple,color:"#fff",
          border:"none",borderRadius:6,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:500}}>
          {running?"Running...":"▶ Run Recon"}
        </button>
      </div>

      {summary&&(
        <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <KpiCard label="Match Rate" value={pct(summary.match_rate)}
            color={summary.match_rate>95?S.green:summary.match_rate>90?S.amber:S.red}
            sub={`${summary.matched} of ${summary.total} payouts`}/>
          {buckets.map(b=>{
            const rows=summary.by_status?.filter(r=>r.status===b.key)||[];
            const cnt=rows.reduce((a,r)=>a+(r.count||0),0);
            const disc=rows.reduce((a,r)=>a+(r.total_disc||0),0);
            return <KpiCard key={b.key} label={b.label} value={cnt} color={b.color}
              sub={disc?`${Math.round(disc/100).toLocaleString()} unreconciled`:"Clean"}
              alert={b.key!=="matched"&&cnt>0}/>;
          })}
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[null,...buckets.map(b=>b.key)].map(k=>(
          <button key={k||"all"} onClick={()=>setFilter(k)} style={{
            background:filter===k?S.purple:S.bgCard,color:filter===k?"#fff":S.textMuted,
            border:`1px solid ${filter===k?S.purple:S.border}`,borderRadius:6,
            padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:500}}>
            {k?k.replace(/_/g," "):"All"}
          </button>
        ))}
      </div>

      <div style={{background:S.bgCard,border:`1px solid ${S.border}`,borderRadius:8,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:S.bgPage}}>
              {["Payout","Currency","Merchant","Stripe Amt","Bank Amt","Discrepancy","Status","Bank","Action"].map(h=>(
                <th key={h} style={{padding:"10px 14px",textAlign:"left",color:S.textDim,fontWeight:500,
                  fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:`1px solid ${S.border}`}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map(r=>(
              <tr key={r.id} style={{borderBottom:`1px solid ${S.border}`}}>
                <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:10,color:S.textDim}}>{r.payout_id?.slice(0,12)}…</td>
                <td style={{padding:"10px 14px",fontWeight:600}}>{r.currency}</td>
                <td style={{padding:"10px 14px",color:S.textMuted,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.merchant_name||"—"}</td>
                <td style={{padding:"10px 14px",fontWeight:500}}>{fmt(r.stripe_amount,r.currency)}</td>
                <td style={{padding:"10px 14px",color:r.bank_amount!==r.stripe_amount?S.red:S.text}}>{r.bank_amount?fmt(r.bank_amount,r.currency):"—"}</td>
                <td style={{padding:"10px 14px",fontWeight:600,color:r.discrepancy_amount?S.red:S.green}}>
                  {r.discrepancy_amount?fmt(Math.abs(r.discrepancy_amount),r.currency):"—"}
                </td>
                <td style={{padding:"10px 14px"}}><Badge label={r.status} color={STA[r.status]}/></td>
                <td style={{padding:"10px 14px",color:S.textMuted,fontSize:11}}>{r.bank_name||"—"}</td>
                <td style={{padding:"10px 14px"}}>
                  {r.status!=="matched"&&!r.resolved&&(
                    <button onClick={()=>resolve(r.id)} style={{fontSize:11,background:"none",
                      border:`1px solid ${S.border}`,borderRadius:4,padding:"3px 8px",cursor:"pointer",color:S.textMuted}}>
                      Resolve
                    </button>
                  )}
                  {r.resolved===1&&<span style={{fontSize:11,color:S.green}}>Done</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ALERTS TAB ────────────────────────────────────────────────────────────────
function AlertsTab() {
  const [alerts, setAlerts] = useState([]);
  const [expanded, setExpanded] = useState(null);

  const load = () => fetch(`${API}/alerts`).then(r=>r.json()).then(setAlerts);
  useEffect(()=>{ load(); },[]);

  const update = async(id,status) => {
    await fetch(`${API}/alerts/${id}`,{method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({status,resolved_at:new Date().toISOString().replace("T"," ").slice(0,19)})});
    load();
  };

  const open = alerts.filter(a=>a.status==="open").length;
  const inv  = alerts.filter(a=>a.status==="investigating").length;
  const crit = alerts.filter(a=>a.severity==="critical"&&a.status!=="resolved").length;

  return (
    <div>
      <Sec>Alert Centre — Automated Monitoring</Sec>
      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <KpiCard label="Open" value={open} color={open>0?S.red:S.green} alert={open>0}/>
        <KpiCard label="Investigating" value={inv} color={S.amber}/>
        <KpiCard label="Critical" value={crit} color={S.red} alert={crit>0}/>
        <KpiCard label="Total (6mo)" value={alerts.length}/>
      </div>

      <div style={{background:S.purple+"0A",border:`1px solid ${S.purple}33`,borderRadius:8,
        padding:"12px 16px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}>
        <span style={{fontSize:18}}>⚡</span>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:S.purple}}>n8n Automation Active</div>
          <div style={{fontSize:12,color:S.textMuted}}>
            Polls <code style={{background:S.bgPage,padding:"1px 5px",borderRadius:3}}>/api/webhooks/n8n/check-performance</code> every 15 min.
            Auto-creates critical alerts when any currency drops below 88% — zero analyst time for detection.
          </div>
        </div>
      </div>

      {alerts.map(a=>(
        <div key={a.id} style={{background:S.bgCard,
          border:`1px solid ${a.status!=="resolved"?SEV[a.severity]+"44":S.border}`,
          borderRadius:8,marginBottom:10,overflow:"hidden"}}>
          <div onClick={()=>setExpanded(expanded===a.id?null:a.id)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",cursor:"pointer"}}>
            <div style={{width:3,height:36,background:SEV[a.severity]||S.textDim,borderRadius:3,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <Badge label={a.severity} color={SEV[a.severity]}/>
                <Badge label={a.status} color={STA[a.status]}/>
                {a.affected_currency&&<Badge label={a.affected_currency} color={S.purple}/>}
                <span style={{fontSize:11,color:S.textDim,marginLeft:"auto"}}>{ago(a.created_at)}</span>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:S.text}}>{a.title}</div>
            </div>
          </div>
          {expanded===a.id&&(
            <div style={{padding:"0 18px 16px",borderTop:`1px solid ${S.border}`}}>
              <p style={{fontSize:13,color:S.textMuted,marginTop:12,lineHeight:1.6,margin:"12px 0 8px"}}>{a.description}</p>
              {a.affected_volume>0&&(
                <div style={{display:"flex",gap:16,marginTop:8}}>
                  <div style={{fontSize:12,color:S.textDim}}>Transactions: <strong>{a.affected_volume?.toLocaleString()}</strong></div>
                  <div style={{fontSize:12,color:S.textDim}}>At risk: <strong>{fmt(a.affected_amount)}</strong></div>
                </div>
              )}
              {a.resolution_notes&&(
                <div style={{marginTop:12,background:S.green+"0A",border:`1px solid ${S.green}33`,
                  borderRadius:6,padding:"8px 12px",fontSize:12,color:S.textMuted}}>
                  Resolution: {a.resolution_notes}
                </div>
              )}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                {a.status==="open"&&<button onClick={()=>update(a.id,"investigating")} style={{background:S.amber,color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12}}>Investigate</button>}
                {a.status!=="resolved"&&<button onClick={()=>update(a.id,"resolved")} style={{background:S.green,color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12}}>Resolve</button>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── PARTNERS TAB ──────────────────────────────────────────────────────────────
function PartnersTab() {
  const [partners, setPartners] = useState([]);
  useEffect(()=>{ fetch(`${API}/partners`).then(r=>r.json()).then(setPartners); },[]);

  return (
    <div>
      <Sec>Banking Partner & Network Health</Sec>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
        {partners.map(p=>(
          <div key={p.id} style={{background:S.bgCard,
            border:`1px solid ${p.status==="degraded"?S.amber:S.border}`,
            borderRadius:8,padding:18,
            boxShadow:p.status==="degraded"?`0 0 0 2px ${S.amber}22`:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:S.text}}>{p.name}</div>
                <div style={{fontSize:11,color:S.textDim,textTransform:"uppercase",letterSpacing:"0.05em"}}>{p.type} · {p.region}</div>
              </div>
              <Badge label={p.status} color={STA[p.status]}/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:S.textDim,marginBottom:4}}>
                <span>Health Score</span>
                <span style={{fontWeight:700,color:p.health_score>90?S.green:p.health_score>80?S.amber:S.red}}>{p.health_score}/100</span>
              </div>
              <div style={{height:6,background:S.border,borderRadius:4}}>
                <div style={{height:6,width:`${p.health_score}%`,borderRadius:4,
                  background:p.health_score>90?S.green:p.health_score>80?S.amber:S.red}}/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:S.bgPage,borderRadius:6,padding:"8px 10px"}}>
                <div style={{fontSize:10,color:S.textDim,marginBottom:2}}>SUCCESS RATE</div>
                <div style={{fontSize:16,fontWeight:700,color:p.success_rate>0.93?S.green:S.amber}}>{pct(p.success_rate*100)}</div>
              </div>
              <div style={{background:S.bgPage,borderRadius:6,padding:"8px 10px"}}>
                <div style={{fontSize:10,color:S.textDim,marginBottom:2}}>SETTLEMENT</div>
                <div style={{fontSize:16,fontWeight:700,color:S.text}}>T+{p.avg_settlement_days}</div>
              </div>
            </div>
            {p.last_incident&&<div style={{fontSize:11,color:S.textDim,marginTop:10}}>Last incident: <span style={{color:S.amber}}>{p.last_incident}</span></div>}
            <div style={{fontSize:11,color:S.textDim,marginTop:4}}>Currencies: {p.currencies}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DISPUTES TAB ──────────────────────────────────────────────────────────────
function DisputesTab() {
  const [data, setData] = useState(null);
  useEffect(()=>{ fetch(`${API}/disputes`).then(r=>r.json()).then(setData); },[]);
  if (!data) return <div style={{color:S.textDim}}>Loading...</div>;

  return (
    <div>
      <Sec>Dispute Queue — Chargeback Management</Sec>
      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <KpiCard label="Open Disputes" value={data.open_count} color={S.red} alert={data.open_count>10} sub="Needs response"/>
        <KpiCard label="Total at Risk" value={fmt(data.total_at_risk)} color={S.red} sub="Open + warning"/>
        <KpiCard label="Overdue" value={data.overdue_count} color={S.red} alert={data.overdue_count>0} sub="Evidence past due"/>
        <KpiCard label="Total (6mo)" value={data.disputes?.length}/>
      </div>
      <div style={{background:"#DF1B4108",border:`1px solid ${S.red}22`,borderRadius:8,
        padding:"10px 16px",marginBottom:16,fontSize:12,color:S.textMuted}}>
        Visa threshold: 1.0% | Current USD rate: 3.1% — <strong style={{color:S.red}}>Monitoring program risk.</strong> Primary: product_not_received (41%). Action: coordinate with Stripe Atlas (acct_006).
      </div>
      <div style={{background:S.bgCard,border:`1px solid ${S.border}`,borderRadius:8,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:S.bgPage}}>
              {["ID","Merchant","Amount","Reason","Status","Severity","Evidence Due","Created"].map(h=>(
                <th key={h} style={{padding:"10px 14px",textAlign:"left",color:S.textDim,fontWeight:500,
                  fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:`1px solid ${S.border}`}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.disputes.slice(0,80).map(d=>(
              <tr key={d.id} style={{borderBottom:`1px solid ${S.border}`,
                background:d.status==="needs_response"?S.red+"04":"transparent"}}>
                <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:10,color:S.textDim}}>{d.id?.slice(0,12)}</td>
                <td style={{padding:"10px 14px",fontSize:11,color:S.textMuted,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.merchant_name}</td>
                <td style={{padding:"10px 14px",fontWeight:600,color:S.red}}>{fmt(d.amount,d.currency)}</td>
                <td style={{padding:"10px 14px",color:S.textMuted}}>{d.reason?.replace(/_/g," ")}</td>
                <td style={{padding:"10px 14px"}}><Badge label={d.status} color={STA[d.status]}/></td>
                <td style={{padding:"10px 14px"}}><Badge label={d.severity} color={SEV[d.severity]}/></td>
                <td style={{padding:"10px 14px",fontSize:11,
                  color:d.evidence_due_by<new Date().toISOString().slice(0,10)?S.red:S.textMuted}}>{d.evidence_due_by}</td>
                <td style={{padding:"10px 14px",fontSize:11,color:S.textDim}}>{d.created_at?.slice(0,10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
const TABS = [
  { key:"performance",    label:"Performance",    icon:"📈" },
  { key:"reconciliation", label:"Reconciliation", icon:"⚖️" },
  { key:"alerts",         label:"Alerts",         icon:"🔔" },
  { key:"partners",       label:"Partners",       icon:"🏦" },
  { key:"disputes",       label:"Disputes",       icon:"⚠️" },
];

export default function App() {
  const [tab, setTab] = useState("performance");
  const [kpis, setKpis] = useState(null);
  useEffect(()=>{ fetch(`${API}/kpis`).then(r=>r.json()).then(setKpis); },[]);

  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif"}}>
      {/* Sidebar */}
      <div style={{width:220,background:S.navy,display:"flex",flexDirection:"column",padding:"20px 0",flexShrink:0}}>
        <div style={{padding:"0 20px 20px",borderBottom:"1px solid #1E3A5F"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,background:S.purple,borderRadius:6,display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff"}}>E</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>Entropy Solutions</div>
              <div style={{fontSize:11,color:"#8898AA"}}>TechOps Platform</div>
            </div>
          </div>
        </div>

        {kpis&&(
          <div style={{padding:"16px 20px",borderBottom:"1px solid #1E3A5F"}}>
            <div style={{fontSize:10,color:"#8898AA",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Last 30 Days</div>
            {[
              {label:"Success Rate",value:pct(kpis.success_rate),alert:kpis.success_rate<90},
              {label:"Volume",value:fmt(kpis.total_volume)},
              {label:"Open Alerts",value:kpis.open_alerts,alert:kpis.open_alerts>0},
              {label:"Recon Exceptions",value:kpis.recon_exceptions,alert:kpis.recon_exceptions>50},
            ].map(k=>(
              <div key={k.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:11,color:"#8898AA"}}>{k.label}</span>
                <span style={{fontSize:12,fontWeight:700,color:k.alert?S.amber:"#fff"}}>{k.value}</span>
              </div>
            ))}
          </div>
        )}

        <nav style={{padding:"12px"}}>
          {TABS.map(t=>(
            <div key={t.key} onClick={()=>setTab(t.key)} style={{
              display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:6,marginBottom:2,
              background:tab===t.key?S.purple:"transparent",cursor:"pointer"}}>
              <span style={{fontSize:14}}>{t.icon}</span>
              <span style={{fontSize:13,fontWeight:tab===t.key?600:400,color:tab===t.key?"#fff":"#8898AA"}}>{t.label}</span>
            </div>
          ))}
        </nav>

        <div style={{marginTop:"auto",padding:"16px 20px",borderTop:"1px solid #1E3A5F"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:S.purple,display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"}}>SC</div>
            <div>
              <div style={{fontSize:12,fontWeight:500,color:"#fff"}}>Surya C.</div>
              <div style={{fontSize:10,color:"#8898AA"}}>Payments Analyst</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,background:S.bgPage,display:"flex",flexDirection:"column"}}>
        <div style={{background:S.bgCard,borderBottom:`1px solid ${S.border}`,padding:"0 28px",
          height:52,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,color:S.textMuted}}>TechOps</span>
          <span style={{color:S.border}}>/</span>
          <span style={{fontSize:13,fontWeight:500,color:S.text}}>{TABS.find(t=>t.key===tab)?.label}</span>
          <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:11,color:S.textDim}}>{new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
            <div style={{width:6,height:6,borderRadius:"50%",background:S.green}}/>
            <span style={{fontSize:11,color:S.green}}>Live</span>
          </div>
        </div>
        <div style={{padding:28,overflowY:"auto",flex:1}}>
          {tab==="performance"    &&<PerformanceTab/>}
          {tab==="reconciliation" &&<ReconciliationTab/>}
          {tab==="alerts"         &&<AlertsTab/>}
          {tab==="partners"       &&<PartnersTab/>}
          {tab==="disputes"       &&<DisputesTab/>}
        </div>
      </div>
    </div>
  );
}
