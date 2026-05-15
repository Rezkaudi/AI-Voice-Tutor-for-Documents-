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
  const document = await store.getDocument(id);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const [pages, fileUrl] = await Promise.all([
    store.getPages(id),
    store.getFileUrl(id)
  ]);

  return NextResponse.json({
    document,
    pages,
    fileUrl
  });
}
