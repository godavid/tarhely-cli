// Védelem az ellen, hogy a letöltött levelek egy git-repóba commitolhatók
// legyenek: ha a kimeneti mappa egy munkafán belül van és nincs ignorálva,
// a letöltés el sem indul.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { EXIT_CODES, TarhelyError } from "./errors.js";

export function assertOutDirNotCommittable(outDir: string): void {
  const absolute = resolve(outDir);
  const cwd = nearestExistingDir(absolute);
  // Próbafájl a mappán belül: a könyvtárra vonatkozó minta (`/tarhely/`) akkor is
  // illeszkedik, ha a mappa még nem létezik. A név kiterjesztés nélküli, hogy
  // egy `*.jsonl`-szerű fájlminta ne adjon hamis biztonságot.
  const probe = join(absolute, ".tarhely-cli-probe");
  const status = gitStatus(cwd, ["check-ignore", "-q", "--", probe]);
  // 0: ignorálva · 128: nem git-munkafa (vagy nincs git) · 1: commitolható lenne
  if (status !== 1) return;
  throw new TarhelyError(
    EXIT_CODES.unknown,
    `A letöltési mappa (${absolute}) egy git-repóban van, és nincs a .gitignore-ban: a levelek commitolhatók lennének.`,
    "Vedd fel a mappát a .gitignore-ba, vagy adj meg repón kívüli mappát: --out <mappa>"
  );
}

function nearestExistingDir(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

function gitStatus(cwd: string, args: readonly string[]): number {
  try {
    execFileSync("git", [...args], { cwd, stdio: "ignore" });
    return 0;
  } catch (error) {
    const status = (error as { status?: number | null }).status;
    // Nincs git a gépen (ENOENT): nincs mibe commitolni.
    return typeof status === "number" ? status : 128;
  }
}
