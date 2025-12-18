// src/utils/referral/refCode.ts
import { createHash } from "crypto";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

const REFERRAL_CODE_SECRET = requireEnv("REFERRAL_CODE_SECRET");

/**
 * Deterministic, non-guessable ref_code:
 * - stable per address
 * - traceable server-side (you can always recompute)
 * - not easily enumerable (uses a secret)
 */
export function makeRefCodeForAddress(
  referrerAddress: string,
  opts?: { length?: number }
): string {
  const length = opts?.length ?? 12;
  const normalized = referrerAddress.trim().toLowerCase();

  const hex = createHash("sha256")
    .update(`${normalized}:${REFERRAL_CODE_SECRET}`)
    .digest("hex");

  // Convert hex -> base36-ish token by taking a slice then parsing BigInt.
  // This avoids needing extra deps for base62.
  const slice = hex.slice(0, 20); // 80 bits
  const token = BigInt(`0x${slice}`).toString(36);

  // Ensure fixed-ish length output (pad if needed)
  const padded = token.padStart(length, "0");
  return padded.slice(0, length);
}
