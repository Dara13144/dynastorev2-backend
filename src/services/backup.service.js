import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { supabase, isConfigured } from '../config/supabase.js';
import { db } from '../utils/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.resolve(__dirname, '../../backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export class BackupService {
  constructor() {
    this.backupsDir = BACKUPS_DIR;
  }

  /**
   * Fetch all raw data from either Supabase or in-memory fallback
   */
  async getFullSystemData() {
    if (isConfigured && supabase) {
      const [
        catRes,
        prodRes,
        profRes,
        ordRes,
        itemsRes,
        payRes,
        walletRes,
        dlRes,
        notifRes,
        auditRes,
      ] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('order_items').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('wallet_transactions').select('*'),
        supabase.from('downloads').select('*'),
        supabase.from('notifications').select('*'),
        supabase.from('audit_logs').select('*'),
      ]);

      return {
        categories: catRes.data || [],
        products: prodRes.data || [],
        profiles: profRes.data || [],
        orders: ordRes.data || [],
        order_items: itemsRes.data || [],
        payments: payRes.data || [],
        wallet_transactions: walletRes.data || [],
        downloads: dlRes.data || [],
        notifications: notifRes.data || [],
        audit_logs: auditRes.data || [],
        coupons: (await db.listCoupons()) || [],
      };
    }

    // Fallback store
    return {
      categories: [...(db.store?.categories || [])],
      products: [...(db.store?.products || [])],
      profiles: [...(db.store?.profiles || [])],
      orders: [...(db.store?.orders || [])],
      order_items: [...(db.store?.order_items || [])],
      payments: [...(db.store?.payments || [])],
      wallet_transactions: [...(db.store?.wallet_transactions || [])],
      downloads: [...(db.store?.downloads || [])],
      notifications: [...(db.store?.notifications || [])],
      audit_logs: [...(db.store?.audit_logs || [])],
      coupons: [...(db.store?.coupons || [])],
    };
  }

  /**
   * Create a full system snapshot file and save to backend/backups/
   */
  async createBackup({ adminId, adminEmail = 'System Admin', note = 'Manual Backup' } = {}) {
    const rawData = await this.getFullSystemData();
    const backupId = `bcp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const counts = {};
    let totalRecords = 0;
    for (const [key, rows] of Object.entries(rawData)) {
      counts[key] = rows.length;
      totalRecords += rows.length;
    }

    const serializedData = JSON.stringify(rawData);
    const checksum = crypto.createHash('sha256').update(serializedData).digest('hex');

    const backupPayload = {
      version: '2.0.0',
      system: 'DynaStore',
      backupId,
      createdAt: timestamp,
      createdBy: adminEmail,
      adminId: adminId || null,
      note,
      checksum,
      counts,
      totalRecords,
      storageEngine: isConfigured && supabase ? 'Supabase Cloud (PostgreSQL)' : 'In-Memory Dev Store',
      data: rawData,
    };

    const fileName = `backup_dynastore_${timestamp.replace(/[:.]/g, '-')}_${backupId}.json`;
    const filePath = path.join(this.backupsDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), 'utf8');

    const stats = fs.statSync(filePath);

    // Audit log
    if (adminId) {
      await db.createAuditLog({
        adminId,
        action: 'SYSTEM_BACKUP_CREATED',
        targetType: 'BACKUP',
        targetId: backupId,
        metadata: {
          fileName,
          totalRecords,
          counts,
          sizeBytes: stats.size,
          note,
        },
      }).catch(() => {});
    }

    return {
      backupId,
      fileName,
      createdAt: timestamp,
      createdBy: adminEmail,
      note,
      checksum,
      counts,
      totalRecords,
      sizeBytes: stats.size,
      sizeFormatted: this.formatBytes(stats.size),
    };
  }

  /**
   * List all stored backup snapshot files with metadata
   */
  async listBackups() {
    if (!fs.existsSync(this.backupsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.backupsDir).filter((f) => f.endsWith('.json'));
    const backups = [];

    for (const file of files) {
      const filePath = path.join(this.backupsDir, file);
      try {
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);

        backups.push({
          backupId: parsed.backupId || file.replace('.json', ''),
          fileName: file,
          createdAt: parsed.createdAt || stats.mtime.toISOString(),
          createdBy: parsed.createdBy || 'System',
          note: parsed.note || 'Full System Snapshot',
          version: parsed.version || '2.0.0',
          totalRecords: parsed.totalRecords || 0,
          counts: parsed.counts || {},
          checksum: parsed.checksum || '',
          sizeBytes: stats.size,
          sizeFormatted: this.formatBytes(stats.size),
        });
      } catch (e) {
        console.warn(`Failed reading backup file ${file}:`, e.message);
      }
    }

    // Sort newest first
    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get specific backup file info and absolute path for downloading
   */
  async getBackupFile(backupId) {
    const list = await this.listBackups();
    const found = list.find((b) => b.backupId === backupId || b.fileName === backupId);
    if (!found) return null;

    const filePath = path.join(this.backupsDir, found.fileName);
    if (!fs.existsSync(filePath)) return null;

    return {
      ...found,
      filePath,
    };
  }

  /**
   * Delete a backup snapshot
   */
  async deleteBackup(backupId, adminId) {
    const fileInfo = await this.getBackupFile(backupId);
    if (!fileInfo) {
      throw new Error('Backup snapshot not found');
    }

    fs.unlinkSync(fileInfo.filePath);

    if (adminId) {
      await db.createAuditLog({
        adminId,
        action: 'SYSTEM_BACKUP_DELETED',
        targetType: 'BACKUP',
        targetId: backupId,
        metadata: { fileName: fileInfo.fileName },
      }).catch(() => {});
    }

    return { success: true, message: `Backup ${fileInfo.fileName} deleted successfully` };
  }

  /**
   * Restore system from a backup snapshot payload
   */
  async restoreBackup({ backupData, mode = 'merge', adminId } = {}) {
    if (!backupData || !backupData.data) {
      throw new Error('Invalid backup file structure: missing data payload');
    }

    const { data } = backupData;
    const results = {};
    const startTime = Date.now();

    // Order of restoration respecting foreign key constraints
    const restoreOrder = [
      'categories',
      'products',
      'profiles',
      'orders',
      'order_items',
      'payments',
      'wallet_transactions',
      'downloads',
      'notifications',
      'audit_logs',
      'coupons',
    ];

    if (isConfigured && supabase) {
      for (const table of restoreOrder) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          results[table] = { count: 0, status: 'SKIPPED' };
          continue;
        }

        try {
          // If overwrite mode, we can clean replace or upsert
          // Using upsert with onConflict: 'id' ensures seamless restoration
          const chunkSize = 100;
          let insertedCount = 0;

          for (let i = 0; i < rows.length; i += chunkSize) {
            let chunk = rows.slice(i, i + chunkSize);
            if (table === 'coupons') {
              chunk = chunk.map(c => {
                const { min_spend, times_used, usage_limit, ...rest } = c;
                return {
                  ...rest,
                  min_order_amount: rest.min_order_amount ?? min_spend ?? 0,
                  current_uses: rest.current_uses ?? times_used ?? 0,
                  max_uses: rest.max_uses ?? usage_limit ?? null,
                };
              });
            }
            const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
            if (error) {
              console.warn(`Restore warning on table ${table}:`, error.message);
            } else {
              insertedCount += chunk.length;
            }
          }

          results[table] = { count: insertedCount, status: 'RESTORED' };
        } catch (err) {
          console.error(`Failed restoring table ${table}:`, err.message);
          results[table] = { count: 0, status: 'ERROR', error: err.message };
        }
      }
    } else {
      // In-memory fallback
      for (const table of restoreOrder) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          results[table] = { count: 0, status: 'SKIPPED' };
          continue;
        }

        if (mode === 'overwrite') {
          db.store[table] = [...rows];
        } else {
          // Merge by ID
          const current = db.store[table] || [];
          for (const item of rows) {
            const idx = current.findIndex((c) => c.id === item.id);
            if (idx >= 0) {
              current[idx] = { ...current[idx], ...item };
            } else {
              current.push(item);
            }
          }
          db.store[table] = current;
        }
        results[table] = { count: rows.length, status: 'RESTORED' };
      }
    }

    const elapsedMs = Date.now() - startTime;

    if (adminId) {
      await db.createAuditLog({
        adminId,
        action: 'SYSTEM_BACKUP_RESTORED',
        targetType: 'BACKUP',
        targetId: backupData.backupId || 'CUSTOM_RESTORE',
        metadata: {
          mode,
          elapsedMs,
          results,
          backupDate: backupData.createdAt,
        },
      }).catch(() => {});
    }

    return {
      success: true,
      mode,
      elapsedMs,
      results,
      message: `System restored successfully in ${elapsedMs}ms (${mode} mode)`,
    };
  }

  /**
   * Get backup statistics & system live overview
   */
  async getBackupStats() {
    const list = await this.listBackups();
    const liveData = await this.getFullSystemData();

    const totalBackups = list.length;
    const totalBytes = list.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);
    const lastBackup = list[0] || null;

    const liveCounts = {};
    let totalLiveRecords = 0;
    for (const [table, rows] of Object.entries(liveData)) {
      liveCounts[table] = rows.length;
      totalLiveRecords += rows.length;
    }

    return {
      totalBackups,
      totalDiskUsage: this.formatBytes(totalBytes),
      totalBytes,
      lastBackupDate: lastBackup?.createdAt || null,
      lastBackupId: lastBackup?.backupId || null,
      storageEngine: isConfigured && supabase ? 'Supabase PostgreSQL' : 'Dev Memory Store',
      liveCounts,
      totalLiveRecords,
    };
  }

  formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

export const backupService = new BackupService();
