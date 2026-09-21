import { Router } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as ctrl from '@/controllers/payment.controller'

const router = Router()
router.use(authMiddleware)
router.get('/', ctrl.list)
router.post('/', ctrl.create)
router.delete('/:id', ctrl.remove)
export default router
