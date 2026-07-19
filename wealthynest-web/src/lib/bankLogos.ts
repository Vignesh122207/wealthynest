// Bank/broker display name → real logo file (public/bank-logos/). Mostly
// sourced from companieslogo.com's "icon/symbol" variant (a square, text-free
// mark distinct from their wide text-lockup version — pulled via each listed
// company's stock ticker) with a few from Wikimedia Commons for names that
// aren't stock-listed. Falls back to a colored monogram (real brand color +
// initials) for names without a file yet, then to the generic PremiumIcon
// badge for anything unmatched. Clearbit's free logo API (the original plan)
// was discontinued with no replacement DNS record, and third-party logo
// proxies (unavatar.io) proved unreliable in testing. Keys match
// INDIAN_BANKS / STOCK_BROKERS in constants.ts exactly (case-insensitive).
const REAL_LOGO_FILES: Record<string, string> = {
  "state bank of india":  "/bank-logos/sbi.svg",
  "hdfc bank":            "/bank-logos/hdfc.svg",
  "icici bank":           "/bank-logos/icici.svg",
  "axis bank":            "/bank-logos/axis.png",
  "kotak mahindra bank":  "/bank-logos/kotak.png",
  "punjab national bank": "/bank-logos/pnb.png",
  "bank of baroda":       "/bank-logos/bob.svg",
  "canara bank":          "/bank-logos/canara.png",
  "yes bank":             "/bank-logos/yes.png",
  "indusind bank":        "/bank-logos/indusind.png",
  "federal bank":         "/bank-logos/federal.png",
  "idfc first bank":      "/bank-logos/idfcfirst.png",
  "union bank of india":  "/bank-logos/unionbank.png",
  "indian bank":          "/bank-logos/indianbank.svg",
  "bank of india":        "/bank-logos/boi.png",
  "bandhan bank":         "/bank-logos/bandhan.png",
  "au small finance bank":"/bank-logos/aubank.svg",
  "south indian bank":    "/bank-logos/southindian.png",
  "rbl bank":             "/bank-logos/rbl.png",
  "uco bank":             "/bank-logos/uco.jpg",
  "zerodha":              "/bank-logos/zerodha.svg",
  "groww":                "/bank-logos/groww.png",
  "angel one":            "/bank-logos/angelone.png",
  "motilal oswal":        "/bank-logos/motilaloswal.svg",
  "paytm money":          "/bank-logos/paytmmoney.png",
  "sharekhan":            "/bank-logos/sharekhan.png",
  "iifl securities":      "/bank-logos/iifl.svg",
  "icici direct":         "/bank-logos/icici.svg",
  "hdfc securities":      "/bank-logos/hdfc.svg",
  "kotak securities":     "/bank-logos/kotak.png",
  "axis direct":          "/bank-logos/axis.png",
  "sbi securities":       "/bank-logos/sbi.svg",
  "upstox":               "/bank-logos/upstox.png",
  "5paisa":               "/bank-logos/5paisa.png",
  "dhan":                 "/bank-logos/dhan.jpg",
  "standard chartered bank": "/bank-logos/standardchartered.svg",
};

export function getRealLogoFile(name?: string): string | undefined {
  if (!name) return undefined;
  return REAL_LOGO_FILES[name.trim().toLowerCase()];
}

// Most files above are true squares where object-cover is a no-op, and a few
// (Sharekhan, UCO) are wide lockups where object-cover's default crop (from
// object-left) is deliberate — it keeps the left mark and drops the illegible
// wordmark. Zerodha (90×60 viewBox) and Canara (658×524) both draw their mark
// edge-to-edge with no internal padding, so cropping either to a square cuts
// off a real point of the shape — they need the whole mark shown via
// object-contain instead. Checked every other logo in this file at 2x/4x
// size (Axis, Bank of Baroda, Bank of India, Indian Bank, Federal, Kotak,
// IndusInd, Union Bank, Yes, RBL, South Indian, PNB, etc.) — none of them
// crop off any real content, so they stay on the object-cover default.
const LOGO_FIT_OVERRIDES: Record<string, "contain"> = {
  "zerodha": "contain",
  "canara bank": "contain",
  "standard chartered bank": "contain",
};

export function getLogoFit(name?: string): "cover" | "contain" {
  if (!name) return "cover";
  return LOGO_FIT_OVERRIDES[name.trim().toLowerCase()] ?? "cover";
}

export interface BankMonogram { initials: string; hex: string; }

