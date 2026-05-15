import { NextResponse } from "next/server";
import { requireAccess } from "@/server/access-control";
import { synthesizeSpeech } from "@/server/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_LENGTH = 4000;

export async function POST(request: Request) {
  const denied = await requireAccess();
  if (denied) {
    return denied;
  }

  const body = await request.json().catch(() => null);
  const raw = typeof body?.text === "string" ? body.text.trim() : "";

  if (!raw) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }

  const text = raw.slice(0, MAX_TEXT_LENGTH);

  try {
    const audio = await synthesizeSpeech(text);
    return new Response(audio, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Speech synthesis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
