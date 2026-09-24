import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendIndex,
  INDEX_FILE,
  type IndexEntry,
  knownIds,
  readIndex
} from "../src/store/index.js";

const sampleEntry1: IndexEntry = {
  eid: "000000012026010100000001",
  mailbox: "12345678-pelda-kft",
  receivedOn: "2026-01-01",
  receivedAt: "2026-01-01 10:00",
  sender: "NAV",
  type: "Adóigazolás",
  desc: "Tájékoztatás adóügyben",
  referencedRegistrationNumber: null,
  note: null,
  dir: "12345678-pelda-kft/2026-01-01_000000012026010100000001",
  file: "level.pdf",
  extracted: ["level.pdf"],
  downloadedAt: "2026-01-01T10:05:00.000Z"
};

const sampleEntry2: IndexEntry = {
  eid: "000000012026010100000002",
  mailbox: "12345678-pelda-kft",
  receivedOn: "2026-01-02",
  receivedAt: "2026-01-02 12:00",
  sender: "Fővárosi Törvényszék Cégbírósága",
  type: "Végzés",
  desc: "Cégbejegyzés",
  referencedRegistrationNumber: "000000012026010100000001",
  note: "Letölthető végzés",
  dir: "12345678-pelda-kft/2026-01-02_000000012026010100000002",
  file: "vegzes.zip",
  extracted: ["vegzes.pdf", "kiserolevel.txt"],
  downloadedAt: "2026-01-02T12:05:00.000Z"
};

describe("INDEX_FILE", () => {
  it("defines the index filename as index.jsonl", () => {
    expect(INDEX_FILE).toBe("index.jsonl");
  });
});

describe("readIndex", () => {
  it("returns an empty array when index file does not exist", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-idx-"));
    expect(readIndex(tmpDir)).toEqual([]);
  });

  it("ignores trailing and empty lines in the index file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-idx-"));
    fs.writeFileSync(
      path.join(tmpDir, INDEX_FILE),
      `${JSON.stringify(sampleEntry1)}\n\n  \n`,
      "utf8"
    );
    expect(readIndex(tmpDir)).toEqual([sampleEntry1]);
  });
});

describe("appendIndex", () => {
  it("creates target directory and writes the first entry", () => {
    const tmpDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-idx-")), "submappa");
    appendIndex(tmpDir, sampleEntry1);
    expect(readIndex(tmpDir)).toEqual([sampleEntry1]);
  });

  it("appends multiple entries in order", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tarhely-idx-"));
    appendIndex(tmpDir, sampleEntry1);
    appendIndex(tmpDir, sampleEntry2);
    expect(readIndex(tmpDir)).toEqual([sampleEntry1, sampleEntry2]);
  });
});

describe("knownIds", () => {
  it("collects unique eids into a Set", () => {
    expect(knownIds([sampleEntry1, sampleEntry2])).toEqual(
      new Set(["000000012026010100000001", "000000012026010100000002"])
    );
  });

  it("returns an empty set for empty entries list", () => {
    expect(knownIds([])).toEqual(new Set());
  });
});
