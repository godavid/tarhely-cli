// A belépő (felhasználónév, jelszó, TOTP-seed) tárolása.
//
// Az egyetlen tartós hely az operációs rendszer kulcstartója (macOS Keychain,
// Windows Credential Manager, Linux Secret Service). Az env-felülírás
// szerverekre és CI-ra van: ott a titkot a futtató környezet adja, a gépen nem
// marad. Fájlba a belépő SOHA nem kerül.

import { EXIT_CODES, noCredentialsError, TarhelyError } from "../errors.js";

export interface Credentials {
  readonly username: string;
  readonly password: string;
  readonly totpSeed: string;
}

export type CredentialSource = "env" | "keyring";

export interface KeyringAdapter {
  get(): string | null;
  set(value: string): void;
  delete(): boolean;
}

export interface CredentialStore {
  /** A belépő, vagy null, ha sehol nincs. Hiányos env → hiba, nem csendes átesés. */
  load(): Credentials | null;
  /** Mint a `load`, de hiánynál a 2-es kilépési kódú hibát dobja. */
  require(): Credentials;
  save(credentials: Credentials): void;
  clear(): boolean;
  /** Honnan jönne a belépő a jelen környezetben. */
  source(): CredentialSource;
}

export const ENV_KEYS = {
  username: "TARHELY_USERNAME",
  password: "TARHELY_PASSWORD",
  totpSeed: "TARHELY_TOTP_SEED"
} as const;

const KEYRING_SERVICE = "tarhely-cli";
const KEYRING_ACCOUNT = "default";

export function createCredentialStore(
  env: NodeJS.ProcessEnv = process.env,
  keyring: KeyringAdapter = createSystemKeyring()
): CredentialStore {
  function fromEnv(): Credentials | null {
    const username = env[ENV_KEYS.username];
    const password = env[ENV_KEYS.password];
    const totpSeed = env[ENV_KEYS.totpSeed];
    const present = [username, password, totpSeed].filter((value) => value && value !== "");
    if (present.length === 0) {
      return null;
    }
    if (present.length !== 3) {
      throw new TarhelyError(
        EXIT_CODES.noCredentials,
        "Hiányos env-belépő: a három változó együtt kell.",
        `Add meg mindhármat (${Object.values(ENV_KEYS).join(", ")}), vagy töröld őket, és használd a kulcstartót (npx tarhely-cli init).`
      );
    }
    return {
      username: username as string,
      password: password as string,
      totpSeed: totpSeed as string
    };
  }

  function fromKeyring(): Credentials | null {
    const raw = keyring.get();
    if (raw === null || raw === "") {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Credentials>;
    if (!parsed.username || !parsed.password || !parsed.totpSeed) {
      return null;
    }
    return { username: parsed.username, password: parsed.password, totpSeed: parsed.totpSeed };
  }

  const store: CredentialStore = {
    load() {
      return fromEnv() ?? fromKeyring();
    },
    require() {
      const credentials = store.load();
      if (credentials === null) {
        throw noCredentialsError();
      }
      return credentials;
    },
    save(credentials) {
      keyring.set(JSON.stringify(credentials));
    },
    clear() {
      return keyring.delete();
    },
    source() {
      return fromEnv() !== null ? "env" : "keyring";
    }
  };
  return store;
}

// A natív modult lustán töltjük: a `--help` és a tesztek ne függjenek tőle, és
// a hiányzó kulcstartó-háttér (pl. csupasz Linux) érthető üzenettel bukjon.
export function createSystemKeyring(): KeyringAdapter {
  type Entry = {
    getPassword(): string | null;
    setPassword(value: string): void;
    deletePassword(): boolean;
  };
  let entry: Entry | null = null;

  function open(): Entry {
    if (entry === null) {
      let mod: { Entry: new (service: string, account: string) => Entry };
      try {
        mod = requireKeyring();
      } catch (error) {
        throw new TarhelyError(
          EXIT_CODES.unknown,
          `Nem érhető el az operációs rendszer kulcstartója: ${error instanceof Error ? error.message : String(error)}`,
          `Linuxon telepíts Secret Service hátteret (gnome-keyring vagy KWallet), vagy add meg a belépőt env-ben: ${Object.values(ENV_KEYS).join(", ")}.`
        );
      }
      entry = new mod.Entry(KEYRING_SERVICE, KEYRING_ACCOUNT);
    }
    return entry;
  }

  return {
    get() {
      try {
        return open().getPassword();
      } catch (error) {
        if (error instanceof TarhelyError) {
          throw error;
        }
        return null;
      }
    },
    set(value) {
      open().setPassword(value);
    },
    delete() {
      try {
        return open().deletePassword();
      } catch (error) {
        if (error instanceof TarhelyError) {
          throw error;
        }
        return false;
      }
    }
  };
}

function requireKeyring(): {
  Entry: new (
    service: string,
    account: string
  ) => {
    getPassword(): string | null;
    setPassword(value: string): void;
    deletePassword(): boolean;
  };
} {
  // Szinkron betöltés kell (a store API szinkron); a natív csomag CommonJS.
  // biome-ignore lint/suspicious/noExplicitAny: a createRequire típusa ezt adja
  const require = (globalThis as any).process
    .getBuiltinModule("node:module")
    .createRequire(import.meta.url);
  return require("@napi-rs/keyring");
}
