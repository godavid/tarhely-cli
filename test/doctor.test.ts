import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { type DoctorCheck, maskUsername, runDoctor } from "../src/commands/doctor.js";
import { EXIT_CODES, TarhelyError } from "../src/errors.js";
import { createReporter } from "../src/report.js";
import type { CredentialStore } from "../src/store/credentials.js";

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

function createFakeStore(
  creds: { username: string; password: string; totpSeed: string } | null
): CredentialStore {
  return {
    load: () => creds,
    require: () => {
      if (!creds) {
        throw new TarhelyError(EXIT_CODES.noCredentials, "Nincs belépő");
      }
      return creds;
    },
    save: () => {},
    clear: () => true,
    source: () => "env"
  };
}

describe("maskUsername", () => {
  it("masks username longer than 3 characters with first 2 and last char", () => {
    expect(maskUsername("abcdef")).toBe("ab…f");
  });

  it("masks username with Hungarian company user format", () => {
    expect(maskUsername("pelda_user")).toBe("pe…r");
  });

  it("returns three asterisks for username of 3 characters", () => {
    expect(maskUsername("abc")).toBe("***");
  });

  it("returns three asterisks for username of 1 character", () => {
    expect(maskUsername("a")).toBe("***");
  });

  it("returns three asterisks for empty username", () => {
    expect(maskUsername("")).toBe("***");
  });
});

describe("runDoctor", () => {
  it("returns exit code 2 when credentials are missing", async () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    const code = await runDoctor({
      store: createFakeStore(null),
      reporter,
      fetchImpl: async () => new Response(null, { status: 302 }),
      nodeVersion: "22.0.0"
    });
    expect(code).toBe(EXIT_CODES.noCredentials);
  });

  it("marks belepo check as not ok when credentials are missing", async () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    await runDoctor({
      store: createFakeStore(null),
      reporter,
      fetchImpl: async () => new Response(null, { status: 302 }),
      nodeVersion: "22.0.0"
    });
    const parsed = JSON.parse(stdout.output) as { checks: DoctorCheck[] };
    expect(parsed.checks.find((check) => check.name === "belepo")?.ok).toBe(false);
  });

  it("marks node check as not ok when nodeVersion is below 20", async () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    await runDoctor({
      store: createFakeStore({
        username: "pelda_user",
        password: "pelda_password",
        totpSeed: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
      }),
      reporter,
      fetchImpl: async () => new Response(null, { status: 302 }),
      nodeVersion: "18.0.0"
    });
    const parsed = JSON.parse(stdout.output) as { checks: DoctorCheck[] };
    expect(parsed.checks.find((check) => check.name === "node")?.ok).toBe(false);
  });

  it("marks node check as ok when nodeVersion is 20 or higher", async () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    await runDoctor({
      store: createFakeStore({
        username: "pelda_user",
        password: "pelda_password",
        totpSeed: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
      }),
      reporter,
      fetchImpl: async () => new Response(null, { status: 302 }),
      nodeVersion: "22.0.0"
    });
    const parsed = JSON.parse(stdout.output) as { checks: DoctorCheck[] };
    expect(parsed.checks.find((check) => check.name === "node")?.ok).toBe(true);
  });

  it("marks halozat check as ok when fetchImpl returns 302", async () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    await runDoctor({
      store: createFakeStore({
        username: "pelda_user",
        password: "pelda_password",
        totpSeed: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
      }),
      reporter,
      fetchImpl: async () => new Response(null, { status: 302 }),
      nodeVersion: "22.0.0"
    });
    const parsed = JSON.parse(stdout.output) as { checks: DoctorCheck[] };
    expect(parsed.checks.find((check) => check.name === "halozat")?.ok).toBe(true);
  });

  it("marks halozat check as not ok when fetchImpl throws network error", async () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    await runDoctor({
      store: createFakeStore({
        username: "pelda_user",
        password: "pelda_password",
        totpSeed: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
      }),
      reporter,
      fetchImpl: async () => {
        throw new Error("Hálózati hiba");
      },
      nodeVersion: "22.0.0"
    });
    const parsed = JSON.parse(stdout.output) as { checks: DoctorCheck[] };
    expect(parsed.checks.find((check) => check.name === "halozat")?.ok).toBe(false);
  });

  it("marks belepo check as not ok when store loading throws error", async () => {
    const stdout = createMemoryStream();
    const reporter = createReporter({ json: true, debugDir: null, stdout: stdout.stream });
    const faultyStore: CredentialStore = {
      load: () => {
        throw new Error("Kulcstartó elérhetetlen");
      },
      require: () => {
        throw new Error("Kulcstartó elérhetetlen");
      },
      save: () => {},
      clear: () => false,
      source: () => "keyring"
    };
    await runDoctor({
      store: faultyStore,
      reporter,
      fetchImpl: async () => new Response(null, { status: 302 }),
      nodeVersion: "22.0.0"
    });
    const parsed = JSON.parse(stdout.output) as { checks: DoctorCheck[] };
    expect(parsed.checks.find((check) => check.name === "belepo")?.ok).toBe(false);
  });
});
