export async function fetchPdfBytes(pdfUrl: string): Promise<Buffer> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status}) from storage`);
  }
  return Buffer.from(await response.arrayBuffer());
}
