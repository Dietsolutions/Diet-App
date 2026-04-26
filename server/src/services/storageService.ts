// storageService.ts — Audio file persistence.
// Primary: Vercel Blob (BLOB_READ_WRITE_TOKEN).
// Fallback: base64 data-URL stored directly in the DB (no external storage).
// The fallback is ~1–3 MB per file and only suitable for low traffic / dev.

import { put } from '@vercel/blob';

/**
 * Store an mp3 Buffer and return a public URL.
 * `filename` should be a path-like string, e.g.
 *   "audio/userId/meal_name_1234567890.mp3"
 */
export async function storeAudioFile(
  audioBuffer: Buffer,
  filename: string,
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(filename, audioBuffer, {
      access:      'public',
      contentType: 'audio/mpeg',
    });
    return url;
  }

  // Fallback: encode as a data URL so the frontend can still play it
  // without any external storage. Not ideal for production at scale.
  console.warn(
    '[storageService] BLOB_READ_WRITE_TOKEN not set — using base64 data URL fallback. ' +
    'Add Vercel Blob to your project for proper file storage.',
  );
  const b64 = audioBuffer.toString('base64');
  return `data:audio/mpeg;base64,${b64}`;
}
