import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/login/Login'
import Dashboard from '@/pages/dashboard/Dashboard'
import Products from '@/pages/master/Products'
import ProductForm from '@/pages/master/ProductForm'
import ProductView from '@/pages/master/ProductView'
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
    ],
  },
])

export default router
