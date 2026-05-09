# QuizLive - Quick Start Guide

## 📋 Prerequisites

- Node.js 18+ (https://nodejs.org)
- PostgreSQL 12+ (https://www.postgresql.org)
- npm or yarn

## 🚀 Installation & Setup

### Step 1: Install Dependencies
```bash
cd d:\quiz
npm install
```

This installs dependencies for the root workspace, client, and server.

### Step 2: Set Up PostgreSQL Database

**Option A: Local PostgreSQL**
```bash
# Create a new database
createdb quizlive

# Note the connection string: postgresql://user:password@localhost:5432/quizlive
```

**Option B: Cloud PostgreSQL (Railway/Supabase/Vercel)**
```
Get your connection string and save it for step 3
```

### Step 3: Configure Environment

**Server (.env already configured)**
- Edit `server/.env` if using cloud database:
  ```
  DATABASE_URL=postgresql://user:password@host:5432/quizlive
  JWT_SECRET=change-this-to-a-secure-random-string
  ```

**Client**
- `client/.env` is already configured for local development

### Step 4: Initialize Database

```bash
cd server
npx prisma migrate dev --name init
cd ..
```

This will:
- Create the database schema
- Generate Prisma client
- Run migrations

### Step 5: Start Development Servers

From the root directory:
```bash
npm run dev
```

This starts both servers concurrently:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:4000

Or start them separately:
```bash
# Terminal 1
npm run dev -w server

# Terminal 2
npm run dev -w client
```

## 🎯 Usage

### Create Your First Quiz (as Admin)

1. **Go to Admin Login**: http://localhost:5173/admin/login
2. **Create Account**: 
   - Email: admin@example.com
   - Password: password123
   - Name: Your Name
3. **Create Quiz**: Click "Create New Quiz"
4. **Add Questions**: 
   - Click "Add Question"
   - Fill in question text
   - Choose type (MCQ, True/False, etc.)
   - Add options for MCQ
   - Set time limit and points
   - Click "Save Question"
5. **Launch Quiz**: Back to dashboard, click "Launch" on your quiz
   - Get the room code (6 characters)
   - Share with participants!

### Join a Quiz (as Participant)

1. **Go to Join Page**: http://localhost:5173
2. **Enter Details**:
   - Room Code: (6-character code from admin)
   - Nickname: Your name
3. **Click "Join Quiz"**
4. **Wait for host to start**
5. **Answer questions as they appear!**
6. **View results and leaderboard**

### Admin Session Control

When a quiz is launched:
1. **Session Control Panel** shows:
   - Real-time participant list (green dot = answered)
   - Live response chart (updating as answers come in)
   - Question timer countdown
   - Control buttons:
     - **Next Question**: Move to next question
     - **Lock Answers**: Stop accepting answers
     - **Show Results**: Reveal correct answer
     - **End Session**: Finish the quiz

2. **View Leaderboard**: Shows top participants and their scores

3. **Live Scoring**:
   - Correct + fast = more points
   - Wrong answer = 0 points
   - Points decay based on time taken

## 📚 Key Features

### For Admins
✓ Create unlimited quizzes
✓ Multiple question types (MCQ, True/False, Short Text, Poll)
✓ Configurable time limits per question
✓ Real-time session control
✓ Live participant monitoring
✓ Answer distribution charts
✓ Leaderboard updates

### For Participants
✓ No app installation - just a browser
✓ Simple room code join
✓ Real-time question delivery
✓ Server-synced timer (prevents cheating)
✓ Instant feedback on answers
✓ Live ranking updates
✓ Mobile-friendly UI

## 🔐 Security Notes

- Change `JWT_SECRET` in production
- Use HTTPS in production
- Keep database credentials secure
- Use environment variables, never hardcode secrets
- Set `CLIENT_URL` to your frontend domain

## 📊 Database

The app uses Prisma ORM with these key tables:
- **Admin**: Quiz creators
- **Quiz**: Quiz collections
- **Question**: Individual questions
- **Session**: Live quiz instances
- **Participant**: Quiz participants
- **Response**: Answers submitted

View/modify schema: `server/prisma/schema.prisma`

## 🐛 Troubleshooting

### "PostgreSQL connection failed"
```
✓ Ensure PostgreSQL is running
✓ Check DATABASE_URL in server/.env
✓ Verify database name is correct
✓ Check username/password
```

### "Port 4000 already in use"
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:4000 | xargs kill -9
```

### "Socket.IO connection failed"
```
✓ Ensure backend is running (npm run dev -w server)
✓ Check CLIENT_URL in server/.env matches frontend URL
✓ Check VITE_SERVER_URL in client/.env matches backend URL
```

### Database migrations error
```bash
cd server
npx prisma migrate reset  # ⚠️ Deletes all data
npx prisma db push        # Forces schema sync
```

## 📝 File Structure

```
quiz/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── pages/            # Page components
│   │   │   ├── JoinPage.tsx
│   │   │   ├── WaitingRoom.tsx
│   │   │   ├── ParticipantQuestion.tsx
│   │   │   ├── AdminLogin.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── QuizBuilder.tsx
│   │   │   └── SessionControl.tsx
│   │   ├── components/        # Reusable components
│   │   ├── context/          # React Context
│   │   ├── App.tsx           # Main App
│   │   └── main.tsx          # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── server/                    # Node.js Backend
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   │   ├── auth.ts
│   │   │   ├── quiz.ts
│   │   │   └── session.ts
│   │   ├── socket/           # WebSocket handlers
│   │   │   └── handlers.ts
│   │   ├── prisma/           # Database
│   │   │   └── schema.prisma
│   │   └── index.ts          # Server entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env
│   └── .env.example
│
├── package.json              # Workspace root
├── README.md
└── QUICKSTART.md            # This file
```

## 🎓 Building a Quiz

### Question Types

**MCQ (Multiple Choice)**
- Create A, B, C, D options
- Mark one as correct
- Award points for correct answers

**True/False**
- Auto-generates 2 options
- Same scoring as MCQ

**Short Text**
- Free text answer
- Requires manual admin review or keyword matching

**Poll**
- Like MCQ but no correct answer
- Shows distribution, no scoring

### Best Practices

1. **Time Limits**: 20-60 seconds per question
2. **Points**: 100-1000 points per question
3. **Options**: Keep text concise (avoid paragraphs)
4. **Questions**: 5-20 questions per quiz
5. **Clarity**: Make questions unambiguous

## 📱 Mobile Testing

Test on mobile devices:
```bash
# Find your machine's local IP
ipconfig getifaddr en0          # macOS
hostname -I                      # Linux
ipconfig                        # Windows (look for IPv4)

# Then visit: http://<YOUR_IP>:5173
```

## 🚢 Deployment

### Deploy to Railway

```bash
# 1. Create Railway account (railway.app)
# 2. Connect your GitHub repo
# 3. Add PostgreSQL addon
# 4. Set environment variables:
#    DATABASE_URL (auto-set by Railway)
#    JWT_SECRET
#    CLIENT_URL (your deployed frontend URL)
# 5. Deploy!
```

### Deploy to Vercel (Frontend)

```bash
npm run build -w client
# Deploy the client/dist folder to Vercel
```

## 💡 Tips & Tricks

- Use **live preview** to see results updating in real-time
- **Lock answers** to control pacing (prevents early submissions)
- **Refresh leaderboard** frequently to keep engagement high
- Use **short room codes** for in-person events
- Test on **mobile** before hosting events
- Have a **backup quiz** ready in case of issues

## 📞 Support & Community

- Check README.md for detailed documentation
- Look at design doc for feature specifications
- Review component code for implementation details

## ✨ Next Steps

1. Create your first quiz
2. Test with a friend as participant
3. Customize styling in `client/tailwind.config.ts`
4. Explore Socket.IO events in `server/src/socket/handlers.ts`
5. Deploy to the cloud!

Happy quizzing! 🎉
