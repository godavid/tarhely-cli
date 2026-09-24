// Első beállítás: belépő bekérése a terminálban, kulcstartóba mentés, Chromium
// telepítése, próba-belépés. A belépőt az ember gépeli be, rejtve; argumentumban
// vagy chatben soha nem utazik.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { isChromiumInstalled } from "../browser.js";
import { isValidTotpSeed } from "../kau/totp.js";
import { ask, askHidden } from "../prompt.js";
import type { Reporter } from "../report.js";
import { withSession } from "../session.js";
import type { CredentialStore } from "../store/credentials.js";

export interface InitOptions {
  readonly store: CredentialStore;
  readonly reporter: Reporter;
  readonly headed: boolean;
}

export async function runInit(options: InitOptions): Promise<number> {
  const { reporter, store } = options;
  if (reporter.json) {
    return reporter.fail(
      new Error("Az init interaktív parancs, --json nélkül, saját terminálban futtatandó.")
    );
  }

  reporter.info("Ügyfélkapu+ belépő rögzítése a rendszer kulcstartójába.");
  reporter.info("A jelszó és a TOTP-seed gépelés közben nem látszik.\n");

  const username = await ask("Ügyfélkapu felhasználónév: ");
  const password = await askHidden("Jelszó: ");
  let totpSeed = await askHidden("TOTP-seed (a hitelesítő alkalmazás kézi beviteli kulcsa): ");
  while (!isValidTotpSeed(totpSeed)) {
    reporter.info(
      "Ez nem érvényes base32 kulcs. A QR-kód melletti betű-szám sorozat kell, szóközök nélkül."
    );
    totpSeed = await askHidden("TOTP-seed: ");
  }
  if (username === "" || password === "") {
    return reporter.fail(new Error("A felhasználónév és a jelszó nem lehet üres."));
  }

  try {
    store.save({ username, password, totpSeed: totpSeed.replace(/[\s-]+/g, "").toUpperCase() });
  } catch (error) {
    return reporter.fail(error);
  }
  reporter.info("\nBelépő elmentve a kulcstartóba (tarhely-cli / default).");

  if (!isChromiumInstalled()) {
    reporter.info("Chromium telepítése a Playwright alá (egyszeri, ~150 MB)…");
    const status = installChromium();
    if (status !== 0) {
      return reporter.fail(
        new Error(
          "A Chromium telepítése nem sikerült. Futtasd kézzel: npx playwright install chromium"
        )
      );
    }
  }

  reporter.info("Próba-belépés…");
  try {
    const mailboxes = await withSession(
      { store, reporter, headed: options.headed },
      async (session) => session.mailboxes.map((mailbox) => mailbox.name)
    );
    reporter.info("\nSikeres belépés. Elérhető postafiókok:");
    mailboxes.forEach((name, index) => {
      reporter.info(`  ${index + 1}. ${name}`);
    });
    reporter.info("\nKövetkező lépés: npx tarhely-cli download --out ./tarhely");
    return reporter.finish({ mailboxes });
  } catch (error) {
    reporter.info("A belépő elmentve, de a próba-belépés nem sikerült.");
    return reporter.fail(error);
  }
}

function installChromium(): number {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
  const result = spawnSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
  return result.status ?? 1;
}
