import { describe, expect, it } from "vitest";
import { EXIT_CODES } from "../src/errors.js";
import {
  type Credentials,
  createCredentialStore,
  ENV_KEYS,
  type KeyringAdapter
} from "../src/store/credentials.js";

function createMemoryKeyring(initialValue: string | null = null): KeyringAdapter {
  let stored = initialValue;
  return {
    get: () => stored,
    set: (value: string) => {
      stored = value;
    },
    delete: () => {
      const existed = stored !== null;
      stored = null;
      return existed;
    }
  };
}

const syntheticCreds: Credentials = {
  username: "pelda_user",
  password: "pelda_password",
  totpSeed: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
};

describe("ENV_KEYS", () => {
  it("defines standard environment variable names", () => {
    expect(ENV_KEYS).toEqual({
      username: "TARHELY_USERNAME",
      password: "TARHELY_PASSWORD",
      totpSeed: "TARHELY_TOTP_SEED"
    });
  });
});

describe("source", () => {
  it("reports env when all env variables are set", () => {
    const store = createCredentialStore(
      {
        TARHELY_USERNAME: syntheticCreds.username,
        TARHELY_PASSWORD: syntheticCreds.password,
        TARHELY_TOTP_SEED: syntheticCreds.totpSeed
      },
      createMemoryKeyring()
    );
    expect(store.source()).toBe("env");
  });

  it("reports keyring when env variables are absent", () => {
    const store = createCredentialStore({}, createMemoryKeyring());
    expect(store.source()).toBe("keyring");
  });
});

describe("load", () => {
  it("loads credentials from environment variables", () => {
    const store = createCredentialStore(
      {
        TARHELY_USERNAME: syntheticCreds.username,
        TARHELY_PASSWORD: syntheticCreds.password,
        TARHELY_TOTP_SEED: syntheticCreds.totpSeed
      },
      createMemoryKeyring()
    );
    expect(store.load()).toEqual(syntheticCreds);
  });

  it("loads credentials from keyring when env is empty", () => {
    const store = createCredentialStore({}, createMemoryKeyring(JSON.stringify(syntheticCreds)));
    expect(store.load()).toEqual(syntheticCreds);
  });

  it("prioritizes env over keyring credentials", () => {
    const store = createCredentialStore(
      {
        TARHELY_USERNAME: "env_user",
        TARHELY_PASSWORD: "env_password",
        TARHELY_TOTP_SEED: syntheticCreds.totpSeed
      },
      createMemoryKeyring(JSON.stringify(syntheticCreds))
    );
    expect(store.load()?.username).toBe("env_user");
  });

  it("returns null when neither env nor keyring has credentials", () => {
    const store = createCredentialStore({}, createMemoryKeyring(null));
    expect(store.load()).toBeNull();
  });

  it("returns null when keyring data is empty string", () => {
    const store = createCredentialStore({}, createMemoryKeyring(""));
    expect(store.load()).toBeNull();
  });

  it("returns null when keyring data lacks required fields", () => {
    const store = createCredentialStore(
      {},
      createMemoryKeyring(JSON.stringify({ username: "pelda_user" }))
    );
    expect(store.load()).toBeNull();
  });

  it("throws TarhelyError code 2 when only 1 env variable is set", () => {
    const store = createCredentialStore({ TARHELY_USERNAME: "pelda_user" }, createMemoryKeyring());
    expect(() => store.load()).toThrow(
      expect.objectContaining({
        code: EXIT_CODES.noCredentials
      })
    );
  });

  it("throws TarhelyError code 2 when only 2 env variables are set", () => {
    const store = createCredentialStore(
      {
        TARHELY_USERNAME: "pelda_user",
        TARHELY_PASSWORD: "pelda_password"
      },
      createMemoryKeyring()
    );
    expect(() => store.load()).toThrow(
      expect.objectContaining({
        code: EXIT_CODES.noCredentials
      })
    );
  });
});

describe("require", () => {
  it("returns credentials when available in store", () => {
    const store = createCredentialStore({}, createMemoryKeyring(JSON.stringify(syntheticCreds)));
    expect(store.require()).toEqual(syntheticCreds);
  });

  it("throws TarhelyError code 2 when no credentials are found", () => {
    const store = createCredentialStore({}, createMemoryKeyring(null));
    expect(() => store.require()).toThrow(
      expect.objectContaining({
        code: EXIT_CODES.noCredentials
      })
    );
  });
});

describe("save and clear", () => {
  it("saves credentials to the keyring adapter as JSON", () => {
    const keyring = createMemoryKeyring();
    const store = createCredentialStore({}, keyring);
    store.save(syntheticCreds);
    expect(JSON.parse(keyring.get() ?? "{}")).toEqual(syntheticCreds);
  });

  it("round-trips save and load through the keyring adapter", () => {
    const store = createCredentialStore({}, createMemoryKeyring());
    store.save(syntheticCreds);
    expect(store.load()).toEqual(syntheticCreds);
  });

  it("clears credentials and returns true when entry existed", () => {
    const store = createCredentialStore({}, createMemoryKeyring(JSON.stringify(syntheticCreds)));
    expect(store.clear()).toBe(true);
  });

  it("returns false when clearing an empty keyring", () => {
    const store = createCredentialStore({}, createMemoryKeyring(null));
    expect(store.clear()).toBe(false);
  });
});
