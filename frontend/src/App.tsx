import { RouterProvider } from 'react-router-dom'
import router from '@/router'
import { AuthProvider } from '@/store/AuthContext'
import { SettingsProvider } from '@/store/SettingsContext'

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <RouterProvider router={router} />
      </SettingsProvider>
    </AuthProvider>
  )
}
