import fs from 'fs';
import path from 'path';
import { supabase, isConfigured } from '../config/supabase.js';
import { ENV } from '../config/env.js';

/**
 * Storage Service for managing Supabase Storage buckets & local uploads fallback:
 * 1. 'game-files' (PRIVATE) - Requires short-lived Signed URLs
 * 2. 'product-images' (PUBLIC) - Product covers, screenshots, categories
 */
class StorageService {
  constructor() {
    this.gameBucket = 'game-files';
    this.imageBucket = 'product-images';
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      try {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      } catch (e) {
        // ignore
      }
    }
  }

  async ensureBucketExists(bucket) {
    if (!isConfigured || !supabase) return;
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const found = buckets?.some(b => b.name === bucket);
      if (!found) {
        await supabase.storage.createBucket(bucket, {
          public: bucket === this.imageBucket,
        });
        console.log(`✅ Created storage bucket '${bucket}'`);
      }
    } catch (e) {
      console.warn(`Storage bucket '${bucket}' check notice:`, e.message);
    }
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
      try {
        const { data, error } = await supabase.storage
          .from(this.gameBucket)
          .createSignedUrl(filePath, expiresInSeconds, {
            download: true,
          });

        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      } catch (err) {
        console.warn('Supabase signed URL notice:', err.message);
      }
    }

    // Fallback development mock signed link for testing when external Supabase is not connected
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const token = Buffer.from(`${filePath}:${expiresAt}:mock_signature`).toString('base64url');
    return `http://localhost:5001/api/downloads/file-stream?path=${encodeURIComponent(filePath)}&token=${token}&expires=${expiresAt}`;
  }

  /**
   * Upload file to Supabase Storage & local uploads cache
   */
  async uploadFile(bucket, filePath, fileBuffer, mimeType) {
    // 1. Save local copy in uploads directory as failsafe
    const localFileName = filePath.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localFilePath = path.join(this.uploadsDir, localFileName);
    try {
      fs.writeFileSync(localFilePath, fileBuffer);
    } catch (e) {
      // ignore
    }

    // 2. Upload to Supabase Storage if configured
    if (isConfigured && supabase) {
      try {
        await this.ensureBucketExists(bucket);
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, fileBuffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (error) {
          console.warn(`Supabase Storage upload fallback notice: ${error.message}`);
        } else if (data?.path) {
          return data.path;
        }
      } catch (err) {
        console.warn(`Supabase upload catch: ${err.message}`);
      }
    }

    // Dev / local fallback path
    return filePath;
  }

  /**
   * Get public URL for product images
   */
  getPublicImageUrl(filePath) {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
      return filePath;
    }

    if (isConfigured && supabase) {
      try {
        const { data } = supabase.storage.from(this.imageBucket).getPublicUrl(filePath);
        if (data?.publicUrl) return data.publicUrl;
      } catch (e) {
        // ignore
      }
    }

    const localFileName = filePath.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `http://localhost:5001/uploads/${localFileName}`;
  }
}

export const storageService = new StorageService();
export default storageService;
