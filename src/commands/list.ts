import { EXIT_CODES, TarhelyError } from "../errors.js";
import type { Reporter } from "../report.js";
import { selectMailboxes, withSession } from "../session.js";
import type { CredentialStore } from "../store/credentials.js";
import { listLetters } from "../tarhely/inbox.js";

export interface ListCommandOptions {
  readonly store: CredentialStore;
  readonly reporter: Reporter;
  readonly headed: boolean;
  readonly mailbox: string;
  readonly since: string | null;
  readonly outDir: string | null;
}

export async function runList(options: ListCommandOptions): Promise<number> {
  const { reporter } = options;
  try {
    const letters = await withSession(options, async (session) => {
      const mailboxes = selectMailboxes(session.mailboxes, options.mailbox);
      if (mailboxes.length === 0) {
        throw new TarhelyError(
          EXIT_CODES.unknown,
          `Nincs ilyen postafiók: ${options.mailbox}`,
          `Elérhető: ${session.mailboxes.map((item, index) => `${index + 1}. ${item.name}`).join(", ")}`
        );
      }
      return listLetters(session, {
        mailboxes,
        since: options.since,
        outDir: options.outDir,
        step: reporter.step
      });
    });
    for (const letter of letters) {
      const marker = options.outDir === null ? "" : letter.isNew ? " [ÚJ]" : " [megvan]";
      reporter.info(
        `${letter.receivedAt}  ${letter.sender}  —  ${letter.desc || letter.type}  (${letter.eid})${marker}`
      );
    }
    reporter.info(`\n${letters.length} levél.`);
    return reporter.finish({ letters });
  } catch (error) {
    return reporter.fail(error);
  }
}
