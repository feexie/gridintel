import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/* ==========================================================
   TIME-BASED ONE-TIME PASSWORDS (RFC 6238)

   What an authenticator app computes: HMAC-SHA1 of the 30-second
   step, six digits. The in-memory identity adapter checks codes
   with it, and the browser tests compute them with it. Supabase
   checks its own; this module is not used with it.
========================================================== */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Not a base32 secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new shared secret: 20 random bytes, base32. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for the step holding `atMs`. */
export function totpCode(secret: string, atMs: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / STEP_SECONDS)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** True when the code is for the step holding `atMs` or the one either side of it, as apps allow for a slow clock. */
export function totpMatches(secret: string, code: string, atMs: number): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((drift) => {
    const expected = Buffer.from(totpCode(secret, atMs + drift * STEP_SECONDS * 1000));
    return timingSafeEqual(expected, Buffer.from(code));
  });
}

export function totpUri(secret: string, account: string, issuer: string): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
