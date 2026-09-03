import test from 'node:test';
import assert from 'node:assert/strict';
import { backupService } from '../services/backup.service.js';

test('Backup Service - Full System Snapshot Creation', async () => {
  const backup = await backupService.createBackup({
    adminId: 'u0000000-0000-0000-0000-000000000001',
    adminEmail: 'admin_tester@dynastore.com',
    note: 'Automated Unit Test Snapshot',
  });

  assert.ok(backup.backupId, 'Backup must have unique ID');
  assert.ok(backup.fileName, 'Backup must have a file name');
  assert.ok(backup.checksum, 'Backup must compute checksum');
  assert.ok(backup.totalRecords >= 0, 'Must calculate record counts');
  assert.ok(backup.sizeBytes > 0, 'Backup file must contain data');
});

test('Backup Service - List Backups & Fetch Stats', async () => {
  const backups = await backupService.listBackups();
  assert.ok(Array.isArray(backups), 'Should return an array of backups');
  assert.ok(backups.length >= 1, 'Should have at least one backup');

  const stats = await backupService.getBackupStats();
  assert.ok(stats.totalBackups >= 1);
  assert.ok(stats.totalDiskUsage);
  assert.ok(stats.liveCounts);
  assert.ok(typeof stats.totalLiveRecords === 'number');
});

test('Backup Service - File Lookup and Content Verification', async () => {
  const backups = await backupService.listBackups();
  const latest = backups[0];

  const fileInfo = await backupService.getBackupFile(latest.backupId);
  assert.ok(fileInfo, 'File info must be resolved');
  assert.ok(fileInfo.filePath, 'File path must exist');
});

test('Backup Service - Restore Validation & Execution', async () => {
  const rawData = await backupService.getFullSystemData();
  const mockPayload = {
    version: '2.0.0',
    system: 'DynaStore',
    backupId: `test_restore_${Date.now()}`,
    createdAt: new Date().toISOString(),
    data: rawData,
  };

  const result = await backupService.restoreBackup({
    backupData: mockPayload,
    mode: 'merge',
    adminId: 'u0000000-0000-0000-0000-000000000001',
  });

  assert.equal(result.success, true);
  assert.equal(result.mode, 'merge');
  assert.ok(result.results);
});

test('Backup Service - Snapshot Deletion', async () => {
  // Create temporary backup to delete
  const tempBackup = await backupService.createBackup({
    note: 'Temporary for deletion test',
  });

  const delRes = await backupService.deleteBackup(tempBackup.backupId);
  assert.equal(delRes.success, true);

  const lookup = await backupService.getBackupFile(tempBackup.backupId);
  assert.equal(lookup, null, 'Deleted backup should no longer exist');
});
