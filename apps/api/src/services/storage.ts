import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
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

function getS3Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY."
    );
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET environment variable not set.");
  return bucket;
}

export function createUploadMiddleware() {
  const s3 = getS3Client();
  const bucket = getBucket();

  return multer({
    storage: multerS3({
      s3,
      bucket,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const key = `files/${uuidv4()}${ext}`;
        cb(null, key);
      },
      metadata: (_req, file, cb) => {
        cb(null, { originalName: file.originalname });
      },
    }),
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

export async function generateSignedDownloadUrl(
  fileKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const s3 = getS3Client();
  const bucket = getBucket();

  const command = new GetObjectCommand({ Bucket: bucket, Key: fileKey });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

export async function deleteFileFromStorage(fileKey: string): Promise<void> {
  const s3 = getS3Client();
  const bucket = getBucket();

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey }));
  logger.info({ fileKey }, "File deleted from R2 storage");
}

export function isStorageConfigured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}
