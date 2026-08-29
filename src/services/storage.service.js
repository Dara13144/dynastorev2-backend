import { supabase, isConfigured } from '../config/supabase.js';

/**
 * Storage Service for managing Supabase Storage buckets:
 * 1. 'game-files' (PRIVATE) - Requires short-lived Signed URLs
 * 2. 'product-images' (PUBLIC) - Product covers, screenshots, categories
 */
class StorageService {
  constructor() {
    this.gameBucket = 'game-files';
    this.imageBucket = 'product-images';
  }

  /**
   * Generate short-lived signed URL for game file download (Default: 900s / 15 minutes)
   */
  async generateSignedDownloadUrl(filePath, expiresInSeconds = 900) {
    if (!filePath) {
      throw new Error('File path is required for signed URL generation');
    }

    // Direct cloud / CDN external download link support (e.g. Google Drive, Mega, MediaFire, CDN)
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    if (isConfigured && supabase) {
      const { data, error } = await supabase.storage
        .from(this.gameBucket)
        .createSignedUrl(filePath, expiresInSeconds, {
          download: true,
        });

      if (error) {
        console.warn('Supabase signed URL notice (bucket file pending upload):', error.message);
        const expiresAt = Date.now() + expiresInSeconds * 1000;
        const token = Buffer.from(`${filePath}:${expiresAt}:secure_sig`).toString('base64url');
        return `http://localhost:5001/api/downloads/file-stream?path=${encodeURIComponent(filePath)}&token=${token}&expires=${expiresAt}`;
      }

      return data.signedUrl;
    }

    // Fallback development mock signed link for testing when external Supabase is not connected
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const token = Buffer.from(`${filePath}:${expiresAt}:mock_signature`).toString('base64url');
    return `http://localhost:5001/api/downloads/file-stream?path=${encodeURIComponent(filePath)}&token=${token}&expires=${expiresAt}`;
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(bucket, filePath, fileBuffer, mimeType) {
    if (isConfigured && supabase) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        throw new Error(`Storage upload error: ${error.message}`);
      }

      return data.path;
    }

    // Dev fallback mock path
    return filePath;
  }

  /**
   * Get public URL for product images
   */
  getPublicImageUrl(filePath) {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    if (isConfigured && supabase) {
      const { data } = supabase.storage.from(this.imageBucket).getPublicUrl(filePath);
      return data.publicUrl;
    }

    return filePath;
  }
}

export const storageService = new StorageService();
export default storageService;
