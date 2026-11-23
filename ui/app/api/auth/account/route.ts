import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionFromCookies,
  SESSION_COOKIE_NAME,
  updateAccountCredentials,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      currentPassword?: string;
      newUsername?: string;
      newPassword?: string;
    };

    const result = await updateAccountCredentials({
      currentPassword: body.currentPassword || "",
      newUsername: body.newUsername || "",
      newPassword: body.newPassword,
    });

    const newToken = await createSessionToken(result.username);
    const response = NextResponse.json({
      success: true,
      username: result.username,
      passwordUpdated: result.passwordUpdated,
    });

    response.cookies.set(SESSION_COOKIE_NAME, newToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to update account credentials",
      },
      { status: 400 }
    );
  }
}
