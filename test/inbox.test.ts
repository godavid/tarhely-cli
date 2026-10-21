import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import type { Page } from "playwright";
import { afterEach, describe, expect, it } from "vitest";
import type { StepFn } from "../src/kau/login.js";
import type { Session } from "../src/session.js";
import { appendIndex, readIndex } from "../src/store/index.js";
import type { MailboxRef } from "../src/tarhely/api.js";
import {
  type DownloadOptions,
  type DownloadResult,
  downloadNewLetters,
  type ListOptions,
  listLetters
} from "../src/tarhely/inbox.js";

const testMailbox: MailboxRef = {
  index: 0,
  name: "12345678 (Példa Kft.)",
  slug: "12345678-pelda-kft",
  addressId: "addr-001"
};

const EID_0101 = "000000012026010100000001";
const EID_0103 = "000000012026010300000002";
const EID_0105 = "000000012026010500000003";
const EID_1231 = "000000012025123100000004";

const DOWNLOADED_AT = "2026-01-06T09:30:00.000Z";
const DEFAULT_LABEL = "tajekoztatas-adougyben";

const dirs: string[] = [];

function tempOutDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-inbox-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

interface RawRowOptions {
  readonly eid: string;
  readonly receivedAtMs?: number;
  readonly desc?: string;
  readonly type?: string;
}

/** Nyers listaelem a portál API mezőivel, ahogy az apiList kapja (ld. apiRow). */
function rawRow({
  eid,
  receivedAtMs,
  desc = "Tájékoztatás adóügyben",
  type = "Adóigazolás"
}: RawRowOptions): Record<string, unknown> {
  const row: Record<string, unknown> = {
    erkeztetesiSzam: eid,
    feladoRovidNev: "NAV",
    feladoNev: "Nemzeti Adó- és Vámhivatal",
    cimzettNev: "Példa Kft.",
    dokumentumTipus: type,
    dokumentumLeiras: desc,
    fajlMeret: 2048
  };
  if (receivedAtMs !== undefined) {
    row.erkezesiDatum = receivedAtMs;
  }
  return row;
}

interface Harness {
  readonly session: Session;
  readonly step: StepFn;
  readonly steps: string[];
  /** Ezeknek a leveleknek a letöltése HTTP 500-zal válaszol; élőben módosítható. */
  readonly failingDownloads: Set<string>;
}

/**
 * Fake munkamenet egyetlen postafiókkal. A lap `evaluate`-ja a valódi
 * `fetchInPage` helyett a `responseFor`ból válaszol, a postafiók-választó gomb
 * viszont „nincs a DOM-ban”, így a switchMailbox az egypostafiókos gyorsutat
 * járja, és a tényleges listázást/letöltést az api.ts valós kódja végzi.
 */
