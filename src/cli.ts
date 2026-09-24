#!/usr/bin/env node
// A bin belépési pontja: a `main` a main.ts-ben él, itt csak futtatjuk. Nincs
// „közvetlen futás" ellenőrzés: npx/pnpm symlinken át indítva az
// import.meta.url és az argv[1] sosem egyezne, és a CLI némán semmit sem tenne.

import { EXIT_CODES } from "./errors.js";
import { main } from "./main.js";

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exitCode = EXIT_CODES.unknown;
  }
);
