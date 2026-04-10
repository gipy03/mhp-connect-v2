import { Client } from "@replit/object-storage";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";
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
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

let storageClient: Client | null = null;

function getClient(): Client {
  if (!storageClient) {
    storageClient = new Client();
  }
  return storageClient;
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
  const ext = path.extname(originalName);
  const key = `files/${uuidv4()}${ext}`;
  const client = getClient();

  const { ok, error } = await client.uploadFromBytes(key, buffer);
  if (!ok) {
    throw new Error(`Erreur lors du téléchargement : ${error}`);
  }

  logger.info({ key, size: buffer.length }, "File uploaded to Replit Object Storage");
  return { key, size: buffer.length };
}

export async function downloadFile(
  fileKey: string
): Promise<Buffer> {
  const client = getClient();
  const { ok, value, error } = await client.downloadAsBytes(fileKey);
  if (!ok) {
    throw new Error(`Fichier introuvable dans le stockage : ${error}`);
  }
  return value[0];
}

export async function deleteFileFromStorage(fileKey: string): Promise<void> {
  const client = getClient();
  const { ok, error } = await client.delete(fileKey);
  if (!ok) {
    logger.warn({ fileKey, error }, "Failed to delete from Replit Object Storage");
  } else {
    logger.info({ fileKey }, "File deleted from Replit Object Storage");
  }
}

export function isStorageConfigured(): boolean {
  try {
    getClient();
    return true;
  } catch {
    return false;
  }
}
