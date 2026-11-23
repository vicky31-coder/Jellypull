import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { fetchTorrentsAndStats } from "@/lib/qbit";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchTorrentsAndStats();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch qBittorrent status",
      },
      { status: 502 }
    );
  }
}
