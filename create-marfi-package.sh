#!/bin/bash

echo "📦 Creating MarFi Complete Package..."

# Create the zip package
zip -r marfi-complete-package-v2.zip marfi-complete-package-v2/ -x "*.DS_Store" "*/node_modules/*" "*/dist/*" "*/.git/*"

echo "✅ Package created: marfi-complete-package-v2.zip"
echo ""
echo "📁 Package Contents:"
echo "  • Complete source code with all latest features"
echo "  • All chart types (Line, Column, Stacked Column, Pie, Scorecard, Table)"
echo "  • Rich text editing with selective coloring"
echo "  • Drag & drop functionality"
echo "  • Y-axis formatting options"
echo "  • Sample data (sample-data.csv)"
echo "  • Setup instructions (README.md, QUICK_START.md)"
echo ""
echo "🚀 To use on Mac:"
echo "  1. Extract marfi-complete-package-v2.zip"
echo "  2. cd marfi-complete-package-v2"
echo "  3. npm install"
echo "  4. npm run dev"
echo "  5. Open http://localhost:3000"
echo ""
echo "📊 Exact same functionality as the interactive interface!"
