import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getStopSeedingPreference, setStopSeedingPreference } from "@/lib/qbit";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stopSeeding = await getStopSeedingPreference();
    return NextResponse.json({ stopSeeding });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch seeding setting" },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { stopSeeding?: boolean };
    const value = await setStopSeedingPreference(Boolean(body.stopSeeding));
    return NextResponse.json({ stopSeeding: value });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update seeding setting" },
      { status: 500 }
    );
  }
}
