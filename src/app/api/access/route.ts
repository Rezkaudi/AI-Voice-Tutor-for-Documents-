import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { grantAccess, isAccessGranted } from "@/server/access-control";

export async function GET() {
  return NextResponse.json({
    required: Boolean(appConfig.accessCode),
    granted: await isAccessGranted()
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return grantAccess(typeof body.code === "string" ? body.code : "");
}
