import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/login/Login'
import Dashboard from '@/pages/dashboard/Dashboard'
import Products from '@/pages/master/Products'
import Suppliers from '@/pages/master/Suppliers'
import SupplierForm from '@/pages/master/SupplierForm'

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
      { path: 'master/suppliers', element: <Suppliers /> },
      { path: 'master/suppliers/new', element: <SupplierForm /> },
      { path: 'master/suppliers/edit/:id', element: <SupplierForm /> },
    ],
  },
])

export default router
