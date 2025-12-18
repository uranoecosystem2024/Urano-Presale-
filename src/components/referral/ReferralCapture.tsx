// src/components/referral/ReferralCapture.tsx
"use client";

import { useEffect } from "react";
import { pickUtmFromSearchParams } from "@/utils/referral/utm";

type StoredAttribution = Readonly<{
  ref_code: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  first_seen_at: string; // ISO
}>;

const LS_KEY = "urano:ref_attribution";
const COOKIE_KEY = "urano_ref";

function setCookie(name: string, value: string, days: number): void {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export default function ReferralCapture(): null {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const sp = url.searchParams;

      const refCode = sp.get("ref")?.trim() ?? "";
      if (!refCode) return;

      const utms = pickUtmFromSearchParams(sp);

      const payload: StoredAttribution = {
        ref_code: refCode,
        ...utms,
        first_seen_at: new Date().toISOString(),
      };

      const serialized = JSON.stringify(payload);

      // Persist in both cookie + localStorage
      setCookie(COOKIE_KEY, serialized, 30);
      window.localStorage.setItem(LS_KEY, serialized);

      // Clean URL: remove ref + utms
      sp.delete("ref");
      sp.delete("utm_source");
      sp.delete("utm_medium");
      sp.delete("utm_campaign");
      sp.delete("utm_content");
      sp.delete("utm_term");

      const cleaned = `${url.pathname}${sp.toString() ? `?${sp.toString()}` : ""}${url.hash}`;
      window.history.replaceState({}, "", cleaned);
    } catch {
      // no-op
    }
  }, []);

  return null;
}
