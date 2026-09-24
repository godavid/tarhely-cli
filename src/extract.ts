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
  // A szűrő a kibontás ELŐTT fut, a központi jegyzék `originalSize` mezőjéből:
  // egy apró, erősen tömörített zip így nem tudja kimeríteni a memóriát.
  let total = 0;
  const entries = unzipSync(new Uint8Array(bytes), {
    filter(info) {
      if (info.name.endsWith("/")) {
        return false;
      }
      if (!isSafeEntryPath(info.name)) {
        throw new Error(`Gyanús útvonal a zipben, a kibontás leáll: ${info.name}`);
      }
      total += info.originalSize;
      if (total > MAX_TOTAL_BYTES) {
        throw new Error("A zip kibontott mérete meghaladja a 200 MB-os korlátot.");
      }
      return true;
    }
  });
  const written: string[] = [];

  for (const [name, data] of Object.entries(entries)) {
    const relative = name.replace(/\\/g, "/").split(posix.sep).join(sep);
    const target = join(targetDir, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    written.push(relative);
  }

  return written;
}
