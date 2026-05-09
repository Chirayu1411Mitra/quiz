@echo off
setlocal
echo ==========================================
echo   QuizLive - Starting Services
echo ==========================================

if not exist "node_modules" (
    echo [1/3] Installing dependencies...
    call npm install
) else (
    echo [1/3] Dependencies already installed.
)

echo [2/3] Setting up SQLite database...
cd server
call npx prisma generate
call npx prisma migrate dev --name init
cd ..

echo [3/3] Starting development servers...
echo Server: http://localhost:4000
echo Client: http://localhost:5173
echo.
call npm run dev

pause
