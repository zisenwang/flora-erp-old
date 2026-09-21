import { Router } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as ctrl from '@/controllers/customer.controller'

const router = Router()
router.use(authMiddleware)
router.get('/', ctrl.list)
router.get('/next-code', ctrl.nextCode)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.delete('/:id', ctrl.remove)
export default router
