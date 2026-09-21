import { Router } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as ctrl from '@/controllers/purchase.controller'

const router = Router()
router.use(authMiddleware)
router.get('/orders', ctrl.listOrders)
router.get('/orders/detail', ctrl.listOrdersDetail)
router.get('/orders/:id', ctrl.getOrder)
router.post('/orders', ctrl.createOrder)
router.put('/orders/:id', ctrl.updateOrder)
router.patch('/orders/:id/void', ctrl.voidOrder)
router.get('/returns', ctrl.listReturns)
router.get('/returns/:id', ctrl.getReturn)
router.post('/returns', ctrl.createReturn)
router.put('/returns/:id', ctrl.updateReturn)
router.patch('/returns/:id/void', ctrl.voidReturn)
export default router
