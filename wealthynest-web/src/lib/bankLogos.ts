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
};

export function getLogoFit(name?: string): "cover" | "contain" {
  if (!name) return "cover";
  return LOGO_FIT_OVERRIDES[name.trim().toLowerCase()] ?? "cover";
}

export interface BankMonogram { initials: string; hex: string; }

const BANK_MONOGRAMS: Record<string, BankMonogram> = {
  "state bank of india":       { initials: "SBI",  hex: "#2A5DB0" },
  "hdfc bank":                 { initials: "HDFC", hex: "#E31E24" },
  "icici bank":                { initials: "ICICI",hex: "#F58220" },
  "axis bank":                 { initials: "AXIS", hex: "#97144D" },
  "kotak mahindra bank":       { initials: "KTK",  hex: "#ED1C24" },
  "punjab national bank":      { initials: "PNB",  hex: "#7A1F2B" },
  "bank of baroda":            { initials: "BOB",  hex: "#F7941D" },
  "canara bank":                { initials: "CNR",  hex: "#FFB300" },
  "yes bank":                  { initials: "YES",  hex: "#003D7C" },
  "indusind bank":             { initials: "IIB",  hex: "#A6192E" },
  "federal bank":              { initials: "FED",  hex: "#003DA5" },
  "idfc first bank":           { initials: "IDFC", hex: "#A31F34" },
  "union bank of india":       { initials: "UBI",  hex: "#F58220" },
  "indian bank":               { initials: "IB",   hex: "#00693E" },
  "bank of india":             { initials: "BOI",  hex: "#004C97" },
  "bandhan bank":              { initials: "BDN",  hex: "#A6192E" },
  "au small finance bank":     { initials: "AU",   hex: "#E4002B" },
  "south indian bank":         { initials: "SIB",  hex: "#006838" },
  "rbl bank":                  { initials: "RBL",  hex: "#7A1F2B" },
  "uco bank":                  { initials: "UCO",  hex: "#C8102E" },
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
