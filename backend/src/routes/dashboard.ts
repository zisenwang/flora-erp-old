import { Router } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as ctrl from '@/controllers/dashboard.controller'

const router = Router()
router.use(authMiddleware)
router.get('/summary', ctrl.summary)
export default router
