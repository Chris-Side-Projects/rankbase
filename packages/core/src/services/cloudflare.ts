import { randomUUID } from 'crypto';
import { uploadToR2 } from './r2';

/**
 * Uploads an image buffer to image storage and returns the public URL.
 *
 * Backed by Cloudflare R2 (S3-compatible) since R2 has no acceptable-use policy
 * restrictions on adult content. The function name is preserved from the
 * original Cloudflare Images integration so call sites don't need to change;
 * `metadata` is accepted for API parity but is currently informational only.
 */
export async function uploadToCloudflareImages(
  imageBuffer: Buffer,
  metadata?: Record<string, string>
): Promise<string> {
  void metadata;
  const key = `images/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.png`;
  return uploadToR2(imageBuffer, key, 'image/png');
}
