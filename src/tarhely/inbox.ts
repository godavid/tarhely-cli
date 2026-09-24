// A beérkezett levelek listázása és letöltése postafiókonként.
//
// A letöltés levelenként külön mappát ad (`<out>/<postafiók>/<dátum>_<eid>_<leírás>/`)
// az eredeti fájllal, a kibontott tartalommal és egy meta.json-nal, és minden
// sikeres levelet azonnal az index.jsonl-be ír — így egy félbeszakadt futás után
// a következő ott folytatja, ahol abbamaradt.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractZip, isZip } from "../extract.js";
import type { StepFn } from "../kau/login.js";
import type { Session } from "../session.js";
import { appendIndex, type IndexEntry, knownIds, readIndex } from "../store/index.js";
import {
  apiDetail,
  apiList,
  downloadLetter,
  isNewLetter,
  type LetterRow,
  type MailboxRef,
  readQuotaPercent,
  slugify
} from "./api.js";
import { switchMailbox } from "./mailbox.js";

export interface ListedLetter extends LetterRow {
  readonly mailbox: string;
  readonly isNew: boolean;
}

export interface ListOptions {
  readonly mailboxes: readonly MailboxRef[];
  readonly since: string | null;
  readonly outDir: string | null;
  readonly step: StepFn;
}

export async function listLetters(session: Session, options: ListOptions): Promise<ListedLetter[]> {
  const known = options.outDir === null ? new Set<string>() : knownIds(readIndex(options.outDir));
  const out: ListedLetter[] = [];
  for (const mailbox of options.mailboxes) {
    await switchMailbox(session.page, session.sniffed, mailbox, options.step);
    const rows = await apiList(session.page, session.sniffed, mailbox);
    options.step("lista", true, `${mailbox.name}: ${rows.length} üzenet`);
    for (const row of rows) {
      out.push({ ...row, mailbox: mailbox.name, isNew: isNewLetter(row, known, options.since) });
    }
  }
  return out;
}

export interface DownloadOptions extends ListOptions {
  readonly outDir: string;
  readonly max: number;
  readonly extract: boolean;
  readonly now?: () => Date;
}

export interface MailboxReport {
  readonly mailbox: string;
  readonly total: number;
  readonly fresh: number;
  readonly downloaded: number;
  readonly failed: number;
  readonly quotaPercent: number | null;
}

export interface DownloadResult {
  readonly downloaded: number;
  readonly failed: number;
  readonly skippedByLimit: number;
  readonly mailboxes: readonly MailboxReport[];
  readonly letters: readonly IndexEntry[];
  readonly failures: readonly { eid: string; mailbox: string; error: string }[];
}

export async function downloadNewLetters(
  session: Session,
  options: DownloadOptions
): Promise<DownloadResult> {
  const known = knownIds(readIndex(options.outDir));
  const now = options.now ?? (() => new Date());
  const letters: IndexEntry[] = [];
  const failures: { eid: string; mailbox: string; error: string }[] = [];
  const reports: MailboxReport[] = [];
  let remaining = options.max;
  let skippedByLimit = 0;

  for (const mailbox of options.mailboxes) {
    await switchMailbox(session.page, session.sniffed, mailbox, options.step);
    const rows = await apiList(session.page, session.sniffed, mailbox);
    const fresh = rows.filter((row) => isNewLetter(row, known, options.since));
    options.step("lista", true, `${mailbox.name}: ${rows.length} üzenet, ${fresh.length} új`);
    const quotaPercent = await readQuotaPercent(session.page, session.sniffed, mailbox);

    let downloaded = 0;
    let failed = 0;
    for (const row of fresh) {
      if (remaining <= 0) {
        skippedByLimit += 1;
        continue;
      }
      const eid = row.eid as string;
      try {
        const entry = await downloadOne(session, mailbox, row, eid, options, now);
        appendIndex(options.outDir, entry);
        known.add(eid);
        letters.push(entry);
        downloaded += 1;
        remaining -= 1;
        options.step("letoltes", true, `${eid} → ${entry.dir}`);
      } catch (error) {
        // Egy levél bukása nem viszi el a futást: a többi letöltése folytatódik,
        // és a kihagyott levél a következő futáson újra jelöltté válik.
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ eid, mailbox: mailbox.name, error: message });
        failed += 1;
        options.step("letoltes", false, `${eid}: ${message}`);
      }
    }
    reports.push({
      mailbox: mailbox.name,
      total: rows.length,
      fresh: fresh.length,
      downloaded,
      failed,
      quotaPercent
    });
  }

  return {
    downloaded: letters.length,
    failed: failures.length,
    skippedByLimit,
    mailboxes: reports,
    letters,
    failures
  };
}

async function downloadOne(
  session: Session,
  mailbox: MailboxRef,
  row: LetterRow,
  eid: string,
  options: DownloadOptions,
  now: () => Date
): Promise<IndexEntry> {
  const detail = await apiDetail(session.page, session.sniffed, mailbox, eid);
  const file = await downloadLetter(session.page, session.sniffed, mailbox, eid, detail.fileName);

  const label = slugify(row.desc || row.type || "level").slice(0, 40);
  const dir = join(mailbox.slug, `${row.receivedOn || "ismeretlen-datum"}_${eid}_${label}`);
  const absolute = join(options.outDir, dir);
  mkdirSync(absolute, { recursive: true });
  writeFileSync(join(absolute, file.name), file.bytes);

  const extracted =
    options.extract && isZip(file.bytes) ? extractZip(file.bytes, join(absolute, "kibontva")) : [];

  const entry: IndexEntry = {
    eid,
    mailbox: mailbox.name,
    receivedOn: row.receivedOn,
    receivedAt: row.receivedAt,
    sender: row.senderFull || row.sender,
    type: row.type,
    desc: row.desc,
    referencedRegistrationNumber: detail.referencedRegistrationNumber,
    note: detail.note,
    dir,
    file: file.name,
    extracted: extracted.map((name) => join("kibontva", name)),
    downloadedAt: now().toISOString()
  };
  writeFileSync(join(absolute, "meta.json"), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  return entry;
}
