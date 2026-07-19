#!/usr/bin/env python3
"""Regenerates sample-cas-statement.pdf. Not run by the test suite itself — the PDF is committed
as a static fixture; re-run this only if the fixture needs to change.

Requires `reportlab` (pip install reportlab). Run from this directory:
    python3 generate-sample-cas-statement.py

The text layout below is deliberately matched to CasImportServiceImpl.parseHoldings' regex
patterns (FOLIO_PATTERN, NAV_PATTERN, VALUE_PATTERN, UNITS_PATTERN) so the backend's parser
confidently extracts exactly one fully-valid holding — see InvestmentsPage.importFromCas's own
comment in the Playwright suite for why this matters (the real parser is admittedly tuned against
general knowledge of CAS layouts, not a verified real sample, so a hand-picked line format that's
known to parse cleanly avoids depending on that heuristic's real-world accuracy). If you change
this text, verify parseHoldings still extracts one valid row before committing the regenerated PDF.
"""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

OUTPUT = "sample-cas-statement.pdf"

LINES = [
    "CONSOLIDATED ACCOUNT STATEMENT",
    "Statement for the period 01-Jan-2026 to 30-Jun-2026",
    "",
    "Folio No: 1234567 / 0",
    "E2E Growth Fund Direct Plan Growth",
    "Closing Unit Balance: 100.000 NAV: 50.0000 Value: Rs. 5,000.00",
]

c = canvas.Canvas(OUTPUT, pagesize=A4)
c.setFont("Helvetica", 10)
y = 800
for line in LINES:
    c.drawString(50, y, line)
    y -= 20
c.save()
print(f"wrote {OUTPUT}")
