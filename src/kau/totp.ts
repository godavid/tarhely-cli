// TOTP (RFC 6238, SHA-1, 30 mp, 6 jegy): az Ügyfélkapu+ hitelesítő alkalmazás
// kódját állítja elő. Függőség nélkül, node:crypto-ra épül.

import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input
    .toUpperCase()
    .replace(/=+$/, "")
    .replace(/[\s-]+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Érvénytelen base32 karakter a TOTP-seedben: ${char}`);
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(out);
}

export function totpCode(seed: string, atSeconds: number, stepSeconds = 30): string {
  const counter = Math.floor(atSeconds / stepSeconds);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", base32Decode(seed)).update(buffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

// Hány másodperc van hátra az aktuális ablakból. A belépés akkor hasal el
// némán, ha a kód küldés közben jár le, ezért kevés maradéknál várunk.
export function secondsLeftInWindow(atSeconds: number, stepSeconds = 30): number {
  return stepSeconds - (Math.floor(atSeconds) % stepSeconds);
}

/** Igaz, ha a seed dekódolható és kódot lehet belőle képezni. */
export function isValidTotpSeed(seed: string): boolean {
  try {
    return base32Decode(seed).length >= 10 && /^\d{6}$/.test(totpCode(seed, 0));
  } catch {
    return false;
  }
}
