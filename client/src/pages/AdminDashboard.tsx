import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Plus, Play, Edit2, Trash2, LogOut } from 'lucide-react'

interface Quiz {
  id: string
  title: string
  description?: string
  questions?: any[]
  createdAt: string
}

export default function AdminDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [newQuizTitle, setNewQuizTitle] = useState('')
  const [showNewQuizForm, setShowNewQuizForm] = useState(false)
  const navigate = useNavigate()
  const { admin, logout, socket } = useSession()

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchQuizzes()
  }, [])

  useEffect(() => {
    if (!socket) return

    const handleSessionCreated = ({ roomCode }: { roomCode: string }) => {
      navigate(`/admin/session/${roomCode}`)
    }

    socket.on('session:created', handleSessionCreated)

    return () => {
      socket.off('session:created', handleSessionCreated)
    }
  }, [socket, navigate])

  const fetchQuizzes = async () => {
    if (!token) return
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/quizzes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setQuizzes(data)
      }
    } catch (err) {
      console.error('Failed to fetch quizzes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuizTitle.trim()) return

    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newQuizTitle.trim() }),
      })

      if (response.ok) {
        const newQuiz = await response.json()
        setQuizzes([newQuiz, ...quizzes])
        setNewQuizTitle('')
        setShowNewQuizForm(false)
        navigate(`/admin/quiz/${newQuiz.id}/edit`)
      }
    } catch (err) {
      console.error('Failed to create quiz:', err)
    }
  }

  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm('Delete this quiz? This cannot be undone.')) return

    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/quizzes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setQuizzes(quizzes.filter((q) => q.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete quiz:', err)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Subtle Admin Background Mesh */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-indigo-50 via-white to-purple-50 opacity-70 pointer-events-none"></div>
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 pointer-events-none animate-blob"></div>
      <div className="absolute top-40 -left-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 pointer-events-none animate-blob animation-delay-2000"></div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 rotate-3">
              <span className="text-white font-black text-2xl">Q</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Quiz Arena</h1>
              <p className="text-indigo-600 font-bold mt-1 uppercase text-[10px] tracking-widest bg-indigo-50 inline-block px-2 py-0.5 rounded-md">Master: {admin?.name || 'Admin'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-secondary flex items-center gap-2 px-6 border-slate-200"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Actions Bar */}
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-2xl font-black text-slate-800">Your Quizzes</h2>
          {!showNewQuizForm && (
            <button
              onClick={() => setShowNewQuizForm(true)}
              className="btn-primary flex items-center gap-3 px-8 shadow-indigo-100"
            >
              <Plus size={24} />
              Craft New Quiz
            </button>
          )}
        </div>

        {/* Create Quiz Form */}
        {showNewQuizForm && (
          <div className="card mb-12 animate-slide-up border-2 border-indigo-100 bg-indigo-50/30">
            <h2 className="text-2xl font-black mb-6">New Quiz Details</h2>
            <form onSubmit={handleCreateQuiz} className="flex gap-4">
              <input
                type="text"
                placeholder="Give your quiz a legendary title..."
                value={newQuizTitle}
                onChange={(e) => setNewQuizTitle(e.target.value)}
                className="input-field flex-1 text-xl font-bold py-4"
              />
              <button type="submit" className="btn-primary px-10">
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewQuizForm(false)}
                className="btn-secondary px-8"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Quizzes List */}
        {loading ? (
          <div className="text-center py-24">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600"></div>
            <p className="text-slate-500 font-bold mt-6 text-xl">Loading your arena...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="card text-center py-32 border-4 border-dashed border-slate-200 bg-transparent">
            <p className="text-slate-300 text-3xl font-black mb-8">No quizzes found.</p>
            <button onClick={() => setShowNewQuizForm(true)} className="btn-primary py-5">
               Start by creating your first one
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="card group hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-indigo-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-indigo-50 transition-colors"></div>
                
                <div className="relative z-10">
                  <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight">{quiz.title}</h3>
                  {quiz.description && (
                    <p className="text-slate-500 font-medium mb-6 line-clamp-2">{quiz.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-8">
                    <span className="bg-slate-100 text-slate-600 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                      {quiz.questions?.length || 0} Questions
                    </span>
                    <span className="bg-emerald-50 text-emerald-600 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                      Ready
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate(`/admin/quiz/${quiz.id}/edit`)}
                      className="btn-secondary flex-1 py-4 font-black text-sm"
                    >
                      <Edit2 size={18} className="mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (socket) {
                          socket.emit('admin:create_session', { quizId: quiz.id })
                        }
                      }}
                      className="btn-primary flex-[1.5] py-4 font-black text-sm"
                    >
                      <Play size={18} className="mr-2" fill="currentColor" />
                      Launch Quiz
                    </button>
                    <button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="btn-secondary p-4 text-rose-500 border-rose-100 hover:bg-rose-50 hover:border-rose-200"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
