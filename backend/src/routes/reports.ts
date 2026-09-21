import { Router } from 'express'
import { authMiddleware } from '@/middleware/auth'
import * as ctrl from '@/controllers/reports.controller'

const router = Router()
router.use(authMiddleware)
router.get('/rankings',          ctrl.rankings)
router.get('/sales/group',       ctrl.salesGroup)
router.get('/sales/subgroup',    ctrl.salesSubgroup)
router.get('/sales/orders',      ctrl.salesOrders)
router.get('/purchase/group',    ctrl.purchaseGroup)
router.get('/purchase/subgroup', ctrl.purchaseSubgroup)
router.get('/purchase/orders',   ctrl.purchaseOrders)
router.get('/sales',             ctrl.salesReport)
router.get('/purchase',          ctrl.purchaseReport)
router.get('/inventory',         ctrl.inventoryReport)
export default router
