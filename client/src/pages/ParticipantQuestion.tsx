import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { CheckCircle, XCircle } from 'lucide-react'

interface Question {
  id: string
  text: string
  type: string
  options?: any
  timeLimit: number
}

export default function ParticipantQuestion() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { socket, participant } = useSession()
  const [question, setQuestion] = useState<Question | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [selectedAns, setSelectedAns] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const selectedAnsRef = useRef<string | null>(null)

  useEffect(() => {
    selectedAnsRef.current = selectedAns
  }, [selectedAns])

  // Load participantId from localStorage (set by WaitingRoom when joining)
  useEffect(() => {
    const stored = localStorage.getItem('participantId')
    if (stored) setParticipantId(stored)
  }, [])

  useEffect(() => {
    if (!socket || !roomCode || !participant) return

    // Fetch initial state in case session is already active
    const fetchInitialState = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/sessions/${roomCode}`)
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'ACTIVE' && data.quiz?.questions) {
            const currentQ = data.quiz.questions[data.currentQuestionIdx]
            if (currentQ) {
              setQuestion({
                ...currentQ,
                options: typeof currentQ.options === 'string' ? JSON.parse(currentQ.options) : currentQ.options
              })
              setTimeLeft(data.timeLeft || 0)
              setAnswered(data.answerLocked || false)
              // Note: timer will sync via socket.on('session:timer_sync')
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial state:', err)
      }
    }

    fetchInitialState()

    // Listen for question start
    socket.on('session:question_start', ({ question: q, timeLimit }: any) => {
      setQuestion(q)
      setTimeLeft(timeLimit)
      setAnswered(false)
      setSelectedAns(null)
      setFeedback(null)
    })

    // Listen for timer sync
    socket.on('session:timer_sync', ({ secondsLeft }: { secondsLeft: number }) => {
      setTimeLeft(Math.max(0, secondsLeft))
    })

    // Listen for answer submission ack
    socket.on('session:answer_submitted_ack', () => {
      setAnswered(true)
      // Feedback will be shown later when admin reveals answer
    })

    // Listen for answer reveal
    socket.on('session:answer_revealed', ({ correctOptionId }: { correctOptionId: string }) => {
      setFeedback(selectedAnsRef.current === correctOptionId ? 'correct' : 'incorrect')
    })

    // Listen for answers locked
    socket.on('session:answers_locked', () => {
      setAnswered(true)
    })

    // Listen for results
    socket.on('session:results', () => {
      // Results will be shown by admin
    })

    // Listen for session ended
    socket.on('session:ended', () => {
      navigate('/')
    })

    return () => {
      socket.off('session:question_start')
      socket.off('session:timer_sync')
      socket.off('session:answer_submitted_ack')
      socket.off('session:answers_locked')
      socket.off('session:results')
      socket.off('session:ended')
      socket.off('session:answer_revealed')
    }
  }, [socket, roomCode, participant, navigate])

  const handleAnswerSelect = (answerId: string) => {
    if (answered || !participantId) return

    setSelectedAns(answerId)
    setAnswered(true)

    // Submit answer
    socket?.emit('participant:submit_answer', {
      roomCode,
      participantId,
      questionId: question?.id,
      answer: answerId,
    })
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="mt-4 text-lg">Loading question...</p>
        </div>
      </div>
    )
  }

  const colorMap: Record<number, string> = {
    0: 'bg-red-500 hover:bg-red-600',
    1: 'bg-blue-500 hover:bg-blue-600',
    2: 'bg-yellow-500 hover:bg-yellow-600',
    3: 'bg-green-500 hover:bg-green-600',
  }

  const options = Array.isArray(question.options) ? question.options : []
  const timerColor = timeLeft > 10 ? 'text-indigo-600' : timeLeft > 5 ? 'text-amber-500' : 'text-rose-500'

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 right-1/3 w-96 h-96 bg-rose-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="max-w-3xl w-full relative z-10">
        {/* Progress & Timer */}
        <div className="flex justify-between items-center mb-10 px-4">
          <div className="bg-white/10 px-6 py-3 rounded-full text-white font-black uppercase tracking-widest text-xs backdrop-blur-md shadow-lg border border-white/5">
             Live Question
          </div>
          <div className={`text-6xl font-black font-mono transition-all duration-300 ${timerColor} scale-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]`}>
            {timeLeft}s
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-[3rem] p-12 mb-8 animate-slide-up shadow-2xl border-0">
          <h2 className="text-4xl font-black text-slate-900 mb-12 leading-tight text-center">
            {question.text}
          </h2>

          {/* Options */}
          <div className="grid grid-cols-1 gap-5">
            {options.map((option: any, idx: number) => {
              const isSelected = selectedAns === option.id
              const isRevealed = feedback !== null
              
              return (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(option.id)}
                  disabled={answered}
                  className={`
                    relative group p-6 rounded-3xl font-bold text-left text-2xl transition-all duration-300
                    flex items-center gap-6 border-4
                    ${isSelected && !isRevealed ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-500/30 scale-[1.02]' : 'bg-white border-slate-100 text-slate-700 hover:border-indigo-200 hover:bg-slate-50'}
                    ${answered && !isSelected ? 'opacity-40 grayscale-[0.5]' : ''}
                    ${isRevealed && feedback === 'correct' && isSelected ? 'bg-emerald-500 border-emerald-400 text-white scale-[1.02] shadow-xl shadow-emerald-500/30' : ''}
                    ${isRevealed && feedback === 'incorrect' && isSelected ? 'bg-rose-500 border-rose-400 text-white scale-[1.02] shadow-xl shadow-rose-500/30' : ''}
                  `}
                >
                  <div className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black transition-colors
                    ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500'}
                  `}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="flex-1">{option.text}</span>
                  
                  {isRevealed && isSelected && (
                    <div className="animate-bounce drop-shadow-md">
                      {feedback === 'correct' ? <CheckCircle size={40} className="text-white" /> : <XCircle size={40} className="text-white" />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Feedback & Status */}
          <div className="mt-12 h-14 flex items-center justify-center">
            {answered && !feedback && (
              <div className="flex items-center gap-3 text-indigo-600 font-black animate-pulse text-xl uppercase tracking-widest">
                <div className="w-3 h-3 bg-indigo-600 rounded-full animate-ping"></div>
                Awaiting Reveal...
              </div>
            )}
            
            {feedback === 'correct' && (
              <div className="text-emerald-500 text-3xl font-black animate-bounce flex items-center gap-3 drop-shadow-md uppercase tracking-widest">
                <CheckCircle size={36} /> BRILLIANT!
              </div>
            )}
            
            {feedback === 'incorrect' && (
              <div className="text-rose-500 text-3xl font-black animate-shake flex items-center gap-3 drop-shadow-md uppercase tracking-widest">
                <XCircle size={36} /> NOT QUITE...
              </div>
            )}
          </div>
        </div>
        
        {/* Tips */}
        <p className="text-center text-slate-500 font-bold uppercase tracking-widest text-xs opacity-80">
          Speed equals more points ⚡
        </p>
      </div>
    </div>
  )
}
