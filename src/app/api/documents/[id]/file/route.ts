import { NextResponse } from "next/server";
import { requireAccess } from "@/server/access-control";
import { getDocumentStore } from "@/server/document-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAccess();
  if (denied) {
    return denied;
  }

  const { id } = await context.params;
  const store = getDocumentStore();
  const localFile = await store.getFile(id);

  if (localFile) {
    return new Response(new Uint8Array(localFile.buffer), {
      headers: {
        "content-type": localFile.mimeType,
        "content-disposition": `inline; filename="${localFile.fileName.replaceAll('"', "")}"`
      }
    });
  }

  const fileUrl = await store.getFileUrl(id);
  if (fileUrl) {
    return NextResponse.redirect(fileUrl);
  }

  return NextResponse.json({ error: "File not found." }, { status: 404 });
}
