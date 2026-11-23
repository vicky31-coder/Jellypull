import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getQbitStatus, testAndSaveQbitConnection } from "@/lib/qbit";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getQbitStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      url?: string;
      username?: string;
      password?: string;
    };

    const url = body.url?.trim() || "http://127.0.0.1:8085";
    const username = body.username?.trim() || "";
    const password = body.password ?? "";

    const result = await testAndSaveQbitConnection({ url, username, password });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        connected: false,
        error: err instanceof Error ? err.message : "Failed to connect to qBittorrent",
      },
      { status: 400 }
    );
  }
}
