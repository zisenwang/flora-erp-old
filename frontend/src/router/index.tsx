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

const isLoggedIn = () => !!localStorage.getItem('token')

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/print/purchase/:id', element: <RequireAuth><PurchasePrint key="order" /></RequireAuth> },
  { path: '/print/sales/:id', element: <RequireAuth><SalesPrint key="order" /></RequireAuth> },
  { path: '/print/sales-return/:id', element: <RequireAuth><SalesPrint key="return" kind="return" /></RequireAuth> },
  { path: '/print/purchase-return/:id', element: <RequireAuth><PurchasePrint key="return" kind="return" /></RequireAuth> },
  {
    path: '/',
    element: <RequireAuth><MainLayout /></RequireAuth>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'master/products', element: <Products /> },
      { path: 'master/products/new', element: <ProductForm /> },
      { path: 'master/products/edit/:id', element: <ProductForm /> },
      { path: 'master/products/view/:id', element: <ProductView /> },
      { path: 'master/suppliers', element: <Suppliers /> },
      { path: 'master/suppliers/new', element: <SupplierForm /> },
      { path: 'master/suppliers/edit/:id', element: <SupplierForm /> },
      { path: 'master/customers', element: <Customers /> },
      { path: 'master/customers/new', element: <CustomerForm /> },
      { path: 'master/customers/edit/:id', element: <CustomerForm /> },
      { path: 'purchase/orders/new', element: <PurchaseIn key="order" /> },
      { path: 'purchase/returns/new', element: <PurchaseIn key="return" kind="return" /> },
      { path: 'purchase/orders', element: <PurchaseList mode="summary" /> },
      { path: 'purchase/orders/detail', element: <PurchaseList mode="detail" /> },
      { path: 'purchase/orders/:id', element: <PurchaseView kind="order" /> },
      { path: 'purchase/orders/:id/edit', element: <PurchaseEdit key="order" /> },
      { path: 'purchase/returns/:id/edit', element: <PurchaseEdit key="return" kind="return" /> },
      { path: 'purchase/returns/:id', element: <PurchaseView kind="return" /> },
      { path: 'sales/orders/new', element: <SalesIn key="order" /> },
      { path: 'sales/returns/new', element: <SalesIn key="return" kind="return" /> },
      { path: 'sales/orders', element: <SalesList key="summary" /> },
      { path: 'sales/orders/detail', element: <SalesList key="detail" mode="detail" /> },
      { path: 'sales/orders/:id', element: <SalesView key="order" /> },
      { path: 'sales/orders/:id/edit', element: <SalesEdit key="order" /> },
      { path: 'sales/returns/:id', element: <SalesView key="return" kind="return" /> },
      { path: 'sales/returns/:id/edit', element: <SalesEdit key="return" kind="return" /> },
      { path: 'inventory', element: <InventoryList /> },
      { path: 'inventory/adjust', element: <InventoryAdjust /> },
      { path: 'inventory/adjustments', element: <InventoryAdjustments /> },
      { path: 'inventory/adjustments/:id', element: <InventoryAdjustmentView /> },
      { path: 'inventory/check', element: <InventoryCheck /> },
      { path: 'reports/purchase', element: <PurchaseReport key="product" mode="product" /> },
      { path: 'reports/purchase/supplier', element: <PurchaseReport key="supplier" mode="supplier" /> },
      { path: 'reports/purchase/operator', element: <PurchaseReport key="operator" mode="operator" /> },
      { path: 'reports/inventory', element: <InventoryReport /> },
      { path: 'reports/sales', element: <SalesReport key="product" mode="product" /> },
      { path: 'reports/sales/customer', element: <SalesReport key="customer" mode="customer" /> },
      { path: 'reports/sales/supplier', element: <SalesReport key="supplier" mode="supplier" /> },
      { path: 'reports/sales/monthly', element: <SalesReport key="monthly" mode="monthly" /> },
      { path: 'reports/sales/customer-product', element: <SalesReport key="customerProduct" mode="customerProduct" /> },
      { path: 'reports/sales/year-month', element: <SalesReport key="yearMonth" mode="yearMonth" /> },
      // 报损管理 / 修改密码 / 产品分类 / 产品调价 / 销售订单 / 收支管理 — not planned, placeholder only
      { path: 'loss', element: <UnderDevelopment /> },
      { path: 'loss/new', element: <UnderDevelopment /> },
      { path: 'settings/password', element: <UnderDevelopment /> },
      { path: 'master/categories', element: <UnderDevelopment /> },
      { path: 'master/price-adjust', element: <UnderDevelopment /> },
      { path: 'sales/bookings', element: <UnderDevelopment /> },
      { path: 'payment', element: <UnderDevelopment /> },
    ],
  },
])

export default router
