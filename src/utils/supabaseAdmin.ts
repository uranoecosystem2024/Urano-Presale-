// src/utils/supabaseAdmin.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      referrers: {
        Row: {
          id: string;
          referrer_address: string;
          ref_code: string;
          created_at: string;
          last_generated_at: string | null;
        };
        Insert: {
          id?: string;
          referrer_address: string;
          ref_code: string;
          created_at?: string;
          last_generated_at?: string | null;
        };
        Update: {
          id?: string;
          referrer_address?: string;
          ref_code?: string;
          created_at?: string;
          last_generated_at?: string | null;
        };
        Relationships: [];
      };
      conversions: {
        Row: {
          id: number;
          created_at: string;
          referrer_address: string;
          buyer_address: string;
          tx_hash: string;
          chain_id: number;
          amount: string | null;
          ref_code: string;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          referrer_address: string;
          buyer_address: string;
          tx_hash: string;
          chain_id: number;
          amount?: string | null;
          ref_code: string;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          referrer_address?: string;
          buyer_address?: string;
          tx_hash?: string;
          chain_id?: number;
          amount?: string | null;
          ref_code?: string;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export async function upsertReferrer(input: {
  referrerAddress: string;
  refCode: string;
}): Promise<void> {
  const { referrerAddress, refCode } = input;

  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  await admin
    .from("referrers")
    .upsert(
      {
        referrer_address: referrerAddress,
        ref_code: refCode,
        last_generated_at: new Date().toISOString(),
      },
      { onConflict: "referrer_address" }
    )
    .throwOnError();
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
}

export type ReferrerRow = Readonly<{
  referrer_address: string;
  ref_code: string;
}>;

export async function getReferrerByCode(refCode: string): Promise<ReferrerRow | null> {
  /* eslint-disable
    @typescript-eslint/no-unsafe-call,
    @typescript-eslint/no-unsafe-member-access,
    @typescript-eslint/no-unsafe-assignment
  */
  const res = await admin
    .from("referrers")
    .select("referrer_address,ref_code")
    .eq("ref_code", refCode)
    .maybeSingle();
  /* eslint-enable
    @typescript-eslint/no-unsafe-call,
    @typescript-eslint/no-unsafe-member-access,
    @typescript-eslint/no-unsafe-assignment
  */

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (res.error) throw new Error(String(res.error.message));

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return (res.data as ReferrerRow | null) ?? null;
}

export type InsertConversionInput = Readonly<{
  referrer_address: string;
  buyer_address: string;
  tx_hash: string;
  chain_id: number;
  amount?: string | null;
  ref_code: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}>;

export async function insertConversion(input: InsertConversionInput): Promise<void> {
  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  await admin
    .from("conversions")
    .insert({
      referrer_address: input.referrer_address,
      buyer_address: input.buyer_address,
      tx_hash: input.tx_hash,
      chain_id: input.chain_id,
      amount: input.amount ?? null,
      ref_code: input.ref_code,
      utm_source: input.utm_source ?? null,
      utm_medium: input.utm_medium ?? null,
      utm_campaign: input.utm_campaign ?? null,
      utm_content: input.utm_content ?? null,
      utm_term: input.utm_term ?? null,
    })
    .throwOnError();
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
}
