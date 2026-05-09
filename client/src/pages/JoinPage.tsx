import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Play, Share2 } from 'lucide-react'
import { useSession } from '../context/SessionContext'

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setParticipant } = useSession()

  useEffect(() => {
    // Clear any stale participant session from previous game
    localStorage.removeItem('participantId')

    const code = searchParams.get('code')
    if (code) {
      setRoomCode(code.toUpperCase())
    }
  }, [searchParams])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!roomCode.trim() || !nickname.trim()) {
      setError('Please enter both room code and nickname')
      setLoading(false)
      return
    }

    try {
      // Validate room exists
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/sessions/${roomCode.toUpperCase()}`
      )

      if (!response.ok) {
        setError('Room code not found or session ended')
        setLoading(false)
        return
      }

      // Store participant info
      const participantData = {
        roomCode: roomCode.toUpperCase(),
        nickname: nickname.trim(),
      }
      setParticipant(participantData)
      localStorage.setItem('participant', JSON.stringify(participantData))

      navigate(`/lobby/${roomCode.toUpperCase()}`)
    } catch (err) {
      setError('Failed to connect to room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute -bottom-8 right-4 w-72 h-72 bg-rose-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <div className="card w-full max-w-md relative z-10 p-12 bg-white/95 backdrop-blur-md rounded-[3rem] shadow-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl mb-6 shadow-xl shadow-indigo-200 rotate-3">
             <Play className="text-white" size={40} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">QuizLive</h1>
          <p className="text-slate-500 font-bold">The ultimate arena awaits.</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Room Code</label>
            <input
              type="text"
              placeholder="E.g. AB12CD"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="input-field py-5 text-2xl font-mono font-black text-center tracking-[0.3em] uppercase"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Your Alias</label>
            <input
              type="text"
              placeholder="Enter your legend name"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              className="input-field py-5 font-bold"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border-2 border-rose-100 text-rose-600 font-bold rounded-2xl animate-shake">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-6 text-xl" disabled={loading}>
            {loading ? 'Entering Arena...' : 'Join the Fight'}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-slate-400 font-bold mb-4">Are you a Quiz Master?</p>
          <Link to="/admin/login" className="inline-flex items-center gap-2 text-indigo-600 font-black hover:gap-3 transition-all">
            Host your own session <Share2 size={18} />
          </Link>
        </div>
      </div>
    </div>
  )
}
