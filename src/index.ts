// Könyvtári belépési pont: a CLI mögötti építőkövek más programoknak.

export { ALLOWED_HOSTS, isAllowedHost, launchBrowser } from "./browser.js";
export { EXIT_CODES, type ExitCode, TarhelyError } from "./errors.js";
export { extractZip, isSafeEntryPath, isZip } from "./extract.js";
export { type LoginOptions, loginToKau, type StepFn } from "./kau/login.js";
export { base32Decode, isValidTotpSeed, secondsLeftInWindow, totpCode } from "./kau/totp.js";
export { type Session, selectMailboxes, withSession } from "./session.js";
export {
  type CredentialStore,
  type Credentials,
  createCredentialStore,
  ENV_KEYS,
  type KeyringAdapter
} from "./store/credentials.js";
export { appendIndex, type IndexEntry, knownIds, readIndex } from "./store/index.js";
export * from "./tarhely/api.js";
export { downloadNewLetters, listLetters } from "./tarhely/inbox.js";
export { dismissModals, switchMailbox } from "./tarhely/mailbox.js";
