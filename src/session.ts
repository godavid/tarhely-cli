// Egy bejelentkezett munkamenet: belépő betöltése, böngésző, KAÜ-belépés,
// API-fejlécek. Minden portálhoz nyúló parancs ezen át megy, így a belépés és a
// takarítás egy helyen van.

import type { Page } from "playwright";
import { launchBrowser } from "./browser.js";
import { loginToKau } from "./kau/login.js";
import type { Reporter } from "./report.js";
import type { CredentialStore } from "./store/credentials.js";
import {
  attachApiListeners,
  type MailboxRef,
  primeApiHeaders,
  type SniffedState,
  TARHELY_URL
} from "./tarhely/api.js";

export interface Session {
  readonly page: Page;
  readonly sniffed: SniffedState;
  readonly mailboxes: readonly MailboxRef[];
}

export interface SessionOptions {
  readonly store: CredentialStore;
  readonly reporter: Reporter;
  readonly headed: boolean;
}

export async function withSession<T>(
  options: SessionOptions,
  work: (session: Session) => Promise<T>
): Promise<T> {
  const credentials = options.store.require();
  const browser = await launchBrowser({ headed: options.headed });
  // A belépési lépésekről SOHA nincs diagnosztika: a kitöltött mezők értéke
  // bekerülne a képernyőképbe. A capture csak sikeres belépés után él.
  let loggedIn = false;
  try {
    await loginToKau(
      browser.page,
      { targetUrl: TARHELY_URL, ...credentials },
      options.reporter.step
    );
    loggedIn = true;
    const sniffed = attachApiListeners(browser.page);
    await primeApiHeaders(browser.page, sniffed, options.reporter.step);
    return await work({ page: browser.page, sniffed, mailboxes: sniffed.mailboxes });
  } catch (error) {
    if (loggedIn) {
      await options.reporter.capture(browser.page, "error");
    }
    throw error;
  } finally {
    await browser.close();
  }
}

/** A `--mailbox` értéke: `all`, sorszám (1-től), vagy a név egy részlete. */
export function selectMailboxes(mailboxes: readonly MailboxRef[], selector: string): MailboxRef[] {
  if (selector === "all") {
    return [...mailboxes];
  }
  if (/^\d+$/.test(selector)) {
    const match = mailboxes[Number(selector) - 1];
    return match ? [match] : [];
  }
  const needle = selector.toLowerCase();
  return mailboxes.filter(
    (mailbox) => mailbox.name.toLowerCase().includes(needle) || mailbox.slug.includes(needle)
  );
}
