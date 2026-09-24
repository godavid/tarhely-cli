// A letöltött zip biztonságos kibontása. A hatósági levél zipje idegen
// bemenet: kilépő útvonalat, abszolút utat vagy aránytalan méretet nem
// engedünk ki a célmappából.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix, sep } from "node:path";

import { unzipSync } from "fflate";

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

export function isZip(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes.subarray(0, 4).equals(ZIP_SIGNATURE);
}

/** Igaz, ha az archívumbeli név a célmappán belül marad. */
export function isSafeEntryPath(name: string): boolean {
  if (name === "" || name.includes("\0")) {
    return false;
  }
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    return false;
  }
  const segments = normalized.split("/");
  return (
    !segments.some((segment) => segment === "..") && segments.every((segment) => segment !== "")
  );
}

/**
 * Kibontja a zipet a célmappába, és visszaadja a kiírt fájlok relatív útjait.
 * Könyvtár-bejegyzést kihagy; gyanús nevű bejegyzésnél az egész kibontás
 * hibával áll meg, nem csak az adott fájl marad ki.
 */
export function extractZip(bytes: Buffer, targetDir: string): string[] {
  const entries = unzipSync(new Uint8Array(bytes));
  const written: string[] = [];
  let total = 0;

  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/")) {
      continue;
    }
    if (!isSafeEntryPath(name)) {
      throw new Error(`Gyanús útvonal a zipben, a kibontás leáll: ${name}`);
    }
    total += data.byteLength;
    if (total > MAX_TOTAL_BYTES) {
      throw new Error("A zip kibontott mérete meghaladja a 200 MB-os korlátot.");
    }
    const relative = name.replace(/\\/g, "/").split(posix.sep).join(sep);
    const target = join(targetDir, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    written.push(relative);
  }

  return written;
}
