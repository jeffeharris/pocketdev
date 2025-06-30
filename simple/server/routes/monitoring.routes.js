import { Router } from 'express';

const router = Router();

// TODO: Implement monitoring routes
router.get('/', (req, res) => {
  res.json({ message: 'Monitoring routes not yet implemented' });
});

export default router;