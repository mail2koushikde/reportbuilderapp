#!/bin/bash

# Start development script for both frontend and API

echo "🚀 Starting development environment..."

# Function to cleanup background processes
cleanup() {
    echo "🧹 Cleaning up..."
    pkill -f "python.*start.py"
    pkill -f "npm.*dev"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start Flask API in background
echo "📡 Starting Flask API server..."
cd api
pip install -r requirements.txt > /dev/null 2>&1
python start.py &
API_PID=$!
cd ..

# Wait a moment for API to start
sleep 3

# Check if API started successfully
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Flask API started successfully on port 5000"
else
    echo "⚠️  Flask API may not have started correctly"
fi

# Start frontend development server
echo "🌐 Starting frontend development server..."
npm run dev &
FRONTEND_PID=$!

echo "🎉 Development environment ready!"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:5000"
echo "   Press Ctrl+C to stop both servers"

# Wait for both processes
wait $API_PID $FRONTEND_PID
