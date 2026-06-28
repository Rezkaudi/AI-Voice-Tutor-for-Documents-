import multer from "multer";

const AUDIO_LIMIT_BYTES = 8 * 1024 * 1024;

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AUDIO_LIMIT_BYTES }
});