function createHarness(
  listRows: readonly Record<string, unknown>[],
  details: Record<string, Record<string, unknown>> = {},
  files: Record<string, Buffer> = {}
): Harness {
  const failingDownloads = new Set<string>();
  const steps: string[] = [];
  const step: StepFn = (name, ok, detail) => {
    steps.push(`${name}:${ok ? "ok" : "hibas"}:${detail ?? ""}`);
  };

  function responseFor(request: { path: string }): unknown {
    if (request.path === "/levelezes/api/uzenetek/BEERKEZETT/kereses") {
      return { status: 200, body: { uzenetek: [...listRows], uzenetekSzama: listRows.length } };
    }
    if (request.path === "/levelezes/api/mailbox/details") {
      return { status: 200, body: { hasznaltKvota: 10, kvota: 200 } };
    }
    const detail = request.path.match(/^\/levelezes\/api\/uzenet\/beerkezett\/([^/]+)$/);
    if (detail) {
      return { status: 200, body: details[decodeURIComponent(detail[1])] ?? {} };
    }
    const download = request.path.match(
      /^\/levelezes\/api\/uzenet\/letoltes\/beerkezett\/([^/]+)$/
    );
    if (download) {
      const eid = decodeURIComponent(download[1]);
      if (failingDownloads.has(eid)) {
        return { status: 500, body: "Szerver hiba" };
      }
      const bytes = files[eid];
      if (bytes === undefined) {
        throw new Error(`A tesztnek nincs letöltési válasza ehhez: ${eid}`);
      }
      return {
        status: 200,
        contentType: "application/octet-stream",
        body: bytes.toString("base64")
      };
    }
    throw new Error(`A teszt nem ismeri ezt az API-hívást: ${request.path}`);
  }

  const locator = {
    first() {
      return locator;
    },
    getAttribute() {
      return Promise.resolve(null);
    },
    click() {
      return Promise.resolve();
    },
    count() {
      return Promise.resolve(0);
    },
    waitFor() {
      return Promise.reject(new Error("nincs postafiók-választó"));
    }
  };
  const page = {
    evaluate: (_fn: unknown, request: { path: string }): Promise<unknown> =>
      Promise.resolve(responseFor(request)),
    locator: () => locator,
    waitForTimeout: () => Promise.resolve(),
    keyboard: { press: () => Promise.resolve() }
  } as unknown as Page;

  return {
    session: {
      page,
      sniffed: { addressId: testMailbox.addressId, xsrf: "token-xyz", mailboxes: [testMailbox] },
      mailboxes: [testMailbox]
    },
    step,
    steps,
    failingDownloads
  };
}

function listOptions(harness: Harness, outDir: string | null, since: string | null): ListOptions {
  return { mailboxes: [testMailbox], since, outDir, step: harness.step };
}

async function runDownload(
  harness: Harness,
  outDir: string,
  overrides: Partial<DownloadOptions> = {}
): Promise<DownloadResult> {
  return downloadNewLetters(harness.session, {
    mailboxes: [testMailbox],
    since: null,
    outDir,
    max: 100,
    extract: false,
    step: harness.step,
    now: () => new Date(DOWNLOADED_AT),
    ...overrides
  });
}

function seedIndex(outDir: string, eid: string): void {
  appendIndex(outDir, {
    eid,
    mailbox: testMailbox.name,
    receivedOn: "2026-01-01",
    receivedAt: "2026-01-01 10:00",
    sender: "NAV",
    type: "Adóigazolás",
    desc: "Tájékoztatás adóügyben",
    referencedRegistrationNumber: null,
    note: null,
    dir: `${testMailbox.slug}/2026-01-01_${eid}_${DEFAULT_LABEL}`,
    file: "level.pdf",
    extracted: [],
    downloadedAt: "2026-01-01T10:05:00.000Z"
  });
}

function letterDir(outDir: string, eid: string, receivedOn: string, label = DEFAULT_LABEL): string {
  return path.join(outDir, testMailbox.slug, `${receivedOn}_${eid}_${label}`);
}

describe("listLetters", () => {
  it("marks letters already in index.jsonl as not new and unknown ones as new", async () => {
    const outDir = tempOutDir();
    seedIndex(outDir, EID_0101);
    const harness = createHarness([
      rawRow({ eid: EID_0101, receivedAtMs: Date.UTC(2026, 0, 1, 10) }),
      rawRow({ eid: EID_0103, receivedAtMs: Date.UTC(2026, 0, 3, 12) })
    ]);
    const letters = await listLetters(harness.session, listOptions(harness, outDir, null));
    expect(letters.map((letter) => [letter.eid, letter.isNew])).toEqual([
      [EID_0101, false],
      [EID_0103, true]
    ]);
    expect(letters.every((letter) => letter.mailbox === testMailbox.name)).toBe(true);
  });

  it("treats every letter as new when outDir is null", async () => {
    const harness = createHarness([
      rawRow({ eid: EID_0101, receivedAtMs: Date.UTC(2026, 0, 1, 10) }),
      rawRow({ eid: EID_0103, receivedAtMs: Date.UTC(2026, 0, 3, 12) })
    ]);
    const letters = await listLetters(harness.session, listOptions(harness, null, null));
    expect(letters.map((letter) => letter.isNew)).toEqual([true, true]);
  });

  it("applies the since filter: only letters on or after the threshold are new", async () => {
    const harness = createHarness([
      rawRow({ eid: EID_1231, receivedAtMs: Date.UTC(2025, 11, 31, 9) }),
      rawRow({ eid: EID_0103, receivedAtMs: Date.UTC(2026, 0, 3, 12) }),
      rawRow({ eid: EID_0105, receivedAtMs: Date.UTC(2026, 0, 5, 12) })
    ]);
    const letters = await listLetters(harness.session, listOptions(harness, null, "2026-01-03"));
    expect(letters.map((letter) => [letter.eid, letter.isNew])).toEqual([
      [EID_1231, false],
      [EID_0103, true],
      [EID_0105, true]
    ]);
  });
});

