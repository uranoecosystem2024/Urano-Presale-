// src/app/api/referral/convert/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { getReferrerByCode, insertConversion } from "@/utils/supabaseAdmin";

type ConvertBody = Readonly<{
  buyer_address: string;
  tx_hash: string;
  chain_id: number;
  amount?: string | null;
}>;

type StoredAttribution = Readonly<{
  ref_code: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  first_seen_at: string;
}>;

const COOKIE_KEY = "urano_ref";

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ConvertBody>;

    const buyerRaw = body.buyer_address;
    const txHashRaw = body.tx_hash;
    const chainId = body.chain_id;

    if (!buyerRaw || typeof buyerRaw !== "string") {
      return NextResponse.json({ error: "Missing buyer_address" }, { status: 400 });
    }
    if (!txHashRaw || typeof txHashRaw !== "string") {
      return NextResponse.json({ error: "Missing tx_hash" }, { status: 400 });
    }
    if (typeof chainId !== "number" || Number.isNaN(chainId)) {
      return NextResponse.json({ error: "Missing chain_id" }, { status: 400 });
    }

    const buyer = normalizeAddress(buyerRaw);
    const txHash = txHashRaw.trim();

    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_KEY)?.value ?? "";
    const decoded = raw ? decodeURIComponent(raw) : "";
    const attribution = decoded ? safeJsonParse<StoredAttribution>(decoded) : null;

    if (!attribution?.ref_code) {
      // no referral attribution present -> no-op
      return NextResponse.json({ ok: true, attributed: false });
    }

    const refCode = String(attribution.ref_code).trim();
    const ref = await getReferrerByCode(refCode);

    if (!ref?.referrer_address) {
      // unknown ref_code -> ignore but don't break purchase flow
      return NextResponse.json({ ok: true, attributed: false });
    }

    await insertConversion({
      referrer_address: normalizeAddress(ref.referrer_address),
      buyer_address: buyer,
      tx_hash: txHash,
      chain_id: chainId,
      amount: body.amount ?? null,
      ref_code: refCode,
      utm_source: attribution.utm_source ?? null,
      utm_medium: attribution.utm_medium ?? null,
      utm_campaign: attribution.utm_campaign ?? null,
      utm_content: attribution.utm_content ?? null,
      utm_term: attribution.utm_term ?? null,
    });

    return NextResponse.json({ ok: true, attributed: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
