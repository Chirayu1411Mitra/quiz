import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Play, Lock, Eye, Flag, QrCode, Share2, Copy, BarChart } from 'lucide-react'
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { QRCodeCanvas } from 'qrcode.react'

interface Participant {
  id: string
  nickname: string
  score: number
  hasAnswered: boolean
}

interface Question {
  id: string
  text: string
  options?: any[]
  timeLimit: number
  points: number
}

export default function SessionControl() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { socket } = useSession()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [sessionStatus, setSessionStatus] = useState('WAITING')
  const [timeLeft, setTimeLeft] = useState(0)
  const [answersLocked, setAnswersLocked] = useState(false)
  const [chartData, setChartData] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [showShareModal, setShowShareModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [responseCountsCache, setResponseCountsCache] = useState<Record<string, number>>({})

  const joinUrl = `${window.location.origin}/join?code=${roomCode}`

  // Build chart-friendly data from raw responseCounts + question options
  const buildChartData = (
    counts: Record<string, number>,
    options: any[]
  ) => {
    return options.map((opt: any, idx: number) => ({
      option: String.fromCharCode(65 + idx),   // A, B, C, D
      label: opt.text,
      responses: counts[opt.id] ?? 0,
      isCorrect: opt.isCorrect,
      fill: opt.isCorrect ? '#10b981' : '#6366f1',
    }))
  }

  useEffect(() => {
    const fetchSession = async () => {
      if (!roomCode) return
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/sessions/${roomCode}`)
        if (response.ok) {
          const data = await response.json()
          const processedQuestions = (data.quiz?.questions || []).map((q: any) => ({
            ...q,
            options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          }))
          setQuestions(processedQuestions)
          setParticipants(
            (data.participants || []).map((p: any) => ({
              id: p.id,
              nickname: p.nickname,
              score: p.score ?? 0,
              hasAnswered: false,
            }))
          )
          setSessionStatus(data.status)
          setCurrentQuestionIdx(data.currentQuestionIdx || 0)
        }
      } catch (err) {
        console.error('Failed to fetch session:', err)
      }
    }

    fetchSession()
  }, [roomCode])

  useEffect(() => {
    if (!socket || !roomCode) return

    // Join as admin
    socket.emit('admin:create_session', { roomCode })

    // Listen for events
    socket.on('session:participant_joined', (data: any) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.id === data.participantId)) return prev
        return [
          ...prev,
          {
            id: data.participantId,
            nickname: data.nickname,
            score: 0,
            hasAnswered: false,
          },
        ]
      })
    })

    socket.on('session:timer_sync', ({ secondsLeft }: any) => {
      setTimeLeft(secondsLeft)
    })

    socket.on('session:answer_update', ({ responseCounts, participantId }: any) => {
      setResponseCountsCache(responseCounts || {})

      // Mark the answering participant
      if (participantId) {
        setParticipants((prev) =>
          prev.map((p) => (p.id === participantId ? { ...p, hasAnswered: true } : p))
        )
      }

      // Update chart using current question options for readable labels
      setQuestions((currentQs) => {
        setCurrentQuestionIdx((currentIdx) => {
          const opts = currentQs[currentIdx]?.options
          if (opts?.length) {
            setChartData(buildChartData(responseCounts || {}, opts))
          }
          return currentIdx
        })
        return currentQs
      })
    })

    socket.on('session:results', ({ responseCounts }: any) => {
      setResponseCountsCache(responseCounts || {})
      setQuestions((currentQs) => {
        setCurrentQuestionIdx((currentIdx) => {
          const opts = currentQs[currentIdx]?.options
          if (opts?.length) {
            setChartData(buildChartData(responseCounts || {}, opts))
          }
          return currentIdx
        })
        return currentQs
      })
    })

    socket.on('session:leaderboard', ({ topParticipants }: any) => {
      setLeaderboard(topParticipants || [])
    })

    socket.on('session:answers_locked', () => {
      setAnswersLocked(true)
    })

    socket.on('session:question_start', ({ questionIdx }: any) => {
      setCurrentQuestionIdx(questionIdx)
      setAnswersLocked(false)
      setChartData([])   // clear previous question's chart
      setResponseCountsCache({})
      setParticipants((prev) => prev.map((p) => ({ ...p, hasAnswered: false })))
    })

    socket.on('session:ended', () => {
      setTimeout(() => navigate('/admin/dashboard'), 2000)
    })

    return () => {
      socket.off('session:participant_joined')
      socket.off('session:timer_sync')
      socket.off('session:answer_update')
      socket.off('session:results')
      socket.off('session:leaderboard')
      socket.off('session:answers_locked')
      socket.off('session:question_start')
      socket.off('session:started')
      socket.off('session:ended')
    }
  }, [socket, roomCode])

  const handleStartQuiz = () => {
    if (!roomCode) return
    socket?.emit('admin:start_session', { roomCode })
    setSessionStatus('ACTIVE')
  }

  const handleRevealAnswer = () => {
    if (!roomCode) return
    socket?.emit('admin:reveal_answer', { roomCode })
  }

  const handleNextQuestion = () => {
    if (!roomCode) return
    socket?.emit('admin:next_question', { roomCode })
    // DO NOT update currentQuestionIdx locally — session:question_start event is the single source of truth
    setAnswersLocked(false)
  }

  const handleLockAnswers = () => {
    if (!roomCode) return
    socket?.emit('admin:lock_answers', { roomCode })
    setAnswersLocked(true)
  }

  const handleShowResults = () => {
    if (!roomCode) return
    socket?.emit('admin:show_results', { roomCode })
    socket?.emit('admin:show_leaderboard', { roomCode })
    // Also rebuild chart locally from cache so it appears immediately
    const opts = questions[currentQuestionIdx]?.options
    if (opts?.length && Object.keys(responseCountsCache).length > 0) {
      setChartData(buildChartData(responseCountsCache, opts))
    }
  }

  const handleEndSession = () => {
    if (!roomCode) return
    if (window.confirm('End this session?')) {
      socket?.emit('admin:end_session', { roomCode })
      setTimeout(() => navigate('/admin/dashboard'), 2000)
    }
  }

  const currentQuestion = questions[currentQuestionIdx]
  const answeredCount = participants.filter((p) => p.hasAnswered).length

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background Mesh */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-br from-slate-100 via-indigo-50/50 to-emerald-50/30 opacity-70 pointer-events-none"></div>
      <div className="absolute top-20 right-20 w-[500px] h-[500px] bg-indigo-200 rounded-full mix-blend-multiply filter blur-[120px] opacity-30 pointer-events-none animate-blob"></div>
      <div className="absolute -bottom-40 left-20 w-[600px] h-[600px] bg-sky-200 rounded-full mix-blend-multiply filter blur-[150px] opacity-20 pointer-events-none animate-blob animation-delay-4000"></div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 rotate-3 border-2 border-indigo-400/20">
              <span className="text-white font-black text-2xl">Q</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Command Center</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                  Room Code
                </span>
                <span className="font-mono text-indigo-600 font-black tracking-wider text-sm">
                  {roomCode}
                </span>
                {sessionStatus === 'ACTIVE' && (
                  <span className="flex items-center gap-1.5 text-emerald-600 font-bold uppercase text-[10px] tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowShareModal(true)}
              className="btn-secondary py-3 px-5 text-sm font-black text-slate-600 border-slate-200 hover:text-indigo-600 hover:border-indigo-200"
            >
              <Share2 size={16} className="mr-2" />
              Share Link
            </button>
            <button
              onClick={handleEndSession}
              className="btn-secondary py-3 px-5 text-sm font-black text-rose-500 border-rose-100 hover:bg-rose-50 hover:border-rose-200"
            >
              End Session
            </button>
          </div>
        </div>
      </header>

      {/* Share Modal (Redesigned) */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-12 max-w-lg w-full text-center shadow-2xl animate-in zoom-in-95 duration-300 border border-white">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600">
              <Share2 size={40} />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-2">Join the Quiz</h3>
            <p className="text-slate-500 mb-10 text-lg">Scan the code or enter the room code to play!</p>
            
            <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 inline-block mb-10">
              <QRCodeCanvas 
                value={joinUrl} 
                size={260}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-6">
              <div className="bg-indigo-50/50 p-6 rounded-2xl flex items-center justify-between border-2 border-indigo-100 group">
                <div className="text-left">
                  <p className="text-xs font-bold text-indigo-400 uppercase mb-1">Room Code</p>
                  <span className="font-mono font-black text-3xl text-indigo-600 tracking-tighter">{roomCode}</span>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(roomCode || '')
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="bg-white p-4 rounded-xl shadow-sm text-indigo-600 hover:scale-110 transition-transform active:scale-95"
                >
                  {copied ? 'Copied!' : <Copy size={24} />}
                </button>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setShowShareModal(false)} className="btn-primary flex-1 py-5 text-lg">
                  Done, Let's Play!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-8 py-10">
        {sessionStatus === 'WAITING' ? (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="card text-center py-24 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
              
              <h3 className="text-6xl font-black mb-6 text-slate-900 tracking-tight">Ready to start?</h3>
              <p className="text-2xl text-slate-500 mb-12 max-w-xl mx-auto leading-relaxed">
                We have <span className="text-indigo-600 font-black">{participants.length}</span> legends ready to compete.
              </p>
              
              <div className="flex flex-col items-center gap-10">
                <div className="relative group cursor-pointer" onClick={() => setShowShareModal(true)}>
                  <div className="absolute -inset-4 bg-indigo-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative text-7xl font-black tracking-[0.2em] bg-slate-900 px-12 py-6 rounded-3xl shadow-2xl text-white transform hover:scale-105 transition-transform">
                    {roomCode}
                  </div>
                </div>
                
                <button
                  onClick={handleStartQuiz}
                  className="mt-6 px-16 py-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] text-3xl font-black shadow-2xl shadow-indigo-300 hover:scale-105 active:scale-95 transition-all flex items-center gap-6"
                >
                  <Play size={40} fill="currentColor" />
                  START COMPETITION
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-8">
                <h4 className="text-2xl font-black text-slate-800">Joined Players</h4>
                <div className="text-slate-400 font-bold uppercase text-sm tracking-widest">{participants.length} Active</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {participants.map((p) => (
                  <div key={p.id} className="card bg-white p-6 text-center transform hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-indigo-100 hover:shadow-indigo-100/50">
                    <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-black text-indigo-600 shadow-inner">
                      {p.nickname.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-lg font-black text-slate-800 truncate">{p.nickname}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Ready</p>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-200 rounded-[2.5rem]">
                    <p className="text-slate-300 text-2xl font-bold">Waiting for the first player...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-8">
            {/* Left Sidebar: Controls & Stats */}
            <div className="col-span-3 space-y-6 sticky top-28 h-fit">
              <div className="card space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="stat-card">
                    <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Progress</p>
                    <p className="text-3xl font-black text-indigo-600">{currentQuestionIdx + 1}<span className="text-lg text-indigo-300">/{questions.length}</span></p>
                  </div>
                  <div className="stat-card">
                    <p className="text-xs font-black text-rose-400 uppercase tracking-widest mb-1">Timer</p>
                    <p className={`text-3xl font-black font-mono transition-colors duration-500 ${
                      timeLeft > 10 ? 'text-indigo-600' :
                      timeLeft > 5 ? 'text-amber-500' :
                      'text-rose-600'
                    }`}>
                      {timeLeft}s
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Controls</p>
                  <button
                    onClick={handleNextQuestion}
                    disabled={currentQuestionIdx >= questions.length - 1}
                    className="btn-primary w-full py-5 text-lg group"
                  >
                    <Play size={20} className="mr-2 group-hover:translate-x-1 transition-transform" fill="currentColor" />
                    Next Question
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleRevealAnswer} className="btn-secondary font-black border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                      <Eye size={18} className="mr-2" />
                      Reveal
                    </button>
                    <button onClick={handleLockAnswers} disabled={answersLocked} className="btn-secondary font-black border-2 border-slate-100 text-slate-600">
                      <Lock size={18} className="mr-2" />
                      Lock
                    </button>
                  </div>

                  <button onClick={handleShowResults} className="btn-secondary w-full py-4 font-black">
                    <BarChart size={20} className="mr-2 text-indigo-500" />
                    Show Results
                  </button>

                  <button onClick={handleEndSession} className="btn-danger w-full py-4 font-black mt-4">
                    <Flag size={20} className="mr-2" />
                    End Session
                  </button>
                </div>

                <div className="pt-8 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm font-black text-slate-400 uppercase">Response Status</p>
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{Math.round((answeredCount / (participants.length || 1)) * 100)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                      style={{ width: `${(answeredCount / (participants.length || 1)) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-center text-slate-500 text-sm font-bold mt-4">
                    {answeredCount} of {participants.length} players answered
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content: Question & Visualization */}
            <div className="col-span-9 space-y-8 animate-in fade-in duration-500">
              {currentQuestion && (
                <div className="card relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 text-8xl font-black text-slate-50 pointer-events-none select-none">
                    Q{currentQuestionIdx + 1}
                  </div>
                  <div className="relative z-10">
                    <h2 className="text-4xl font-black text-slate-900 mb-12 max-w-3xl leading-tight">
                      {currentQuestion.text}
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-6">
                      {currentQuestion.options?.map((opt: any, idx: number) => (
                        <div key={opt.id} className={`p-8 rounded-[2rem] border-2 transition-all duration-300 flex items-center gap-6 ${opt.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${opt.isCorrect ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white text-slate-400 shadow-sm'}`}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <div>
                            <p className={`text-xl font-black ${opt.isCorrect ? 'text-emerald-900' : 'text-slate-800'}`}>{opt.text}</p>
                            {opt.isCorrect && <p className="text-emerald-600 text-xs font-bold uppercase mt-1 tracking-widest">Correct Answer</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8">
                {/* Visual Data */}
                <div className="card">
                  <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
                    <BarChart className="text-indigo-500" /> Response Distribution
                  </h3>
                  <div className="h-[350px] w-full">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="option" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#94a3b8' }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                            formatter={(value: any, _: any, props: any) => [
                              `${value} response${value !== 1 ? 's' : ''}`,
                              props.payload?.label || props.payload?.option,
                            ]}
                          />
                          <Bar dataKey="responses" radius={[8, 8, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill || '#6366f1'} />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-300 font-bold">
                        No responses yet to visualize
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Leaderboard */}
                <div className="card">
                  <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
                    <Flag className="text-indigo-500" /> Standings
                  </h3>
                  <div className="space-y-4">
                    {leaderboard.length > 0 ? (
                      leaderboard.map((p: any, idx: number) => (
                        <div key={p.id} className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${idx === 0 ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' : 'bg-slate-50 border border-slate-100'}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${idx === 0 ? 'bg-white/20' : 'bg-white text-slate-400 shadow-sm'}`}>
                            #{idx + 1}
                          </div>
                          <p className="flex-1 font-black truncate">{p.nickname}</p>
                          <p className={`font-mono font-black text-lg ${idx === 0 ? 'text-white' : 'text-indigo-600'}`}>{p.score}</p>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-slate-300 font-bold">
                        Leaderboard will appear here
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Participants Grid */}
              <div className="card bg-slate-900 border-none shadow-2xl">
                <h3 className="text-xl font-black text-white mb-8">Active Legends</h3>
                <div className="grid grid-cols-6 gap-4">
                  {participants.map((p) => (
                    <div 
                      key={p.id} 
                      className={`p-4 rounded-2xl border-2 transition-all duration-300 text-center ${
                        p.hasAnswered ? 'bg-indigo-500 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/40' : 'bg-slate-800 border-slate-700 opacity-60'
                      }`}
                    >
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2 text-white font-black">
                        {p.nickname.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-xs font-black text-white truncate">{p.nickname}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
