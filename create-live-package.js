#!/usr/bin/env node

/**
 * MarFi Dashboard - Complete Live Package Creation Script
 * This script creates a downloadable package with all current live functionality
 */

const fs = require("fs");
const path = require("path");

console.log("📦 Creating MarFi Dashboard Complete Live Package...");

// Create package directory
const packageDir = "marfi-live-package";
const clientDir = path.join(packageDir, "client");
const componentsDir = path.join(clientDir, "components");
const uiDir = path.join(componentsDir, "ui");
const hooksDir = path.join(clientDir, "hooks");
const libDir = path.join(clientDir, "lib");
const pagesDir = path.join(clientDir, "pages");
const srcDir = path.join(packageDir, "src");

// Create all directories
[packageDir, clientDir, componentsDir, uiDir, hooksDir, libDir, pagesDir, srcDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log("✅ Created directory structure");

// Function to copy directory recursively
function copyDirectorySync(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  ${src} not found, skipping...`);
    return;
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Copy all client files
console.log("📋 Copying client files...");
copyDirectorySync("client/components", componentsDir);
copyDirectorySync("client/hooks", hooksDir);
copyDirectorySync("client/lib", libDir);
copyDirectorySync("client/pages", pagesDir);

// Copy specific files
const filesToCopy = [
  { src: "client/global.css", dest: path.join(clientDir, "global.css") },
  { src: "client/App.tsx", dest: path.join(clientDir, "App.tsx") },
  { src: "client/vite-env.d.ts", dest: path.join(clientDir, "vite-env.d.ts") },
  { src: "components.json", dest: path.join(packageDir, "components.json") },
  { src: "tailwind.config.ts", dest: path.join(packageDir, "tailwind.config.ts") },
  { src: "tsconfig.json", dest: path.join(packageDir, "tsconfig.json") },
];

filesToCopy.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ ${src} → ${dest}`);
  } else {
    console.log(`⚠️  ${src} not found, skipping...`);
  }
});

// Create package.json with all necessary dependencies
const packageJson = {
  "name": "marfi-dashboard-live",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.13.3",
    "lucide-react": "^0.468.0",
    "react-router-dom": "^6.28.0",
    "@tanstack/react-query": "^5.62.7",
    "@radix-ui/react-accordion": "^1.2.2",
    "@radix-ui/react-alert-dialog": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.2",
    "@radix-ui/react-checkbox": "^1.1.3",
    "@radix-ui/react-dialog": "^1.1.3",
    "@radix-ui/react-dropdown-menu": "^2.1.3",
    "@radix-ui/react-hover-card": "^1.1.3",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-menubar": "^1.1.3",
    "@radix-ui/react-navigation-menu": "^1.2.2",
    "@radix-ui/react-popover": "^1.1.3",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.2",
    "@radix-ui/react-scroll-area": "^1.2.1",
    "@radix-ui/react-select": "^2.1.3",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-sheet": "^1.1.2",
    "@radix-ui/react-slider": "^1.2.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.2",
    "@radix-ui/react-toast": "^1.2.3",
    "@radix-ui/react-toggle": "^1.1.2",
    "@radix-ui/react-toggle-group": "^1.1.2",
    "@radix-ui/react-tooltip": "^1.1.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react-swc": "^3.5.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "~5.6.2",
    "vite": "^6.0.1"
  }
};

fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify(packageJson, null, 2));
console.log("✅ Created package.json");

// Create index.html
const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MarFi Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

fs.writeFileSync(path.join(packageDir, "index.html"), indexHtml);
console.log("✅ Created index.html");

// Create main.tsx
const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../client/App'
import '../client/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;

fs.writeFileSync(path.join(srcDir, "main.tsx"), mainTsx);
console.log("✅ Created src/main.tsx");

// Create vite.config.ts
const viteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
});`;

fs.writeFileSync(path.join(packageDir, "vite.config.ts"), viteConfig);
console.log("✅ Created vite.config.ts");

// Create PostCSS config
const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

fs.writeFileSync(path.join(packageDir, "postcss.config.js"), postcssConfig);
console.log("✅ Created postcss.config.js");

// Create README
const readme = `# MarFi Dashboard Live

A comprehensive dashboard builder with interactive charts, drag-and-drop functionality, and advanced data visualization capabilities.

## Features

- **Interactive Dashboard Builder**: Create, customize, and manage multiple dashboard cards
- **Chart Types**: Bar charts, Mix bar charts, Pie charts, and Data tables
- **Drag & Drop**: Merge chart segments and rearrange elements
- **Responsive Design**: Intelligent scaling based on card size
- **Editable Elements**: Click-to-edit chart titles and legend items
- **Expandable Legends**: Full-height legend views with scrolling
- **Advanced Interactions**: Hover effects, tooltips, and visual feedback

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Open your browser:**
   Navigate to \`http://localhost:5173\`

## Building for Production

\`\`\`bash
npm run build
\`\`\`

The built files will be in the \`dist/\` directory.

## Project Structure

- \`client/components/\` - React components including the main BuildReport dashboard
- \`client/components/ui/\` - Reusable UI components (buttons, dialogs, etc.)
- \`client/hooks/\` - Custom React hooks
- \`client/lib/\` - Utility functions
- \`client/pages/\` - Page components

## Technologies Used

- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **Recharts** for chart components
- **Radix UI** for accessible UI primitives
- **Lucide React** for icons

## License

Private project - All rights reserved.
`;

fs.writeFileSync(path.join(packageDir, "README.md"), readme);
console.log("✅ Created README.md");

// Create setup instructions
const setupMd = `# Setup Instructions

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager

## Installation Steps

1. **Extract the package** to your desired location
2. **Navigate to the project directory:**
   \`\`\`bash
   cd marfi-live-package
   \`\`\`

3. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

4. **Start the development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Access the application:**
   Open your browser and go to \`http://localhost:5173\`

## Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build
- \`npm run typecheck\` - Run TypeScript type checking

## Troubleshooting

If you encounter any issues:

1. Make sure you have Node.js v18+ installed
2. Delete \`node_modules\` and \`package-lock.json\`, then run \`npm install\` again
3. Clear your browser cache
4. Check the browser console for any error messages

## Features Overview

The dashboard includes:

- **Dashboard Builder**: Add, remove, and configure dashboard cards
- **Chart Types**: Bar, Mix Bar, Pie charts, and Data tables
- **Interactive Elements**: Drag-and-drop merging, editable titles, expandable legends
- **Responsive Design**: Charts automatically adapt to card sizes
- **Sample Data**: Includes sample datasets for immediate testing

Enjoy building your dashboards! 🚀
`;

fs.writeFileSync(path.join(packageDir, "SETUP.md"), setupMd);
console.log("✅ Created SETUP.md");

console.log(`
🎉 MarFi Dashboard Complete Live Package created successfully!

📁 Package location: ${packageDir}/

🚀 To run the application:
   1. Navigate to the package directory: cd ${packageDir}
   2. Install dependencies: npm install
   3. Start development server: npm run dev
   4. Open http://localhost:5173 in your browser

📦 Package includes:
   ✅ Complete dashboard builder functionality
   ✅ All chart types (Bar, Mix Bar, Pie, Table)
   ✅ Drag & drop merging capabilities
   ✅ Editable titles and legends
   ✅ Responsive design and scaling
   ✅ Full UI component library
   ✅ All recent improvements and fixes

📋 Files included:
   ✅ Complete client-side application
   ✅ All React components and hooks
   ✅ UI component library
   ✅ Configuration files
   ✅ Documentation and setup instructions

Happy coding! 🎯
`);
