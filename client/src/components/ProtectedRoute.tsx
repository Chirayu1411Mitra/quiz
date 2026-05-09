import { Navigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin } = useSession()

  if (!admin) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}
