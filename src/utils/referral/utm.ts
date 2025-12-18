// src/utils/referral/utm.ts

export type UtmPayload = Readonly<{
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  }>;
  
  export const UTM_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ] as const;
  
  export type UtmKey = (typeof UTM_KEYS)[number];
  
  export function pickUtmFromSearchParams(sp: URLSearchParams): UtmPayload {
    const out: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const v = sp.get(key);
      if (v && v.trim().length > 0) out[key] = v.trim();
    }
    return out as UtmPayload;
  }
  