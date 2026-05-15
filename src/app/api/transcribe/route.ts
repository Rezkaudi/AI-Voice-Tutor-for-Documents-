import { NextResponse } from "next/server";
import { requireAccess } from "@/server/access-control";
import { transcribeAudio } from "@/server/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = await requireAccess();
  if (denied) {
    return denied;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("audio");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Audio recording is empty." }, { status: 400 });
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio clip is too long. Keep recordings under 60 seconds." }, { status: 413 });
  }

  try {
    const text = await transcribeAudio(file);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
