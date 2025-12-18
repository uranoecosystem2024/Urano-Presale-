// src/utils/referral/whitelist.ts

export const REFERRAL_WHITELIST = [
    "0xcf49627131e24cbf2bc9ab6a92e3061a56f5a251",
    "0x5dae4334cd8054027a28a6985dcde0bd1ec68620",
    "0xbe0816f9379737e3b01e162c2481f62e91bdd247",
    "0x026a648a971e4ae7805980680a54e505b6d80f3f"
  ] as const;
  
  export type WhitelistedReferrerAddress = (typeof REFERRAL_WHITELIST)[number];
  
  export function normalizeAddress(address: string): string {
    return address.trim().toLowerCase();
  }
  
  export function isWhitelistedReferrer(address?: string | null): boolean {
    if (!address) return false;
    const a = normalizeAddress(address);
    return (REFERRAL_WHITELIST as readonly string[]).includes(a);
  }
  