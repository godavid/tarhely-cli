import { confirm } from "../prompt.js";
import type { Reporter } from "../report.js";
import type { CredentialStore } from "../store/credentials.js";

export interface ForgetOptions {
  readonly store: CredentialStore;
  readonly reporter: Reporter;
  readonly yes: boolean;
}

export async function runForget(options: ForgetOptions): Promise<number> {
  const { reporter, store } = options;
  if (!options.yes) {
    if (reporter.json) {
      return reporter.fail(
        new Error("A forget megerősítést kér; --json módban add meg a --yes kapcsolót.")
      );
    }
    const sure = await confirm("Törlöd az Ügyfélkapu+ belépőt a kulcstartóból?");
    if (!sure) {
      reporter.info("Nem történt semmi.");
      return reporter.finish({ removed: false });
    }
  }
  try {
    const removed = store.clear();
    reporter.info(removed ? "A belépő törölve a kulcstartóból." : "Nem volt tárolt belépő.");
    return reporter.finish({ removed });
  } catch (error) {
    return reporter.fail(error);
  }
}
