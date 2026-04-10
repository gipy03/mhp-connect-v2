import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";
import fs from "node:fs/promises";
import { logger } from "../lib/logger.js";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "audio/mpeg",
  "audio/mp3",
  "video/mp4",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const STORAGE_DIR = path.resolve(process.cwd(), ".data", "uploads");

async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

export function createUploadMiddleware() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`));
      }
    },
  });
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ key: string; size: number }> {
  await ensureStorageDir();
  const ext = path.extname(originalName);
  const key = `files/${uuidv4()}${ext}`;
  const filePath = path.join(STORAGE_DIR, key.replace("files/", ""));

  await fs.writeFile(filePath, buffer);

  logger.info({ key, size: buffer.length }, "File uploaded to local storage");
  return { key, size: buffer.length };
}

export async function downloadFile(
  fileKey: string
): Promise<Buffer> {
  const fileName = fileKey.replace("files/", "");
  const filePath = path.join(STORAGE_DIR, fileName);

  try {
    return await fs.readFile(filePath);
  } catch {
    throw new Error(`Fichier introuvable dans le stockage : ${fileKey}`);
  }
}

export async function deleteFileFromStorage(fileKey: string): Promise<void> {
  const fileName = fileKey.replace("files/", "");
  const filePath = path.join(STORAGE_DIR, fileName);

  try {
    await fs.unlink(filePath);
    logger.info({ fileKey }, "File deleted from local storage");
  } catch (err) {
    logger.warn({ fileKey, err }, "Failed to delete file from local storage");
  }
}

export function isStorageConfigured(): boolean {
  return true;
}
