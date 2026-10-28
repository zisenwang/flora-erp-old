import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/login/Login'
import Dashboard from '@/pages/dashboard/Dashboard'
import Products from '@/pages/master/Products'
import ProductForm from '@/pages/master/ProductForm'
import ProductView from '@/pages/master/ProductView'
import PurchaseIn from '@/pages/purchase/PurchaseIn'
import PurchaseList from '@/pages/purchase/PurchaseList'
import PurchaseView from '@/pages/purchase/PurchaseView'
import PurchaseEdit from '@/pages/purchase/PurchaseEdit'
import SalesList from '@/pages/sales/SalesList'
import SalesView from '@/pages/sales/SalesView'
import SalesEdit from '@/pages/sales/SalesEdit'
import SalesIn from '@/pages/sales/SalesIn'
import SalesPrint from '@/pages/print/SalesPrint'
import UnderDevelopment from '@/pages/common/UnderDevelopment'
import InventoryList from '@/pages/inventory/InventoryList'
import InventoryAdjust from '@/pages/inventory/InventoryAdjust'
import InventoryAdjustments from '@/pages/inventory/InventoryAdjustments'
import InventoryAdjustmentView from '@/pages/inventory/InventoryAdjustmentView'
import InventoryCheck from '@/pages/inventory/InventoryCheck'
import PurchaseReport from '@/pages/reports/PurchaseReport'
import SalesReport from '@/pages/reports/SalesReport'
import InventoryReport from '@/pages/reports/InventoryReport'
import PurchasePrint from '@/pages/print/PurchasePrint'
import Suppliers from '@/pages/master/Suppliers'
import SupplierForm from '@/pages/master/SupplierForm'
import Customers from '@/pages/master/Customers'
import CustomerForm from '@/pages/master/CustomerForm'
import MobileHome from '@/pages/mobile/MobileHome'
import MobileStart from '@/pages/mobile/MobileStart'
import MobileSales from '@/pages/mobile/MobileSales'
import MobileCustomers from '@/pages/mobile/MobileCustomers'
import MobileAddProduct from '@/pages/mobile/MobileAddProduct'
import MobileOrder from '@/pages/mobile/MobileOrder'
import PaymentList from '@/pages/payment/PaymentList'
import PaymentNew from '@/pages/payment/PaymentNew'
import OperatorList from '@/pages/settings/OperatorList'
import OperatorForm from '@/pages/settings/OperatorForm'
import { can, isAdmin, type Permission } from '@/utils/permissions'

const isLoggedIn = () => !!localStorage.getItem('token')

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
}

// 操作员表: 管理员 only
function RequireAdmin({ children }: { children: React.ReactNode }) {
  return isAdmin() ? <>{children}</> : <Navigate to="/" replace />
}

