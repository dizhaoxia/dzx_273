import express, { type Request, type Response } from 'express';
import storage from '../services/storage.js';

const router = express.Router();

router.post('/docs', async (req: Request, res: Response) => {
  try {
    const { name } = req.body || {};
    const result = await storage.createDocument(name);
    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[API] Failed to create document:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create document',
    });
  }
});

router.get('/docs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await storage.getDocument(id);

    if (!doc) {
      res.status(404).json({
        success: false,
        error: 'Document not found',
      });
      return;
    }

    const collaboratorCount = await storage.getUserCount(id);

    res.status(200).json({
      success: true,
      data: {
        id: doc.id,
        name: doc.name,
        updatedAt: doc.updatedAt.toISOString(),
        collaboratorCount,
      },
    });
  } catch (err) {
    console.error('[API] Failed to get document:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get document',
    });
  }
});

router.get('/docs/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const users = await storage.getUsers(id);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error('[API] Failed to get users:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get users',
    });
  }
});

export default router;
