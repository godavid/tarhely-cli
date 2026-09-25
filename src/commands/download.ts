import { resolve } from "node:path";

import { EXIT_CODES, TarhelyError } from "../errors.js";
import { assertOutDirNotCommittable } from "../outdir.js";
import type { Reporter } from "../report.js";
import { selectMailboxes, withSession } from "../session.js";
import type { CredentialStore } from "../store/credentials.js";
import { downloadNewLetters } from "../tarhely/inbox.js";

export interface DownloadCommandOptions {
  readonly store: CredentialStore;
  readonly reporter: Reporter;
  readonly headed: boolean;
  readonly mailbox: string;
  readonly since: string | null;
  readonly outDir: string;
  readonly max: number;
  readonly extract: boolean;
}

export async function runDownload(options: DownloadCommandOptions): Promise<number> {
  const { reporter } = options;
  const outDir = resolve(options.outDir);
  try {
    assertOutDirNotCommittable(outDir);
    const result = await withSession(options, async (session) => {
      const mailboxes = selectMailboxes(session.mailboxes, options.mailbox);
      if (mailboxes.length === 0) {
        throw new TarhelyError(
          EXIT_CODES.unknown,
          `Nincs ilyen postafiók: ${options.mailbox}`,
          `Elérhető: ${session.mailboxes.map((item, index) => `${index + 1}. ${item.name}`).join(", ")}`
        );
      }
      return downloadNewLetters(session, {
        mailboxes,
        since: options.since,
        outDir,
        max: options.max,
        extract: options.extract,
        step: reporter.step
      });
    });

    for (const report of result.mailboxes) {
      const quota = report.quotaPercent === null ? "" : `, tárhely-kvóta ${report.quotaPercent}%`;
      reporter.info(
        `${report.mailbox}: ${report.total} levél, ${report.fresh} új, ${report.downloaded} letöltve${report.failed ? `, ${report.failed} sikertelen` : ""}${quota}`
      );
    }
    if (result.skippedByLimit > 0) {
      reporter.info(
        `${result.skippedByLimit} új levél kimaradt a --max korlát miatt; futtasd újra.`
      );
    }
    reporter.info(`\nMappa: ${outDir}`);
    const code = result.failed > 0 ? EXIT_CODES.partial : EXIT_CODES.ok;
    return reporter.finish({ outDir, ...result }, code);
  } catch (error) {
    return reporter.fail(error);
  }
}
