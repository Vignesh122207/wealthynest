import {expect, type Locator, type Page} from "@playwright/test";
import {toastLocator} from "../helpers/wait.helper";
import {TEST_IDS} from "../constants/testIds";

/** Shared behavior every dashboard page object needs — nav, header title, toast assertions. */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /** Escape hatch for tools that need the raw `Page` itself (e.g. AxeBuilder — see a11y.spec.ts)
   * rather than a Locator/testid. Prefer a named BasePage method for anything reused more than
   * once; this exists so those tools don't have to be threaded through every page object. */
  get rawPage(): Page {
    return this.page;
  }

  get headerTitle(): Locator {
    return this.page.getByTestId(TEST_IDS.header.title);
  }

  async expectHeaderTitle(title: string | RegExp): Promise<void> {
    await expect(this.headerTitle).toHaveText(title);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async expectToast(text: string | RegExp): Promise<void> {
    await expect(toastLocator(this.page, text).first()).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.page.getByTestId(TEST_IDS.nav.logout).click();
  }

  navLink(href: string): Locator {
    return this.page.getByTestId(TEST_IDS.nav.link(href));
  }

  async navigateTo(href: string): Promise<void> {
    await this.navLink(href).click();
  }

  /** Below the `lg` breakpoint, the desktop `<aside>` sidebar is unrendered and nav links only
   * exist inside the slide-out mobile overlay — call this before navLink()/navigateTo() on a
   * narrow viewport (see responsive.spec.ts). */
  async openMobileMenu(): Promise<void> {
    await this.page.getByTestId(TEST_IDS.nav.mobileMenuToggle).click();
  }

  /** Generic testid escape hatch for one-off checks that don't warrant a dedicated method (see
   * responsive.spec.ts's FAB check) — prefer a named method for anything reused more than once. */
  byTestId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  async expectUrl(pattern: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  /** next-themes (see wealthynest-web's app/layout.tsx: `<ThemeProvider attribute="class">`)
   * applies the active theme as a class on `<html>` — this checks that actual application state,
   * not just a picker's own selected-option styling (SettingsPage.expectThemeSelected checks that
   * instead; use both together for a real dark-mode assertion, see settings.spec.ts). */
  async expectHtmlThemeClass(theme: "dark" | "light"): Promise<void> {
    await expect(this.page.locator("html")).toHaveClass(new RegExp(theme));
  }

  /** A page whose content overflows its viewport horizontally forces the whole app into
   * side-scroll on narrow screens — the most common "not actually responsive" symptom. */
  async expectNoHorizontalOverflow(): Promise<void> {
    const { scrollWidth, clientWidth } = await this.page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, "page overflows horizontally at the current viewport width").toBeLessThanOrEqual(clientWidth + 1);
  }
}
