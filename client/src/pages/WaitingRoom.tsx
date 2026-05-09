import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Users, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

export default function WaitingRoom() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { socket, participant } = useSession()
  const [participantCount, setParticipantCount] = useState(1)
  const [quizTitle, setQuizTitle] = useState('')
  const [showQR, setShowQR] = useState(false)
  const hasJoined = useRef(false)  // guard against double-join on socket reconnect
  const joinUrl = `${window.location.origin}/join?code=${roomCode}`

  useEffect(() => {
    const fetchSession = async () => {
      if (!roomCode) return
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/sessions/${roomCode}`)
        if (response.ok) {
          const data = await response.json()
          setQuizTitle(data.quiz?.title || '')
          setParticipantCount(data.participantCount || 0)
        }
      } catch (err) {
        console.error('Failed to fetch session:', err)
      }
    }
    fetchSession()
  }, [roomCode])

  useEffect(() => {
    if (!socket || !roomCode || !participant) return

    // Only emit join once — prevent duplicate DB records on socket reconnect
    if (!hasJoined.current) {
      hasJoined.current = true
      socket.emit('participant:join', {
        roomCode,
        nickname: participant.nickname,
      })
    }

    // Save participantId given by the server
    socket.on('participant:joined', ({ participantId }: { participantId: string }) => {
      localStorage.setItem('participantId', participantId)
    })

    // Listen for participant count updates
    socket.on('session:participant_joined', ({ count }: { count: number }) => {
      setParticipantCount(count)
    })

    // Listen for question start — navigate to quiz page
    socket.on('session:question_start', () => {
      navigate(`/quiz/${roomCode}`)
    })

    // Listen for session ended
    socket.on('session:ended', () => {
      navigate('/')
    })

    return () => {
      socket.off('participant:joined')
      socket.off('session:participant_joined')
      socket.off('session:question_start')
      socket.off('session:ended')
    }
  }, [socket, roomCode, participant, navigate])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-rose-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="card w-full max-w-md text-center relative z-10 p-12 bg-white/95 backdrop-blur-md rounded-[3rem] shadow-2xl border-0">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl mb-6 shadow-xl shadow-indigo-200 rotate-3">
          <Users className="text-white" size={40} />
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{quizTitle || 'QuizLive Arena'}</h1>
        <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-xs">Room: <span className="font-mono text-indigo-600 text-sm bg-indigo-50 px-2 py-1 rounded-md">{roomCode}</span></p>

        <div className="py-8 bg-slate-50 rounded-3xl mb-8 border border-slate-100 shadow-inner">
          <div className="text-center">
            <p className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-xs">Awaiting Host...</p>
            <p className="text-6xl font-black text-indigo-600 mb-2 drop-shadow-sm">{participantCount}</p>
            <p className="text-sm font-bold text-slate-500">Legend{participantCount !== 1 ? 's' : ''} ready</p>
          </div>

          <div className="flex justify-center mt-6 gap-2">
            <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce animation-delay-2000"></div>
            <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce animation-delay-4000"></div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setShowQR(!showQR)}
            className="btn-secondary w-full py-4 text-sm font-black text-indigo-600 border-indigo-100 hover:bg-indigo-50"
          >
            <QrCode size={20} className="mr-2" />
            {showQR ? 'Hide Invite QR' : 'Show Invite QR'}
          </button>
          
          {showQR && (
            <div className="mt-4 p-6 bg-white rounded-3xl shadow-lg border border-slate-100 inline-block animate-slide-up">
              <QRCodeCanvas 
                value={joinUrl} 
                size={180}
                level="M"
                includeMargin={true}
              />
              <p className="mt-4 text-xs font-black text-slate-400 tracking-widest uppercase">Scan to join</p>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-sm">
          <p className="text-slate-400 font-bold">Playing as <span className="text-slate-800 font-black">{participant?.nickname}</span></p>
        </div>
      </div>
    </div>
  )
}
