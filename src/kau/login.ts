// KAÜ (Ügyfélkapu+) belépés Playwrighttal.
//
// Minden hatósági felület ugyanezen a flow-n megy be, csak a cél-URL más. A
// lépéssor élesben, napi futásban bevált; a szándékos várakozások a portál lassan
// renderelődő választólapját és a TOTP-ablak lejáratát kezelik.
//
// A belépési lépésekről SZÁNDÉKOSAN nem készül képernyőkép vagy
// accessibility-snapshot: a kitöltött mezők értéke bekerülne az artefaktumba.

import type { Page } from "playwright";

import { loginFailedError, portalChangedError } from "../errors.js";
import { secondsLeftInWindow, totpCode } from "./totp.js";

export interface LoginOptions {
  readonly targetUrl: string;
  readonly username: string;
  readonly password: string;
  readonly totpSeed: string;
}

export type StepFn = (name: string, ok: boolean, detail?: string | null) => void;

const KAU_BUTTON_LABEL = "Ügyfélkapu+ hitelesítő alkalmazással";

async function acceptCookies(page: Page): Promise<void> {
  for (const label of ["Megértettem", "Elfogadom", "Rendben"]) {
    const button = page.getByRole("button", { name: label });
    const found = await button
      .count()
      .then((count) => count > 0)
      .catch(() => false);
    if (found) {
      await button
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
      return;
    }
  }
}

// Némely hatósági felület nem közvetlenül a KAÜ-választóra visz: a saját landing
// oldalán előbb a „Bejelentkezés" gombra kell kattintani. A tárhely közvetlenül a
// választót adja. A guard csak akkor lép, ha a gomb rövid várakozás után sincs
// jelen: a várakozás nélküli pillanatkép a lassan renderelődő választólapon
// tévesen a landing-ágra vinne.
async function advanceToKauSelection(page: Page, step: StepFn): Promise<void> {
  const kauReady = await page
    .getByRole("button", { name: KAU_BUTTON_LABEL })
    .first()
    .waitFor({ state: "attached", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (kauReady) {
    return;
  }

  const loginButton = page.getByRole("button", { name: /^Bejelentkezés( az oldalra)?$/ });
  const hasLogin = await loginButton
    .count()
    .then((count) => count > 0)
    .catch(() => false);
  if (hasLogin) {
    await loginButton.click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(3000);
    step("kau-valaszto", true, "Bejelentkezés → KAÜ-választó");
  }
}

// A KAÜ-választón a DÁP-os elrendezés egy `div.dap-login` réteggel fedheti a
// gombot: a Playwright akcionálhatósági ellenőrzése ilyenkor a timeoutig
// „intercepts pointer events"-szel próbálkozik, hiába látható a gomb. A gomb
// inline `onclick`-je egy rejtett formot submittel, ezért a click esemény
// közvetlen kiváltása (réteg-ellenőrzés nélkül) ugyanazt az utat indítja el.
async function clickKauButton(page: Page, step: StepFn): Promise<void> {
  const button = page.getByRole("button", { name: KAU_BUTTON_LABEL });
  try {
    await button.click({ timeout: 5_000 });
    return;
  } catch (error) {
    step("kau-gomb", true, `közvetlen kattintás nem ment (${message(error)}), esemény-kiváltás`);
  }
  await button.dispatchEvent("click", undefined, { timeout: 5_000 });
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page
    .locator(selector)
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * Belép a KAÜ-n, és a megadott hatósági felületen hagyja a böngészőt.
 *
 * Hibáknál megkülönbözteti a rossz belépőt (a form ugyanott marad) a portál
 * változásától (a várt elem sehol), mert a felhasználónak más a teendője.
 */
export async function loginToKau(page: Page, options: LoginOptions, step: StepFn): Promise<void> {
  const { targetUrl, username, password, totpSeed } = options;

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);
  await acceptCookies(page);
  step("open-target", true, targetUrl);

  await advanceToKauSelection(page, step);

  // A dropdownt előbb ki kell nyitni, különben a lenti gombok „intercepts
  // pointer events" hibát adnak, hiába láthatók.
  const dropdown = page.locator("#dropdown-control-id");
  const hasDropdown = await dropdown
    .count()
    .then((count) => count > 0)
    .catch(() => false);
  if (hasDropdown) {
    await dropdown.click({ timeout: 15_000 });
    await page.waitForTimeout(1200);
  }

  try {
    await clickKauButton(page, step);
    await page.waitForSelector("#name", { timeout: 30_000 });
  } catch (error) {
    const failure = portalChangedError(
      `nem található az „${KAU_BUTTON_LABEL}" belépési út (${message(error)})`
    );
    // Itt még semmilyen titok nincs a lapon, a képernyőkép veszélytelen és hasznos.
    failure.capturable = true;
    throw failure;
  }
  await page.waitForTimeout(1200);
  step("kau-form", true);

  await page.fill("#name", username);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Bejelentkezés" }).click();
  try {
    await page.waitForSelector("#identifier", { timeout: 30_000 });
  } catch {
    if (await isVisible(page, "#password")) {
      throw loginFailedError("a portál nem fogadta el a felhasználónevet vagy a jelszót");
    }
    throw portalChangedError("a jelszó után nem jelent meg a hitelesítő kód mezője");
  }
  await page.waitForTimeout(1200);
  step("password-accepted", true);

  // Ne küldjünk olyan kódot, ami küldés közben jár le.
  const remaining = secondsLeftInWindow(Date.now() / 1000);
  if (remaining < 8) {
    await page.waitForTimeout((remaining + 1) * 1000);
  }
  await page.fill("#identifier", totpCode(totpSeed, Date.now() / 1000));
  await page.getByRole("button", { name: "Bejelentkezés" }).click();
  await page.waitForLoadState("domcontentloaded");

  // A KAÜ a SAML-választ egy köztes `/proxy/saml/response` lapon át küldi
  // vissza a célfelületnek; ez helyben lassabb lehet, mint a fix várakozás.
  const targetHost = new URL(targetUrl).host;
  await page
    .waitForURL((url) => url.host.includes(targetHost), { timeout: 45_000 })
    .catch(() => {});
  await page.waitForTimeout(2000);
  if (!page.url().includes(targetHost)) {
    if (await isVisible(page, "#identifier")) {
      throw loginFailedError(
        "a portál nem fogadta el a hitelesítő kódot (rossz TOTP-seed vagy pontatlan óra)"
      );
    }
    throw loginFailedError(`a belépés után nem a célfelületen vagyunk (${page.url()})`);
  }
  step("logged-in", true, page.url());
}

// A Playwright hívásnaplójából az első sor mellé az OKOT is kiemeljük
// („intercepts pointer events", „not visible"…): ez különbözteti meg a portál
// átalakulását a hálózati lassúságtól.
function message(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const lines = error.message
    .replace(/\u001b\[\d+m/g, "")
    .split("\n")
    .map((line) => line.trim());
  const first = lines[0] ?? error.message;
  const reason = lines.find((line) =>
    /intercepts pointer events|not visible|not enabled|not attached|hidden/.test(line)
  );
  return reason ? `${first} ${reason.replace(/^-\s*/, "")}` : first;
}
