import { Router } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as ctrl from '@/controllers/loss.controller'

const router = Router()
router.use(authMiddleware)
router.get('/', ctrl.list)
router.post('/', ctrl.create)
export default router
