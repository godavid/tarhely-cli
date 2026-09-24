// A letöltött levelek jegyzéke: `<out>/index.jsonl`, soronként egy levél.
// Ez egyben a „már letöltött" lista is, ezért a `download` idempotens.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface IndexEntry {
  readonly eid: string;
  readonly mailbox: string;
  readonly receivedOn: string;
  readonly receivedAt: string;
  readonly sender: string;
  readonly type: string;
  readonly desc: string;
  readonly referencedRegistrationNumber: string | null;
  readonly note: string | null;
  /** A levél mappája az `--out` könyvtárhoz képest. */
  readonly dir: string;
  /** Az eredeti letöltött fájl neve a mappán belül. */
  readonly file: string;
  readonly extracted: readonly string[];
  readonly downloadedAt: string;
}

export const INDEX_FILE = "index.jsonl";

export function readIndex(outDir: string): IndexEntry[] {
  const path = join(outDir, INDEX_FILE);
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as IndexEntry);
}

export function knownIds(entries: readonly IndexEntry[]): Set<string> {
  return new Set(entries.map((entry) => entry.eid));
}

export function appendIndex(outDir: string, entry: IndexEntry): void {
  mkdirSync(outDir, { recursive: true });
  appendFileSync(join(outDir, INDEX_FILE), `${JSON.stringify(entry)}\n`, "utf8");
}
