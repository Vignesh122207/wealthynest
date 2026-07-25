import {expect, type Download, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

export class VaultPage extends BasePage {
  async gotoVault(): Promise<void> {
    await this.goto(ROUTES.vault);
  }

  async createLoginItem(input: { title: string; secret: string; username?: string; totpSecret?: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addVaultItem).click();
    await this.page.getByTestId("vault-title-input").fill(input.title);
    await this.page.getByTestId("vault-secret-input").fill(input.secret);
    if (input.username) {
      await this.page.getByLabel("Username / Email").fill(input.username);
    }
    if (input.totpSecret) {
      // Collapsed by default (VaultItemForm's <details> disclosure) — has to be opened before
      // its input becomes visible/fillable.
      await this.page.locator("summary", { hasText: "Add a 2FA code" }).click();
      await this.page.getByTestId("vault-totp-input").fill(input.totpSecret);
    }
    await Promise.all([
      waitForApiResponse(this.page, "/vault/items", "POST"),
      this.page.getByTestId("vault-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Opens the "Generate" panel (PasswordGeneratorPanel) already showing in the create/edit form —
   * it renders a live preview on mount and on every option change but only writes into
   * `vault-secret-input` once "Use this" is clicked (see useGeneratedSecret) — matches the Vault
   * redesign prototype's preview-then-confirm generate panel. */
  async openGenerator(): Promise<void> {
    await this.page.getByRole("button", { name: "Generate" }).click();
  }

  async setGeneratorMode(mode: "Random" | "Passphrase"): Promise<void> {
    await this.page.getByRole("button", { name: mode }).click();
  }

  /** Reads the generator panel's own live preview — not yet committed to the real password field.
   * The preview is written by a post-mount effect (React state, not an uncontrolled input ref like
   * `vault-secret-input` used to be), so the element can be visible a beat before it's populated —
   * wait for non-empty text rather than reading immediately. */
  async generatedSecret(): Promise<string> {
    const preview = this.page.getByTestId("vault-generator-preview");
    await expect(preview).not.toHaveText("", { timeout: 5000 });
    return preview.innerText();
  }

  /** Commits the panel's current preview into `vault-secret-input` and closes the panel. */
  async useGeneratedSecret(): Promise<void> {
    await this.page.getByTestId("vault-generator-use").click();
  }

  /** SECURE_NOTE items skip the LOGIN-only username/URL fields and use a plain textarea
   * (`getByLabel("Note")`) instead of `vault-secret-input` for their body. */
  async createSecureNote(input: { title: string; note: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addVaultItem).click();
    await this.page.getByRole("button", { name: "Secure Note" }).click();
    await this.page.getByTestId("vault-title-input").fill(input.title);
    await this.page.getByLabel("Note", { exact: true }).fill(input.note);
    await Promise.all([
      waitForApiResponse(this.page, "/vault/items", "POST"),
      this.page.getByTestId("vault-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Opens the edit modal (row's main click surface, aria-label="Edit {title}") and renames the
   * item — password/note is left blank, which the backend keeps unchanged (see vaultItemSchema's
   * `requireSecret` for why that's valid on update but not create). */
  async editTitle(currentTitle: string, newTitle: string): Promise<void> {
    await this.page.getByRole("button", { name: `Edit ${currentTitle}` }).click();
    await this.page.getByTestId("vault-title-input").fill(newTitle);
    await Promise.all([
      waitForApiResponse(this.page, /\/vault\/items\/.+$/, "PUT"),
      this.page.getByTestId("vault-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Favorite toggle's aria-label encodes both the item title and the *action* (not current
   * state), so the caller states the target state and this picks the matching button label. */
  async setFavorite(title: string, favorite: boolean): Promise<void> {
    const label = favorite ? `Add ${title} to favorites` : `Remove ${title} from favorites`;
    await Promise.all([
      waitForApiResponse(this.page, /\/vault\/items\/.+\/favorite$/, "PATCH"),
      this.page.getByRole("button", { name: label }).click(),
    ]);
  }

  async expectFavorite(title: string, favorite: boolean): Promise<void> {
    const label = favorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`;
    await expect(this.page.getByRole("button", { name: label })).toBeVisible();
  }

  /** VaultItemRow's whole clickable surface opens the reveal modal (aria-label="View {title}") —
   * no shared data-testid across rows since the title itself is always unique enough to target.
   * `exact: true` matters here — Playwright's default name matching is substring-based, so a
   * renamed item like "X Renamed" would otherwise still match a lookup for "X". */
  rowByTitle(title: string): Locator {
    return this.page.getByRole("button", { name: `View ${title}`, exact: true });
  }

  async openReveal(title: string): Promise<void> {
    await this.rowByTitle(title).click();
  }

  /** Confirms with the account password (RevealSecretModal re-authenticates every reveal) and
   * returns the plaintext secret once the toggle is switched to show it. Pass `trustDevice: true`
   * to also check "Trust this device" — a later `openReveal()` + `revealSecretTrusted()` on any
   * item then skips the password prompt entirely (the trust token is account-wide, not scoped to
   * the item that issued it — see VaultServiceImpl#issueStepUpToken). */
  async revealSecret(accountPassword: string, opts?: { trustDevice?: boolean }): Promise<string> {
    await this.page.getByTestId("vault-reveal-password-input").fill(accountPassword);
    if (opts?.trustDevice) {
      await this.page.getByTestId("vault-trust-device-checkbox").check();
    }
    await Promise.all([
      waitForApiResponse(this.page, /\/vault\/items\/.+\/reveal$/, "POST"),
      this.page.getByTestId("vault-reveal-submit").click(),
    ]);
    await this.page.getByRole("button", { name: "Show" }).click();
    return this.page.getByTestId("vault-revealed-secret").innerText();
  }

  /** For a reveal that auto-completes via an already-trusted device (RevealSecretModal's own
   * `autoRevealPending` effect) — no password form ever renders, so this only waits for the
   * revealed content itself rather than filling/submitting anything. */
  async revealSecretTrusted(): Promise<string> {
    await this.page.getByRole("button", { name: "Show" }).click();
    return this.page.getByTestId("vault-revealed-secret").innerText();
  }

  /** True once RevealSecretModal has settled past its brief "Unlocking…" auto-reveal state into
   * either the password form or the revealed-secret view. */
  async expectNotUnlocking(): Promise<void> {
    await expect(this.page.getByText("Unlocking…")).toHaveCount(0);
  }

  async closeModal(): Promise<void> {
    await this.page.getByRole("button", { name: "Done" }).click();
    await waitForDialogClosed(this.page);
  }

  async openExport(): Promise<void> {
    await this.page.getByTestId("vault-export-open").click();
  }

  async exportCsv(accountPassword: string): Promise<Download> {
    await this.page.getByTestId("vault-export-password-input").fill(accountPassword);
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.page.getByTestId("vault-export-submit").click(),
    ]);
    return download;
  }

  healthTile(key: "reused" | "weak" | "breached"): Locator {
    return this.page.getByTestId(`vault-health-tile-${key}`);
  }

  async healthCount(key: "reused" | "weak" | "breached"): Promise<number> {
    const text = await this.healthTile(key).locator("p.text-lg").innerText();
    return parseInt(text, 10);
  }

  async openHealthTile(key: "reused" | "weak" | "breached"): Promise<void> {
    await this.healthTile(key).click();
  }

  healthItemRow(title: string): Locator {
    return this.page.getByTestId("vault-health-item-row").filter({ hasText: title });
  }

  async deleteItem(title: string): Promise<void> {
    await this.page.getByRole("button", { name: `Edit ${title}` }).click();
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, /\/vault\/items\/.+$/, "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async expectItemVisible(title: string): Promise<void> {
    await expect(this.rowByTitle(title)).toBeVisible();
  }

  async expectItemNotVisible(title: string): Promise<void> {
    await expect(this.rowByTitle(title)).toHaveCount(0);
  }
}
