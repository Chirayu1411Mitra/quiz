export interface RoomState {
  sessionId: string
  roomCode: string
  adminSocketId: string
  status: 'waiting' | 'active' | 'paused' | 'ended'
  currentQuestionIdx: number
  questionStartTime: number | null
  answerLocked: boolean
  timerInterval: ReturnType<typeof setInterval> | null
  participants: Map<
    string,
    {
      nickname: string
      socketId: string
      score: number
      hasAnswered: boolean
    }
  >
  responseCounts: Map<string, number>
}

export const rooms = new Map<string, RoomState>()

