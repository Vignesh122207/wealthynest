#!/usr/bin/env python3
"""Regenerates sample-bank-statement-locked.pdf. Not run by the test suite itself — the PDF is
committed as a static fixture; re-run this only if the fixture needs to change.

Requires `reportlab` (pip install reportlab). Run from this directory:
    python3 generate-sample-bank-statement-pdf.py

Password-protects the PDF (user password below) so statement-import.spec.ts can exercise the
PDF/password path in ImportStatementModal. The two transaction lines are deliberately
self-contained single lines — date, narration, withdrawal/deposit/balance all on one line, no
wrapping — matching StatementImportServiceImpl.parsePdfLines' simplest supported layout (the
"Standard Chartered"-style case per its own doc comment) so the parser confidently extracts both
rows without depending on the wrapping-narration heuristics tuned for other bank layouts.
"""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.pdfencrypt import StandardEncryption

OUTPUT = "sample-bank-statement-locked.pdf"
PASSWORD = "e2etest123"

LINES = [
    "Statement of Account",
    "05-Jan-2026 Zeta Mart Purchase 250.00 0.00 9750.00",
    "06-Jan-2026 Salary Credit 0.00 5000.00 14750.00",
]

encrypt = StandardEncryption(userPassword=PASSWORD, ownerPassword="ownerSecret123", canPrint=1, canModify=0)
c = canvas.Canvas(OUTPUT, pagesize=A4, encrypt=encrypt)
c.setFont("Helvetica", 10)
y = 800
for line in LINES:
    c.drawString(50, y, line)
    y -= 20
c.save()
print(f"wrote {OUTPUT} (password: {PASSWORD})")
