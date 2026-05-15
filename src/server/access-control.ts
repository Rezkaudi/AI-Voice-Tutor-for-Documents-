import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";

const ACCESS_COOKIE = "teaching_avatar_access";

export async function isAccessGranted(): Promise<boolean> {
  if (!appConfig.accessCode) {
    return true;
  }

  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE)?.value === accessToken();
}

export async function requireAccess(): Promise<NextResponse | null> {
  if (await isAccessGranted()) {
    return null;
  }

  return NextResponse.json({ error: "Access code required." }, { status: 401 });
}

export async function grantAccess(code: string): Promise<NextResponse> {
  if (!appConfig.accessCode || code.trim() === appConfig.accessCode) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_COOKIE, accessToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    });
    return response;
  }

  return NextResponse.json({ error: "The access code is not correct." }, { status: 403 });
}

function accessToken(): string {
  return createHash("sha256").update(appConfig.accessCode || "open").digest("hex");
}
