import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { EXIT_CODES, TarhelyError } from "../src/errors.js";
import { createReporter } from "../src/report.js";

function createMemoryStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    }
  });
  return {
    stream,
    get output() {
      return chunks.join("");
    }
  };
}

describe("createReporter - JSON mode", () => {
  it("writes a single JSON line to stdout on finish", () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    reporter.finish({ count: 5 });
    expect(JSON.parse(stdout.output)).toEqual({
      ok: true,
      code: EXIT_CODES.ok,
      count: 5,
      steps: []
    });
  });

  it("returns the exit code from finish", () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    expect(reporter.finish({}, EXIT_CODES.partial)).toBe(EXIT_CODES.partial);
  });

  it("sets ok to false in JSON when finish is called with a non-zero code", () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    reporter.finish({}, EXIT_CODES.partial);
    expect(JSON.parse(stdout.output).ok).toBe(false);
  });

  it("writes error details to stdout on fail with TarhelyError", () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    reporter.fail(
      new TarhelyError(
        EXIT_CODES.loginFailed,
        "Hibás jelszó vagy felhasználónév",
        "Futtasd újra az init parancsot"
      )
    );
    expect(JSON.parse(stdout.output)).toEqual({
      ok: false,
      code: EXIT_CODES.loginFailed,
      error: "Hibás jelszó vagy felhasználónév",
      hint: "Futtasd újra az init parancsot",
      steps: []
    });
  });

  it("returns error exit code on fail with TarhelyError", () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    expect(reporter.fail(new TarhelyError(EXIT_CODES.noCredentials, "Nincs belépő"))).toBe(
      EXIT_CODES.noCredentials
    );
  });

  it("maps generic Error to unknown exit code and null hint in JSON", () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    reporter.fail(new Error("Váratlan hiba"));
    expect(JSON.parse(stdout.output)).toEqual({
      ok: false,
      code: EXIT_CODES.unknown,
      error: "Váratlan hiba",
      hint: null,
      steps: []
    });
  });

  it("does not write info messages to stderr in JSON mode", () => {
    const stderr = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stderr: stderr.stream });
    reporter.info("Tájékoztató üzenet");
    expect(stderr.output).toBe("");
  });

  it("does not write step logs to stderr in JSON mode", () => {
    const stderr = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stderr: stderr.stream });
    reporter.step("bejelentkezes", true, "sikeres");
    expect(stderr.output).toBe("");
  });
});

describe("createReporter - Human mode", () => {
  it("writes info messages to stderr with a newline", () => {
    const stderr = createMemoryStream();
    const reporter = createReporter({ json: false, debugDir: null, stderr: stderr.stream });
    reporter.info("Tájékoztató üzenet");
    expect(stderr.output).toBe("Tájékoztató üzenet\n");
  });

  it("does not write info messages to stdout in human mode", () => {
    const stdout = createMemoryStream();
    const stderr = createMemoryStream();
    const reporter = createReporter({
      json: false,
      debugDir: null,
      stdout: stdout.stream,
      stderr: stderr.stream
    });
    reporter.info("Tájékoztató üzenet");
    expect(stdout.output).toBe("");
  });

  it("writes successful step to stderr with dot marker", () => {
    const stderr = createMemoryStream();
    const reporter = createReporter({ json: false, debugDir: null, stderr: stderr.stream });
    reporter.step("letoltes", true, "10 db");
    expect(stderr.output).toBe("· letoltes — 10 db\n");
  });

  it("writes failed step to stderr with cross marker and without detail", () => {
    const stderr = createMemoryStream();
    const reporter = createReporter({ json: false, debugDir: null, stderr: stderr.stream });
    reporter.step("kapcsolodas", false);
    expect(stderr.output).toBe("✗ kapcsolodas\n");
  });

  it("writes error message and hint to stderr on fail", () => {
    const stderr = createMemoryStream();
    const reporter = createReporter({ json: false, debugDir: null, stderr: stderr.stream });
    reporter.fail(new TarhelyError(EXIT_CODES.noCredentials, "Nincs belépő", "Futtasd: init"));
    expect(stderr.output).toBe("Hiba: Nincs belépő\nTanács: Futtasd: init\n");
  });

  it("records step history in steps property", () => {
    const reporter = createReporter({ json: true, debugDir: null });
    reporter.step("lepes-1", true, "reszlet");
    expect(reporter.steps[0]).toMatchObject({
      step: "lepes-1",
      ok: true,
      detail: "reszlet"
    });
  });
});
