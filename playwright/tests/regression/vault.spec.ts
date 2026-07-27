import {expect, test} from "../../fixtures";
import {randomSecureNote, randomVaultItem} from "../../test-data/factory";
import {TEST_IDS} from "../../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../../helpers/wait.helper";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/.
test.describe.configure({ mode: "serial" });

test.describe("Vault", () => {
  test("creates a login item @regression", async ({ vaultPage }) => {
    const item = randomVaultItem();
    await vaultPage.gotoVault();
    await vaultPage.createLoginItem(item);
    await vaultPage.expectItemVisible(item.title);
  });

  test("reveals a login item's password after confirming the account password @regression", async ({ vaultPage, regressionUser }) => {
    const item = randomVaultItem();
    await vaultPage.gotoVault();
    await vaultPage.createLoginItem(item);

    await vaultPage.openReveal(item.title);
    const revealed = await vaultPage.revealSecret(regressionUser.password);
    expect(revealed).toBe(item.secret);
    await vaultPage.closeModal();
  });

  test("deletes a vault item @regression", async ({ vaultPage }) => {
    const item = randomVaultItem();
    await vaultPage.gotoVault();
    await vaultPage.createLoginItem(item);
    await vaultPage.expectItemVisible(item.title);

    await vaultPage.deleteItem(item.title);
    await vaultPage.expectItemNotVisible(item.title);
  });

  test("edits an existing item's title @regression", async ({ vaultPage }) => {
    const item = randomVaultItem();
    await vaultPage.gotoVault();
    await vaultPage.createLoginItem(item);

    const newTitle = `${item.title} Renamed`;
    await vaultPage.editTitle(item.title, newTitle);
    await vaultPage.expectItemVisible(newTitle);
    await vaultPage.expectItemNotVisible(item.title);
  });

  test("creates a secure note item and reveals its content @regression", async ({ vaultPage, regressionUser }) => {
    const note = randomSecureNote();
    await vaultPage.gotoVault();
    await vaultPage.createSecureNote(note);
    await vaultPage.expectItemVisible(note.title);

    await vaultPage.openReveal(note.title);
    const revealed = await vaultPage.revealSecret(regressionUser.password);
    expect(revealed).toBe(note.note);
    await vaultPage.closeModal();
  });

  test("toggles favorite on a vault item @regression", async ({ vaultPage }) => {
    const item = randomVaultItem();
    await vaultPage.gotoVault();
    await vaultPage.createLoginItem(item);
    await vaultPage.expectFavorite(item.title, false);

    await vaultPage.setFavorite(item.title, true);
    await vaultPage.expectFavorite(item.title, true);

    await vaultPage.setFavorite(item.title, false);
    await vaultPage.expectFavorite(item.title, false);
  });

  test("the password generator fills a value in both random and passphrase mode @regression", async ({ vaultPage }) => {
    const title = `E2E Generated ${Date.now()}`;
    await vaultPage.gotoVault();
    await vaultPage.rawPage.getByTestId(TEST_IDS.fab.toggle).click();
    await vaultPage.rawPage.getByTestId(TEST_IDS.fab.addVaultItem).click();
    await vaultPage.rawPage.getByTestId("vault-title-input").fill(title);

    // The panel generates once on mount, so a value is already present before any interaction.
    await vaultPage.openGenerator();
    const randomValue = await vaultPage.generatedSecret();
    expect(randomValue.length).toBeGreaterThan(0);

    await vaultPage.setGeneratorMode("Passphrase");
    const passphraseValue = await vaultPage.generatedSecret();
    expect(passphraseValue).not.toBe(randomValue);
    expect(passphraseValue).toMatch(/-/); // word-word-word-word style

    await vaultPage.useGeneratedSecret();
    await expect(vaultPage.rawPage.getByTestId("vault-secret-input")).toHaveValue(passphraseValue);

    await Promise.all([
      waitForApiResponse(vaultPage.rawPage, "/vault/items", "POST"),
      vaultPage.rawPage.getByTestId("vault-form-submit").click(),
    ]);
    await waitForDialogClosed(vaultPage.rawPage);
    await vaultPage.expectItemVisible(title);
  });

  test("adds a TOTP secret and shows a live rotating code on reveal @regression", async ({ vaultPage, regressionUser }) => {
    const item = randomVaultItem();
    await vaultPage.gotoVault();
    // A standard example base32 secret (the one used throughout RFC 6238 tooling docs) — any
    // valid base32 string works since the code is generated client-side from it.
    await vaultPage.createLoginItem({ ...item, totpSecret: "JBSWY3DPEHPK3PXP" });

    await vaultPage.openReveal(item.title);
    await vaultPage.revealSecret(regressionUser.password);
    await expect(vaultPage.rawPage.getByText("2FA Code")).toBeVisible();
    // 6-digit code rendered as "123 456" — asserting the shape, not an exact value, since it
    // rotates every 30 seconds and this suite doesn't control wall-clock time.
    await expect(vaultPage.rawPage.getByText(/^\d{3} \d{3}$/)).toBeVisible();
    await vaultPage.closeModal();

    // Editing the same item should now show "2FA is set up" instead of a blank input.
    await vaultPage.rawPage.getByRole("button", { name: `Edit ${item.title}` }).click();
    await expect(vaultPage.rawPage.getByText("2FA is set up for this item")).toBeVisible();
    await vaultPage.rawPage.getByRole("button", { name: "Cancel" }).click();
  });

  // "Reused" and "weak" are computed synchronously and locally (secret hashing + the strength
  // heuristic), so fully deterministic. "Breached" is a real call to HIBP's public Pwned
  // Passwords k-anonymity API (see VaultServiceImpl#checkBreach) — a legitimate, key-free,
  // built-for-automated-checking public service (unlike the NSE/BSE live search this suite
  // deliberately avoids elsewhere), so asserting on it here is a reasonable bet, not the same
  // flakiness risk. "password123" is scored weak by VaultPasswordStrengthEvaluator (a common
  // base word plus digits) and has been in the HIBP breach corpus for years.
  test("flags reused, weak, and breached passwords on Vault Health @regression", async ({ vaultPage }) => {
    const weakPassword = "password123";
    const itemA = { ...randomVaultItem(), secret: weakPassword };
    const itemB = { ...randomVaultItem(), secret: weakPassword };

    await vaultPage.gotoVault();
    await vaultPage.createLoginItem(itemA);
    await vaultPage.createLoginItem(itemB);
    await vaultPage.gotoVault(); // fresh load so useVaultHealth reflects both new items

    await expect(vaultPage.rawPage.getByTestId("vault-health-card")).toBeVisible();
    expect(await vaultPage.healthCount("reused")).toBeGreaterThanOrEqual(2);
    expect(await vaultPage.healthCount("weak")).toBeGreaterThanOrEqual(2);
    expect(await vaultPage.healthCount("breached")).toBeGreaterThanOrEqual(1);

    await vaultPage.openHealthTile("weak");
    await expect(vaultPage.healthItemRow(itemA.title)).toBeVisible();
    await vaultPage.healthItemRow(itemA.title).click();
    await expect(vaultPage.rawPage.getByTestId("vault-title-input")).toHaveValue(itemA.title);
    await vaultPage.rawPage.getByRole("button", { name: "Cancel" }).click();

    await vaultPage.deleteItem(itemA.title);
    await vaultPage.deleteItem(itemB.title);
  });

  test("exports vault items as an unencrypted CSV after confirming the account password @regression", async ({ vaultPage, regressionUser }) => {
    const item = randomVaultItem();
    await vaultPage.gotoVault();
    await vaultPage.createLoginItem(item);

    await vaultPage.openExport();
    const download = await vaultPage.exportCsv(regressionUser.password);
    expect(download.suggestedFilename()).toMatch(/^wealthynest-vault-export-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("trusting a device on reveal skips the password prompt on a later reveal @regression", async ({ vaultPage, regressionUser }) => {
    const itemA = randomVaultItem();
    const itemB = randomVaultItem();
    await vaultPage.gotoVault();
    await vaultPage.createLoginItem(itemA);
    await vaultPage.createLoginItem(itemB);

    await vaultPage.openReveal(itemA.title);
    const revealedA = await vaultPage.revealSecret(regressionUser.password, { trustDevice: true });
    expect(revealedA).toBe(itemA.secret);
    await vaultPage.closeModal();

    // The trust token is account-wide (not scoped to itemA) — a different item's reveal should
    // now skip straight past the password form.
    await vaultPage.openReveal(itemB.title);
    await expect(vaultPage.rawPage.getByTestId("vault-reveal-password-input")).toHaveCount(0);
    const revealedB = await vaultPage.revealSecretTrusted();
    expect(revealedB).toBe(itemB.secret);
    await vaultPage.closeModal();

    await vaultPage.deleteItem(itemA.title);
    await vaultPage.deleteItem(itemB.title);
  });
});
