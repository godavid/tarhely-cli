import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { TarhelyError } from "../src/errors.js";
import { parseCli } from "../src/main.js";
import { assertOutDirNotCommittable } from "../src/outdir.js";

const repoRoot = resolve(import.meta.dirname, "..");
const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "tarhely-outdir-"));
  dirs.push(dir);
  return dir;
}

function tempRepo(gitignore?: string): string {
  const dir = tempDir();
  execFileSync("git", ["init", "-q"], { cwd: dir });
  if (gitignore !== undefined) writeFileSync(join(dir, ".gitignore"), gitignore);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("assertOutDirNotCommittable", () => {
  it("keeps the default --out directory ignored in this repository", () => {
    const outDir = join(repoRoot, parseCli(["download"]).outDir);
    expect(() => assertOutDirNotCommittable(outDir)).not.toThrow();
  });

  it("refuses a directory inside a git work tree that is not ignored", () => {
    const repo = tempRepo();
    expect(() => assertOutDirNotCommittable(join(repo, "tarhely"))).toThrow(TarhelyError);
  });

  it("refuses when only the index file pattern is ignored", () => {
    const repo = tempRepo("*.jsonl\n");
    expect(() => assertOutDirNotCommittable(join(repo, "tarhely"))).toThrow(TarhelyError);
  });

  it("allows an ignored directory even before it exists", () => {
    const repo = tempRepo("/tarhely/\n");
    expect(() => assertOutDirNotCommittable(join(repo, "tarhely", "nested"))).not.toThrow();
  });

  it("allows a directory outside any git work tree", () => {
    expect(() => assertOutDirNotCommittable(join(tempDir(), "tarhely"))).not.toThrow();
  });
});
