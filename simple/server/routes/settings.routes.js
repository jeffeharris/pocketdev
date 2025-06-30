import { Router } from 'express';

const router = Router();

// TODO: Implement settings routes
router.get('/', (req, res) => {
  res.json({ message: 'Settings routes not yet implemented' });
});

export default router;