// every page but the home page: 管理员, or an 操作员 granted that page in 操作员表 → 权限
function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  return can(permission) ? <>{children}</> : <Navigate to="/" replace />
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/print/purchase/:id', element: <RequireAuth><PurchasePrint key="order" /></RequireAuth> },
  { path: '/print/sales/:id', element: <RequireAuth><SalesPrint key="order" /></RequireAuth> },
  { path: '/print/sales-return/:id', element: <RequireAuth><SalesPrint key="return" kind="return" /></RequireAuth> },
  { path: '/print/purchase-return/:id', element: <RequireAuth><PurchasePrint key="return" kind="return" /></RequireAuth> },
  // 手机版 (old jhsmpS pages): 首页, then 手机开单 1 选择客户提示 → 2 选择客户 → 3 选择产品 → 4 修改信息 → 5 开单信息 → back to 1
  { path: '/m', element: <RequireAuth><MobileHome /></RequireAuth> },
  { path: '/m/sales', element: <RequireAuth><RequirePermission permission="mobile"><MobileStart /></RequirePermission></RequireAuth> },
  { path: '/m/sales/customers', element: <RequireAuth><RequirePermission permission="mobile"><MobileCustomers /></RequirePermission></RequireAuth> },
  { path: '/m/sales/products', element: <RequireAuth><RequirePermission permission="mobile"><MobileSales /></RequirePermission></RequireAuth> },
  { path: '/m/sales/add/:id', element: <RequireAuth><RequirePermission permission="mobile"><MobileAddProduct /></RequirePermission></RequireAuth> },
  { path: '/m/sales/order', element: <RequireAuth><RequirePermission permission="mobile"><MobileOrder /></RequirePermission></RequireAuth> },
  {
    path: '/',
    element: <RequireAuth><MainLayout /></RequireAuth>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'master/products', element: <RequirePermission permission="product"><Products /></RequirePermission> },
      { path: 'master/products/new', element: <RequirePermission permission="product"><ProductForm /></RequirePermission> },
      { path: 'master/products/edit/:id', element: <RequirePermission permission="product"><ProductForm /></RequirePermission> },
      { path: 'master/products/view/:id', element: <RequirePermission permission="product"><ProductView /></RequirePermission> },
      { path: 'master/suppliers', element: <RequirePermission permission="supplier"><Suppliers /></RequirePermission> },
      { path: 'master/suppliers/new', element: <RequirePermission permission="supplier"><SupplierForm /></RequirePermission> },
      { path: 'master/suppliers/edit/:id', element: <RequirePermission permission="supplier"><SupplierForm /></RequirePermission> },
      { path: 'master/customers', element: <RequirePermission permission="customer"><Customers /></RequirePermission> },
      { path: 'master/customers/new', element: <RequirePermission permission="customer"><CustomerForm /></RequirePermission> },
      { path: 'master/customers/edit/:id', element: <RequirePermission permission="customer"><CustomerForm /></RequirePermission> },
      { path: 'purchase/orders/new', element: <RequirePermission permission="purchase_in"><PurchaseIn key="order" /></RequirePermission> },
      { path: 'purchase/returns/new', element: <RequirePermission permission="purchase_return"><PurchaseIn key="return" kind="return" /></RequirePermission> },
      { path: 'purchase/orders', element: <RequirePermission permission="purchase_list"><PurchaseList mode="summary" /></RequirePermission> },
      { path: 'purchase/orders/detail', element: <RequirePermission permission="purchase_list"><PurchaseList mode="detail" /></RequirePermission> },
      { path: 'purchase/orders/:id', element: <RequirePermission permission="purchase_list"><PurchaseView kind="order" /></RequirePermission> },
      { path: 'purchase/orders/:id/edit', element: <RequirePermission permission="purchase_list"><PurchaseEdit key="order" /></RequirePermission> },
      { path: 'purchase/returns/:id/edit', element: <RequirePermission permission="purchase_list"><PurchaseEdit key="return" kind="return" /></RequirePermission> },
      { path: 'purchase/returns/:id', element: <RequirePermission permission="purchase_list"><PurchaseView kind="return" /></RequirePermission> },
      { path: 'sales/orders/new', element: <RequirePermission permission="sales_in"><SalesIn key="order" /></RequirePermission> },
      { path: 'sales/returns/new', element: <RequirePermission permission="sales_return"><SalesIn key="return" kind="return" /></RequirePermission> },
      { path: 'sales/orders', element: <RequirePermission permission="sales_list"><SalesList key="summary" /></RequirePermission> },
      { path: 'sales/orders/detail', element: <RequirePermission permission="sales_list"><SalesList key="detail" mode="detail" /></RequirePermission> },
      { path: 'sales/orders/:id', element: <RequirePermission permission="sales_list"><SalesView key="order" /></RequirePermission> },
      { path: 'sales/orders/:id/edit', element: <RequirePermission permission="sales_list"><SalesEdit key="order" /></RequirePermission> },
      { path: 'sales/returns/:id', element: <RequirePermission permission="sales_list"><SalesView key="return" kind="return" /></RequirePermission> },
      { path: 'sales/returns/:id/edit', element: <RequirePermission permission="sales_list"><SalesEdit key="return" kind="return" /></RequirePermission> },
      { path: 'inventory', element: <RequirePermission permission="inventory"><InventoryList /></RequirePermission> },
      { path: 'inventory/adjust', element: <RequirePermission permission="inventory_adjust"><InventoryAdjust /></RequirePermission> },
      { path: 'inventory/adjustments', element: <RequirePermission permission="inventory_adjustments"><InventoryAdjustments /></RequirePermission> },
      { path: 'inventory/adjustments/:id', element: <RequirePermission permission="inventory_adjustments"><InventoryAdjustmentView /></RequirePermission> },
      { path: 'inventory/check', element: <RequirePermission permission="inventory_check"><InventoryCheck /></RequirePermission> },
      { path: 'reports/purchase', element: <RequirePermission permission="report_purchase"><PurchaseReport key="product" mode="product" /></RequirePermission> },
      { path: 'reports/purchase/supplier', element: <RequirePermission permission="report_purchase"><PurchaseReport key="supplier" mode="supplier" /></RequirePermission> },
      { path: 'reports/purchase/operator', element: <RequirePermission permission="report_purchase"><PurchaseReport key="operator" mode="operator" /></RequirePermission> },
      { path: 'reports/inventory', element: <RequirePermission permission="report_inventory"><InventoryReport /></RequirePermission> },
      { path: 'reports/sales', element: <RequirePermission permission="report_sales"><SalesReport key="product" mode="product" /></RequirePermission> },
      { path: 'reports/sales/customer', element: <RequirePermission permission="report_sales"><SalesReport key="customer" mode="customer" /></RequirePermission> },
      { path: 'reports/sales/supplier', element: <RequirePermission permission="report_sales"><SalesReport key="supplier" mode="supplier" /></RequirePermission> },
      { path: 'reports/sales/monthly', element: <RequirePermission permission="report_sales"><SalesReport key="monthly" mode="monthly" /></RequirePermission> },
      { path: 'reports/sales/customer-product', element: <RequirePermission permission="report_sales"><SalesReport key="customerProduct" mode="customerProduct" /></RequirePermission> },
      { path: 'reports/sales/year-month', element: <RequirePermission permission="report_sales"><SalesReport key="yearMonth" mode="yearMonth" /></RequirePermission> },
      { path: 'payment', element: <RequirePermission permission="payment"><PaymentList /></RequirePermission> },
      { path: 'payment/new', element: <RequirePermission permission="payment"><PaymentNew /></RequirePermission> },
      { path: 'settings/operators', element: <RequireAdmin><OperatorList /></RequireAdmin> },
      { path: 'settings/operators/new', element: <RequireAdmin><OperatorForm key="new" mode="new" /></RequireAdmin> },
      { path: 'settings/operators/:id/edit', element: <RequireAdmin><OperatorForm key="edit" mode="edit" /></RequireAdmin> },
      { path: 'settings/operators/:id/password', element: <RequireAdmin><OperatorForm key="password" mode="password" /></RequireAdmin> },
      { path: 'settings/operators/:id/permissions', element: <RequireAdmin><OperatorForm key="permissions" mode="permissions" /></RequireAdmin> },
      // 报损管理 / 产品分类 / 产品调价 — not planned, placeholder only
      { path: 'loss', element: <RequirePermission permission="loss"><UnderDevelopment /></RequirePermission> },
      { path: 'loss/new', element: <RequirePermission permission="loss"><UnderDevelopment /></RequirePermission> },
      { path: 'master/categories', element: <RequirePermission permission="product_category"><UnderDevelopment /></RequirePermission> },
      { path: 'master/price-adjust', element: <RequirePermission permission="price_adjust"><UnderDevelopment /></RequirePermission> },
    ],
  },
])

export default router
