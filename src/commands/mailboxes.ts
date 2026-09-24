import type { Reporter } from "../report.js";
import { withSession } from "../session.js";
import type { CredentialStore } from "../store/credentials.js";

export interface MailboxesOptions {
  readonly store: CredentialStore;
  readonly reporter: Reporter;
  readonly headed: boolean;
}

export async function runMailboxes(options: MailboxesOptions): Promise<number> {
  const { reporter } = options;
  try {
    const mailboxes = await withSession(options, async (session) =>
      session.mailboxes.map((mailbox) => ({
        index: mailbox.index + 1,
        name: mailbox.name,
        slug: mailbox.slug
      }))
    );
    for (const mailbox of mailboxes) {
      reporter.info(`${mailbox.index}. ${mailbox.name}`);
    }
    return reporter.finish({ mailboxes });
  } catch (error) {
    return reporter.fail(error);
  }
}
