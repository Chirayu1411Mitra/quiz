import { createContext, useContext, ReactNode, useCallback, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface SessionContextType {
  socket: Socket | null
  admin: any | null
  participant: any | null
  setAdmin: (admin: any) => void
  setParticipant: (participant: any) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [admin, setAdmin] = useState<any>(() => {
    const stored = localStorage.getItem('admin')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        localStorage.removeItem('admin')
      }
    }
    return null
  })
  const [participant, setParticipant] = useState<any>(() => {
    const stored = localStorage.getItem('participant')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        localStorage.removeItem('participant')
      }
    }
    return null
  })

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      throw new Error('Login failed')
    }

    const data = await response.json()
    setAdmin(data.admin)
    localStorage.setItem('admin', JSON.stringify(data.admin))
    localStorage.setItem('token', data.token)
  }, [])

  const logout = useCallback(() => {
    setAdmin(null)
    setParticipant(null)
    localStorage.removeItem('admin')
    localStorage.removeItem('token')
    localStorage.removeItem('participant')
  }, [])

  return (
    <SessionContext.Provider
      value={{
        socket,
        admin,
        participant,
        setAdmin,
        setParticipant,
        login,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
