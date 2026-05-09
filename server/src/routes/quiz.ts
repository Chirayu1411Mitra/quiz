import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { verifyToken } from './auth.js'

const router = Router()

// Get all quizzes for admin
router.get('/', verifyToken, async (req: any, res: Response) => {
  try {
    const prisma = req.prisma as PrismaClient
    const quizzes = await prisma.quiz.findMany({
      where: { adminId: req.adminId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { questions: true },
        },
      },
    })

    const formattedQuizzes = quizzes.map((q: any) => ({
      ...q,
      questions: q.questions.map((question: any) => ({
        ...question,
        options: typeof question.options === 'string' ? JSON.parse(question.options) : question.options
      }))
    }))

    res.json(formattedQuizzes)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch quizzes' })
  }
})

// Get single quiz
router.get('/:id', verifyToken, async (req: any, res: Response) => {
  try {
    const prisma = req.prisma as PrismaClient
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!quiz || quiz.adminId !== req.adminId) {
      res.status(404).json({ message: 'Quiz not found' })
      return
    }

    const formattedQuiz = {
      ...quiz,
      questions: quiz.questions.map((q: any) => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      }))
    }

    res.json(formattedQuiz)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch quiz' })
  }
})

// Create quiz
router.post('/', verifyToken, async (req: any, res: Response) => {
  const schema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
  })

  try {
    const data = schema.parse(req.body)
    const prisma = req.prisma as PrismaClient

    const quiz = await prisma.quiz.create({
      data: {
        title: data.title,
        description: data.description,
        adminId: req.adminId,
      },
    })

    res.status(201).json(quiz)
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error' })
      return
    }
    console.error(err)
    res.status(500).json({ message: 'Failed to create quiz' })
  }
})

// Update quiz
router.put('/:id', verifyToken, async (req: any, res: Response) => {
  const schema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
  })

  try {
    const data = schema.parse(req.body)
    const prisma = req.prisma as PrismaClient

    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
    })

    if (!quiz || quiz.adminId !== req.adminId) {
      res.status(404).json({ message: 'Quiz not found' })
      return
    }

    const updated = await prisma.quiz.update({
      where: { id: req.params.id },
      data: {
        title: data.title || quiz.title,
        description: data.description !== undefined ? data.description : quiz.description,
      },
    })

    res.json(updated)
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error' })
      return
    }
    res.status(500).json({ message: 'Failed to update quiz' })
  }
})

// Delete quiz
router.delete('/:id', verifyToken, async (req: any, res: Response) => {
  try {
    const prisma = req.prisma as PrismaClient

    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
    })

    if (!quiz || quiz.adminId !== req.adminId) {
      res.status(404).json({ message: 'Quiz not found' })
      return
    }

    await prisma.quiz.delete({
      where: { id: req.params.id },
    })

    res.status(204).send()
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete quiz' })
  }
})

// Add question
router.post('/:id/questions', verifyToken, async (req: any, res: Response) => {
  const schema = z.object({
    text: z.string().min(1),
    type: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_TEXT', 'POLL']),
    options: z.array(z.object({ id: z.string(), text: z.string(), isCorrect: z.boolean().optional() })).optional(),
    timeLimit: z.number().min(5).max(300).default(30),
    points: z.number().min(1).default(100),
  })

  try {
    const data = schema.parse(req.body)
    const prisma = req.prisma as PrismaClient

    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
    })

    if (!quiz || quiz.adminId !== req.adminId) {
      res.status(404).json({ message: 'Quiz not found' })
      return
    }

    // Get next order
    const lastQuestion = await prisma.question.findFirst({
      where: { quizId: req.params.id },
      orderBy: { order: 'desc' },
    })

    const question = await prisma.question.create({
      data: {
        quizId: req.params.id,
        text: data.text,
        type: data.type,
        options: data.options ? JSON.stringify(data.options) : null,
        timeLimit: data.timeLimit,
        points: data.points,
        order: (lastQuestion?.order || 0) + 1,
      },
    })

    const formattedQuestion = {
      ...question,
      options: typeof question.options === 'string' ? JSON.parse(question.options) : question.options
    }

    res.status(201).json(formattedQuestion)
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: err.errors })
      return
    }
    console.error(err)
    res.status(500).json({ message: 'Failed to create question' })
  }
})

// Update question
router.put('/:id/questions/:qid', verifyToken, async (req: any, res: Response) => {
  try {
    const prisma = req.prisma as PrismaClient

    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
    })

    if (!quiz || quiz.adminId !== req.adminId) {
      res.status(404).json({ message: 'Quiz not found' })
      return
    }

    // Whitelist only fields that are safe to update
    const { text, type, options, timeLimit, points } = req.body
    const updateData: any = {}
    if (text !== undefined) updateData.text = text
    if (type !== undefined) updateData.type = type
    if (timeLimit !== undefined) updateData.timeLimit = Number(timeLimit)
    if (points !== undefined) updateData.points = Number(points)
    if (options !== undefined) {
      updateData.options = typeof options !== 'string' ? JSON.stringify(options) : options
    }

    const question = await prisma.question.update({
      where: { id: req.params.qid },
      data: updateData,
    })

    const formattedQuestion = {
      ...question,
      options: typeof question.options === 'string' ? JSON.parse(question.options) : question.options
    }

    res.json(formattedQuestion)
  } catch (err) {
    res.status(500).json({ message: 'Failed to update question' })
  }
})

// Delete question
router.delete('/:id/questions/:qid', verifyToken, async (req: any, res: Response) => {
  try {
    const prisma = req.prisma as PrismaClient

    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
    })

    if (!quiz || quiz.adminId !== req.adminId) {
      res.status(404).json({ message: 'Quiz not found' })
      return
    }

    await prisma.question.delete({
      where: { id: req.params.qid },
    })

    res.status(204).send()
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete question' })
  }
})

export default router
