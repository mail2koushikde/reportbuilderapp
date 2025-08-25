#!/bin/bash

echo "🚀 Starting Flask API for Snowflake import..."

# Check if we're in the right directory
if [ ! -d "api" ]; then
    echo "❌ Error: 'api' directory not found. Are you in the project root?"
    exit 1
fi

# Navigate to api directory
cd api

# Check if requirements.txt exists
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: requirements.txt not found in api directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Check if start.py exists
if [ ! -f "start.py" ]; then
    echo "❌ Error: start.py not found in api directory"
    exit 1
fi

# Start the Flask API
echo "🐍 Starting Flask server on port 5000..."
echo "✨ API will be available at: http://localhost:5000"
echo "🧪 Test mode is enabled by default (no Snowflake credentials needed)"
echo "📡 Health check: http://localhost:5000/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================================"

python start.py
