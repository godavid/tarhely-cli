// A tárhely (hivatali kapu) portál SPA-ja mögötti REST API.
//
// A lista, a metaadat és a letöltés is innen jön: a felület Letöltés gombja
// ugyanazt a végpontot hívja, amit itt közvetlenül. A DOM-os út (kijelölés,
// toolbar, modal) élesben sorra eltört, az API stabilabb.
//
// A hívások a LAPON BELÜL futnak (süti + XSRF), ezért `page.evaluate` viszi
// őket. FONTOS: valódi függvényt adunk át, nem stringet — a stringet a Playwright
// kifejezésként értékeli ki, és nem adja át neki az argumentumot.

import type { Page } from "playwright";

import { portalChangedError } from "../errors.js";

export const TARHELY_URL = "https://tarhely.gov.hu";
export const INBOX_URL = "https://tarhely.gov.hu/levelezes/";
const API = "/levelezes/api";

export interface MailboxRef {
  /** A portál postafiók-választójában elfoglalt hely (0 = első, általában a személyes). */
  readonly index: number;
  /** A portál által mutatott név, pl. „Értesítési tárhely" vagy „12345678 (Példa Kft)". */
  readonly name: string;
  /** Mappanévnek alkalmas, ékezet nélküli alak. */
  readonly slug: string;
  /** A portál belső azonosítója; ezzel megy minden API-hívás (`address-id` fejléc). */
  readonly addressId: string;
}

export interface SniffedState {
  addressId: string | null;
  xsrf: string | null;
  mailboxes: MailboxRef[];
}

export interface LetterRow {
  readonly eid: string | null;
  readonly sender: string;
  readonly senderFull: string;
  readonly recipient: string;
  readonly type: string;
  readonly desc: string;
  /** `YYYY-MM-DD HH:MM` */
  readonly receivedAt: string;
  /** `YYYY-MM-DD` */
  readonly receivedOn: string;
  readonly size: number | null;
}

export interface LetterDetail {
  readonly fileName: string | null;
  readonly referencedRegistrationNumber: string | null;
  readonly note: string | null;
}

interface InPageRequest {
  path: string;
  method: string;
  payload: unknown;
  hdr: Record<string, string>;
  binary: boolean;
}

interface InPageResponse {
  status: number;
  contentType?: string | null;
  body: unknown;
}

// Böngésző-kontextusban fut: csak DOM- és fetch-API-t használhat.
async function fetchInPage({
  path,
  method,
  payload,
  hdr,
  binary
}: InPageRequest): Promise<InPageResponse> {
  const headers: Record<string, string> = Object.assign(
    { Accept: binary ? "*/*" : "application/json" },
    hdr
  );
  if (!headers["x-xsrf-token"]) {
    const cookie = document.cookie.split("; ").find((item) => item.startsWith("XSRF-TOKEN="));
    if (cookie) {
      headers["x-xsrf-token"] = decodeURIComponent(cookie.split("=")[1] ?? "");
    }
  }
  const init: RequestInit = { method, headers, credentials: "include" };
  if (payload !== null && payload !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(payload);
  }
  const response = await fetch(path, init);
  if (binary && response.ok) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    let raw = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      raw += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: btoa(raw)
    };
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 300);
  }
  return { status: response.status, body };
}

// excludeSystemMessages: null → a TELJES lista jön. A felület alapértelmezett
// szűrője a rendszerüzeneteket (feladási/letöltési igazolás) elrejti.
const LIST_FILTER = {
  searchTerm: null,
  labelIds: null,
  unreadOnly: null,
  excludeSystemMessages: null,
  messageTypes: [],
  verificationTypes: [],
  incomingFromDate: null,
  incomingToDate: null
};

export function slugify(value: string): string {
  const ascii = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii === "" ? "postafiok" : ascii.slice(0, 60);
}

/** A `/mailbox/reload` válaszából a postafiókok, a választó sorrendjében. */
export function toMailboxRefs(items: unknown): MailboxRef[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const refs: MailboxRef[] = [];
  items.forEach((item: Record<string, unknown>, index) => {
    const name = String(
      item.mailboxName ?? item.megnevezes ?? item.name ?? `postafiók ${index + 1}`
    );
    const addressId = item.azonosito;
    if (typeof addressId !== "string" || addressId === "") {
      return;
    }
    refs.push({ index, name, slug: slugify(name), addressId });
  });
  return refs;
}

