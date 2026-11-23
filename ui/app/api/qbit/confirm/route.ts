import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { confirmTorrentSelection } from "@/lib/qbit";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      hash?: string;
      unselectedIds?: number[];
      cancel?: boolean;
      stopSeeding?: boolean;
    };

    if (!body.hash) {
      return NextResponse.json({ error: "Torrent hash is required" }, { status: 400 });
    }

    await confirmTorrentSelection({
      hash: body.hash,
      unselectedIds: Array.isArray(body.unselectedIds) ? body.unselectedIds : [],
      cancel: Boolean(body.cancel),
      stopSeeding: Boolean(body.stopSeeding),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to confirm torrent selection" },
      { status: 500 }
    );
  }
}
