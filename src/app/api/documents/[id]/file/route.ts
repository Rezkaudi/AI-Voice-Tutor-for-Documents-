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
        "content-disposition": `inline; filename="${sanitizeHeaderFileName(localFile.fileName)}"`
      }
    });
  }

  const fileUrl = await store.getFileUrl(id);
  if (fileUrl) {
    return NextResponse.redirect(fileUrl);
  }

  return NextResponse.json({ error: "File not found." }, { status: 404 });
}

/** Drop control chars (incl. CR/LF), quotes, and backslashes so the file name cannot break the header. */
function sanitizeHeaderFileName(fileName: string): string {
  const stripped = Array.from(fileName)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0x1f && char !== '"' && char !== "\\";
    })
    .join("");
  return stripped.trim() || "document";
}
