import { Router } from 'express';

const router = Router();

// TODO: Implement task routes
router.get('/', (req, res) => {
  res.json({ message: 'Task routes not yet implemented' });
});

export default router;