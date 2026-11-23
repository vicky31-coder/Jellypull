import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ error: "Missing search query 'q'" }, { status: 400 });
  }

  const safe = request.nextUrl.searchParams.get("safe") || "1";
  const providers = request.nextUrl.searchParams.get("providers") || "";
  const apiUrl = (process.env.JELLYPULL_API_URL || "http://127.0.0.1:8045").replace(/\/+$/, "");

  const params = new URLSearchParams({ q, safe });
  if (providers) params.set("providers", providers);

  const headers: Record<string, string> = {};
  const apiPassword = process.env.JELLYPULL_PASSWORD || process.env.AUTH_PASSWORD;
  if (apiPassword) {
    headers["x-api-key"] = apiPassword;
  }

  try {
    const res = await fetch(`${apiUrl}/api/search?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Failed to reach Jellypull API: ${err.message}`
            : "Failed to reach Jellypull API",
      },
      { status: 502 }
    );
  }
}
