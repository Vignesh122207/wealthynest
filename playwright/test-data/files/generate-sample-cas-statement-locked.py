#!/usr/bin/env python3
"""Regenerates sample-cas-statement-locked.pdf. Not run by the test suite itself — the PDF is
committed as a static fixture; re-run this only if the fixture needs to change.

Requires `reportlab` (pip install reportlab). Run from this directory:
    python3 generate-sample-cas-statement-locked.py

Password-protected sibling of sample-cas-statement.pdf (see generate-sample-cas-statement.py's own
comment for why the text layout is hand-picked against CasImportServiceImpl.parseHoldings' exact
regex patterns) — same shape, different scheme/folio text so it doesn't collide with the other
fixture's already-imported holding when both specs run in the same pass.
"""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.pdfencrypt import StandardEncryption

OUTPUT = "sample-cas-statement-locked.pdf"
PASSWORD = "cas2026secure"

LINES = [
    "CONSOLIDATED ACCOUNT STATEMENT",
    "Statement for the period 01-Jan-2026 to 30-Jun-2026",
    "",
    "Folio No: 7654321 / 0",
    "E2E Secure Equity Fund Direct Plan Growth",
    "Closing Unit Balance: 200.000 NAV: 25.0000 Value: Rs. 5,000.00",
]

encrypt = StandardEncryption(userPassword=PASSWORD, ownerPassword="ownerSecret456", canPrint=1, canModify=0)
c = canvas.Canvas(OUTPUT, pagesize=A4, encrypt=encrypt)
c.setFont("Helvetica", 10)
y = 800
for line in LINES:
    c.drawString(50, y, line)
    y -= 20
c.save()
print(f"wrote {OUTPUT} (password: {PASSWORD})")
