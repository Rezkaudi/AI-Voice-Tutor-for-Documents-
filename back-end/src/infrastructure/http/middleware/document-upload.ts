import multer from "multer";

const DOCUMENT_LIMIT_BYTES = 25 * 1024 * 1024;

function decodeFileName(originalname: string): string {
  return Buffer.from(originalname, "latin1").toString("utf8");
}

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_LIMIT_BYTES },
  fileFilter: (_req, file, cb) => {
    file.originalname = decodeFileName(file.originalname);
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    cb(null, isPdf);
  }
});
