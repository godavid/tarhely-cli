import { describe, expect, it } from "vitest";
import { base32Decode, isValidTotpSeed, secondsLeftInWindow, totpCode } from "../src/kau/totp.js";

const RFC_SEED = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("base32Decode", () => {
  it("decodes RFC 6238 seed to ASCII 12345678901234567890", () => {
    expect(base32Decode(RFC_SEED).toString("utf8")).toBe("12345678901234567890");
  });

  it("handles lowercase letters", () => {
    expect(base32Decode(RFC_SEED.toLowerCase()).toString("utf8")).toBe("12345678901234567890");
  });

  it("strips spaces and dashes from the seed", () => {
    expect(base32Decode("GEZD GNBV-GY3T-QOJQ-GEZD-GNBV-GY3T-QOJQ").toString("utf8")).toBe(
      "12345678901234567890"
    );
  });

  it("ignores trailing padding", () => {
    expect(base32Decode("MY======").toString("utf8")).toBe("f");
  });

  it("throws on invalid character 1", () => {
    expect(() => base32Decode("GEZD1")).toThrow("Érvénytelen base32 karakter a TOTP-seedben: 1");
  });

  it("throws on invalid character 8", () => {
    expect(() => base32Decode("GEZD8")).toThrow("Érvénytelen base32 karakter a TOTP-seedben: 8");
  });
});

describe("totpCode", () => {
  it("matches RFC 6238 vector at T=59", () => {
    expect(totpCode(RFC_SEED, 59)).toBe("287082");
  });

  it("matches RFC 6238 vector at T=1111111109", () => {
    expect(totpCode(RFC_SEED, 1111111109)).toBe("081804");
  });

  it("matches RFC 6238 vector at T=1234567890", () => {
    expect(totpCode(RFC_SEED, 1234567890)).toBe("005924");
  });

  it("matches RFC 6238 vector at T=2000000000", () => {
    expect(totpCode(RFC_SEED, 2000000000)).toBe("279037");
  });

  it("pads the code to 6 digits with leading zero", () => {
    expect(totpCode(RFC_SEED, 1111111109)).toHaveLength(6);
  });
});

describe("secondsLeftInWindow", () => {
  it("returns full window at step boundary T=0", () => {
    expect(secondsLeftInWindow(0, 30)).toBe(30);
  });

  it("returns 1 second remaining at T=29", () => {
    expect(secondsLeftInWindow(29, 30)).toBe(1);
  });

  it("returns full window at step boundary T=30", () => {
    expect(secondsLeftInWindow(30, 30)).toBe(30);
  });

  it("returns 1 second remaining at T=59", () => {
    expect(secondsLeftInWindow(59, 30)).toBe(1);
  });

  it("supports custom window step size", () => {
    expect(secondsLeftInWindow(45, 60)).toBe(15);
  });
});

describe("isValidTotpSeed", () => {
  it("returns true for valid RFC 6238 seed", () => {
    expect(isValidTotpSeed(RFC_SEED)).toBe(true);
  });

  it("returns true for seed with spaces and dashes", () => {
    expect(isValidTotpSeed("GEZD GNBV-GY3T-QOJQ-GEZD-GNBV-GY3T-QOJQ")).toBe(true);
  });

  it("returns false for seed shorter than 10 bytes", () => {
    expect(isValidTotpSeed("MZXW6YQ")).toBe(false);
  });

  it("returns false for seed containing invalid characters", () => {
    expect(isValidTotpSeed("GEZD1890XYZ")).toBe(false);
  });
});
