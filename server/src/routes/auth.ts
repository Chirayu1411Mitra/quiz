import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
// @ts-ignore
import { z } from 'zod'

const router = Router()

// Middleware to verify JWT
export const verifyToken = (req: any, res: Response, next: any) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    res.status(401).json({ message: 'No token provided' })
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret')
    req.adminId = (decoded as any).id
    next()
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' })
    return
  }
}

// Register
router.post('/register', async (req: any, res: Response) => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(4, 'Password must be at least 4 characters long'),
  })

  try {
    const data = schema.parse(req.body)
    const prisma = req.prisma as PrismaClient

    // Check if email exists
    const existing = await prisma.admin.findUnique({ where: { email: data.email } })
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12)

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
      },
    })

    // Generate token
    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    )

    res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    })
    return
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ 
        message: err.errors[0]?.message || 'Validation error', 
        errors: err.errors 
      })
    }
    console.error(err)
    res.status(500).json({ message: 'Registration failed' })
    return
  }
})

// Login
router.post('/login', async (req: any, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
  })

  try {
    const data = schema.parse(req.body)
    const prisma = req.prisma as PrismaClient

    // Find admin
    const admin = await prisma.admin.findUnique({ where: { email: data.email } })
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, admin.password)
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Generate token
    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    )

    res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    })
    return
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0]?.message || 'Validation error' })
    }
    console.error(err)
    res.status(500).json({ message: 'Login failed' })
    return
  }
})

// Get current admin
router.get('/me', verifyToken, async (req: any, res: Response) => {
  try {
    const prisma = req.prisma as PrismaClient
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId },
    })

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' })
    }

    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
    })
    return
  } catch (err) {
    res.status(500).json({ message: 'Failed to get admin' })
    return
  }
})

export default router
