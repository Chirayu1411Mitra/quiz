# QuizLive - Real-time Interactive Quiz Platform

A modern, real-time interactive quiz platform inspired by Mentimeter and Slido. Built with React, Node.js, Socket.IO, and PostgreSQL.

## Features

- **Real-time quizzes**: No app installation required - participants join via browser with a room code
- **Admin control**: Full session control panel with live participant view
- **Live results**: Real-time answer distribution charts and leaderboards
- **Mobile-friendly**: Works seamlessly on mobile, tablet, and desktop
- **Speed-based scoring**: Kahoot-style points based on correctness and speed
- **Multiple question types**: MCQ, True/False, Short Text, and Poll questions

## Tech Stack

### Frontend
- **React** 18 with TypeScript
- **Vite** for blazing-fast HMR
- **Tailwind CSS** for responsive styling
- **Socket.IO Client** for real-time communication
- **Recharts** for live data visualization
- **Zustand** for state management

### Backend
- **Node.js** with Express
- **Socket.IO** for WebSocket communication
- **PostgreSQL** with Prisma ORM
- **JWT** for admin authentication
- **bcryptjs** for password hashing

## Project Structure

```
quizlive/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Main pages
│   │   ├── components/    # Reusable components
│   │   ├── context/       # React context
│   │   ├── App.tsx        # Main App component
│   │   └── main.tsx       # Entry point
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── server/                # Node.js backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── socket/        # Socket.IO handlers
│   │   ├── prisma/        # Database schema
│   │   └── index.ts       # Server entry point
│   ├── tsconfig.json
│   └── package.json
├── package.json          # Workspace root
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- (Optional) Railway account for deployment

### Local Setup

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   # Server
   cp server/.env.example server/.env
   # Update DATABASE_URL with your PostgreSQL connection string
   # Update JWT_SECRET with a secure key

   # Client
   cp client/.env.example client/.env
   ```

3. **Set up database**
   ```bash
   cd server
   npx prisma migrate dev --name init
   cd ..
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

   - Client: http://localhost:5173
   - Server: http://localhost:4000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create admin account
- `POST /api/auth/login` - Sign in as admin
- `GET /api/auth/me` - Get current admin (requires JWT)

### Quiz Management
- `GET /api/quizzes` - Get all quizzes for admin
- `POST /api/quizzes` - Create new quiz
- `GET /api/quizzes/:id` - Get quiz with questions
- `PUT /api/quizzes/:id` - Update quiz
- `DELETE /api/quizzes/:id` - Delete quiz
- `POST /api/quizzes/:id/questions` - Add question
- `PUT /api/quizzes/:id/questions/:qid` - Update question
- `DELETE /api/quizzes/:id/questions/:qid` - Delete question

### Sessions
- `GET /api/sessions/:roomCode` - Get session status
- `GET /api/sessions/:roomCode/results` - Get session results

## Real-Time Socket.IO Events

### Admin Events
- `admin:create_session` - Create a quiz session
- `admin:start_session` - Start quiz (allow participants)
- `admin:next_question` - Advance to next question
- `admin:lock_answers` - Lock answer submissions
- `admin:show_results` - Display correct answer
- `admin:show_leaderboard` - Show participant rankings
- `admin:end_session` - End quiz session
- `admin:kick_participant` - Remove a participant

### Participant Events
- `participant:join` - Join a session with nickname
- `participant:submit_answer` - Submit answer to current question
- `participant:rejoin` - Reconnect after disconnect

### Broadcast Events
- `session:question_start` - New question (to all participants)
- `session:timer_sync` - Timer update (every second)
- `session:answer_submitted_ack` - Answer acknowledgment (to submitter)
- `session:answers_locked` - Answers locked (to all)
- `session:results` - Show correct answer (to all)
- `session:leaderboard` - Leaderboard update (to all)
- `session:ended` - Session ended (to all)

## Usage

### As Admin

1. Visit http://localhost:5173/admin/login
2. Create an account or sign in
3. Create a new quiz
4. Add questions (MCQ, True/False, Short Text, or Poll)
5. Click "Launch" to start a session
6. Share the room code with participants
7. Control the session from the admin panel:
   - Advance questions
   - Lock answers
   - View live results
   - See leaderboards
   - End session

### As Participant

1. Visit http://localhost:5173
2. Enter the room code (6 characters)
3. Enter your nickname
4. Wait for host to start the quiz
5. Answer questions as they appear
6. View your score and ranking

## Scoring System

Points are calculated based on:
- **Correctness**: Correct answers earn points, wrong answers earn 0
- **Speed**: Points decay linearly based on time taken vs. time limit
- **Formula**: `points = maxPoints * (1.0 - (timeRatio * 0.5))`

## Database Schema

### Key Models
- **Admin**: Quiz creators and session hosts
- **Quiz**: Collection of questions
- **Question**: Individual quiz items (MCQ, True/False, etc.)
- **Session**: Live quiz instance with a room code
- **Participant**: Quiz participant in a session
- **Response**: Individual answer submitted by a participant

## Deployment

### Deploy to Railway

1. Create a Railway project
2. Add PostgreSQL addon
3. Connect GitHub repository
4. Set environment variables in Railway dashboard
5. Deploy will auto-build and run `npm start`

### Environment Variables (Production)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-very-secure-secret-key
PORT=4000
CLIENT_URL=https://your-client-url.com
NODE_ENV=production
```

## Security

- JWT authentication for admin endpoints
- Bcrypt password hashing (12 salt rounds)
- CORS configured for client URL only
- Room codes are randomly generated and unique
- Participant IDs are server-generated (not client-supplied)
- Server-side validation of all answers
- Rate limiting on join attempts
- Reconnection handling with socket ID updates

## Performance

- WebSocket communication for low-latency real-time updates
- In-memory room state for ultra-fast operations
- Database persistence for permanent records
- Timer synchronization from server (prevents cheating)
- Efficient broadcast events using Socket.IO rooms

## Future Enhancements

- QR code generation for room codes
- Session recording and replay
- CSV export of results
- Dark mode
- Custom themes
- Team-based scoring
- Advanced analytics
- Mobile app (React Native)

## License

MIT

## Support

For issues and feature requests, please open an issue on GitHub.
