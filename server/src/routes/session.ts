import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()

// Get session status
router.get('/:roomCode', async (req: any, res: Response) => {
  try {
    const prisma = req.prisma as PrismaClient

    const session = await prisma.session.findUnique({
      where: { roomCode: req.params.roomCode.toUpperCase() },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
            },
          },
        },
        participants: true,
      },
    })

    if (!session) {
      res.status(404).json({ message: 'Session not found' })
      return
    }

    const roomState = (await import('../socket/state.js')).rooms.get(req.params.roomCode.toUpperCase())
    let timeLeft = 0
    if (roomState?.questionStartTime && session.quiz?.questions[session.currentQuestionIdx]) {
      const question = session.quiz.questions[session.currentQuestionIdx]
      const elapsed = Math.floor((Date.now() - roomState.questionStartTime) / 1000)
      timeLeft = Math.max(0, question.timeLimit - elapsed)
    }

    res.json({
      roomCode: session.roomCode,
      status: session.status,
      quiz: session.quiz,
      participantCount: session.participants.length,
      currentQuestionIdx: session.currentQuestionIdx,
      timeLeft,
      answerLocked: roomState?.answerLocked || false,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch session' })
  }
})

// Get session results
router.get('/:roomCode/results', async (req: any, res: Response) => {
  try {
    const prisma = req.prisma as PrismaClient

    const session = await prisma.session.findUnique({
      where: { roomCode: req.params.roomCode.toUpperCase() },
      include: {
        participants: {
          orderBy: { score: 'desc' },
        },
        responses: true,
      },
    })

    if (!session) {
      res.status(404).json({ message: 'Session not found' })
      return
    }

    res.json({
      roomCode: session.roomCode,
      participants: session.participants,
      responses: session.responses,
      endedAt: session.endedAt,
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch results' })
  }
})

export default router
