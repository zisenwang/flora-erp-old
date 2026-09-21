import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as repo from '@/repositories/settings.repo'

const router = Router()

// GET is public — company info is displayed on login page and print views
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await repo.getAll()
    res.json({ data: settings })
  } catch (e) {
    next(e)
  }
})

router.put('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body as Record<string, string>
    await Promise.all(Object.entries(updates).map(([k, v]) => repo.upsert(k, v)))
    const settings = await repo.getAll()
    res.json({ data: settings })
  } catch (e) {
    next(e)
  }
})

export default router
