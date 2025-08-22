#!/usr/bin/env node

/**
 * MarFi Dashboard - Package for Download Script
 * This script creates a downloadable package of the MarFi Dashboard
 */

const fs = require("fs");
const path = require("path");

console.log("📦 Creating MarFi Dashboard package...");

// Create package directory
const packageDir = "marfi-dashboard-package";
const clientDir = path.join(packageDir, "client");
const clientPagesDir = path.join(clientDir, "pages");

// Create directories
[packageDir, clientDir, clientPagesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy essential files
const filesToCopy = [
  { src: "package.json", dest: path.join(packageDir, "package.json") },
  { src: "vite.config.ts", dest: path.join(packageDir, "vite.config.ts") },
  {
    src: "tailwind.config.ts",
    dest: path.join(packageDir, "tailwind.config.ts"),
  },
  { src: "tsconfig.json", dest: path.join(packageDir, "tsconfig.json") },
  { src: "client/global.css", dest: path.join(clientDir, "global.css") },
  {
    src: "client/pages/Index.tsx",
    dest: path.join(clientPagesDir, "Index.tsx"),
  },
  { src: "README.md", dest: path.join(packageDir, "README.md") },
];

console.log("📋 Copying files...");
filesToCopy.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ ${src} → ${dest}`);
  } else {
    console.log(`⚠️  ${src} not found, skipping...`);
  }
});

// Create additional required files for standalone operation
console.log("🔧 Creating additional files...");

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

// Create src directory and main.tsx
const srcDir = path.join(packageDir, "src");
fs.mkdirSync(srcDir, { recursive: true });

const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import Index from '../client/pages/Index'
import '../client/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Index />
  </React.StrictMode>,
)`;

fs.writeFileSync(path.join(srcDir, "main.tsx"), mainTsx);
console.log("✅ Created src/main.tsx");

// Create simplified vite config for standalone
const simpleViteConfig = `import { defineConfig } from "vite";
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

fs.writeFileSync(path.join(packageDir, "vite.config.ts"), simpleViteConfig);
console.log("✅ Updated vite.config.ts for standalone operation");

// Create simplified package.json for standalone
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

// Remove unnecessary dependencies and scripts
const simplifiedPackageJson = {
  name: "marfi-dashboard",
  private: true,
  version: "1.0.0",
  type: "module",
  scripts: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    typecheck: "tsc",
  },
  dependencies: {
    react: packageJson.devDependencies.react,
    "react-dom": packageJson.devDependencies["react-dom"],
    "lucide-react": packageJson.devDependencies["lucide-react"],
  },
  devDependencies: {
    "@types/react": packageJson.devDependencies["@types/react"],
    "@types/react-dom": packageJson.devDependencies["@types/react-dom"],
    "@vitejs/plugin-react-swc":
      packageJson.devDependencies["@vitejs/plugin-react-swc"],
    autoprefixer: packageJson.devDependencies.autoprefixer,
    postcss: packageJson.devDependencies.postcss,
    tailwindcss: packageJson.devDependencies.tailwindcss,
    "tailwindcss-animate": packageJson.devDependencies["tailwindcss-animate"],
    typescript: packageJson.devDependencies.typescript,
    vite: packageJson.devDependencies.vite,
  },
};

fs.writeFileSync(
  path.join(packageDir, "package.json"),
  JSON.stringify(simplifiedPackageJson, null, 2),
);
console.log("✅ Updated package.json for standalone operation");

// Create PostCSS config
const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

fs.writeFileSync(path.join(packageDir, "postcss.config.js"), postcssConfig);
console.log("✅ Created postcss.config.js");

// Update TailwindCSS config for new structure
const tailwindConfig = `import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./client/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;`;

fs.writeFileSync(path.join(packageDir, "tailwind.config.ts"), tailwindConfig);
console.log("✅ Updated tailwind.config.ts");

// Create TypeScript config for standalone
const tsConfig = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false,
    "noFallthroughCasesInSwitch": false,
    "strictNullChecks": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./client/*"]
    }
  },
  "include": [
    "src/**/*",
    "client/**/*",
    "vite.config.ts"
  ],
  "exclude": ["node_modules", "dist"]
}`;

fs.writeFileSync(path.join(packageDir, "tsconfig.json"), tsConfig);
console.log("✅ Updated tsconfig.json");

console.log(`
🎉 MarFi Dashboard package created successfully!

📁 Package location: ${packageDir}/

🚀 To run the application:
   1. Navigate to the package directory: cd ${packageDir}
   2. Install dependencies: npm install
   3. Start development server: npm run dev
   4. Open http://localhost:5173 in your browser

📦 To build for production:
   npm run build

The built files will be in the dist/ directory and can be deployed to any static hosting service.

Happy coding! 🎯
`);