const BANK_MONOGRAMS: Record<string, BankMonogram> = {
  // Public sector banks
  "state bank of india":       { initials: "SBI",  hex: "#2A5DB0" },
  "punjab national bank":      { initials: "PNB",  hex: "#7A1F2B" },
  "bank of baroda":            { initials: "BOB",  hex: "#F7941D" },
  "canara bank":                { initials: "CNR",  hex: "#FFB300" },
  "union bank of india":       { initials: "UBI",  hex: "#F58220" },
  "bank of india":             { initials: "BOI",  hex: "#004C97" },
  "indian bank":               { initials: "IB",   hex: "#00693E" },
  "central bank of india":     { initials: "CBI",  hex: "#00539C" },
  "indian overseas bank":      { initials: "IOB",  hex: "#ED1C24" },
  "uco bank":                  { initials: "UCO",  hex: "#C8102E" },
  "bank of maharashtra":       { initials: "BOM",  hex: "#00558C" },
  "punjab & sind bank":        { initials: "PSB",  hex: "#004C97" },

  // Private sector banks
  "hdfc bank":                 { initials: "HDFC", hex: "#E31E24" },
  "icici bank":                { initials: "ICICI",hex: "#F58220" },
  "axis bank":                 { initials: "AXIS", hex: "#97144D" },
  "kotak mahindra bank":       { initials: "KTK",  hex: "#ED1C24" },
  "indusind bank":             { initials: "IIB",  hex: "#A6192E" },
  "yes bank":                  { initials: "YES",  hex: "#003D7C" },
  "idfc first bank":           { initials: "IDFC", hex: "#A31F34" },
  "federal bank":              { initials: "FED",  hex: "#003DA5" },
  "south indian bank":         { initials: "SIB",  hex: "#006838" },
  "rbl bank":                  { initials: "RBL",  hex: "#7A1F2B" },
  "bandhan bank":              { initials: "BDN",  hex: "#A6192E" },
  "idbi bank":                 { initials: "IDBI", hex: "#ED1C24" },
  "city union bank":           { initials: "CUB",  hex: "#F58220" },
  "dcb bank":                  { initials: "DCB",  hex: "#ED1C24" },
  "karnataka bank":            { initials: "KBL",  hex: "#003DA5" },
  "karur vysya bank":          { initials: "KVB",  hex: "#7A1F2B" },
  "tamilnad mercantile bank":  { initials: "TMB",  hex: "#F58220" },
  "jammu & kashmir bank":      { initials: "J&K",  hex: "#7A1F2B" },
  "dhanlaxmi bank":            { initials: "DXB",  hex: "#A6192E" },
  "csb bank":                  { initials: "CSB",  hex: "#004C97" },
  "nainital bank":             { initials: "NTL",  hex: "#00563F" },

  // Small finance banks
  "au small finance bank":     { initials: "AU",   hex: "#E4002B" },
  "equitas small finance bank":{ initials: "EQ",   hex: "#ED1C24" },
  "ujjivan small finance bank":{ initials: "UJJ",  hex: "#F58220" },
  "jana small finance bank":   { initials: "JANA", hex: "#00A651" },
  "esaf small finance bank":   { initials: "ESAF", hex: "#00A651" },
  "suryoday small finance bank":{ initials: "SUR", hex: "#F7941D" },
  "utkarsh small finance bank":{ initials: "UTK",  hex: "#F58220" },
  "north east small finance bank":{ initials: "NESFB", hex: "#00A651" },
  "shivalik small finance bank":{ initials: "SHIV", hex: "#003DA5" },
  "unity small finance bank":  { initials: "UNITY",hex: "#5A38F6" },
  "capital small finance bank":{ initials: "CAP",  hex: "#004C97" },

  // Payments banks
  "airtel payments bank":      { initials: "APB",  hex: "#ED1C24" },
  "india post payments bank":  { initials: "IPPB", hex: "#F58220" },
  "fino payments bank":        { initials: "FINO", hex: "#8DC63F" },
  "paytm payments bank":       { initials: "PPBL", hex: "#00BAF2" },
  "jio payments bank":         { initials: "JIO",  hex: "#0F1B4C" },
  "nsdl payments bank":        { initials: "NSDL", hex: "#003DA5" },

  // Foreign banks operating in India
  "standard chartered bank":   { initials: "SC",   hex: "#0473EA" },
};

const BROKER_MONOGRAMS: Record<string, BankMonogram> = {
  "zerodha":          { initials: "Z",    hex: "#387ED1" },
  "groww":            { initials: "G",    hex: "#00D09C" },
  "angel one":        { initials: "A1",   hex: "#E96C33" },
  "upstox":           { initials: "UX",   hex: "#5A38F6" },
  "icici direct":     { initials: "ICICI",hex: "#F58220" },
  "hdfc securities":  { initials: "HDFC", hex: "#E31E24" },
  "kotak securities": { initials: "KTK",  hex: "#ED1C24" },
  "motilal oswal":    { initials: "MO",   hex: "#003DA5" },
  "5paisa":           { initials: "5P",   hex: "#F58220" },
  "paytm money":      { initials: "PM",   hex: "#00BAF2" },
  "sharekhan":        { initials: "SK",   hex: "#E31E24" },
  "iifl securities":  { initials: "IIFL", hex: "#1B3F8B" },
  "sbi securities":   { initials: "SBI",  hex: "#2A5DB0" },
  "axis direct":      { initials: "AXIS", hex: "#97144D" },
  "dhan":             { initials: "DHAN", hex: "#0EA5A5" },
};

const ALL_MONOGRAMS: Record<string, BankMonogram> = { ...BANK_MONOGRAMS, ...BROKER_MONOGRAMS };

export function getBankMonogram(name?: string): BankMonogram | undefined {
  if (!name) return undefined;
  return ALL_MONOGRAMS[name.trim().toLowerCase()];
}
