// NSE symbol → real logo file (public/stock-logos/), same two-tier fallback as bankLogos.ts:
// real file → colored monogram (brand-adjacent hex + initials) → generic PremiumIcon badge.
// No real files curated yet (see StockLogo.tsx) — this map exists now so dropping files into
// public/stock-logos/ later is a pure data change, no component change. Hex values here are
// brand-adjacent approximations, not verified trademark colors — same rigor as BANK_MONOGRAMS
// in bankLogos.ts, good enough for a small colored badge, not meant to be pixel-exact.
const REAL_LOGO_FILES: Record<string, string> = {};

export function getRealStockLogoFile(symbol?: string): string | undefined {
  if (!symbol) return undefined;
  return REAL_LOGO_FILES[symbol.trim().toUpperCase()];
}

export interface StockMonogram { initials: string; hex: string; }

// Nifty 50 constituents plus a handful of other commonly-held NSE names. Deliberately not
// exhaustive (NSE lists ~2,400 symbols) — anything missing here just falls through to the
// generic stock icon, same as every symbol did before this file existed.
const STOCK_MONOGRAMS: Record<string, StockMonogram> = {
  RELIANCE:    { initials: "RIL",    hex: "#002E6D" },
  TCS:         { initials: "TCS",    hex: "#0B3861" },
  HDFCBANK:    { initials: "HDFC",   hex: "#E31E24" },
  INFY:        { initials: "INFY",   hex: "#007CC3" },
  ICICIBANK:   { initials: "ICICI",  hex: "#F58220" },
  HINDUNILVR:  { initials: "HUL",    hex: "#0033A0" },
  ITC:         { initials: "ITC",    hex: "#A6192E" },
  SBIN:        { initials: "SBI",    hex: "#2A5DB0" },
  BHARTIARTL:  { initials: "AIRTEL", hex: "#ED1C24" },
  KOTAKBANK:   { initials: "KOTAK",  hex: "#ED1C24" },
  LT:          { initials: "L&T",    hex: "#002C6C" },
  AXISBANK:    { initials: "AXIS",   hex: "#97144D" },
  ASIANPAINT:  { initials: "AP",     hex: "#ED1C24" },
  MARUTI:      { initials: "MSIL",   hex: "#E4002B" },
  TITAN:       { initials: "TITAN",  hex: "#B08D57" },
  SUNPHARMA:   { initials: "SUN",    hex: "#F58220" },
  ULTRACEMCO:  { initials: "UTCEM",  hex: "#E30613" },
  NESTLEIND:   { initials: "NESTLE", hex: "#78BE20" },
  WIPRO:       { initials: "WIPRO",  hex: "#341F65" },
  BAJFINANCE:  { initials: "BAJAJ",  hex: "#003876" },
  HCLTECH:     { initials: "HCL",    hex: "#0075C9" },
  TATAMOTORS:  { initials: "TATA",   hex: "#0B3861" },
  TATASTEEL:   { initials: "TATA",   hex: "#0B3861" },
  TATACONSUM:  { initials: "TATA",   hex: "#0B3861" },
  ADANIENT:    { initials: "ADANI",  hex: "#E31E24" },
  ADANIPORTS:  { initials: "ADANI",  hex: "#E31E24" },
  POWERGRID:   { initials: "PGCIL",  hex: "#0033A0" },
  NTPC:        { initials: "NTPC",   hex: "#0054A6" },
  ONGC:        { initials: "ONGC",   hex: "#EE2E24" },
  COALINDIA:   { initials: "CIL",    hex: "#33383D" },
  JSWSTEEL:    { initials: "JSW",    hex: "#E31E24" },
  GRASIM:      { initials: "GRASIM", hex: "#0B3861" },
  HINDALCO:    { initials: "HDLC",   hex: "#0B3861" },
  DRREDDY:     { initials: "DRL",    hex: "#00563F" },
  CIPLA:       { initials: "CIPLA",  hex: "#EE2E24" },
  DIVISLAB:    { initials: "DIVIS",  hex: "#003DA5" },
  EICHERMOT:   { initials: "EICHER", hex: "#C8102E" },
  HEROMOTOCO:  { initials: "HERO",   hex: "#E4002B" },
  "BAJAJ-AUTO":{ initials: "BAJAJ",  hex: "#003876" },
  "M&M":       { initials: "M&M",    hex: "#E31E24" },
  BRITANNIA:   { initials: "BRIT",   hex: "#ED1C24" },
  TECHM:       { initials: "TECHM",  hex: "#E31E24" },
  SBILIFE:     { initials: "SBI",    hex: "#2A5DB0" },
  HDFCLIFE:    { initials: "HDFC",   hex: "#E31E24" },
  BAJAJFINSV:  { initials: "BAJAJ",  hex: "#003876" },
  APOLLOHOSP:  { initials: "APOLLO", hex: "#ED1C24" },
  INDUSINDBK:  { initials: "IIB",    hex: "#A6192E" },
  UPL:         { initials: "UPL",    hex: "#0033A0" },
  VEDL:        { initials: "VEDL",   hex: "#E31E24" },
  GAIL:        { initials: "GAIL",   hex: "#F58220" },
  IOC:         { initials: "IOCL",   hex: "#F58220" },
  BPCL:        { initials: "BPCL",   hex: "#F58220" },
  ZOMATO:      { initials: "ZOM",    hex: "#E23744" },
  PAYTM:       { initials: "PAYTM",  hex: "#00BAF2" },
  IRCTC:       { initials: "IRCTC",  hex: "#003DA5" },
  DMART:       { initials: "DMART",  hex: "#00A651" },
};

export function getStockMonogram(symbol?: string): StockMonogram | undefined {
  if (!symbol) return undefined;
  return STOCK_MONOGRAMS[symbol.trim().toUpperCase()];
}