describe("downloadNewLetters", () => {
  it("downloads new letters into per-letter folders, records them in index.jsonl and skips them on a rerun", async () => {
    const outDir = tempOutDir();
    const harness = createHarness(
      [
        rawRow({ eid: EID_0101, receivedAtMs: Date.UTC(2026, 0, 1, 10) }),
        rawRow({ eid: EID_0103, receivedAtMs: Date.UTC(2026, 0, 3, 12) })
      ],
      {
        [EID_0101]: { fajlNev: "level-1.pdf" },
        [EID_0103]: { fajlNev: "level-3.pdf" }
      },
      {
        [EID_0101]: Buffer.from("pdf-tartalom-1"),
        [EID_0103]: Buffer.from("pdf-tartalom-3")
      }
    );

    const first = await runDownload(harness, outDir);
    expect(first.downloaded).toBe(2);
    expect(first.failed).toBe(0);
    expect(first.skippedByLimit).toBe(0);
    expect(first.letters.map((entry) => entry.eid)).toEqual([EID_0101, EID_0103]);
    expect(readIndex(outDir).map((entry) => entry.eid)).toEqual([EID_0101, EID_0103]);
    expect(first.mailboxes).toEqual([
      {
        mailbox: testMailbox.name,
        total: 2,
        fresh: 2,
        downloaded: 2,
        failed: 0,
        quotaPercent: 5
      }
    ]);
    expect(harness.steps.some((step) => step.includes("2 új"))).toBe(true);

    const firstDir = letterDir(outDir, EID_0101, "2026-01-01");
    expect(fs.readFileSync(path.join(firstDir, "level-1.pdf"), "utf8")).toBe("pdf-tartalom-1");
    const meta = JSON.parse(fs.readFileSync(path.join(firstDir, "meta.json"), "utf8"));
    expect(meta.eid).toBe(EID_0101);
    expect(meta.file).toBe("level-1.pdf");
    expect(meta.downloadedAt).toBe(DOWNLOADED_AT);

    const second = await runDownload(harness, outDir);
    expect(second.downloaded).toBe(0);
    expect(second.failed).toBe(0);
    expect(second.letters).toEqual([]);
    expect(fs.readdirSync(path.join(outDir, testMailbox.slug))).toHaveLength(2);
    expect(readIndex(outDir)).toHaveLength(2);
  });

  it("keeps downloading when one letter fails, reports it, keeps it out of index.jsonl and retries it on the next run", async () => {
    const outDir = tempOutDir();
    const harness = createHarness(
      [
        rawRow({ eid: EID_0101, receivedAtMs: Date.UTC(2026, 0, 1, 10) }),
        rawRow({ eid: EID_0103, receivedAtMs: Date.UTC(2026, 0, 3, 12) }),
        rawRow({ eid: EID_0105, receivedAtMs: Date.UTC(2026, 0, 5, 12) })
      ],
      {
        [EID_0101]: { fajlNev: "level-1.pdf" },
        [EID_0103]: { fajlNev: "level-3.pdf" },
        [EID_0105]: { fajlNev: "level-5.pdf" }
      },
      {
        [EID_0101]: Buffer.from("pdf-tartalom-1"),
        [EID_0103]: Buffer.from("pdf-tartalom-3"),
        [EID_0105]: Buffer.from("pdf-tartalom-5")
      }
    );
    harness.failingDownloads.add(EID_0103);

    const first = await runDownload(harness, outDir);
    // A `failed` mezőből származtatja a CLI az 5-ös (részleges) kilépési kódot
    // (src/commands/download.ts: result.failed > 0 → EXIT_CODES.partial).
    expect(first.downloaded).toBe(2);
    expect(first.failed).toBe(1);
    expect(first.failures).toEqual([
      {
        eid: EID_0103,
        mailbox: testMailbox.name,
        error: expect.stringContaining("HTTP 500")
      }
    ]);
    expect(first.mailboxes[0]).toMatchObject({
      total: 3,
      fresh: 3,
      downloaded: 2,
      failed: 1
    });
    expect(fs.existsSync(letterDir(outDir, EID_0101, "2026-01-01"))).toBe(true);
    expect(fs.existsSync(letterDir(outDir, EID_0103, "2026-01-03"))).toBe(false);
    expect(fs.existsSync(letterDir(outDir, EID_0105, "2026-01-05"))).toBe(true);
    expect(readIndex(outDir).map((entry) => entry.eid)).toEqual([EID_0101, EID_0105]);
    expect(harness.steps.some((step) => step.startsWith(`letoltes:hibas:${EID_0103}`))).toBe(true);

    harness.failingDownloads.delete(EID_0103);
    const second = await runDownload(harness, outDir);
    expect(second.downloaded).toBe(1);
    expect(second.failed).toBe(0);
    expect(readIndex(outDir).map((entry) => entry.eid)).toEqual([EID_0101, EID_0105, EID_0103]);
    expect(fs.existsSync(letterDir(outDir, EID_0103, "2026-01-03"))).toBe(true);
  });

  it("names the folder <receivedOn>_<eid>_<slug> and caps the slug at 40 characters", async () => {
    const outDir = tempOutDir();
    const harness = createHarness(
      [
        rawRow({
          eid: EID_0101,
          receivedAtMs: Date.UTC(2026, 0, 1, 10),
          desc: "Allamhatosagi level nagyon hosszu leirassal ami tob mint negyven karakter"
        })
      ],
      { [EID_0101]: { fajlNev: "level-1.pdf" } },
      { [EID_0101]: Buffer.from("pdf-tartalom-1") }
    );

    const result = await runDownload(harness, outDir);
    const label = "allamhatosagi-level-nagyon-hosszu-leiras";
    expect(label).toHaveLength(40);
    expect(result.letters[0].dir).toBe(`${testMailbox.slug}/2026-01-01_${EID_0101}_${label}`);
    expect(fs.existsSync(letterDir(outDir, EID_0101, "2026-01-01", label))).toBe(true);
  });

  it("falls back to the letter type in the folder name when the description is empty", async () => {
    const outDir = tempOutDir();
    const harness = createHarness(
      [rawRow({ eid: EID_0101, receivedAtMs: Date.UTC(2026, 0, 1, 10), desc: "", type: "Végzés" })],
      { [EID_0101]: { fajlNev: "level-1.pdf" } },
      { [EID_0101]: Buffer.from("pdf-tartalom-1") }
    );

    const result = await runDownload(harness, outDir);
    expect(result.letters[0].dir).toBe(`${testMailbox.slug}/2026-01-01_${EID_0101}_vegzes`);
  });

  it("uses ismeretlen-datum when the letter has no arrival date", async () => {
    const outDir = tempOutDir();
    const harness = createHarness(
      [rawRow({ eid: EID_0101 })],
      { [EID_0101]: { fajlNev: "level-1.pdf" } },
      { [EID_0101]: Buffer.from("pdf-tartalom-1") }
    );

    const result = await runDownload(harness, outDir);
    expect(result.letters[0].dir).toBe(
      `${testMailbox.slug}/ismeretlen-datum_${EID_0101}_${DEFAULT_LABEL}`
    );
    expect(fs.existsSync(letterDir(outDir, EID_0101, "ismeretlen-datum"))).toBe(true);
  });

  it("extracts a zip into kibontva only when extract is enabled", async () => {
    const outDir = tempOutDir();
    const zipBytes = Buffer.from(
      zipSync({
        "irat.pdf": Buffer.from("irat-tartalom"),
        "melleklet/kiserolevel.txt": Buffer.from("kiserolevel-tartalom")
      })
    );
    const harness = createHarness(
      [rawRow({ eid: EID_0101, receivedAtMs: Date.UTC(2026, 0, 1, 10) })],
      { [EID_0101]: { fajlNev: "csomag.zip" } },
      { [EID_0101]: zipBytes }
    );

    const result = await runDownload(harness, outDir, { extract: true });
    const dir = letterDir(outDir, EID_0101, "2026-01-01");
    expect(fs.readFileSync(path.join(dir, "csomag.zip"))).toEqual(zipBytes);
    expect(fs.readFileSync(path.join(dir, "kibontva", "irat.pdf"), "utf8")).toBe("irat-tartalom");
    expect(
      fs.readFileSync(path.join(dir, "kibontva", "melleklet", "kiserolevel.txt"), "utf8")
    ).toBe("kiserolevel-tartalom");
    expect(result.letters[0].extracted).toEqual([
      path.join("kibontva", "irat.pdf"),
      path.join("kibontva", "melleklet", "kiserolevel.txt")
    ]);

    const noExtractOutDir = tempOutDir();
    const second = await runDownload(harness, noExtractOutDir);
    const noExtractDir = letterDir(noExtractOutDir, EID_0101, "2026-01-01");
    expect(fs.existsSync(path.join(noExtractDir, "kibontva"))).toBe(false);
    expect(second.letters[0].extracted).toEqual([]);
    expect(fs.readFileSync(path.join(noExtractDir, "csomag.zip"))).toEqual(zipBytes);
  });

  it("never extracts a non-zip attachment even when extract is enabled", async () => {
    const outDir = tempOutDir();
    const harness = createHarness(
      [rawRow({ eid: EID_0101, receivedAtMs: Date.UTC(2026, 0, 1, 10) })],
      { [EID_0101]: { fajlNev: "level-1.pdf" } },
      { [EID_0101]: Buffer.from("nem-zip-pdf-tartalom") }
    );

    const result = await runDownload(harness, outDir, { extract: true });
    const dir = letterDir(outDir, EID_0101, "2026-01-01");
    expect(fs.readFileSync(path.join(dir, "level-1.pdf"), "utf8")).toBe("nem-zip-pdf-tartalom");
    expect(fs.existsSync(path.join(dir, "kibontva"))).toBe(false);
    expect(result.letters[0].extracted).toEqual([]);
  });

  it("downloads only letters that arrived on or after the since date", async () => {
    const outDir = tempOutDir();
    const harness = createHarness(
      [
        rawRow({ eid: EID_1231, receivedAtMs: Date.UTC(2025, 11, 31, 9) }),
        rawRow({ eid: EID_0103, receivedAtMs: Date.UTC(2026, 0, 3, 12) })
      ],
      {
        [EID_1231]: { fajlNev: "level-4.pdf" },
        [EID_0103]: { fajlNev: "level-3.pdf" }
      },
      {
        [EID_1231]: Buffer.from("pdf-tartalom-4"),
        [EID_0103]: Buffer.from("pdf-tartalom-3")
      }
    );

    const result = await runDownload(harness, outDir, { since: "2026-01-01" });
    expect(result.downloaded).toBe(1);
    expect(result.letters.map((entry) => entry.eid)).toEqual([EID_0103]);
    expect(result.mailboxes[0]).toMatchObject({ total: 2, fresh: 1, downloaded: 1, failed: 0 });
    expect(readIndex(outDir).map((entry) => entry.eid)).toEqual([EID_0103]);
    expect(fs.existsSync(letterDir(outDir, EID_1231, "2025-12-31"))).toBe(false);
  });
});
