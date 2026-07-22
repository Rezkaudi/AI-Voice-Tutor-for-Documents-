export type UploadRejectReason = "type";

export type UploadValidation =
  | { ok: true }
  | { ok: false; reason: UploadRejectReason };

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

/** Mirrors the server-side fileFilter so bad files fail fast, before upload. */
export function validateUploadFile(file: File): UploadValidation {
  if (!isPdf(file)) return { ok: false, reason: "type" };
  return { ok: true };
}

/**
 * Pick the first usable PDF from a dropped/selected file list. Returns the
 * reason of the first file when none qualify, so the UI can explain why.
 */
export function pickUploadFile(
  files: FileList | File[]
): { file: File } | { file: null; reason: UploadRejectReason | null } {
  const list = Array.from(files);
  if (list.length === 0) return { file: null, reason: null };

  let firstReason: UploadRejectReason | null = null;
  for (const file of list) {
    const result = validateUploadFile(file);
    if (result.ok) return { file };
    if (firstReason === null) firstReason = result.reason;
  }
  return { file: null, reason: firstReason };
}
