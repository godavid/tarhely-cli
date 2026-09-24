// Környezet-ellenőrzés belépés nélkül: az agent ezzel dönti el, mi hiányzik.

import { isChromiumInstalled } from "../browser.js";
import { EXIT_CODES, TarhelyError } from "../errors.js";
import type { Reporter } from "../report.js";
import type { CredentialStore } from "../store/credentials.js";
import { TARHELY_URL } from "../tarhely/api.js";

export interface DoctorOptions {
  readonly store: CredentialStore;
  readonly reporter: Reporter;
  readonly fetchImpl?: typeof fetch;
  readonly nodeVersion?: string;
}

export interface DoctorCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

const MIN_NODE_MAJOR = 20;

export async function runDoctor(options: DoctorOptions): Promise<number> {
  const { reporter, store } = options;
  const checks: DoctorCheck[] = [];

  const nodeVersion = options.nodeVersion ?? process.versions.node;
  const major = Number(nodeVersion.split(".")[0]);
  checks.push({
    name: "node",
    ok: major >= MIN_NODE_MAJOR,
    detail:
      major >= MIN_NODE_MAJOR
        ? `v${nodeVersion}`
        : `v${nodeVersion} — legalább Node ${MIN_NODE_MAJOR} kell`
  });

  const chromium = isChromiumInstalled();
  checks.push({
    name: "chromium",
    ok: chromium,
    detail: chromium ? "telepítve" : "hiányzik — npx playwright install chromium"
  });

  let credentialsOk = false;
  try {
    const credentials = store.load();
    credentialsOk = credentials !== null;
    checks.push({
      name: "belepo",
      ok: credentialsOk,
      detail: credentialsOk
        ? `rögzítve (${store.source() === "env" ? "env" : "kulcstartó"}, felhasználó: ${maskUsername(credentials?.username ?? "")})`
        : "nincs — npx tarhely-cli init (saját terminálban)"
    });
  } catch (error) {
    checks.push({
      name: "belepo",
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  const network = await checkNetwork(options.fetchImpl ?? fetch);
  checks.push(network);

  for (const check of checks) {
    reporter.info(`${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);
  }

  const allOk = checks.every((check) => check.ok);
  const code = allOk
    ? EXIT_CODES.ok
    : credentialsOk
      ? EXIT_CODES.unknown
      : EXIT_CODES.noCredentials;
  if (!allOk && !reporter.json) {
    reporter.info("\nVan javítanivaló, lásd a ✗ sorokat.");
  }
  return reporter.finish({ checks }, code);
}

async function checkNetwork(fetchImpl: typeof fetch): Promise<DoctorCheck> {
  try {
    const response = await fetchImpl(TARHELY_URL, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000)
    });
    const ok = response.status > 0 && response.status < 500;
    return {
      name: "halozat",
      ok,
      detail: ok ? `${TARHELY_URL} elérhető (HTTP ${response.status})` : `HTTP ${response.status}`
    };
  } catch (error) {
    const message =
      error instanceof TarhelyError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return { name: "halozat", ok: false, detail: `${TARHELY_URL} nem érhető el: ${message}` };
  }
}

export function maskUsername(username: string): string {
  if (username.length <= 3) {
    return "***";
  }
  return `${username.slice(0, 2)}…${username.slice(-1)}`;
}
