// src/app/api/referral/generate/route.ts
import { NextResponse, type NextRequest } from "next/server";

import { upsertReferrer } from "@/utils/supabaseAdmin";
import {
  isWhitelistedReferrer,
  normalizeAddress,
} from "@/utils/referral/whitelist";
import { makeRefCodeForAddress } from "@/utils/referral/refCode";

type GenerateBody = {
  address: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

const LANDING_DOMAIN = requireEnv("REFERRAL_LANDING_DOMAIN");

function buildReferralLink(refCode: string): string {
  const base = LANDING_DOMAIN.replace(/\/+$/, "");
  const url = new URL(base);
  url.searchParams.set("ref", refCode);
  url.searchParams.set("utm_source", "referral");
  url.searchParams.set("utm_medium", "wallet");
  url.searchParams.set("utm_campaign", "presale");
  return url.toString();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GenerateBody>;
    const addressRaw = body.address;

    if (!addressRaw || typeof addressRaw !== "string") {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const address = normalizeAddress(addressRaw);

    if (!isWhitelistedReferrer(address)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const refCode = makeRefCodeForAddress(address, { length: 12 });
    const referralLink = buildReferralLink(refCode);

    await upsertReferrer({ referrerAddress: address, refCode });

    return NextResponse.json({
      ref_code: refCode,
      referral_link: referralLink,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
