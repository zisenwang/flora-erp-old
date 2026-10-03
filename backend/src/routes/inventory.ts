import { Router } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as ctrl from '@/controllers/inventory.controller'

const router = Router()
router.use(authMiddleware)
router.get('/', ctrl.list)
router.get('/adjustments', ctrl.listAdjustments)
router.get('/manual-adjustments', ctrl.listManualAdjustments)
router.get('/manual-adjustments/:id', ctrl.getManualAdjustment)
router.post('/adjust', ctrl.adjust)
export default router
