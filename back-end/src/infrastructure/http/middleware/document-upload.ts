import multer from "multer";

function decodeFileName(originalname: string): string {
  return Buffer.from(originalname, "latin1").toString("utf8");
}

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    file.originalname = decodeFileName(file.originalname);
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    cb(null, isPdf);
  }
});
