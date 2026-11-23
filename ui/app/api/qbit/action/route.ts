import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { performTorrentAction } from "@/lib/qbit";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: "pause" | "resume" | "delete" | "deleteFiles";
      hashes?: string[];
    };

    if (!body.action || !Array.isArray(body.hashes) || body.hashes.length === 0) {
      return NextResponse.json({ error: "Missing action or hashes" }, { status: 400 });
    }

    await performTorrentAction(body.action, body.hashes);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}
