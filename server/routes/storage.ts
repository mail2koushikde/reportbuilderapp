import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'saved-views');

// Ensure storage directory exists
async function ensureStorageDir() {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

// Save a view
router.post('/save-view', async (req, res) => {
  try {
    await ensureStorageDir();
    const report = req.body;
    const filename = `view-${report.id}.json`;
    const filepath = path.join(STORAGE_DIR, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    res.json({ success: true, message: 'View saved successfully' });
  } catch (error) {
    console.error('Error saving view:', error);
    res.status(500).json({ error: 'Failed to save view' });
  }
});

// Get all views
router.get('/get-views', async (req, res) => {
  try {
    await ensureStorageDir();
    const files = await fs.readdir(STORAGE_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const views = [];
    for (const file of jsonFiles) {
      try {
        const filepath = path.join(STORAGE_DIR, file);
        const content = await fs.readFile(filepath, 'utf8');
        const view = JSON.parse(content);
        views.push(view);
      } catch (error) {
        console.error(`Error reading view file ${file}:`, error);
      }
    }
    
    // Sort by savedAt date (newest first)
    views.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    
    res.json(views);
  } catch (error) {
    console.error('Error fetching views:', error);
    res.status(500).json({ error: 'Failed to fetch views' });
  }
});

// Delete a specific view
router.delete('/delete-view/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filename = `view-${id}.json`;
    const filepath = path.join(STORAGE_DIR, filename);
    
    await fs.unlink(filepath);
    
    res.json({ success: true, message: 'View deleted successfully' });
  } catch (error) {
    console.error('Error deleting view:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'View not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete view' });
    }
  }
});

// Clear all views
router.delete('/clear-views', async (req, res) => {
  try {
    await ensureStorageDir();
    const files = await fs.readdir(STORAGE_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const filepath = path.join(STORAGE_DIR, file);
      await fs.unlink(filepath);
    }
    
    res.json({ success: true, message: 'All views cleared successfully' });
  } catch (error) {
    console.error('Error clearing views:', error);
    res.status(500).json({ error: 'Failed to clear views' });
  }
});

// Get storage info
router.get('/storage-info', async (req, res) => {
  try {
    await ensureStorageDir();
    const files = await fs.readdir(STORAGE_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    let totalSize = 0;
    for (const file of jsonFiles) {
      try {
        const filepath = path.join(STORAGE_DIR, file);
        const stats = await fs.stat(filepath);
        totalSize += stats.size;
      } catch (error) {
        console.error(`Error getting stats for ${file}:`, error);
      }
    }
    
    // Arbitrary limits for file-based storage
    const maxSize = 100 * 1024 * 1024; // 100MB
    const percentUsed = (totalSize / maxSize) * 100;
    
    res.json({
      viewsCount: jsonFiles.length,
      storageSize: totalSize,
      percentUsed: Math.min(percentUsed, 100),
      isNearLimit: percentUsed > 80
    });
  } catch (error) {
    console.error('Error getting storage info:', error);
    res.status(500).json({ error: 'Failed to get storage info' });
  }
});

export default router;
