import { Router } from 'express';
import { pg } from '../db';
import { systemDocumentation } from '@shared/schema';

const router = Router();

router.get('/system-overview', async (req, res) => {
  try {
    const documentation = await pg.select().from(systemDocumentation);
    res.json(documentation);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar documentação do sistema.' });
  }
});

export default router;
