import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractZip, isSafeEntryPath, isZip } from "../src/extract.js";

describe("isZip", () => {
  it("returns true for buffer starting with zip signature", () => {
    expect(isZip(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
  });

  it("returns false for non-zip data", () => {
    expect(isZip(Buffer.from("nem-zip-tartalom"))).toBe(false);
  });

  it("returns false for buffer shorter than 4 bytes", () => {
    expect(isZip(Buffer.from([0x50, 0x4b]))).toBe(false);
  });
});

describe("isSafeEntryPath", () => {
  it("accepts simple relative file path", () => {
    expect(isSafeEntryPath("dokumentum.pdf")).toBe(true);
  });

  it("accepts nested relative file path", () => {
    expect(isSafeEntryPath("almappa/dokumentum.pdf")).toBe(true);
  });

  it("rejects empty path", () => {
    expect(isSafeEntryPath("")).toBe(false);
  });

  it("rejects path with null byte", () => {
    expect(isSafeEntryPath("file\0.txt")).toBe(false);
  });

  it("rejects posix absolute path", () => {
    expect(isSafeEntryPath("/var/log/level.pdf")).toBe(false);
  });

  it("rejects Windows absolute drive path with backslash", () => {
    expect(isSafeEntryPath("C:\\mappa\\level.pdf")).toBe(false);
  });

  it("rejects Windows absolute drive path with forward slash", () => {
    expect(isSafeEntryPath("C:/mappa/level.pdf")).toBe(false);
  });

  it("rejects parent directory traversal", () => {
    expect(isSafeEntryPath("../kilepo.pdf")).toBe(false);
  });

  it("rejects nested parent directory traversal", () => {
    expect(isSafeEntryPath("mappa/../../kilepo.pdf")).toBe(false);
  });

  it("rejects bare parent directory segment", () => {
    expect(isSafeEntryPath("..")).toBe(false);
  });

  it("rejects empty segments from double slashes", () => {
    expect(isSafeEntryPath("mappa//level.pdf")).toBe(false);
  });
});

function buildManyEntryZip(entryCount: number): Buffer {
  const files: Record<string, Uint8Array> = {};
  for (let index = 0; index < entryCount; index++) {
    files[`bejegyzes-${index}.txt`] = new Uint8Array(0);
  }
  return Buffer.from(zipSync(files));
}

describe("extractZip", () => {
  it("extracts zip entries to target directory and returns relative paths", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-test-"));
    const zipData = Buffer.from(
      zipSync({
        "irat.pdf": Buffer.from("tartalom")
      })
    );
    const written = extractZip(zipData, tmpDir);
    expect(written).toEqual(["irat.pdf"]);
  });

  it("writes extracted file content to disk correctly", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-test-"));
    const zipData = Buffer.from(
      zipSync({
        "irat.pdf": Buffer.from("Példa Kft. határozat")
      })
    );
    extractZip(zipData, tmpDir);
    expect(fs.readFileSync(path.join(tmpDir, "irat.pdf"), "utf8")).toBe("Példa Kft. határozat");
  });

  it("skips directory entries ending with slash", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-test-"));
    const zipData = Buffer.from(
      zipSync({
        "konyvtar/": new Uint8Array(0),
        "konyvtar/irat.pdf": Buffer.from("belso tartalom")
      })
    );
    const written = extractZip(zipData, tmpDir);
    expect(written).toEqual([path.join("konyvtar", "irat.pdf")]);
  });

  it("throws an error when zip contains an unsafe traversal path", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-test-"));
    const zipData = Buffer.from(
      zipSync({
        "../gonosz.txt": Buffer.from("kilepes")
      })
    );
    expect(() => extractZip(zipData, tmpDir)).toThrow("Gyanús útvonal a zipben");
  });

  it("throws when the zip contains more than 2000 entries and writes no files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-test-"));
    const zipData = buildManyEntryZip(2001);
    expect(() => extractZip(zipData, tmpDir)).toThrow(
      "A zip bejegyzésszáma meghaladja a 2000-es korlátot."
    );
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it("extracts a zip with exactly 2000 entries", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-test-"));
    const zipData = buildManyEntryZip(2000);
    const written = extractZip(zipData, tmpDir);
    expect(written).toHaveLength(2000);
  });

  it.skipIf(process.platform === "win32")(
    "creates directories with 0o700 mode and extracted files with 0o600 mode",
    () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-test-"));
      const zipData = Buffer.from(
        zipSync({
          "almappa/irat.pdf": Buffer.from("tartalom")
        })
      );
      extractZip(zipData, tmpDir);
      expect(fs.statSync(path.join(tmpDir, "almappa")).mode & 0o777).toBe(0o700);
      expect(fs.statSync(path.join(tmpDir, "almappa", "irat.pdf")).mode & 0o777).toBe(0o600);
    }
  );
});
