import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prepareMagnetFiles } from "@/lib/qbit";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { magnet?: string };
    const magnet = body.magnet?.trim() || "";
    if (!magnet || !magnet.startsWith("magnet:?")) {
      return NextResponse.json({ error: "Valid magnet URI is required" }, { status: 400 });
    }

    const result = await prepareMagnetFiles(magnet);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load torrent files" },
      { status: 500 }
    );
  }
}
