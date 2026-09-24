// Böngésző-indítás a KAÜ-belépéshez.
//
// A hálózat allowlistes: csak a KAÜ- és a tárhely-domainek felé mehet kérés,
// minden mást a böngésző elutasít. Ha a runner egyszer rossz oldalra
// navigálna, a belépő akkor sem jut ki máshová.

import { existsSync } from "node:fs";

import { type Browser, type BrowserContext, chromium, type Page } from "playwright";

import { EXIT_CODES, TarhelyError } from "./errors.js";

export const ALLOWED_HOSTS = [
  "kau.gov.hu",
  "*.kau.gov.hu",
  "idp.gov.hu",
  "tarhely.gov.hu",
  "*.tarhely.gov.hu"
] as const;

export function isAllowedHost(host: string, allowed: readonly string[] = ALLOWED_HOSTS): boolean {
  return allowed.some((pattern) =>
    pattern.startsWith("*.") ? host.endsWith(pattern.slice(1)) : host === pattern
  );
}

export interface BrowserSession {
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
  close(): Promise<void>;
}

export interface LaunchOptions {
  readonly headed?: boolean;
}

export function isChromiumInstalled(): boolean {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

export async function launchBrowser(options: LaunchOptions = {}): Promise<BrowserSession> {
  if (!isChromiumInstalled()) {
    throw new TarhelyError(
      EXIT_CODES.unknown,
      "Nincs telepített Chromium a Playwright alatt.",
      "Futtasd: npx playwright install chromium (az `npx tarhely-cli init` is megteszi)."
    );
  }
  const browser = await chromium.launch({
    headless: options.headed !== true,
    args: ["--disable-dev-shm-usage"]
  });
  const context = await browser.newContext({
    locale: "hu-HU",
    viewport: { width: 1600, height: 1000 }
  });
  await context.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (isAllowedHost(host)) {
      return route.continue();
    }
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  return {
    browser,
    context,
    page,
    async close() {
      await browser.close().catch(() => {});
    }
  };
}
