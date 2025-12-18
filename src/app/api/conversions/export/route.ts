// src/app/api/conversions/export/route.ts
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Database = {
  public: {
    Tables: {
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
      };
    };
  };
};

type ConversionRow = Database["public"]["Tables"]["conversions"]["Row"];

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

const COLS: ReadonlyArray<keyof ConversionRow> = [
  "created_at",
  "referrer_address",
  "buyer_address",
  "tx_hash",
  "chain_id",
  "amount",
  "ref_code",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  // last-resort for unexpected objects
  const s = JSON.stringify(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function tsForFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 50000) : 20000;

    if (format !== "csv" && format !== "xlsx") {
      return NextResponse.json({ error: "Invalid format. Use csv or xlsx." }, { status: 400 });
    }

    // Fetch rows (throw instead of checking res.error to avoid unsafe access)
    /* eslint-disable
      @typescript-eslint/no-unsafe-call,
      @typescript-eslint/no-unsafe-member-access,
      @typescript-eslint/no-unsafe-assignment
    */
    const res = await admin
      .from("conversions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
      .throwOnError();
    /* eslint-enable
      @typescript-eslint/no-unsafe-call,
      @typescript-eslint/no-unsafe-member-access,
      @typescript-eslint/no-unsafe-assignment
    */

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const rows = (res.data as ConversionRow[] | null) ?? [];

    const filenameBase = `conversions-${tsForFilename()}`;

    if (format === "csv") {
      const header = COLS.join(",");
      const lines = rows.map((r) => COLS.map((c) => csvEscape(r[c])).join(","));
      const csv = [header, ...lines].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // xlsx
    const dataForSheet = rows.map((r) => {
      const out: Record<string, string | number | null> = {};
      for (const c of COLS) {
        out[c] = r[c] ?? null;
      }
      return out;
    });

    /* eslint-disable
      @typescript-eslint/no-unsafe-call,
      @typescript-eslint/no-unsafe-member-access,
      @typescript-eslint/no-unsafe-assignment
    */
    const ws = XLSX.utils.json_to_sheet(dataForSheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "conversions");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    /* eslint-enable
      @typescript-eslint/no-unsafe-call,
      @typescript-eslint/no-unsafe-member-access,
      @typescript-eslint/no-unsafe-assignment
    */

    return new Response(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
