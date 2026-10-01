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
    ],
  },
])

export default router
