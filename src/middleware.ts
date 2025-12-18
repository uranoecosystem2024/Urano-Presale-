import { NextResponse, type NextRequest } from "next/server";

const COOKIE_KEY = "urano_ref";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

type StoredAttribution = Readonly<{
  ref_code: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  first_seen_at: string;
}>;

function isValidRefCode(ref: string): boolean {
  // adjust if your ref codes are strictly different
  return /^[a-zA-Z0-9_-]{3,64}$/.test(ref);
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const ref = url.searchParams.get("ref");

  // No ref param -> nothing to do
  if (!ref) return NextResponse.next();

  const refCode = ref.trim();
  if (!isValidRefCode(refCode)) return NextResponse.next();

  // Don’t overwrite existing attribution (first-touch wins)
  const existing = req.cookies.get(COOKIE_KEY)?.value;
  if (existing && existing.trim().length > 0) return NextResponse.next();

  const payload: StoredAttribution = {
    ref_code: refCode,
    utm_source: url.searchParams.get("utm_source") ?? undefined,
    utm_medium: url.searchParams.get("utm_medium") ?? undefined,
    utm_campaign: url.searchParams.get("utm_campaign") ?? undefined,
    utm_content: url.searchParams.get("utm_content") ?? undefined,
    utm_term: url.searchParams.get("utm_term") ?? undefined,
    first_seen_at: new Date().toISOString(),
  };

  const res = NextResponse.next();

  res.cookies.set({
    name: COOKIE_KEY,
    value: encodeURIComponent(JSON.stringify(payload)),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true, // good: client can’t tamper; server can read it in /api/referral/convert
  });

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