export function attachApiListeners(page: Page): SniffedState {
  const state: SniffedState = { addressId: null, xsrf: null, mailboxes: [] };

  page.on("request", (request) => {
    try {
      const headers = request.headers() ?? {};
      const addressId = headers["address-id"];
      if (request.url().includes(`${API}/`) && addressId) {
        state.addressId = addressId;
        const xsrf = headers["x-xsrf-token"];
        if (xsrf) {
          state.xsrf = xsrf;
        }
      }
    } catch {
      // a lesés best-effort; a hiányzó fejlécet a primeApiHeaders jelzi
    }
  });

  page.on("response", (response) => {
    if (!response.url().endsWith(`${API}/mailbox/reload`) || response.status() !== 200) {
      return;
    }
    response
      .json()
      .then((data) => {
        const refs = toMailboxRefs(data);
        if (refs.length > 0) {
          state.mailboxes = refs;
        }
      })
      .catch(() => {});
  });

  return state;
}

/**
 * Friss API-forgalom kikényszerítése, hogy a fejléceket le tudjuk lesni.
 *
 * A figyelőt a belépés UTÁN rakjuk fel, addigra a lap induló hívásai (amik az
 * `address-id`-t hordozzák) már lefutottak. Az újratöltés után a SPA ismét lekéri
 * a postafiókot és a listát, immár a figyelő szeme előtt.
 */
export async function primeApiHeaders(
  page: Page,
  sniffed: SniffedState,
  step: (name: string, ok: boolean, detail?: string | null) => void
): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await page.goto(INBOX_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    for (let tick = 0; tick < 20; tick += 1) {
      if (sniffed.addressId !== null && sniffed.mailboxes.length > 0) {
        step("api-fejlecek", true, `${round + 1}. kör, ${tick} mp`);
        return;
      }
      await page.waitForTimeout(1000);
    }
  }
  throw portalChangedError(
    "a lap három újratöltés után sem hívta a postafiók-API-t (nincs address-id)"
  );
}

// A postafiók-azonosítót KÉTFELŐL ellenőrizzük: rossz address-id-vel egy MÁSIK
// postafiók iratai jönnének vissza. Az eltérés ezért hiba, nem figyelmeztetés.
export function apiHeaders(sniffed: SniffedState, mailbox: MailboxRef): Record<string, string> {
  if (sniffed.addressId !== mailbox.addressId) {
    throw portalChangedError(
      `address-id ütközés (${mailbox.name}): a lap ${String(sniffed.addressId).slice(0, 10)}… azonosítót használ, a várt ${mailbox.addressId.slice(0, 10)}…`
    );
  }
  const headers: Record<string, string> = { "address-id": mailbox.addressId };
  if (sniffed.xsrf) {
    headers["x-xsrf-token"] = sniffed.xsrf;
  }
  return headers;
}

export interface PageLike {
  evaluate(
    fn: (request: InPageRequest) => Promise<InPageResponse>,
    request: InPageRequest
  ): Promise<unknown>;
}

async function apiRequest(
  page: PageLike,
  sniffed: SniffedState,
  mailbox: MailboxRef,
  path: string,
  { method = "GET", payload = null as unknown, binary = false } = {}
): Promise<InPageResponse> {
  const response = (await page.evaluate(fetchInPage, {
    path: `${API}${path}`,
    method,
    payload,
    binary,
    hdr: apiHeaders(sniffed, mailbox)
  })) as InPageResponse | null | undefined;
  if (response === undefined || response === null) {
    throw portalChangedError(`${method} ${path}: a lapon belüli hívás nem adott választ`);
  }
  if (response.status !== 200) {
    throw portalChangedError(
      `${method} ${path} → HTTP ${response.status}: ${String(response.body).slice(0, 120)}`
    );
  }
  return response;
}

async function apiCall(
  page: PageLike,
  sniffed: SniffedState,
  mailbox: MailboxRef,
  path: string,
  method = "GET",
  payload: unknown = null
): Promise<unknown> {
  return (await apiRequest(page, sniffed, mailbox, path, { method, payload })).body;
}

export async function apiList(
  page: PageLike,
  sniffed: SniffedState,
  mailbox: MailboxRef
): Promise<LetterRow[]> {
  const out: Record<string, unknown>[] = [];
  for (let pageNumber = 0; pageNumber < 50; pageNumber += 1) {
    const body = (await apiCall(page, sniffed, mailbox, "/uzenetek/BEERKEZETT/kereses", "POST", {
      pageNumber,
      countPerPage: "100",
      filter: LIST_FILTER
    })) as { uzenetek?: Record<string, unknown>[]; uzenetekSzama?: number | null };
    const items = body.uzenetek ?? [];
    out.push(...items);
    const total = body.uzenetekSzama;
    if (items.length === 0 || (total !== null && total !== undefined && out.length >= total)) {
      break;
    }
  }
  return out.map(apiRow);
}

