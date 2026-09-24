import { describe, expect, it } from "vitest";
import { parseCli } from "../src/cli.js";

describe("parseCli", () => {
  it("provides default values when no options are specified", () => {
    expect(parseCli(["download"])).toEqual({
      command: "download",
      json: false,
      headed: false,
      debugDir: null,
      mailbox: "all",
      since: null,
      outDir: "tarhely",
      max: 200,
      extract: true,
      yes: false,
      help: false,
      version: false
    });
  });

  it("extracts positional command", () => {
    expect(parseCli(["list"]).command).toBe("list");
  });

  it("returns null command when no arguments are provided", () => {
    expect(parseCli([]).command).toBeNull();
  });

  it("parses --mailbox option", () => {
    expect(parseCli(["--mailbox", "12345678-pelda-kft"]).mailbox).toBe("12345678-pelda-kft");
  });

  it("parses valid --since date string", () => {
    expect(parseCli(["--since", "2026-01-01"]).since).toBe("2026-01-01");
  });

  it("throws on invalid --since format", () => {
    expect(() => parseCli(["--since", "2026/01/01"])).toThrow("A --since formátuma YYYY-MM-DD");
  });

  it("parses --out directory option", () => {
    expect(parseCli(["--out", "egyedi-mappa"]).outDir).toBe("egyedi-mappa");
  });

  it("parses positive integer --max option", () => {
    expect(parseCli(["--max", "50"]).max).toBe(50);
  });

  it("throws when --max is not a number", () => {
    expect(() => parseCli(["--max", "nem-szam"])).toThrow("A --max pozitív egész szám");
  });

  it("throws when --max is zero", () => {
    expect(() => parseCli(["--max", "0"])).toThrow("A --max pozitív egész szám");
  });

  it("throws when --max is negative", () => {
    expect(() => parseCli(["--max=-10"])).toThrow("A --max pozitív egész szám");
  });

  it("sets extract to false with --no-extract flag", () => {
    expect(parseCli(["--no-extract"]).extract).toBe(false);
  });

  it("sets json to true with --json flag", () => {
    expect(parseCli(["--json"]).json).toBe(true);
  });

  it("sets headed to true with --headed flag", () => {
    expect(parseCli(["--headed"]).headed).toBe(true);
  });

  it("parses --debug-dir option", () => {
    expect(parseCli(["--debug-dir", "/tmp/debug"]).debugDir).toBe("/tmp/debug");
  });

  it("sets yes to true with --yes flag", () => {
    expect(parseCli(["--yes"]).yes).toBe(true);
  });

  it("sets help to true with -h short flag", () => {
    expect(parseCli(["-h"]).help).toBe(true);
  });

  it("sets help to true with --help long flag", () => {
    expect(parseCli(["--help"]).help).toBe(true);
  });

  it("sets version to true with -v short flag", () => {
    expect(parseCli(["-v"]).version).toBe(true);
  });

  it("sets version to true with --version long flag", () => {
    expect(parseCli(["--version"]).version).toBe(true);
  });
});
