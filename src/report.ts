// Kimenet a felhasználónak és az agentnek.
//
// Ember: lépésnapló a stderr-re, eredmény a stdout-ra szövegesen.
// Agent (`--json`): a stdout-ra EGYETLEN JSON-objektum a végén, a lépések
// benne; a stderr csendes. Így a stdout mindig gépileg feldolgozható.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "playwright";

import { EXIT_CODES, type ExitCode, exitCodeOf, TarhelyError } from "./errors.js";
import type { StepFn } from "./kau/login.js";

export interface StepEntry {
  readonly step: string;
  readonly ok: boolean;
  readonly detail: string | null;
  readonly at: string;
}

export interface Reporter {
  readonly json: boolean;
  readonly step: StepFn;
  readonly steps: readonly StepEntry[];
  /** Emberi üzenet; JSON-módban elnyeli. */
  info(message: string): void;
  /** Sikeres befejezés: kiírja az eredményt, visszaadja a kilépési kódot. */
  finish(result: Record<string, unknown>, code?: ExitCode): ExitCode;
  /** Hiba: kiírja az üzenetet és a tanácsot, visszaadja a kilépési kódot. */
  fail(error: unknown): ExitCode;
  /** Diagnosztika hibánál: képernyőkép + accessibility-fa, ha van `--debug-dir`. */
  capture(page: Page, name: string): Promise<void>;
}

export interface ReporterOptions {
  readonly json: boolean;
  readonly debugDir: string | null;
  readonly stdout?: NodeJS.WritableStream;
  readonly stderr?: NodeJS.WritableStream;
}

export function createReporter(options: ReporterOptions): Reporter {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const steps: StepEntry[] = [];

  const reporter: Reporter = {
    json: options.json,
    steps,
    step(name, ok, detail) {
      const entry: StepEntry = {
        step: name,
        ok,
        detail: detail ?? null,
        at: new Date().toISOString()
      };
      steps.push(entry);
      if (!options.json) {
        stderr.write(`${ok ? "·" : "✗"} ${name}${entry.detail ? ` — ${entry.detail}` : ""}\n`);
      }
    },
    info(message) {
      if (!options.json) {
        stderr.write(`${message}\n`);
      }
    },
    finish(result, code = EXIT_CODES.ok) {
      if (options.json) {
        stdout.write(`${JSON.stringify({ ok: code === EXIT_CODES.ok, code, ...result, steps })}\n`);
      }
      return code;
    },
    fail(error) {
      const code = exitCodeOf(error);
      const message = error instanceof Error ? error.message : String(error);
      const hint = error instanceof TarhelyError ? error.hint : null;
      if (options.json) {
        stdout.write(`${JSON.stringify({ ok: false, code, error: message, hint, steps })}\n`);
      } else {
        stderr.write(`Hiba: ${message}\n`);
        if (hint) {
          stderr.write(`Tanács: ${hint}\n`);
        }
      }
      return code;
    },
    async capture(page, name) {
      if (options.debugDir === null) {
        return;
      }
      try {
        mkdirSync(options.debugDir, { recursive: true });
        await page.screenshot({ path: join(options.debugDir, `${name}.png`), fullPage: true });
        const aria = await page.locator("body").ariaSnapshot();
        writeFileSync(join(options.debugDir, `${name}.aria.yaml`), aria, "utf8");
        reporter.step(`debug:${name}`, true, options.debugDir);
      } catch (error) {
        reporter.step(
          `debug:${name}`,
          false,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  };
  return reporter;
}