export async function apiDetail(
  page: PageLike,
  sniffed: SniffedState,
  mailbox: MailboxRef,
  eid: string
): Promise<LetterDetail> {
  const detail = (await apiCall(
    page,
    sniffed,
    mailbox,
    `/uzenet/beerkezett/${encodeURIComponent(eid)}`
  )) as Record<string, unknown>;
  return {
    fileName: typeof detail.fajlNev === "string" ? detail.fajlNev : null,
    referencedRegistrationNumber:
      typeof detail.hivatkozottErkeztetesiSzam === "string"
        ? detail.hivatkozottErkeztetesiSzam
        : null,
    note: typeof detail.megjegyzes === "string" ? detail.megjegyzes : null
  };
}

// Az API `erkezesiDatum`-a magyar helyi idő UTC-nek álcázva: ezért olvassuk
// UTC-ben, különben a nyári időszámítás két órát csúsztatna a napon.
export function apiRow(item: Record<string, unknown>): LetterRow {
  const ts = item.erkezesiDatum;
  const when =
    typeof ts === "number" || typeof ts === "string"
      ? new Date(ts).toISOString().slice(0, 16).replace("T", " ")
      : "";
  return {
    eid: typeof item.erkeztetesiSzam === "string" ? item.erkeztetesiSzam : null,
    sender: String(item.feladoRovidNev || item.feladoNev || ""),
    senderFull: String(item.feladoNev ?? ""),
    recipient: String(item.cimzettNev ?? ""),
    type: String(item.dokumentumTipus ?? ""),
    desc: String(item.dokumentumLeiras ?? ""),
    receivedAt: when,
    receivedOn: when.slice(0, 10),
    size: typeof item.fajlMeret === "number" ? item.fajlMeret : null
  };
}

export function sanitizeSuggestedFileName(fileName: string): string {
  const safe = fileName.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^\.+/, "");
  return (safe === "" ? "download.bin" : safe).slice(-80);
}

/** Új-e a levél: ismeretlen érkeztetési szám ÉS a küszöbnapon vagy utána jött. */
export function isNewLetter(
  row: LetterRow,
  knownIds: ReadonlySet<string>,
  since: string | null
): boolean {
  if (row.eid === null || row.eid === "") {
    return false;
  }
  if (knownIds.has(row.eid)) {
    return false;
  }
  return since === null || row.receivedOn >= since;
}

export interface DownloadedFile {
  readonly name: string;
  readonly bytes: Buffer;
}

/**
 * Egy levél letöltése a postafiók saját `address-id`-jával, a felület
 * listájától, szűrőjétől és kijelölésétől függetlenül. A fájlnevet a részletező
 * API `fajlNev` mezője adja, mert a letöltő válasz nem küld
 * `Content-Disposition` fejlécet.
 */
export async function downloadLetter(
  page: PageLike,
  sniffed: SniffedState,
  mailbox: MailboxRef,
  eid: string,
  fileName: string | null
): Promise<DownloadedFile> {
  const path = `/uzenet/letoltes/beerkezett/${encodeURIComponent(eid)}`;
  const response = await apiRequest(page, sniffed, mailbox, path, { binary: true });
  // Lejárt munkamenetnél a portál 200-zal is adhat hibaüzenetet vagy
  // belépőoldalt; az nem kerülhet be hatósági iratként.
  const contentType = String(response.contentType ?? "");
  if (/json|html/i.test(contentType)) {
    throw portalChangedError(`GET ${path}: ${contentType} választ adott fájl helyett`);
  }
  const bytes = Buffer.from(String(response.body), "base64");
  if (bytes.byteLength === 0) {
    throw portalChangedError(`GET ${path}: üres letöltés`);
  }
  return { name: sanitizeSuggestedFileName(fileName ?? ""), bytes };
}

export async function readQuotaPercent(
  page: PageLike,
  sniffed: SniffedState,
  mailbox: MailboxRef
): Promise<number | null> {
  try {
    const details = (await apiCall(page, sniffed, mailbox, "/mailbox/details")) as Record<
      string,
      unknown
    >;
    const used = Number(details.hasznaltKvota ?? 0);
    const total = Number(details.kvota ?? 0);
    return total > 0 ? Math.round((used / total) * 1000) / 10 : null;
  } catch {
    return null;
  }
}
