// Mutual fund AMC name → colored monogram, same three-tier idea as stockLogos.ts/bankLogos.ts
// (real file → monogram → generic icon), but matched differently: `companyName` here is a full
// scheme name pulled from mfapi.in search results (e.g. "ICICI Prudential Bluechip Fund - Growth"),
// not a clean picked value like WalletAccount.bankName — so matching is by AMC-name prefix, not
// exact key, and prefixes are checked longest-first so "icici prudential" wins over a shorter
// generic "icici" would if one existed. No real logo files curated yet — same as StockLogo.
const REAL_LOGO_FILES: Record<string, string> = {};

export function getRealFundLogoFile(companyName?: string): string | undefined {
  if (!companyName) return undefined;
  return REAL_LOGO_FILES[companyName.trim().toLowerCase()];
}

export interface FundHouseMonogram { initials: string; hex: string; }

// Ordered longest-prefix-first within each tie so a more specific name always wins — e.g.
// "icici prudential" must be checked before any future shorter "icici" entry.
const FUND_HOUSE_MONOGRAMS: Array<[prefix: string, monogram: FundHouseMonogram]> = [
  ["aditya birla sun life", { initials: "ABSL",  hex: "#6A1B9A" }],
  ["baroda bnp paribas",    { initials: "BNP",   hex: "#009B77" }],
  ["canara robeco",         { initials: "CR",    hex: "#FFB300" }],
  ["icici prudential",      { initials: "ICICI", hex: "#F58220" }],
  ["franklin templeton",    { initials: "FT",    hex: "#002D72" }],
  ["whiteoak capital",      { initials: "WOC",   hex: "#1A1A2E" }],
  ["motilal oswal",         { initials: "MO",    hex: "#003DA5" }],
  ["bajaj finserv",         { initials: "BAJAJ", hex: "#003876" }],
  ["mirae asset",           { initials: "MIRAE", hex: "#00A651" }],
  ["nippon india",          { initials: "NIMF",  hex: "#C8102E" }],
  ["parag parikh",          { initials: "PPFAS", hex: "#00563F" }],
  ["pgim india",            { initials: "PGIM",  hex: "#F58220" }],
  ["jm financial",          { initials: "JM",    hex: "#7A1F2B" }],
  ["quantum",               { initials: "QTM",   hex: "#1A1A2E" }],
  ["kotak mahindra",        { initials: "KTK",   hex: "#ED1C24" }],
  ["kotak",                 { initials: "KTK",   hex: "#ED1C24" }],
  ["franklin india",        { initials: "FT",    hex: "#002D72" }],
  ["hdfc",                  { initials: "HDFC",  hex: "#E31E24" }],
  ["sbi",                   { initials: "SBI",   hex: "#2A5DB0" }],
  ["axis",                  { initials: "AXIS",  hex: "#97144D" }],
  ["tata",                  { initials: "TATA",  hex: "#0B3861" }],
  ["dsp",                   { initials: "DSP",   hex: "#003DA5" }],
  ["uti",                   { initials: "UTI",   hex: "#003DA5" }],
  ["sundaram",              { initials: "SUN",   hex: "#ED1C24" }],
  ["bandhan",               { initials: "BDN",   hex: "#A6192E" }],
  ["hsbc",                  { initials: "HSBC",  hex: "#DB0011" }],
  ["edelweiss",             { initials: "EDEL",  hex: "#003DA5" }],
  ["invesco",               { initials: "INV",   hex: "#003DA5" }],
  ["groww",                 { initials: "GROWW", hex: "#00D09C" }],
  ["navi",                  { initials: "NAVI",  hex: "#FF4F00" }],
  ["quant",                 { initials: "QUANT", hex: "#1A1A2E" }],
  ["lic",                   { initials: "LIC",   hex: "#00563F" }],
  ["union",                 { initials: "UNION", hex: "#F58220" }],
  ["iifl",                  { initials: "IIFL",  hex: "#1B3F8B" }],
];
FUND_HOUSE_MONOGRAMS.sort((a, b) => b[0].length - a[0].length);

export function getFundHouseMonogram(companyName?: string): FundHouseMonogram | undefined {
  if (!companyName) return undefined;
  const normalized = companyName.trim().toLowerCase();
  const match = FUND_HOUSE_MONOGRAMS.find(([prefix]) => normalized.startsWith(prefix));
  return match?.[1];
}
