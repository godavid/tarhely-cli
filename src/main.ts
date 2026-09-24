// A parancssori logika: argumentum-értelmezés és diszpécser. A tényleges bin
// belépési pont a `cli.ts`, ez a modul tesztből is importálható main() futtatása nélkül.

import { createRequire } from "node:module";
import { parseArgs } from "node:util";

import { runDoctor } from "./commands/doctor.js";
import { runDownload } from "./commands/download.js";
import { runForget } from "./commands/forget.js";
import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { runMailboxes } from "./commands/mailboxes.js";
import { EXIT_CODES } from "./errors.js";
import { createReporter } from "./report.js";
import { createCredentialStore } from "./store/credentials.js";

export const USAGE = `tarhely-cli — Ügyfélkapu+ belépés és a hivatali tárhely leveleinek letöltése

Használat:
  tarhely-cli init                       belépő rögzítése (interaktív, saját terminálban)
  tarhely-cli doctor [--json]            környezet-ellenőrzés belépés nélkül
  tarhely-cli mailboxes [--json]         a belépővel elérhető postafiókok
  tarhely-cli list [opciók]              beérkezett levelek listája (nem tölt le)
  tarhely-cli download [opciók]          új levelek letöltése és kibontása
  tarhely-cli forget [--yes]             belépő törlése a kulcstartóból

Opciók:
  --mailbox <all|sorszám|névrészlet>     melyik postafiók (alap: all)
  --since YYYY-MM-DD                     csak az ettől érkezett levelek
  --out <mappa>                          letöltési mappa (alap: ./tarhely)
  --max <n>                              legfeljebb ennyi levél egy futásban (alap: 200)
  --no-extract                           a zipet ne bontsa ki
  --json                                 gépi kimenet a stdout-ra (agenteknek)
  --headed                               látható böngésző (hibakereséshez)
  --debug-dir <mappa>                    hibánál képernyőkép + accessibility-fa ide
  -h, --help                             ez a súgó
  -v, --version                          verzió

Kilépési kódok: 0 ok · 1 hiba · 2 nincs belépő · 3 belépés sikertelen ·
4 a portál megváltozott · 5 részleges letöltés
`;

const OPTIONS = {
  json: { type: "boolean", default: false },
  headed: { type: "boolean", default: false },
  "debug-dir": { type: "string" },
  mailbox: { type: "string", default: "all" },
  since: { type: "string" },
  out: { type: "string", default: "tarhely" },
  max: { type: "string", default: "200" },
  extract: { type: "boolean", default: true },
  yes: { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
  version: { type: "boolean", short: "v", default: false }
} as const;

export interface ParsedCli {
  readonly command: string | null;
  readonly json: boolean;
  readonly headed: boolean;
  readonly debugDir: string | null;
  readonly mailbox: string;
  readonly since: string | null;
  readonly outDir: string;
  readonly max: number;
  readonly extract: boolean;
  readonly yes: boolean;
  readonly help: boolean;
  readonly version: boolean;
}

export function parseCli(args: readonly string[]): ParsedCli {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: OPTIONS,
    allowPositionals: true,
    allowNegative: true,
    strict: true
  });
  const since = values.since ?? null;
  if (since !== null && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    throw new Error(`A --since formátuma YYYY-MM-DD, ezt kaptam: ${since}`);
  }
  const max = Number(values.max);
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(`A --max pozitív egész szám, ezt kaptam: ${values.max}`);
  }
  return {
    command: positionals[0] ?? null,
    json: values.json,
    headed: values.headed,
    debugDir: values["debug-dir"] ?? null,
    mailbox: values.mailbox,
    since,
    outDir: values.out,
    max,
    extract: values.extract,
    yes: values.yes,
    help: values.help,
    version: values.version
  };
}

export async function main(args: readonly string[]): Promise<number> {
  let parsed: ParsedCli;
  try {
    parsed = parseCli(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return EXIT_CODES.unknown;
  }

  if (parsed.version) {
    process.stdout.write(`${readVersion()}\n`);
    return EXIT_CODES.ok;
  }
  if (parsed.help || parsed.command === null) {
    process.stdout.write(USAGE);
    return parsed.help ? EXIT_CODES.ok : EXIT_CODES.unknown;
  }

  const reporter = createReporter({ json: parsed.json, debugDir: parsed.debugDir });
  const store = createCredentialStore();
  const common = { store, reporter, headed: parsed.headed };

  switch (parsed.command) {
    case "init":
      return runInit(common);
    case "doctor":
      return runDoctor(common);
    case "mailboxes":
      return runMailboxes(common);
    case "list":
      return runList({
        ...common,
        mailbox: parsed.mailbox,
        since: parsed.since,
        outDir: parsed.outDir
      });
    case "download":
      return runDownload({
        ...common,
        mailbox: parsed.mailbox,
        since: parsed.since,
        outDir: parsed.outDir,
        max: parsed.max,
        extract: parsed.extract
      });
    case "forget":
      return runForget({ ...common, yes: parsed.yes });
    default:
      process.stderr.write(`Ismeretlen parancs: ${parsed.command}\n\n${USAGE}`);
      return EXIT_CODES.unknown;
  }
}

function readVersion(): string {
  const require = createRequire(import.meta.url);
  return (require("../package.json") as { version: string }).version;
}
