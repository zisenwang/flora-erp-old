import { Router } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as ctrl from '@/controllers/inventory.controller'

const router = Router()
router.use(authMiddleware)
router.get('/', ctrl.list)
router.get('/adjustments', ctrl.listAdjustments)
router.post('/adjust', ctrl.adjust)
export default router
