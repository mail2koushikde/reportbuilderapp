#!/bin/bash

echo "📦 Creating MarFi Dashboard package..."

# Create zip file
zip -r marfi-dashboard.zip marfi-dashboard-package/

echo "✅ Package created: marfi-dashboard.zip"
echo ""
echo "📋 To use this package:"
echo "1. Download marfi-dashboard.zip"
echo "2. Extract the zip file"
echo "3. Follow instructions in SETUP.md"
echo ""
echo "🚀 Quick start commands:"
echo "   cd marfi-dashboard-package"
echo "   npm install"
echo "   npm run dev"
