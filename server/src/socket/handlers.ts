import { Server, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'

import { rooms, RoomState } from './state.js'

function calculatePoints(
  isCorrect: boolean,
  timeElapsedMs: number,
  timeLimitMs: number,
  maxPoints: number
): number {
  if (!isCorrect) return 0
  const timeRatio = Math.min(timeElapsedMs / timeLimitMs, 1)
  const multiplier = 1.0 - timeRatio * 0.5
  return Math.round(maxPoints * multiplier)
}

// Shared helper: start broadcasting a question to a room
async function broadcastQuestion(
  io: Server,
  socket: Socket,
  prisma: PrismaClient,
  roomCode: string
) {
  const roomState = rooms.get(roomCode)
  if (!roomState) return

  // Cancel any existing timer from previous question
  if (roomState.timerInterval) {
    clearInterval(roomState.timerInterval)
    roomState.timerInterval = null
  }

  const session = await prisma.session.findUnique({
    where: { roomCode },
    include: {
      quiz: {
        include: {
          questions: { orderBy: { order: 'asc' } },
        },
      },
    },
  })

  if (!session || !session.quiz) return

  const questions = session.quiz.questions
  const question = questions[roomState.currentQuestionIdx]

  if (!question) {
    // No more questions – auto-end
    socket.emit('error', { message: 'No more questions' })
    return
  }

  roomState.questionStartTime = Date.now()
  roomState.answerLocked = false
  roomState.responseCounts.clear()

  // Reset answered flags for all participants
  roomState.participants.forEach((p) => {
    p.hasAnswered = false
  })

  // Persist current index
  await prisma.session.update({
    where: { roomCode },
    data: { currentQuestionIdx: roomState.currentQuestionIdx },
  })

  const options =
    typeof question.options === 'string'
      ? JSON.parse(question.options)
      : question.options

  io.to(`room:${roomCode}`).emit('session:question_start', {
    question: {
      id: question.id,
      text: question.text,
      type: question.type,
      options,
      timeLimit: question.timeLimit,
    },
    questionIdx: roomState.currentQuestionIdx,
    total: questions.length,
    timeLimit: question.timeLimit,
  })

  // Also send to admin
  io.to(`admin:${roomCode}`).emit('session:question_start', {
    question: {
      id: question.id,
      text: question.text,
      type: question.type,
      options,
      timeLimit: question.timeLimit,
    },
    questionIdx: roomState.currentQuestionIdx,
    total: questions.length,
    timeLimit: question.timeLimit,
  })

  // Timer broadcast every second
  const timerInterval = setInterval(() => {
    if (!roomState.questionStartTime) {
      clearInterval(timerInterval)
      roomState.timerInterval = null
      return
    }
    const elapsed = Math.floor((Date.now() - roomState.questionStartTime) / 1000)
    const secondsLeft = Math.max(0, question.timeLimit - elapsed)

    io.to(`room:${roomCode}`).emit('session:timer_sync', { secondsLeft })
    io.to(`admin:${roomCode}`).emit('session:timer_sync', { secondsLeft })

    if (secondsLeft === 0) {
      clearInterval(timerInterval)
      roomState.timerInterval = null
      // Auto-lock answers when time is up
      roomState.answerLocked = true
      io.to(`room:${roomCode}`).emit('session:answers_locked', {})
      io.to(`admin:${roomCode}`).emit('session:answers_locked', {})
    }
  }, 1000)

  // Store interval reference so it can be cancelled by next_question
  roomState.timerInterval = timerInterval
}

export default function setupSocketHandlers(io: Server, prisma: PrismaClient) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id)

    // ============ ADMIN EVENTS ============

    /**
     * Admin reconnects to an existing session by roomCode.
     * SessionControl.tsx emits: admin:create_session { roomCode }
     */
    socket.on('admin:create_session', async (data: { roomCode?: string; quizId?: string }) => {
      try {
        const { roomCode, quizId } = data

        let session: any = null

        if (roomCode) {
          // Look up existing session by roomCode
          session = await prisma.session.findUnique({
            where: { roomCode },
            include: { quiz: { include: { questions: { orderBy: { order: 'asc' } } } } },
          })
        } else if (quizId) {
          // Create or find session by quizId
          session = await prisma.session.findFirst({
            where: { quizId, status: { in: ['WAITING', 'ACTIVE'] } },
            include: { quiz: { include: { questions: { orderBy: { order: 'asc' } } } } },
          })

          if (!session) {
            // Generate unique room code
            const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
            let code = Array.from({ length: 6 })
              .map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
              .join('')
            while (await prisma.session.findUnique({ where: { roomCode: code } })) {
              code = Array.from({ length: 6 })
                .map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
                .join('')
            }

            session = await prisma.session.create({
              data: { quizId, roomCode: code, status: 'WAITING' },
              include: { quiz: { include: { questions: { orderBy: { order: 'asc' } } } } },
            })
          }
        }

        if (!session) {
          socket.emit('error', { message: 'Session not found' })
          return
        }

        // Restore or create room state
        let roomState = rooms.get(session.roomCode)
        if (!roomState) {
          roomState = {
            sessionId: session.id,
            roomCode: session.roomCode,
            adminSocketId: socket.id,
            status: session.status.toLowerCase() as RoomState['status'],
            currentQuestionIdx: session.currentQuestionIdx ?? 0,
            questionStartTime: null,
            answerLocked: false,
            timerInterval: null,
            participants: new Map(),
            responseCounts: new Map(),
          }
          rooms.set(session.roomCode, roomState)
        } else {
          // Update admin socket ID on reconnect
          roomState.adminSocketId = socket.id
        }

        // Admin joins both rooms so they get all broadcasts
        socket.join(`admin:${session.roomCode}`)
        socket.join(`room:${session.roomCode}`)

        socket.emit('session:created', {
          roomCode: session.roomCode,
          sessionId: session.id,
          status: session.status,
          currentQuestionIdx: roomState.currentQuestionIdx,
          questions: session.quiz?.questions ?? [],
        })
      } catch (err) {
        console.error('Error creating/restoring session:', err)
        socket.emit('error', { message: 'Failed to create session' })
      }
    })

    socket.on('admin:start_session', async (data: { roomCode: string }) => {
      try {
        const { roomCode } = data
        const roomState = rooms.get(roomCode)

        if (!roomState) {
          socket.emit('error', { message: 'Room not found' })
          return
        }

        roomState.status = 'active'
        roomState.currentQuestionIdx = 0

        await prisma.session.update({
          where: { roomCode },
          data: { status: 'ACTIVE', startedAt: new Date(), currentQuestionIdx: 0 },
        })

        // Notify all participants and admin
        io.to(`room:${roomCode}`).emit('session:started')
        io.to(`admin:${roomCode}`).emit('session:started')

        // Broadcast first question
        await broadcastQuestion(io, socket, prisma, roomCode)
      } catch (err) {
        console.error('Error starting session:', err)
        socket.emit('error', { message: 'Failed to start session' })
      }
    })

    socket.on('admin:next_question', async (data: { roomCode: string }) => {
      try {
        const { roomCode } = data
        const roomState = rooms.get(roomCode)

        if (!roomState) return

        // Advance index before broadcasting
        roomState.currentQuestionIdx += 1

        await broadcastQuestion(io, socket, prisma, roomCode)
      } catch (err) {
        console.error('Error advancing question:', err)
        socket.emit('error', { message: 'Failed to advance question' })
      }
    })

    socket.on('admin:lock_answers', (data: { roomCode: string }) => {
      const { roomCode } = data
      const roomState = rooms.get(roomCode)

      if (!roomState) return

      roomState.answerLocked = true
      io.to(`room:${roomCode}`).emit('session:answers_locked', {})
      io.to(`admin:${roomCode}`).emit('session:answers_locked', {})
    })

    socket.on('admin:show_results', (data: { roomCode: string }) => {
      const { roomCode } = data
      const roomState = rooms.get(roomCode)

      if (!roomState) return

      // Emit current response counts directly from in-memory state
      io.to(`room:${roomCode}`).emit('session:results', {
        responseCounts: Object.fromEntries(roomState.responseCounts),
      })
      io.to(`admin:${roomCode}`).emit('session:results', {
        responseCounts: Object.fromEntries(roomState.responseCounts),
      })
    })

    socket.on('admin:show_leaderboard', async (data: { roomCode: string }) => {
      try {
        const { roomCode } = data
        
        const topParticipants = await prisma.participant.findMany({
          where: { session: { roomCode } },
          orderBy: { score: 'desc' },
          take: 10,
          select: { id: true, nickname: true, score: true }
        })

        io.to(`room:${roomCode}`).emit('session:leaderboard', { topParticipants })
        io.to(`admin:${roomCode}`).emit('session:leaderboard', { topParticipants })
      } catch (err) {
        console.error('Error fetching leaderboard:', err)
      }
    })

    socket.on('admin:reveal_answer', async (data: { roomCode: string }) => {
      try {
        const { roomCode } = data
        const roomState = rooms.get(roomCode)
        if (!roomState) return

        const session = await prisma.session.findUnique({
          where: { roomCode },
          include: {
            quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
          },
        })

        if (!session?.quiz) return
        const question = session.quiz.questions[roomState.currentQuestionIdx]
        if (!question) return

        const options =
          typeof question.options === 'string'
            ? JSON.parse(question.options)
            : question.options
        const correctOption = options?.find((o: any) => o.isCorrect)

        io.to(`room:${roomCode}`).emit('session:answer_revealed', {
          correctOptionId: correctOption?.id,
        })
        io.to(`admin:${roomCode}`).emit('session:answer_revealed', {
          correctOptionId: correctOption?.id,
        })
      } catch (err) {
        console.error('Error revealing answer:', err)
      }
    })

    socket.on('admin:show_leaderboard', async (data: { roomCode: string }) => {
      try {
        const { roomCode } = data
        const roomState = rooms.get(roomCode)
        if (!roomState) return

        const participants = await prisma.participant.findMany({
          where: { session: { roomCode } },
          orderBy: { score: 'desc' },
          take: 10,
        })

        const leaderboard = {
          topParticipants: participants.map((p: any) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
          })),
        }

        io.to(`room:${roomCode}`).emit('session:leaderboard', leaderboard)
        io.to(`admin:${roomCode}`).emit('session:leaderboard', leaderboard)
      } catch (err) {
        console.error('Error showing leaderboard:', err)
      }
    })

    socket.on('admin:end_session', async (data: { roomCode: string }) => {
      try {
        const { roomCode } = data
        const roomState = rooms.get(roomCode)

        if (!roomState) return

        roomState.status = 'ended'

        await prisma.session.update({
          where: { roomCode },
          data: { status: 'ENDED', endedAt: new Date() },
        })

        const participants = await prisma.participant.findMany({
          where: { sessionId: roomState.sessionId },
          orderBy: { score: 'desc' },
        })

        const payload = {
          finalLeaderboard: participants.map((p: any) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
          })),
        }

        io.to(`room:${roomCode}`).emit('session:ended', payload)
        io.to(`admin:${roomCode}`).emit('session:ended', payload)

        rooms.delete(roomCode)
      } catch (err) {
        console.error('Error ending session:', err)
      }
    })

    // ============ PARTICIPANT EVENTS ============

    socket.on('participant:join', async (data: { roomCode: string; nickname: string }) => {
      try {
        const { roomCode, nickname } = data
        const roomState = rooms.get(roomCode)

        if (!roomState) {
          socket.emit('error', { message: 'Room not found' })
          return
        }

        // Create participant in DB
        const participant = await prisma.participant.create({
          data: {
            sessionId: roomState.sessionId,
            nickname,
            socketId: socket.id,
          },
        })

        roomState.participants.set(participant.id, {
          nickname,
          socketId: socket.id,
          score: 0,
          hasAnswered: false,
        })

        socket.join(`room:${roomCode}`)
        socket.join(`participant:${participant.id}`)
        ;(socket as any).participantId = participant.id
        ;(socket as any).roomCode = roomCode

        // Notify admin and all room members
        io.to(`admin:${roomCode}`).emit('session:participant_joined', {
          participantId: participant.id,
          nickname,
          count: roomState.participants.size,
        })

        socket.emit('participant:joined', { participantId: participant.id })
      } catch (err) {
        console.error('Error joining session:', err)
        socket.emit('error', { message: 'Failed to join session' })
      }
    })

    socket.on(
      'participant:submit_answer',
      async (data: {
        roomCode: string
        participantId: string
        questionId: string
        answer: string
      }) => {
        try {
          const { roomCode, participantId, questionId, answer } = data
          const roomState = rooms.get(roomCode)

          if (!roomState || roomState.answerLocked) {
            socket.emit('error', { message: 'Cannot submit answer' })
            return
          }

          const participant = roomState.participants.get(participantId)
          if (!participant || participant.hasAnswered) return

          participant.hasAnswered = true

          // Track response count
          const count = (roomState.responseCounts.get(answer) || 0) + 1
          roomState.responseCounts.set(answer, count)

          // Fetch question for correctness check
          const question = await prisma.question.findUnique({ where: { id: questionId } })
          if (!question) return

          const options =
            typeof question.options === 'string'
              ? JSON.parse(question.options)
              : question.options

          const isCorrect =
            question.type === 'MCQ' &&
            options &&
            (options as any[]).some((opt) => opt.id === answer && opt.isCorrect)

          const timeElapsed = Date.now() - (roomState.questionStartTime || 0)
          const points = calculatePoints(
            isCorrect,
            timeElapsed,
            question.timeLimit * 1000,
            question.points
          )

          if (isCorrect) {
            participant.score += points
            await prisma.participant.update({
              where: { id: participantId },
              data: { score: participant.score },
            })
          }

          await prisma.response.create({
            data: {
              sessionId: roomState.sessionId,
              participantId,
              questionId,
              answer,
              isCorrect,
              pointsEarned: points,
            },
          })

          // Ack back to the answering participant
          socket.emit('session:answer_submitted_ack', {
            correct: isCorrect,
            pointsEarned: points,
            rank:
              Array.from(roomState.participants.values())
                .sort((a, b) => b.score - a.score)
                .findIndex((p) => p.nickname === participant.nickname) + 1,
          })

          const answeredCount = Array.from(roomState.participants.values()).filter(
            (p) => p.hasAnswered
          ).length

          // Update admin with response stats
          io.to(`admin:${roomCode}`).emit('session:answer_update', {
            responseCounts: Object.fromEntries(roomState.responseCounts),
            answeredCount,
            totalCount: roomState.participants.size,
            participantId,
          })

          // Push live leaderboard to admin after every answer
          const sorted = Array.from(roomState.participants.entries())
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 10)
            .map(([id, p]) => ({ id, nickname: p.nickname, score: p.score }))

          io.to(`admin:${roomCode}`).emit('session:leaderboard', { topParticipants: sorted })
        } catch (err) {
          console.error('Error submitting answer:', err)
          socket.emit('error', { message: 'Failed to submit answer' })
        }
      }
    )

    socket.on('participant:rejoin', async (data: { roomCode: string; participantId: string }) => {
      try {
        const { roomCode, participantId } = data
        const roomState = rooms.get(roomCode)

        if (!roomState) {
          socket.emit('error', { message: 'Room not found' })
          return
        }

        await prisma.participant.update({
          where: { id: participantId },
          data: { socketId: socket.id },
        })

        const roomParticipant = roomState.participants.get(participantId)
        if (roomParticipant) roomParticipant.socketId = socket.id

        socket.join(`room:${roomCode}`)
        socket.join(`participant:${participantId}`)
        ;(socket as any).participantId = participantId
        ;(socket as any).roomCode = roomCode

        socket.emit('participant:rejoined', { participantId })
      } catch (err) {
        console.error('Error rejoining:', err)
        socket.emit('error', { message: 'Failed to rejoin' })
      }
    })

    // ============ DISCONNECT ============

    socket.on('disconnect', async () => {
      try {
        const participantId = (socket as any).participantId
        const roomCode = (socket as any).roomCode

        if (participantId && roomCode) {
          const roomState = rooms.get(roomCode)
          if (roomState) {
            roomState.participants.delete(participantId)

            if (roomState.participants.size === 0 && roomState.status === 'waiting') {
              rooms.delete(roomCode)
            } else {
              io.to(`room:${roomCode}`).emit('session:participant_left', { participantId })
              io.to(`admin:${roomCode}`).emit('session:participant_left', { participantId })
            }
          }
        }

        console.log('Client disconnected:', socket.id)
      } catch (err) {
        console.error('Error on disconnect:', err)
      }
    })
  })
}
