import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

/**
 * Cloudflare R2 client (S3-compatible).
 *
 * R2 replaces Cloudflare Images for aega.art because R2 has no acceptable-use
 * policy on stored content — Cloudflare Images explicitly disallows adult work.
 * The bucket is fronted by a public-access worker URL set via R2_PUBLIC_URL.
 */
const s3 = new S3Client({
  region: 'auto',
  endpoint: config.R2_ENDPOINT,
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType = 'image/png'
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${config.R2_PUBLIC_URL}/${key}`;
}
