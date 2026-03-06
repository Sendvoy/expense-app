import { useState, useEffect, useCallback, useContext, createContext, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "ynab-mc-data";
const PREFS_KEY   = "ynab-mc-prefs";
const RATES_KEY   = "ynab-mc-rates";  // { NGN: 1590, EUR: 0.92, ... }  (1 base = X foreign)
const CURRS_KEY   = "ynab-mc-currs";  // ["NGN","EUR",...]  user-enabled currencies

// ─────────────────────────────────────────────────────────────────────────────
// MASTER CURRENCY CATALOGUE  (reference only — never rendered en-masse)
// ─────────────────────────────────────────────────────────────────────────────
const CURRENCIES = {
  USD:{ code:"USD", symbol:"$",   name:"US Dollar",          position:"before", thousands:",",  decimal:".", places:2, flag:"🇺🇸" },
  EUR:{ code:"EUR", symbol:"€",   name:"Euro",                position:"after",  thousands:".",  decimal:",", places:2, flag:"🇪🇺" },
  GBP:{ code:"GBP", symbol:"£",   name:"British Pound",       position:"before", thousands:",",  decimal:".", places:2, flag:"🇬🇧" },
  NGN:{ code:"NGN", symbol:"₦",   name:"Nigerian Naira",      position:"before", thousands:",",  decimal:".", places:2, flag:"🇳🇬" },
  GHS:{ code:"GHS", symbol:"₵",   name:"Ghanaian Cedi",       position:"before", thousands:",",  decimal:".", places:2, flag:"🇬🇭" },
  KES:{ code:"KES", symbol:"KSh", name:"Kenyan Shilling",     position:"before", thousands:",",  decimal:".", places:2, flag:"🇰🇪" },
  ZAR:{ code:"ZAR", symbol:"R",   name:"South African Rand",  position:"before", thousands:" ",  decimal:".", places:2, flag:"🇿🇦" },
  JPY:{ code:"JPY", symbol:"¥",   name:"Japanese Yen",        position:"before", thousands:",",  decimal:".", places:0, flag:"🇯🇵" },
  CNY:{ code:"CNY", symbol:"¥",   name:"Chinese Yuan",        position:"before", thousands:",",  decimal:".", places:2, flag:"🇨🇳" },
  INR:{ code:"INR", symbol:"₹",   name:"Indian Rupee",        position:"before", thousands:",",  decimal:".", places:2, flag:"🇮🇳" },
  CAD:{ code:"CAD", symbol:"CA$", name:"Canadian Dollar",     position:"before", thousands:",",  decimal:".", places:2, flag:"🇨🇦" },
  AUD:{ code:"AUD", symbol:"A$",  name:"Australian Dollar",   position:"before", thousands:",",  decimal:".", places:2, flag:"🇦🇺" },
  BRL:{ code:"BRL", symbol:"R$",  name:"Brazilian Real",      position:"before", thousands:".",  decimal:",", places:2, flag:"🇧🇷" },
  MXN:{ code:"MXN", symbol:"MX$", name:"Mexican Peso",        position:"before", thousands:",",  decimal:".", places:2, flag:"🇲🇽" },
  CHF:{ code:"CHF", symbol:"Fr",  name:"Swiss Franc",         position:"before", thousands:"'",  decimal:".", places:2, flag:"🇨🇭" },
  SEK:{ code:"SEK", symbol:"kr",  name:"Swedish Krona",       position:"after",  thousands:" ",  decimal:",", places:2, flag:"🇸🇪" },
  NOK:{ code:"NOK", symbol:"kr",  name:"Norwegian Krone",     position:"after",  thousands:" ",  decimal:",", places:2, flag:"🇳🇴" },
  AED:{ code:"AED", symbol:"د.إ", name:"UAE Dirham",          position:"after",  thousands:",",  decimal:".", places:2, flag:"🇦🇪" },
  SAR:{ code:"SAR", symbol:"﷼",   name:"Saudi Riyal",         position:"after",  thousands:",",  decimal:".", places:2, flag:"🇸🇦" },
  EGP:{ code:"EGP", symbol:"E£",  name:"Egyptian Pound",      position:"before", thousands:",",  decimal:".", places:2, flag:"🇪🇬" },
  TZS:{ code:"TZS", symbol:"TSh", name:"Tanzanian Shilling",  position:"before", thousands:",",  decimal:".", places:0, flag:"🇹🇿" },
  UGX:{ code:"UGX", symbol:"USh", name:"Ugandan Shilling",    position:"before", thousands:",",  decimal:".", places:0, flag:"🇺🇬" },
  XOF:{ code:"XOF", symbol:"CFA", name:"West African CFA",    position:"after",  thousands:",",  decimal:".", places:0, flag:"🌍" },
  ZMW:{ code:"ZMW", symbol:"ZK",  name:"Zambian Kwacha",      position:"before", thousands:",",  decimal:".", places:2, flag:"🇿🇲" },
  PHP:{ code:"PHP", symbol:"₱",   name:"Philippine Peso",     position:"before", thousands:",",  decimal:".", places:2, flag:"🇵🇭" },
  SGD:{ code:"SGD", symbol:"S$",  name:"Singapore Dollar",    position:"before", thousands:",",  decimal:".", places:2, flag:"🇸🇬" },
  HKD:{ code:"HKD", symbol:"HK$", name:"Hong Kong Dollar",    position:"before", thousands:",",  decimal:".", places:2, flag:"🇭🇰" },
  TWD:{ code:"TWD", symbol:"NT$", name:"Taiwan Dollar",       position:"before", thousands:",",  decimal:".", places:0, flag:"🇹🇼" },
  PKR:{ code:"PKR", symbol:"₨",   name:"Pakistani Rupee",     position:"before", thousands:",",  decimal:".", places:2, flag:"🇵🇰" },
  BDT:{ code:"BDT", symbol:"৳",   name:"Bangladeshi Taka",    position:"before", thousands:",",  decimal:".", places:2, flag:"🇧🇩" },
};
const ALL_CURRENCY_LIST = Object.values(CURRENCIES);

const DATE_FORMATS = [
  { value:"YYYY-MM-DD",  label:"2026-03-05  (ISO)"           },
  { value:"DD/MM/YYYY",  label:"05/03/2026  (UK / Africa)"   },
  { value:"MM/DD/YYYY",  label:"03/05/2026  (US)"            },
  { value:"DD-MM-YYYY",  label:"05-03-2026  (Dashes)"        },
  { value:"DD.MM.YYYY",  label:"05.03.2026  (Dots)"          },
  { value:"D MMM YYYY",  label:"5 Mar 2026  (Short month)"   },
  { value:"D MMMM YYYY", label:"5 March 2026  (Long month)"  },
  { value:"MMMM D, YYYY",label:"March 5, 2026  (US long)"    },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT STATE
// ─────────────────────────────────────────────────────────────────────────────
const defaultPrefs = {
  baseCurrency:   "USD",
  dateFormat:     "DD/MM/YYYY",
  timeFormat:     "12h",
  negativeFormat: "minus",
};

// Default user-enabled currencies (just base + a couple of examples)
const defaultEnabledCurrencies = ["NGN", "EUR"];

// Default rates: 1 USD = X foreign  (base = USD initially)
const defaultRates = {
  NGN: 1590,
  EUR: 0.92,
  GBP: 0.79,
  GHS: 15.2,
  KES: 129,
};

const defaultData = {
  accounts: [
    { id:"a1", name:"Checking",     type:"checking", currency:"USD", balance:3200.00,  onBudget:true },
    { id:"a2", name:"Savings",      type:"savings",  currency:"USD", balance:8500.00,  onBudget:true },
    { id:"a3", name:"Credit Card",  type:"credit",   currency:"USD", balance:-450.00,  onBudget:true },
    { id:"a4", name:"Naira Wallet", type:"checking", currency:"NGN", balance:580000,   onBudget:true },
    { id:"a5", name:"Euro Savings", type:"savings",  currency:"EUR", balance:1200.00,  onBudget:true },
  ],
  categoryGroups: [
    { id:"cg1", name:"Monthly Bills", collapsed:false, categories:[
      { id:"c1", name:"Rent/Mortgage", budgeted:1500, activity:-1500,   goal:{ type:"monthly", amount:1500 } },
      { id:"c2", name:"Electric",      budgeted:120,  activity:-98.50,  goal:{ type:"monthly", amount:120  } },
      { id:"c3", name:"Internet",      budgeted:60,   activity:-59.99,  goal:{ type:"monthly", amount:60   } },
      { id:"c4", name:"Phone",         budgeted:80,   activity:-75.00,  goal:{ type:"monthly", amount:80   } },
    ]},
    { id:"cg2", name:"Everyday Expenses", collapsed:false, categories:[
      { id:"c5", name:"Groceries",      budgeted:400, activity:-287.34, goal:{ type:"monthly", amount:400 } },
      { id:"c6", name:"Dining Out",     budgeted:150, activity:-203.20, goal:{ type:"monthly", amount:150 } },
      { id:"c7", name:"Transportation", budgeted:200, activity:-145.00, goal:null },
      { id:"c8", name:"Personal Care",  budgeted:50,  activity:-32.00,  goal:null },
    ]},
    { id:"cg3", name:"Savings Goals", collapsed:false, categories:[
      { id:"c9",  name:"Emergency Fund", budgeted:300, activity:0, goal:{ type:"target", amount:10000, saved:8500 } },
      { id:"c10", name:"Vacation",       budgeted:200, activity:0, goal:{ type:"target", amount:3000,  saved:800  } },
      { id:"c11", name:"New Car",        budgeted:250, activity:0, goal:{ type:"target", amount:15000, saved:2500 } },
    ]},
    { id:"cg4", name:"Fun Money", collapsed:false, categories:[
      { id:"c12", name:"Entertainment", budgeted:100, activity:-67.00, goal:null },
      { id:"c13", name:"Hobbies",       budgeted:75,  activity:-42.50, goal:null },
      { id:"c14", name:"Clothing",      budgeted:100, activity:0,      goal:null },
    ]},
  ],
  transactions: [
    { id:"t1",  date:"2026-03-01", payee:"Landlord",      categoryId:"c1",  accountId:"a1", currency:"USD", amount:-1500,   amountBase:-1500,   memo:"March rent",       cleared:true  },
    { id:"t2",  date:"2026-03-02", payee:"Whole Foods",   categoryId:"c5",  accountId:"a1", currency:"USD", amount:-87.34,  amountBase:-87.34,  memo:"",                 cleared:true  },
    { id:"t3",  date:"2026-03-03", payee:"Netflix",       categoryId:"c12", accountId:"a3", currency:"USD", amount:-15.99,  amountBase:-15.99,  memo:"",                 cleared:true  },
    { id:"t4",  date:"2026-03-03", payee:"Shell Gas",     categoryId:"c7",  accountId:"a1", currency:"USD", amount:-45.00,  amountBase:-45.00,  memo:"",                 cleared:true  },
    { id:"t5",  date:"2026-03-04", payee:"Chipotle",      categoryId:"c6",  accountId:"a3", currency:"USD", amount:-18.50,  amountBase:-18.50,  memo:"Lunch",            cleared:true  },
    { id:"t6",  date:"2026-03-04", payee:"Employer",      categoryId:null,  accountId:"a1", currency:"USD", amount:2800,    amountBase:2800,    memo:"Paycheck",         cleared:true  },
    { id:"t7",  date:"2026-03-05", payee:"AT&T",          categoryId:"c4",  accountId:"a1", currency:"USD", amount:-75.00,  amountBase:-75.00,  memo:"",                 cleared:false },
    { id:"t8",  date:"2026-03-05", payee:"Trader Joe's",  categoryId:"c5",  accountId:"a1", currency:"USD", amount:-120.00, amountBase:-120.00, memo:"Weekly groceries", cleared:false },
    { id:"t9",  date:"2026-03-02", payee:"Lagos Market",  categoryId:"c5",  accountId:"a4", currency:"NGN", amount:-45000,  amountBase:-28.30,  memo:"Groceries",        cleared:true  },
    { id:"t10", date:"2026-03-03", payee:"DSTV",          categoryId:"c12", accountId:"a4", currency:"NGN", amount:-15000,  amountBase:-9.43,   memo:"Subscription",     cleared:true  },
    { id:"t11", date:"2026-03-04", payee:"European Store",categoryId:"c8",  accountId:"a5", currency:"EUR", amount:-42.00,  amountBase:-45.65,  memo:"Skincare",         cleared:true  },
    { id:"t12", date:"2026-03-01", payee:"EUR Freelance", categoryId:null,  accountId:"a5", currency:"EUR", amount:500,     amountBase:543.48,  memo:"Freelance",        cleared:true  },
  ],
  toBeBudgeted: 1250.00,
  currentMonth: "2026-03",
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────
const load = async (key, fallback) => {
  try { const r = await window.storage.get(key); if (r?.value) return JSON.parse(r.value); } catch {}
  return fallback;
};
const save = async (key, val) => {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSION  — rates = { NGN: 1590, EUR: 0.92 }  meaning 1 base = X foreign
//  • toBase(amount, foreignCode)  → amount in base currency
//  • toForeign(amount, foreignCode) → amount in foreign currency
//  • convert(amount, from, to) → cross-rate via base
// ─────────────────────────────────────────────────────────────────────────────
function makeConverter(base, rates) {
  // Rate of 1 = same as base (base itself has implicit rate of 1)
  const rateOf = (code) => code === base ? 1 : (rates[code] ?? 1);

  // amount in `from` currency → amount in `to` currency
  const convert = (amount, from, to) => {
    if (from === to) return amount;
    const fromRate = rateOf(from); // 1 base = fromRate foreign → 1 foreign = 1/fromRate base
    const toRate   = rateOf(to);
    // amount (from) → base → to
    const inBase = from === base ? amount : amount / fromRate;
    return to === base ? inBase : inBase * toRate;
  };

  return convert;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT
// ─────────────────────────────────────────────────────────────────────────────
function formatAmount(n, currencyCode, negFmt = "minus") {
  const c = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const neg = n < 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(c.places);
  const [intPart, decPart] = fixed.split(".");
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, c.thousands);
  const numStr = c.places > 0 ? `${intFmt}${c.decimal}${decPart}` : intFmt;
  const withSym = c.position === "before" ? `${c.symbol}${numStr}` : `${numStr}\u00A0${c.symbol}`;
  if (!neg) return withSym;
  return negFmt === "parens" ? `(${withSym})` : `-${withSym}`;
}

const SHORT_M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const LONG_M  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function formatDate(iso, fmt) {
  if (!iso) return "";
  const [y,m,d] = iso.split("-");
  const mo = parseInt(m), dy = parseInt(d);
  return fmt.replace("YYYY",y).replace("MM",m.padStart(2,"0")).replace("DD",d.padStart(2,"0"))
    .replace("MMMM",LONG_M[mo-1]).replace("MMM",SHORT_M[mo-1]).replace("D",String(dy)).replace("M",String(mo));
}

function formatTime(t, fmt) {
  if (!t) return "";
  const part = t.includes("T") ? t.split("T")[1] : t;
  const [hh,mm] = part.split(":");
  const h = parseInt(hh);
  if (fmt === "24h") return `${String(h).padStart(2,"0")}:${mm}`;
  return `${h % 12 || 12}:${mm} ${h >= 12 ? "PM" : "AM"}`;
}

const uid        = () => Math.random().toString(36).slice(2,10);
const MONTHS_L   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const parseMonth = (m) => { const [y,mo] = m.split("-"); return { year:parseInt(y), month:parseInt(mo)-1 }; };
const fmtMonth   = (m) => { const {year,month} = parseMonth(m); return `${MONTHS_L[month]} ${year}`; };
const availColor = v => v > 0 ? "#16a34a" : v < 0 ? "#dc2626" : "#6b7280";

// Style atoms
const lbl  = { display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:4 };
const inp  = { width:"100%", padding:"8px 10px", border:"1px solid #e2e8f0", borderRadius:6, fontSize:14, outline:"none", boxSizing:"border-box" };
const thSt = (align="left",mw) => ({ padding:"10px 16px", textAlign:align, fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:".8px", borderBottom:"2px solid #e2e8f0", ...(mw ? {minWidth:mw} : {}) });

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
const AppCtx = createContext({});
function useApp() { return useContext(AppCtx); }

// Small currency pill badge
function CurrBadge({ code, size=11 }) {
  const c = CURRENCIES[code] || CURRENCIES.USD;
  return (
    <span style={{ background:"#e0f2fe", color:"#0369a1", padding:"1px 6px", borderRadius:8, fontSize:size, fontWeight:700, letterSpacing:.3, whiteSpace:"nowrap" }}>
      {c.flag} {code}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, accounts, onAddAccount, onSettings }) {
  const { prefs, rates, enabledCurrencies } = useApp();
  const base    = prefs.baseCurrency;
  const convert = makeConverter(base, rates);

  const netWorth = accounts.reduce((s,a) => s + convert(a.balance, a.currency, base), 0);

  // Per-currency totals for the footer
  const byCurrency = useMemo(() => {
    const map = {};
    accounts.forEach(a => { map[a.currency] = (map[a.currency] || 0) + a.balance; });
    return Object.entries(map);
  }, [accounts]);

  const nav = [
    { id:"budget",   icon:"📊", label:"Budget"       },
    { id:"accounts", icon:"🏦", label:"All Accounts"  },
    { id:"reports",  icon:"📈", label:"Reports"       },
  ];

  const navBtn = (id, icon, label) => (
    <button key={id} onClick={() => setView(id)} style={{
      width:"100%", textAlign:"left", padding:"9px 16px", border:"none", cursor:"pointer",
      background: view===id ? "#2d4a6e" : "transparent",
      color: view===id ? "#fff" : "#94a3b8",
      fontFamily:"inherit", fontSize:13, fontWeight: view===id ? 600 : 400,
      borderLeft: view===id ? "3px solid #3b82f6" : "3px solid transparent",
      display:"flex", alignItems:"center", gap:8, transition:"all .12s"
    }}>
      <span>{icon}</span>{label}
    </button>
  );

  return (
    <aside style={{ width:232, minWidth:232, background:"#1a2537", display:"flex", flexDirection:"column", height:"100vh", overflowY:"auto", flexShrink:0 }}>
      <div style={{ padding:"18px 16px 10px", borderBottom:"1px solid #2d3f55" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:30, height:30, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color:"#fff", fontWeight:800, fontSize:14 }}>M</span>
          </div>
          <div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>MyBudget</div>
            <div style={{ color:"#64748b", fontSize:10 }}>Base: {CURRENCIES[base]?.flag} {base}</div>
          </div>
        </div>
      </div>

      <nav style={{ padding:"8px 0", flex:1 }}>
        {nav.map(n => navBtn(n.id, n.icon, n.label))}

        <div style={{ padding:"14px 16px 4px", color:"#64748b", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
          Accounts
        </div>

        {accounts.filter(a=>a.onBudget).map(acc => {
          const inBase = convert(acc.balance, acc.currency, base);
          const active = view === "account-"+acc.id;
          return (
            <button key={acc.id} onClick={() => setView("account-"+acc.id)} style={{
              width:"100%", textAlign:"left", padding:"8px 16px", border:"none", cursor:"pointer",
              background: active ? "#2d4a6e" : "transparent",
              color: active ? "#fff" : "#94a3b8",
              fontFamily:"inherit", fontSize:12,
              borderLeft: active ? "3px solid #3b82f6" : "3px solid transparent",
              display:"flex", flexDirection:"column", gap:2
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:active?600:400 }}>{acc.name}</span>
                <span style={{ fontSize:9, background:"#2d3f55", padding:"1px 5px", borderRadius:4, color:"#94a3b8" }}>{acc.currency}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:11, color: acc.balance>=0 ? "#4ade80" : "#f87171" }}>
                  {formatAmount(acc.balance, acc.currency)}
                </span>
                {acc.currency !== base && (
                  <span style={{ fontSize:10, color:"#64748b" }}>≈ {formatAmount(inBase, base)}</span>
                )}
              </div>
            </button>
          );
        })}

        <button onClick={onAddAccount} style={{ width:"100%", textAlign:"left", padding:"6px 16px", border:"none", cursor:"pointer", background:"transparent", color:"#3b82f6", fontFamily:"inherit", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
          + Add Account
        </button>
      </nav>

      <div style={{ padding:"0 0 4px" }}>
        {navBtn("settings","⚙️","Settings")}
      </div>

      <div style={{ padding:"12px 16px", borderTop:"1px solid #2d3f55" }}>
        <div style={{ color:"#64748b", fontSize:10, marginBottom:2 }}>Net Worth in {base}</div>
        <div style={{ color:"#fff", fontWeight:700, fontSize:16, marginBottom:6 }}>{formatAmount(netWorth, base)}</div>
        {byCurrency.map(([code, bal]) => (
          <div key={code} style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#64748b", marginBottom:1 }}>
            <span>{CURRENCIES[code]?.flag} {code}</span>
            <span style={{ color: bal>=0 ? "#4ade80" : "#f87171" }}>{formatAmount(bal, code)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET VIEW
// ─────────────────────────────────────────────────────────────────────────────
function BudgetView({ data, setData }) {
  const { prefs, rates } = useApp();
  const base    = prefs.baseCurrency;
  const convert = makeConverter(base, rates);

  const [editCell, setEditCell] = useState(null);
  const [editVal,  setEditVal]  = useState("");
  const [showGoal, setShowGoal] = useState(null);
  const [curMonth, setCurMonth] = useState(data.currentMonth);

  const allCats       = data.categoryGroups.flatMap(g => g.categories);
  const totalBudgeted = allCats.reduce((s,c) => s+c.budgeted, 0);
  const totalActivity = allCats.reduce((s,c) => s+c.activity, 0);

  const onBudget = (gId, cId, val) => {
    const num = parseFloat(val) || 0;
    const old = data.categoryGroups.find(g=>g.id===gId)?.categories.find(c=>c.id===cId)?.budgeted || 0;
    setData(d => ({ ...d, toBeBudgeted: d.toBeBudgeted + old - num,
      categoryGroups: d.categoryGroups.map(g => g.id===gId
        ? { ...g, categories: g.categories.map(c => c.id===cId ? {...c, budgeted:num} : c) } : g)
    }));
  };

  const toggleGroup = id => setData(d => ({...d, categoryGroups: d.categoryGroups.map(g => g.id===id ? {...g,collapsed:!g.collapsed} : g)}));
  const navMonth = dir => {
    const {year,month} = parseMonth(curMonth);
    const nd = new Date(year, month+dir);
    setCurMonth(`${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,"0")}`);
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#f8fafc" }}>
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => navMonth(-1)} style={{ border:"1px solid #e2e8f0", background:"#fff", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:14 }}>‹</button>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:"#1e293b", minWidth:180, textAlign:"center" }}>{fmtMonth(curMonth)}</h2>
          <button onClick={() => navMonth(1)} style={{ border:"1px solid #e2e8f0", background:"#fff", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:14 }}>›</button>
        </div>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          <div style={{ fontSize:11, color:"#64748b", background:"#f1f5f9", padding:"4px 10px", borderRadius:6 }}>
            Budget in <strong>{base}</strong> · <CurrBadge code={base} />
          </div>
          {[["To Be Budgeted", data.toBeBudgeted, true], ["Budgeted", totalBudgeted, false], ["Activity", totalActivity, false]].map(([l,v,h]) => (
            <div key={l} style={{ textAlign:"center", padding:"4px 14px", background: h?(v>=0?"#dcfce7":"#fee2e2"):"transparent", borderRadius:8 }}>
              <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:800, color: h?(v>=0?"#16a34a":"#dc2626"):"#1e293b" }}>{formatAmount(v, base, prefs.negativeFormat)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", paddingBottom:40 }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#f1f5f9", position:"sticky", top:0, zIndex:5 }}>
              <th style={thSt("left",260)}>CATEGORY</th>
              <th style={thSt("right")}>BUDGETED ({base})</th>
              <th style={thSt("right")}>ACTIVITY ({base})</th>
              <th style={thSt("right")}>AVAILABLE</th>
              <th style={thSt("center",80)}>GOAL</th>
            </tr>
          </thead>
          <tbody>
            {data.categoryGroups.map(group => {
              const gB = group.categories.reduce((s,c)=>s+c.budgeted, 0);
              const gA = group.categories.reduce((s,c)=>s+c.activity, 0);
              const gV = group.categories.reduce((s,c)=>s+(c.budgeted+c.activity), 0);
              return [
                <tr key={group.id} style={{ background:"#e8f0fe", cursor:"pointer" }} onClick={() => toggleGroup(group.id)}>
                  <td style={{ padding:"8px 16px", fontWeight:700, fontSize:13, color:"#1e40af", display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:10 }}>{group.collapsed ? "▶" : "▼"}</span>{group.name}
                  </td>
                  <td style={{ padding:"8px 16px", textAlign:"right", fontSize:13, fontWeight:600 }}>{formatAmount(gB, base)}</td>
                  <td style={{ padding:"8px 16px", textAlign:"right", fontSize:13 }}>{formatAmount(gA, base)}</td>
                  <td style={{ padding:"8px 16px", textAlign:"right", fontSize:13, fontWeight:600, color:availColor(gV) }}>{formatAmount(gV, base)}</td>
                  <td/>
                </tr>,
                ...(!group.collapsed ? group.categories.map(cat => {
                  const avail = cat.budgeted + cat.activity;
                  const isEd = editCell?.catId === cat.id;
                  return (
                    <tr key={cat.id} style={{ borderBottom:"1px solid #f1f5f9" }}
                      onMouseEnter={e => e.currentTarget.style.background="#fafbff"}
                      onMouseLeave={e => e.currentTarget.style.background=""}>
                      <td style={{ padding:"8px 16px 8px 32px", fontSize:13, color:"#374151" }}>{cat.name}</td>
                      <td style={{ padding:"6px 16px", textAlign:"right" }}>
                        {isEd
                          ? <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                              onBlur={() => { onBudget(group.id, cat.id, editVal); setEditCell(null); }}
                              onKeyDown={e => { if (e.key==="Enter"||e.key==="Tab") { onBudget(group.id, cat.id, editVal); setEditCell(null); }}}
                              style={{ width:90, textAlign:"right", border:"2px solid #3b82f6", borderRadius:4, padding:"2px 6px", fontSize:13, outline:"none" }} />
                          : <span onClick={() => { setEditCell({groupId:group.id,catId:cat.id}); setEditVal(String(cat.budgeted)); }}
                              style={{ cursor:"pointer", padding:"2px 6px", borderRadius:4, fontSize:13, color:"#374151", fontWeight:500 }}>
                              {formatAmount(cat.budgeted, base, prefs.negativeFormat)}
                            </span>
                        }
                      </td>
                      <td style={{ padding:"8px 16px", textAlign:"right", fontSize:13, color: cat.activity<0?"#dc2626":"#374151" }}>{formatAmount(cat.activity, base, prefs.negativeFormat)}</td>
                      <td style={{ padding:"8px 16px", textAlign:"right" }}>
                        <span style={{ fontWeight:600, fontSize:13, color:availColor(avail), background: avail<0?"#fee2e2":avail>0?"#dcfce7":"#f3f4f6", padding:"2px 8px", borderRadius:12 }}>
                          {formatAmount(avail, base, prefs.negativeFormat)}
                        </span>
                      </td>
                      <td style={{ padding:"8px 16px", textAlign:"center" }}>
                        <button onClick={() => setShowGoal(cat)} style={{ border:"none", background: cat.goal?"#3b82f6":"#e2e8f0", color: cat.goal?"#fff":"#94a3b8", borderRadius:4, padding:"2px 8px", fontSize:11, cursor:"pointer" }}>
                          {cat.goal ? "✓ Goal" : "+ Goal"}
                        </button>
                      </td>
                    </tr>
                  );
                }) : [])
              ];
            })}
          </tbody>
        </table>
      </div>

      {showGoal && (
        <GoalModal cat={showGoal} base={base} onClose={() => setShowGoal(null)}
          onSave={goal => { setData(d => ({...d, categoryGroups: d.categoryGroups.map(g => ({...g, categories: g.categories.map(c => c.id===showGoal.id ? {...c,goal} : c)}))})); setShowGoal(null); }} />
      )}
    </div>
  );
}

function GoalModal({ cat, base, onClose, onSave }) {
  const [type,  setType]  = useState(cat.goal?.type || "monthly");
  const [amount,setAmount]= useState(String(cat.goal?.amount || ""));
  const [saved, setSaved] = useState(String(cat.goal?.saved || "0"));
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
      <div style={{ background:"#fff", borderRadius:12, padding:28, width:380, boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
        <h3 style={{ margin:"0 0 4px", color:"#1e293b" }}>Set Goal — {cat.name}</h3>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:16 }}>Amounts in {base}</div>
        <div style={{ marginBottom:12 }}><label style={lbl}>Goal Type</label>
          <select value={type} onChange={e => setType(e.target.value)} style={inp}>
            <option value="monthly">Monthly Funding Goal</option>
            <option value="target">Savings Target</option>
          </select>
        </div>
        <div style={{ marginBottom:12 }}><label style={lbl}>{type==="monthly"?"Monthly Amount":"Target Amount"} ({base})</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} type="number" style={inp} placeholder="0.00" />
        </div>
        {type==="target" && (
          <div style={{ marginBottom:12 }}><label style={lbl}>Already Saved ({base})</label>
            <input value={saved} onChange={e => setSaved(e.target.value)} type="number" style={inp} placeholder="0.00" />
          </div>
        )}
        <div style={{ display:"flex", gap:8, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", border:"1px solid #e2e8f0", borderRadius:8, cursor:"pointer", background:"#fff" }}>Cancel</button>
          {cat.goal && <button onClick={() => onSave(null)} style={{ padding:"10px 16px", border:"none", borderRadius:8, cursor:"pointer", background:"#fee2e2", color:"#dc2626" }}>Remove</button>}
          <button onClick={() => onSave({ type, amount:parseFloat(amount)||0, ...(type==="target"?{saved:parseFloat(saved)||0}:{}) })}
            style={{ flex:1, padding:"10px", border:"none", borderRadius:8, cursor:"pointer", background:"#3b82f6", color:"#fff", fontWeight:600 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT / TRANSACTIONS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function AccountView({ data, setData, accountId }) {
  const { prefs, rates, enabledCurrencies } = useApp();
  const base    = prefs.baseCurrency;
  const convert = makeConverter(base, rates);

  const account      = accountId ? data.accounts.find(a => a.id===accountId) : null;
  const acctCurrency = account?.currency || base;

  const emptyForm = { date: new Date().toISOString().slice(0,10), payee:"", categoryId:"", accountId: accountId||"", currency: acctCurrency, amount:"", memo:"", cleared:false };
  const [showAdd,    setShowAdd]    = useState(false);
  const [form,       setForm]       = useState(emptyForm);
  const [search,     setSearch]     = useState("");
  const [sortField,  setSortField]  = useState("date");
  const [sortDir,    setSortDir]    = useState(-1);
  const [filterCurr, setFilterCurr] = useState("ALL");

  // Sync form currency when account changes
  useEffect(() => {
    const acc = data.accounts.find(a => a.id===form.accountId);
    if (acc) setForm(f => ({...f, currency: acc.currency}));
  }, [form.accountId]);

  const allCats = data.categoryGroups.flatMap(g => g.categories);

  const presentCurrencies = useMemo(() => {
    const txs = data.transactions.filter(t => accountId ? t.accountId===accountId : true);
    return ["ALL", ...new Set(txs.map(t => t.currency))];
  }, [data.transactions, accountId]);

  const txs = useMemo(() => data.transactions
    .filter(t => accountId ? t.accountId===accountId : true)
    .filter(t => filterCurr==="ALL" || t.currency===filterCurr)
    .filter(t => !search || t.payee.toLowerCase().includes(search.toLowerCase()) || (t.memo||"").toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      let av=a[sortField], bv=b[sortField];
      if (sortField==="date") { av=new Date(av); bv=new Date(bv); }
      return sortDir * (av>bv?1:av<bv?-1:0);
    }), [data.transactions, accountId, filterCurr, search, sortField, sortDir]);

  // Currency summary cards
  const currencySummary = useMemo(() => {
    const map = {};
    txs.forEach(t => {
      if (!map[t.currency]) map[t.currency] = { code:t.currency, total:0, count:0 };
      map[t.currency].total += t.amount;
      map[t.currency].count++;
    });
    return Object.values(map);
  }, [txs]);

  const totalInBase = txs.reduce((s,t) => s + (t.amountBase || 0), 0);

  const addTx = () => {
    const acc = data.accounts.find(a => a.id===form.accountId);
    if (!form.payee || !acc) return;
    const amt     = parseFloat(form.amount) || 0;
    const amtBase = convert(amt, acc.currency, base);
    const tx = { ...form, id:uid(), amount:amt, amountBase:amtBase, currency:acc.currency };
    setData(d => ({
      ...d,
      transactions: [tx, ...d.transactions],
      accounts: d.accounts.map(a => a.id===acc.id ? {...a, balance: a.balance+amt} : a),
    }));
    setShowAdd(false);
    setForm(emptyForm);
  };

  const deleteTx = id => {
    const tx = data.transactions.find(t => t.id===id); if (!tx) return;
    setData(d => ({
      ...d,
      transactions: d.transactions.filter(t => t.id!==id),
      accounts: d.accounts.map(a => a.id===tx.accountId ? {...a, balance: a.balance-tx.amount} : a),
    }));
  };

  const toggleCleared = id => setData(d => ({...d, transactions: d.transactions.map(t => t.id===id ? {...t, cleared:!t.cleared} : t)}));
  const sortBy = f => { if (sortField===f) setSortDir(d=>-d); else { setSortField(f); setSortDir(-1); } };
  const arr    = f => sortField===f ? (sortDir>0?"↑":"↓") : "";

  // currencies available in the dropdown for new transactions (enabled + this account's currency)
  const availCurrencies = [base, ...enabledCurrencies].filter((v,i,a)=>a.indexOf(v)===i);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#f8fafc" }}>
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"14px 24px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:"#1e293b" }}>{account ? account.name : "All Accounts"}</h2>
            {account && <CurrBadge code={account.currency} size={12} />}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..."
              style={{ border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 12px", fontSize:13, outline:"none", width:180 }} />
            <button onClick={() => setShowAdd(v=>!v)} style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:13, cursor:"pointer" }}>
              + Add Transaction
            </button>
          </div>
        </div>

        {/* Currency summary chips */}
        {currencySummary.length > 0 && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom: presentCurrencies.length>2 ? 8 : 0 }}>
            {currencySummary.map(s => (
              <div key={s.code} onClick={() => setFilterCurr(filterCurr===s.code?"ALL":s.code)}
                style={{ background: filterCurr===s.code?"#eff6ff":"#f8fafc", border:`1px solid ${filterCurr===s.code?"#93c5fd":"#e2e8f0"}`, borderRadius:8, padding:"6px 12px", cursor:"pointer" }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#64748b", marginBottom:2 }}>{CURRENCIES[s.code]?.flag} {s.code} · {s.count} tx</div>
                <div style={{ fontSize:13, fontWeight:700, color: s.total>=0?"#16a34a":"#dc2626" }}>{formatAmount(s.total, s.code)}</div>
                {s.code !== base && <div style={{ fontSize:10, color:"#94a3b8" }}>≈ {formatAmount(convert(s.total,s.code,base), base)}</div>}
              </div>
            ))}
            {currencySummary.length > 1 && (
              <div style={{ background:"#f1f5f9", borderRadius:8, padding:"6px 12px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#64748b", marginBottom:2 }}>ALL · in {base}</div>
                <div style={{ fontSize:13, fontWeight:700, color: totalInBase>=0?"#16a34a":"#dc2626" }}>{formatAmount(totalInBase, base)}</div>
              </div>
            )}
          </div>
        )}

        {/* Currency filter tabs */}
        {presentCurrencies.length > 2 && (
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {presentCurrencies.map(c => (
              <button key={c} onClick={() => setFilterCurr(c)} style={{ padding:"3px 10px", border:"none", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:600, background: filterCurr===c?"#3b82f6":"#e2e8f0", color: filterCurr===c?"#fff":"#374151" }}>
                {c==="ALL" ? "All Currencies" : `${CURRENCIES[c]?.flag||""} ${c}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add transaction row */}
      {showAdd && (
        <div style={{ background:"#eff6ff", borderBottom:"2px solid #bfdbfe", padding:"12px 24px", display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
          <FLD label="Date"><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp} /></FLD>
          <FLD label="Payee"><input value={form.payee} onChange={e=>setForm(f=>({...f,payee:e.target.value}))} placeholder="Payee name" style={{...inp,width:150}} /></FLD>
          <FLD label="Account">
            <select value={form.accountId} onChange={e=>setForm(f=>({...f,accountId:e.target.value}))} style={inp}>
              <option value="">Select account…</option>
              {data.accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </FLD>
          <FLD label={`Amount (${form.currency||"—"})`}>
            <div style={{ position:"relative" }}>
              <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" style={{...inp,width:120,paddingRight:40}} />
              <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:11, fontWeight:700, color:"#94a3b8" }}>{form.currency}</span>
            </div>
            {form.currency && form.currency!==base && form.amount && (
              <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>
                ≈ {formatAmount(convert(parseFloat(form.amount)||0, form.currency, base), base)}
              </div>
            )}
          </FLD>
          <FLD label="Category">
            <select value={form.categoryId} onChange={e=>setForm(f=>({...f,categoryId:e.target.value}))} style={inp}>
              <option value="">Uncategorized</option>
              {data.categoryGroups.map(g=>(
                <optgroup key={g.id} label={g.name}>
                  {g.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </FLD>
          <FLD label="Memo"><input value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} placeholder="Optional" style={{...inp,width:120}} /></FLD>
          <div style={{ display:"flex", gap:8, paddingBottom:1 }}>
            <button onClick={addTx} style={{ background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontWeight:600,cursor:"pointer" }}>Save</button>
            <button onClick={()=>setShowAdd(false)} style={{ background:"#fff",color:"#374151",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 16px",cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex:1, overflowY:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#f1f5f9", position:"sticky", top:0, zIndex:5 }}>
              <th style={thSt("center",40)}>✓</th>
              <th style={{...thSt("left"),cursor:"pointer"}} onClick={()=>sortBy("date")}>DATE {arr("date")}</th>
              <th style={{...thSt("left"),cursor:"pointer"}} onClick={()=>sortBy("payee")}>PAYEE {arr("payee")}</th>
              {!accountId && <th style={thSt("left")}>ACCOUNT</th>}
              <th style={thSt("left")}>CATEGORY</th>
              <th style={thSt("left")}>MEMO</th>
              <th style={thSt("right")}>ORIGINAL</th>
              <th style={thSt("right")}>IN {base}</th>
              <th style={thSt("center",40)}></th>
            </tr>
          </thead>
          <tbody>
            {txs.map(tx => {
              const cat = allCats.find(c=>c.id===tx.categoryId);
              const acc = data.accounts.find(a=>a.id===tx.accountId);
              const isDiff = tx.currency !== base;
              return (
                <tr key={tx.id} style={{ borderBottom:"1px solid #f1f5f9" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#f8faff"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{ textAlign:"center",padding:"8px" }}>
                    <button onClick={()=>toggleCleared(tx.id)} style={{ border:"none",background:"transparent",cursor:"pointer",fontSize:15,color:tx.cleared?"#16a34a":"#d1d5db" }}>{tx.cleared?"●":"○"}</button>
                  </td>
                  <td style={{ padding:"8px 16px",fontSize:13,color:"#374151",whiteSpace:"nowrap" }}>{formatDate(tx.date, prefs.dateFormat)}</td>
                  <td style={{ padding:"8px 16px",fontSize:13,fontWeight:500,color:"#1e293b" }}>{tx.payee}</td>
                  {!accountId && (
                    <td style={{ padding:"8px 16px",fontSize:12,color:"#64748b" }}>
                      <div>{acc?.name||"—"}</div>
                      {acc && <CurrBadge code={acc.currency} size={10}/>}
                    </td>
                  )}
                  <td style={{ padding:"8px 16px",fontSize:12 }}>
                    {cat
                      ? <span style={{ background:"#e0f2fe",color:"#0369a1",padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:600 }}>{cat.name}</span>
                      : <span style={{ color:"#94a3b8",fontSize:12 }}>Uncategorized</span>}
                  </td>
                  <td style={{ padding:"8px 16px",fontSize:12,color:"#64748b" }}>{tx.memo}</td>
                  <td style={{ padding:"8px 16px",textAlign:"right" }}>
                    <div style={{ fontWeight:600,fontSize:13,color:tx.amount>=0?"#16a34a":"#dc2626" }}>
                      {formatAmount(tx.amount, tx.currency, prefs.negativeFormat)}
                    </div>
                    {isDiff && <div style={{ fontSize:10,marginTop:1 }}><CurrBadge code={tx.currency} size={9}/></div>}
                  </td>
                  <td style={{ padding:"8px 16px",textAlign:"right" }}>
                    {isDiff
                      ? <span style={{ fontSize:12,color:"#64748b" }}>≈ {formatAmount(tx.amountBase||0, base, prefs.negativeFormat)}</span>
                      : <span style={{ fontSize:12,color:"#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ padding:"8px",textAlign:"center" }}>
                    <button onClick={()=>deleteTx(tx.id)} style={{ border:"none",background:"transparent",cursor:"pointer",color:"#d1d5db",fontSize:14 }}>✕</button>
                  </td>
                </tr>
              );
            })}
            {txs.length===0 && <tr><td colSpan={9} style={{ padding:"40px",textAlign:"center",color:"#94a3b8",fontSize:14 }}>No transactions found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FLD({ label, children }) {
  return <div><label style={{...lbl,marginBottom:3}}>{label}</label>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────
function ReportsView({ data }) {
  const { prefs, rates, enabledCurrencies } = useApp();
  const base    = prefs.baseCurrency;
  const convert = makeConverter(base, rates);
  const [tab,      setTab]      = useState("spending");
  const [viewCurr, setViewCurr] = useState("ALL");

  const allCats = data.categoryGroups.flatMap(g => g.categories);
  const presentCurrencies = useMemo(() => [...new Set(data.transactions.map(t=>t.currency))], [data.transactions]);

  const filteredTxs = useMemo(() =>
    viewCurr==="ALL" ? data.transactions : data.transactions.filter(t=>t.currency===viewCurr),
    [data.transactions, viewCurr]);

  // Effective amount in display currency
  const effAmt = tx => {
    if (viewCurr==="ALL") return tx.amountBase || 0;
    if (tx.currency===viewCurr) return tx.amount;
    return convert(tx.amountBase||0, base, viewCurr);
  };
  const displayCurr = viewCurr==="ALL" ? base : viewCurr;

  const spendByCat = useMemo(() => {
    const map = {};
    filteredTxs.filter(t=>t.amount<0&&t.categoryId).forEach(t=>{
      const cat = allCats.find(c=>c.id===t.categoryId); if(!cat) return;
      if(!map[cat.id]) map[cat.id]={name:cat.name,value:0};
      map[cat.id].value += Math.abs(effAmt(t));
    });
    return Object.values(map).sort((a,b)=>b.value-a.value);
  }, [filteredTxs, viewCurr]);

  const totalSpent  = spendByCat.reduce((s,c)=>s+c.value,0);
  const totalIncome = filteredTxs.filter(t=>t.amount>0).reduce((s,t)=>s+effAmt(t),0);
  const totalBudgeted = allCats.reduce((s,c)=>s+c.budgeted,0);

  const byCurrency = useMemo(() => {
    const map = {};
    data.transactions.forEach(t=>{
      if(!map[t.currency]) map[t.currency]={code:t.currency,income:0,expense:0,count:0};
      if(t.amount>0) map[t.currency].income+=t.amount; else map[t.currency].expense+=Math.abs(t.amount);
      map[t.currency].count++;
    });
    return Object.values(map);
  }, [data.transactions]);

  const nwHist = [{m:"Oct",v:9200},{m:"Nov",v:9800},{m:"Dec",v:10100},{m:"Jan",v:10600},{m:"Feb",v:11200},{m:"Mar",v:11250}];
  const maxNW = Math.max(...nwHist.map(n=>n.v));
  const COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];

  const tabs = [
    {id:"spending","label":"Spending"},
    {id:"income-expense","label":"Income vs Expense"},
    {id:"by-currency","label":"By Currency"},
    {id:"net-worth","label":"Net Worth"},
  ];

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#f8fafc" }}>
      <div style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 24px",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
          <h2 style={{ margin:0,fontSize:20,fontWeight:800,color:"#1e293b" }}>Reports</h2>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:12,color:"#64748b",fontWeight:600 }}>View in:</span>
            <select value={viewCurr} onChange={e=>setViewCurr(e.target.value)}
              style={{ border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 10px",fontSize:13,outline:"none",background:"#fff",cursor:"pointer" }}>
              <option value="ALL">All — unified in {base}</option>
              {presentCurrencies.map(c=><option key={c} value={c}>{CURRENCIES[c]?.flag} {c} — {CURRENCIES[c]?.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:"flex",gap:4 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"6px 16px",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,background:tab===t.id?"#3b82f6":"#f1f5f9",color:tab===t.id?"#fff":"#374151" }}>
              {t.label}
            </button>
          ))}
        </div>
        {viewCurr!=="ALL"&&(
          <div style={{ marginTop:8,background:"#fef9c3",border:"1px solid #fde68a",borderRadius:6,padding:"6px 12px",fontSize:12,color:"#854d0e" }}>
            ⚠ Showing only {viewCurr} transactions. Switch to "All" for unified totals.
          </div>
        )}
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:24 }}>

        {/* SPENDING */}
        {tab==="spending"&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
            <div style={{ background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
                <h3 style={{ margin:0,fontSize:15,fontWeight:700,color:"#1e293b" }}>Spending by Category</h3>
                <CurrBadge code={displayCurr}/>
              </div>
              <div style={{ marginBottom:10,fontSize:12,color:"#64748b" }}>Total: <strong style={{ color:"#dc2626" }}>{formatAmount(totalSpent,displayCurr)}</strong></div>
              {spendByCat.length===0 && <div style={{ color:"#94a3b8",fontSize:13,padding:"16px 0" }}>No spending data for this view.</div>}
              {spendByCat.slice(0,10).map((c,i)=>(
                <div key={c.name} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:3 }}>
                    <span style={{ color:"#374151" }}>{c.name}</span>
                    <span style={{ fontWeight:600,color:"#dc2626" }}>{formatAmount(c.value,displayCurr)}</span>
                  </div>
                  <div style={{ height:8,background:"#f1f5f9",borderRadius:4,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:totalSpent>0?`${Math.min(100,(c.value/totalSpent)*100)}%`:"0%",background:COLORS[i%COLORS.length],borderRadius:4,transition:"width .4s" }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
                <h3 style={{ margin:0,fontSize:15,fontWeight:700,color:"#1e293b" }}>Budget vs Actual</h3>
                <CurrBadge code={base}/>
              </div>
              <div style={{ fontSize:11,color:"#94a3b8",marginBottom:12 }}>Budget targets always in {base}</div>
              {allCats.filter(c=>c.budgeted>0||c.activity!==0).slice(0,8).map(c=>{
                const spent=Math.abs(c.activity),pct=c.budgeted>0?(spent/c.budgeted)*100:0,over=pct>100;
                return (
                  <div key={c.id} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:3 }}>
                      <span style={{ color:"#374151" }}>{c.name}</span>
                      <span style={{ color:over?"#dc2626":"#16a34a",fontWeight:600 }}>{formatAmount(spent,base)} / {formatAmount(c.budgeted,base)}</span>
                    </div>
                    <div style={{ height:8,background:"#f1f5f9",borderRadius:4,overflow:"hidden" }}>
                      <div style={{ height:"100%",width:`${Math.min(100,pct)}%`,background:over?"#ef4444":"#10b981",borderRadius:4 }} />
                    </div>
                    {over&&<div style={{ fontSize:11,color:"#dc2626",marginTop:2 }}>⚠ Over by {formatAmount(spent-c.budgeted,base)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INCOME VS EXPENSE */}
        {tab==="income-expense"&&(
          <div style={{ background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.06)",maxWidth:720 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
              <h3 style={{ margin:0,fontSize:15,fontWeight:700,color:"#1e293b" }}>Income vs Expenses</h3>
              <CurrBadge code={displayCurr}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:28 }}>
              {[["💰 Income",totalIncome,"#16a34a"],["💸 Spent",totalSpent,"#dc2626"],["📈 Saved",totalIncome-totalSpent,(totalIncome-totalSpent)>=0?"#3b82f6":"#dc2626"]].map(([l,v,c])=>(
                <div key={l} style={{ background:"#f8fafc",borderRadius:10,padding:16,borderLeft:`4px solid ${c}` }}>
                  <div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:6 }}>{l}</div>
                  <div style={{ fontSize:22,fontWeight:800,color:c }}>{formatAmount(v,displayCurr)}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:10,alignItems:"flex-end",height:200,borderBottom:"2px solid #e2e8f0" }}>
              {[{label:"Income",value:totalIncome,color:"#10b981"},{label:"Budgeted",value:totalBudgeted,color:"#3b82f6"},{label:"Actual",value:totalSpent,color:"#ef4444"}].map(bar=>{
                const mx=Math.max(totalIncome,totalBudgeted,totalSpent,1);
                return (
                  <div key={bar.label} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:bar.color }}>{formatAmount(bar.value,displayCurr)}</div>
                    <div style={{ width:"55%",height:`${(bar.value/mx)*160}px`,background:bar.color,borderRadius:"4px 4px 0 0",minHeight:4 }} />
                    <div style={{ fontSize:12,color:"#64748b" }}>{bar.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BY CURRENCY */}
        {tab==="by-currency"&&(
          <div>
            <div style={{ marginBottom:16 }}>
              <h3 style={{ margin:"0 0 4px",fontSize:16,fontWeight:700,color:"#1e293b" }}>Breakdown by Currency</h3>
              <p style={{ margin:0,fontSize:13,color:"#64748b" }}>Each currency reported natively, with equivalent in {base}.</p>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16,marginBottom:24 }}>
              {byCurrency.map((b,i)=>{
                const net=b.income-b.expense;
                const inBaseInc=convert(b.income,b.code,base);
                const inBaseExp=convert(b.expense,b.code,base);
                const inBaseNet=convert(net,b.code,base);
                const cc=CURRENCIES[b.code]||CURRENCIES.USD;
                const rate = b.code===base ? null : rates[b.code];
                return (
                  <div key={b.code} style={{ background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 6px rgba(0,0,0,.07)",borderTop:`4px solid ${COLORS[i%COLORS.length]}` }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
                      <span style={{ fontSize:24 }}>{cc.flag}</span>
                      <div>
                        <div style={{ fontWeight:700,fontSize:15,color:"#1e293b" }}>{cc.name}</div>
                        <div style={{ fontSize:11,color:"#64748b" }}>{b.code} · {b.count} transactions</div>
                        {rate&&<div style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>1 {base} = {formatAmount(rate,b.code)} {b.code}</div>}
                      </div>
                    </div>
                    {[["Income",b.income,inBaseInc,"#16a34a"],["Expenses",b.expense,inBaseExp,"#dc2626"],["Net",net,inBaseNet,net>=0?"#3b82f6":"#dc2626"]].map(([l,n,nb,col])=>(
                      <div key={l} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f1f5f9" }}>
                        <span style={{ fontSize:12,color:"#64748b",fontWeight:600 }}>{l}</span>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontWeight:700,fontSize:13,color:col }}>{formatAmount(l==="Expenses"?-n:n,b.code)}</div>
                          {b.code!==base&&<div style={{ fontSize:10,color:"#94a3b8" }}>≈ {formatAmount(l==="Expenses"?-nb:nb,base)}</div>}
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop:10 }}>
                      <div style={{ height:5,background:"#f1f5f9",borderRadius:3,overflow:"hidden" }}>
                        <div style={{ height:"100%",width:`${b.income>0?Math.min(100,(b.income/(b.income+b.expense))*100):0}%`,background:"#10b981",borderRadius:3 }} />
                      </div>
                      <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"#94a3b8",marginTop:2 }}>
                        <span>Income ratio</span><span>{b.income>0?Math.round((b.income/(b.income+b.expense))*100):0}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Grand unified total */}
            <div style={{ background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
              <h4 style={{ margin:"0 0 12px",fontSize:14,fontWeight:700,color:"#1e293b" }}>All Currencies Unified in {base} {CURRENCIES[base]?.flag}</h4>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:16 }}>
                {byCurrency.map(b=>{
                  const net=convert(b.income-b.expense,b.code,base);
                  return (
                    <div key={b.code} style={{ background:"#f8fafc",borderRadius:8,padding:12,borderLeft:`3px solid ${net>=0?"#10b981":"#ef4444"}` }}>
                      <div style={{ fontSize:11,color:"#64748b",marginBottom:3 }}>{CURRENCIES[b.code]?.flag} {b.code}</div>
                      <div style={{ fontWeight:700,fontSize:14,color:net>=0?"#16a34a":"#dc2626" }}>{formatAmount(net,base)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ paddingTop:14,borderTop:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontWeight:700,color:"#374151",fontSize:14 }}>Grand Net Total</span>
                <span style={{ fontWeight:800,fontSize:22,color:byCurrency.reduce((s,b)=>s+convert(b.income-b.expense,b.code,base),0)>=0?"#16a34a":"#dc2626" }}>
                  {formatAmount(byCurrency.reduce((s,b)=>s+convert(b.income-b.expense,b.code,base),0),base)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* NET WORTH */}
        {tab==="net-worth"&&(
          <div style={{ background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.06)",maxWidth:720 }}>
            <h3 style={{ margin:"0 0 4px",fontSize:15,fontWeight:700,color:"#1e293b" }}>Net Worth</h3>
            <div style={{ fontSize:12,color:"#64748b",marginBottom:12 }}>All values in {base}</div>
            <div style={{ fontSize:30,fontWeight:800,color:"#1e293b",marginBottom:20 }}>
              {formatAmount(data.accounts.reduce((s,a)=>s+convert(a.balance,a.currency,base),0),base)}
            </div>
            {data.accounts.map((acc,i)=>{
              const inBase=convert(acc.balance,acc.currency,base);
              const total=data.accounts.reduce((s,a)=>s+Math.abs(convert(a.balance,a.currency,base)),0);
              const pct=total>0?(Math.abs(inBase)/total)*100:0;
              return (
                <div key={acc.id} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3 }}>
                    <span style={{ color:"#374151",fontWeight:500 }}>{acc.name} <span style={{ fontSize:10,color:"#94a3b8" }}>({acc.currency})</span></span>
                    <div style={{ textAlign:"right" }}>
                      <span style={{ fontWeight:700,color:acc.balance>=0?"#16a34a":"#dc2626" }}>{formatAmount(acc.balance,acc.currency)}</span>
                      {acc.currency!==base&&<span style={{ fontSize:11,color:"#94a3b8",marginLeft:6 }}>≈ {formatAmount(inBase,base)}</span>}
                    </div>
                  </div>
                  <div style={{ height:6,background:"#f1f5f9",borderRadius:3,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${Math.min(100,pct)}%`,background:COLORS[i%COLORS.length],borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
            <h4 style={{ margin:"20px 0 10px",fontSize:13,fontWeight:700,color:"#64748b" }}>6-Month Trend ({base})</h4>
            <div style={{ display:"flex",alignItems:"flex-end",gap:12,height:150,borderBottom:"2px solid #e2e8f0" }}>
              {nwHist.map((pt,i)=>(
                <div key={pt.m} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                  <div style={{ fontSize:10,fontWeight:600,color:"#3b82f6" }}>{formatAmount(pt.v,base)}</div>
                  <div style={{ width:"70%",height:`${(pt.v/maxNW)*120}px`,background:i===nwHist.length-1?"#3b82f6":"#bfdbfe",borderRadius:"4px 4px 0 0" }} />
                  <div style={{ fontSize:10,color:"#64748b" }}>{pt.m}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS VIEW  — user-managed currency list + base-centric rates
// ─────────────────────────────────────────────────────────────────────────────
function SettingsView({ prefs, setPrefs, rates, setRates, enabledCurrencies, setEnabledCurrencies }) {
  const [localPrefs,  setLocalPrefs]  = useState({...prefs});
  const [localRates,  setLocalRates]  = useState({...rates});
  const [localCurrs,  setLocalCurrs]  = useState([...enabledCurrencies]);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [savedMsg,    setSavedMsg]    = useState("");

  const base = localPrefs.baseCurrency;

  const doSave = () => {
    setPrefs(localPrefs); setRates(localRates); setEnabledCurrencies(localCurrs);
    save(PREFS_KEY, localPrefs); save(RATES_KEY, localRates); save(CURRS_KEY, localCurrs);
    setSavedMsg("✓ Saved!"); setTimeout(()=>setSavedMsg(""), 2000);
  };

  // When base currency changes, recalculate all rates
  // Old logic: rates were 1 base = X foreign. If base changes from A to B,
  // new rate for any currency C is: new_rate_C = old_rate_C / old_rate_B
  const changeBase = (newBase) => {
    if (newBase === base) { setLocalPrefs(p=>({...p,baseCurrency:newBase})); return; }
    const oldRateForNewBase = localRates[newBase]; // 1 old_base = X new_base
    if (!oldRateForNewBase || oldRateForNewBase === 0) {
      setLocalPrefs(p=>({...p,baseCurrency:newBase}));
      return;
    }
    // Rebuild all rates in terms of new base
    const newRates = {};
    localCurrs.forEach(code => {
      if (code === newBase) return; // skip — it becomes the base
      const oldRate = code === base ? 1 : (localRates[code] || 1);
      // 1 newBase → oldBase cost: 1/oldRateForNewBase old_base units
      // → that many units of code: (1/oldRateForNewBase) * oldRate
      newRates[code] = (1 / oldRateForNewBase) * oldRate;
    });
    // Add the old base as a foreign currency (unless user removes it)
    if (!newRates[base]) {
      newRates[base] = 1 / oldRateForNewBase;
    }
    setLocalRates(newRates);
    setLocalPrefs(p=>({...p,baseCurrency:newBase}));
    // also add old base to enabled list
    if (!localCurrs.includes(base)) {
      setLocalCurrs(c=>[...c, base]);
    }
  };

  const addCurrency = (code) => {
    if (code === base || localCurrs.includes(code)) return;
    setLocalCurrs(c=>[...c,code]);
    // Default rate: 1
    if (!localRates[code]) setLocalRates(r=>({...r,[code]:1}));
    setPickerOpen(false);
  };

  const removeCurrency = (code) => {
    setLocalCurrs(c=>c.filter(x=>x!==code));
    const nr={...localRates}; delete nr[code]; setLocalRates(nr);
  };

  // Preview helpers
  const prevDate = iso => { const [y,m,d]=iso.split("-"); const mo=parseInt(m),dy=parseInt(d);
    return localPrefs.dateFormat.replace("YYYY",y).replace("MM",m.padStart(2,"0")).replace("DD",d.padStart(2,"0"))
      .replace("MMMM",LONG_M[mo-1]).replace("MMM",SHORT_M[mo-1]).replace("D",String(dy)).replace("M",String(mo)); };
  const prevTime = t => { const [hh,mm]=t.split(":"); const h=parseInt(hh);
    if(localPrefs.timeFormat==="24h") return `${String(h).padStart(2,"0")}:${mm}`;
    return `${h%12||12}:${mm} ${h>=12?"PM":"AM"}`; };

  const card = { background:"#fff",borderRadius:12,padding:24,marginBottom:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)" };
  const head = { margin:"0 0 18px",fontSize:15,fontWeight:700,color:"#1e293b",display:"flex",alignItems:"center",gap:8,paddingBottom:12,borderBottom:"1px solid #f1f5f9" };

  // Currencies not yet added (excluding base)
  const availableToAdd = ALL_CURRENCY_LIST.filter(c => c.code !== base && !localCurrs.includes(c.code));

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#f8fafc" }}>
      <div style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 24px",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <h2 style={{ margin:0,fontSize:20,fontWeight:800,color:"#1e293b" }}>Settings</h2>
          <p style={{ margin:"2px 0 0",color:"#64748b",fontSize:13 }}>Manage currencies, exchange rates, and display formats.</p>
        </div>
        <button onClick={doSave} style={{ background:savedMsg?"#16a34a":"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"11px 28px",fontWeight:700,fontSize:14,cursor:"pointer",transition:"background .3s",minWidth:160 }}>
          {savedMsg || "💾 Save Settings"}
        </button>
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:24,maxWidth:820 }}>

        {/* ── BASE CURRENCY ── */}
        <div style={card}>
          <h3 style={head}><span>🏠</span> Base Currency</h3>
          <p style={{ margin:"0 0 14px",fontSize:13,color:"#64748b" }}>
            Your <strong>home currency</strong>. All budget totals, reports, and net worth are expressed in this currency. All exchange rates below are defined as <em>how many foreign units equals 1 {base}</em>.
          </p>
          <select value={base} onChange={e=>changeBase(e.target.value)} style={{...inp,maxWidth:360,fontSize:15,padding:"10px 12px"}}>
            {ALL_CURRENCY_LIST.map(c=><option key={c.code} value={c.code}>{c.flag}  {c.name} ({c.code})</option>)}
          </select>
          <div style={{ marginTop:10,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#1d4ed8" }}>
            ℹ Changing your base currency automatically recalculates all existing exchange rates.
          </div>
        </div>

        {/* ── CURRENCIES & RATES ── */}
        <div style={card}>
          <h3 style={head}><span>💱</span> Currencies & Exchange Rates</h3>
          <p style={{ margin:"0 0 16px",fontSize:13,color:"#64748b" }}>
            Add the currencies you work with. For each one, enter how many units of that currency equal <strong>1 {base}</strong>.
          </p>

          {/* Rate explanation example */}
          <div style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 14px",marginBottom:18,fontSize:12,color:"#15803d" }}>
            <strong>Example:</strong> If your base is {base} and 1 {base} = 1,590 NGN, enter <code style={{ background:"#dcfce7",padding:"1px 4px",borderRadius:3 }}>1590</code> in the NGN row.
            The app will then know that ₦45,000 ÷ 1,590 = {formatAmount(45000/1590, base)}.
          </div>

          {/* Currency rows */}
          {localCurrs.length === 0 && (
            <div style={{ color:"#94a3b8",fontSize:13,padding:"16px 0",textAlign:"center" }}>
              No additional currencies added yet. Click "+ Add Currency" below.
            </div>
          )}

          {localCurrs.map(code => {
            const c = CURRENCIES[code] || {};
            const rate = localRates[code] ?? 1;
            const inverse = rate > 0 ? (1/rate) : 0;
            return (
              <div key={code} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f8fafc",borderRadius:10,marginBottom:8,border:"1px solid #e2e8f0" }}>
                <span style={{ fontSize:22,flexShrink:0 }}>{c.flag}</span>
                <div style={{ flex:"0 0 180px" }}>
                  <div style={{ fontWeight:700,fontSize:14,color:"#1e293b" }}>{c.name}</div>
                  <div style={{ fontSize:11,color:"#64748b" }}>{code}</div>
                </div>
                {/* Rate input */}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11,color:"#64748b",marginBottom:4,fontWeight:600 }}>
                    1 {base} =
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <div style={{ position:"relative",flex:1,maxWidth:160 }}>
                      <input type="number" step="0.0001" min="0"
                        value={rate}
                        onChange={e=>setLocalRates(r=>({...r,[code]:parseFloat(e.target.value)||0}))}
                        style={{ ...inp, paddingRight:44, fontWeight:600, fontSize:15 }} />
                      <span style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:12,fontWeight:700,color:"#94a3b8" }}>{c.symbol}</span>
                    </div>
                    <span style={{ fontSize:11,color:"#94a3b8",minWidth:160 }}>
                      → 1 {code} ≈ {formatAmount(inverse, base)} {base}
                    </span>
                  </div>
                </div>
                <button onClick={()=>removeCurrency(code)} title={`Remove ${code}`}
                  style={{ flexShrink:0,border:"none",background:"transparent",cursor:"pointer",color:"#f87171",fontSize:18,padding:"4px" }}>✕</button>
              </div>
            );
          })}

          {/* Add currency picker */}
          <div style={{ marginTop:12 }}>
            {pickerOpen ? (
              <div style={{ border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden",background:"#fff",maxHeight:280,overflowY:"auto" }}>
                <div style={{ padding:"8px 12px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",fontSize:12,color:"#64748b",fontWeight:600 }}>
                  Select a currency to add
                </div>
                {availableToAdd.map(c=>(
                  <button key={c.code} onClick={()=>addCurrency(c.code)} style={{
                    width:"100%",textAlign:"left",padding:"9px 14px",border:"none",borderBottom:"1px solid #f1f5f9",
                    cursor:"pointer",background:"#fff",display:"flex",alignItems:"center",gap:10,fontSize:13,color:"#374151",
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f0f9ff"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <span style={{ fontSize:18 }}>{c.flag}</span>
                    <span style={{ fontWeight:600 }}>{c.code}</span>
                    <span style={{ color:"#94a3b8" }}>{c.name}</span>
                  </button>
                ))}
                {availableToAdd.length===0&&<div style={{ padding:"12px 14px",color:"#94a3b8",fontSize:13 }}>All currencies already added.</div>}
                <button onClick={()=>setPickerOpen(false)} style={{ width:"100%",padding:"8px",border:"none",borderTop:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",color:"#64748b",fontSize:12 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={()=>setPickerOpen(true)} style={{ border:"2px dashed #e2e8f0",background:"transparent",borderRadius:10,padding:"10px 20px",cursor:"pointer",color:"#3b82f6",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6 }}>
                + Add Currency
              </button>
            )}
          </div>
        </div>

        {/* ── DATE FORMAT ── */}
        <div style={card}>
          <h3 style={head}><span>📅</span> Date Format</h3>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Date Format</label>
            <select value={localPrefs.dateFormat} onChange={e=>setLocalPrefs(p=>({...p,dateFormat:e.target.value}))} style={{...inp,maxWidth:400}}>
              {DATE_FORMATS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div style={{ background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:12,color:"#0369a1",fontWeight:700 }}>Preview</span>
            <div style={{ display:"flex",gap:20 }}>
              {["2026-03-05","2026-12-31","2026-01-08"].map(d=><span key={d} style={{ fontWeight:600,color:"#374151",fontSize:13 }}>{prevDate(d)}</span>)}
            </div>
          </div>
        </div>

        {/* ── TIME & DISPLAY ── */}
        <div style={card}>
          <h3 style={head}><span>🕐</span> Time & Display</h3>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Time Format</label>
            <div style={{ display:"flex",gap:12,marginTop:6 }}>
              {[["12h","12-hour  (2:30 PM)"],["24h","24-hour  (14:30)"]].map(([v,l])=>(
                <label key={v} style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#374151",padding:"9px 20px",border:`2px solid ${localPrefs.timeFormat===v?"#3b82f6":"#e2e8f0"}`,borderRadius:8,background:localPrefs.timeFormat===v?"#eff6ff":"#fff",fontWeight:localPrefs.timeFormat===v?600:400 }}>
                  <input type="radio" name="tf" value={v} checked={localPrefs.timeFormat===v} onChange={()=>setLocalPrefs(p=>({...p,timeFormat:v}))} />{l}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Negative Format</label>
            <div style={{ display:"flex",gap:12,marginTop:6 }}>
              {[["minus","Minus sign  −$50"],["parens","Parentheses  ($50)"]].map(([v,l])=>(
                <label key={v} style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#374151",padding:"9px 20px",border:`2px solid ${localPrefs.negativeFormat===v?"#3b82f6":"#e2e8f0"}`,borderRadius:8,background:localPrefs.negativeFormat===v?"#eff6ff":"#fff",fontWeight:localPrefs.negativeFormat===v?600:400 }}>
                  <input type="radio" name="nf" value={v} checked={localPrefs.negativeFormat===v} onChange={()=>setLocalPrefs(p=>({...p,negativeFormat:v}))} />{l}
                </label>
              ))}
            </div>
          </div>
          <div style={{ background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:12,color:"#0369a1",fontWeight:700 }}>Time preview</span>
            <div style={{ display:"flex",gap:20 }}>
              {["09:05","13:45","00:00","23:59"].map(t=><span key={t} style={{ fontWeight:600,color:"#374151",fontSize:13 }}>{prevTime(t)}</span>)}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD ACCOUNT MODAL  — only shows enabled currencies
// ─────────────────────────────────────────────────────────────────────────────
function AddAccountModal({ onClose, onAdd }) {
  const { prefs, enabledCurrencies } = useApp();
  const base = prefs.baseCurrency;
  const allCurrencies = [base, ...enabledCurrencies].filter((v,i,a)=>a.indexOf(v)===i);
  const [form,setForm]=useState({name:"",type:"checking",currency:base,balance:"",onBudget:true});
  const c = CURRENCIES[form.currency]||CURRENCIES.USD;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}>
      <div style={{ background:"#fff",borderRadius:12,padding:28,width:420,boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
        <h3 style={{ margin:"0 0 16px",color:"#1e293b" }}>Add Account</h3>
        <div style={{ marginBottom:12 }}>
          <label style={lbl}>Account Name</label>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Chase Checking" style={inp} />
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={lbl}>Account Type</label>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={inp}>
            {["checking","savings","credit","cash","investment"].map(t=>(
              <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={lbl}>Currency</label>
          <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={inp}>
            {allCurrencies.map(code=>{
              const cur = CURRENCIES[code]||{};
              return <option key={code} value={code}>{cur.flag}  {cur.name} ({code})</option>;
            })}
          </select>
          {allCurrencies.length < 2 && (
            <div style={{ fontSize:11,color:"#f59e0b",marginTop:4 }}>
              ⚠ Add more currencies in Settings to use them here.
            </div>
          )}
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Opening Balance ({form.currency})</label>
          <div style={{ position:"relative" }}>
            <input type="number" value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))} placeholder="0.00" style={{...inp,paddingRight:50}} />
            <span style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,fontWeight:700,color:"#94a3b8" }}>{c.symbol}</span>
          </div>
        </div>
        <div style={{ marginBottom:16,display:"flex",alignItems:"center",gap:8 }}>
          <input type="checkbox" checked={form.onBudget} onChange={e=>setForm(f=>({...f,onBudget:e.target.checked}))} id="ob" />
          <label htmlFor="ob" style={{ fontSize:13,color:"#374151" }}>Include in budget (on-budget account)</label>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={onClose} style={{ flex:1,padding:"10px",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",background:"#fff" }}>Cancel</button>
          <button onClick={()=>{ if(!form.name)return; onAdd({id:uid(),...form,balance:parseFloat(form.balance)||0}); onClose(); }}
            style={{ flex:1,padding:"10px",border:"none",borderRadius:8,cursor:"pointer",background:"#3b82f6",color:"#fff",fontWeight:600 }}>
            Add Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [data,             setDataRaw]             = useState(null);
  const [prefs,            setPrefsRaw]            = useState(null);
  const [rates,            setRatesRaw]            = useState(null);
  const [enabledCurrencies,setEnabledCurrenciesRaw]= useState(null);
  const [view,             setView]                = useState("budget");
  const [showAdd,          setShowAdd]             = useState(false);

  useEffect(() => {
    Promise.all([
      load(STORAGE_KEY, defaultData),
      load(PREFS_KEY,   defaultPrefs),
      load(RATES_KEY,   defaultRates),
      load(CURRS_KEY,   defaultEnabledCurrencies),
    ]).then(([d,p,r,c]) => {
      setDataRaw(d); setPrefsRaw(p); setRatesRaw(r); setEnabledCurrenciesRaw(c);
    });
  }, []);

  const setData             = useCallback(upd=>{ setDataRaw(prev=>{ const n=typeof upd==="function"?upd(prev):upd; save(STORAGE_KEY,n); return n; }); },[]);
  const setPrefs            = useCallback(upd=>{ setPrefsRaw(prev=>{ const n=typeof upd==="function"?upd(prev):upd; return n; }); },[]);
  const setRates            = useCallback(upd=>{ setRatesRaw(prev=>{ const n=typeof upd==="function"?upd(prev):upd; return n; }); },[]);
  const setEnabledCurrencies= useCallback(upd=>{ setEnabledCurrenciesRaw(prev=>{ const n=typeof upd==="function"?upd(prev):upd; return n; }); },[]);

  if (!data||!prefs||!rates||!enabledCurrencies) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#1a2537",color:"#fff",fontSize:18 }}>
      Loading your budget…
    </div>
  );

  const accountId = view.startsWith("account-") ? view.replace("account-","") : null;
  const ctx = { prefs, rates, enabledCurrencies };

  const main = () => {
    if (view==="budget")   return <BudgetView data={data} setData={setData}/>;
    if (view==="reports")  return <ReportsView data={data}/>;
    if (view==="settings") return <SettingsView prefs={prefs} setPrefs={setPrefs} rates={rates} setRates={setRates} enabledCurrencies={enabledCurrencies} setEnabledCurrencies={setEnabledCurrencies}/>;
    if (view==="accounts"||accountId) return <AccountView data={data} setData={setData} accountId={accountId}/>;
    return null;
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div style={{ display:"flex",height:"100vh",fontFamily:"'DM Sans',-apple-system,sans-serif",overflow:"hidden" }}>
        <Sidebar view={view} setView={setView} accounts={data.accounts}
          onAddAccount={()=>setShowAdd(true)}
          onSettings={()=>setView("settings")}/>
        {main()}
        {showAdd && <AddAccountModal onClose={()=>setShowAdd(false)} onAdd={acc=>setData(d=>({...d,accounts:[...d.accounts,acc]}))}/>}
      </div>
    </AppCtx.Provider>
  );
}
