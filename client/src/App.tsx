import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import JoinPage from './pages/JoinPage'
import WaitingRoom from './pages/WaitingRoom'
import ParticipantQuestion from './pages/ParticipantQuestion'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import QuizBuilder from './pages/QuizBuilder'
import SessionControl from './pages/SessionControl'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Router>
      <SessionProvider>
        <Routes>
          {/* Participant Routes */}
          <Route path="/" element={<JoinPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/lobby/:roomCode" element={<WaitingRoom />} />
          <Route path="/quiz/:roomCode" element={<ParticipantQuestion />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/quiz/:id/edit"
            element={
              <ProtectedRoute>
                <QuizBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/session/:roomCode"
            element={
              <ProtectedRoute>
                <SessionControl />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </Router>
  )
}
