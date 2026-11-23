import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { addMagnetToQbit } from "@/lib/qbit";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      magnet?: string;
      category?: string;
      stopSeeding?: boolean;
    };

    const magnet = body.magnet?.trim() || "";
    if (!magnet || !magnet.startsWith("magnet:?")) {
      return NextResponse.json(
        { error: "Valid magnet URI is required" },
        { status: 400 }
      );
    }

    await addMagnetToQbit(magnet, {
      category: body.category,
      stopSeeding: Boolean(body.stopSeeding),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to add torrent",
      },
      { status: 500 }
    );
  }
}
