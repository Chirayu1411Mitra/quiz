import express, { Request, Response, NextFunction } from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Routes
import authRoutes from './routes/auth.js'
import quizRoutes from './routes/quiz.js'
import sessionRoutes from './routes/session.js'

// Socket handlers
import setupSocketHandlers from './socket/handlers.js'

dotenv.config()

const ALLOWED_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})

const prisma = new PrismaClient()

// Middleware
app.use(cors({ origin: '*' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Make io and prisma available to routes
app.use((req: any, _res: any, next: NextFunction) => {
  req.io = io
  req.prisma = prisma
  next()
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/quizzes', quizRoutes)
app.use('/api/sessions', sessionRoutes)

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// Socket.IO setup
setupSocketHandlers(io, prisma)

// Error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  })
})

const PORT = process.env.PORT || 4000

httpServer.listen(PORT, () => {
  console.log(`QuizLive server running on port ${PORT}`)
  console.log(`WebSocket server ready`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server')
  httpServer.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
})
