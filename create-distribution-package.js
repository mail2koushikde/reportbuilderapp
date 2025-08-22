#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageName = 'marfi-dashboard-complete';
const sourceDir = 'marfi-complete-package';
const outputDir = 'dist-packages';

console.log('📦 Creating MarFi Dashboard Distribution Package...\n');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get current timestamp for unique naming
const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
const zipName = `${packageName}-${timestamp}.zip`;

try {
  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Source directory '${sourceDir}' not found!`);
    process.exit(1);
  }

  console.log('📋 Package Contents:');
  console.log('  ✅ Complete React + TypeScript application');
  console.log('  ✅ All dependencies and configuration files');
  console.log('  ✅ Sample data and documentation');
  console.log('  ✅ Setup guides and troubleshooting');
  console.log('  ✅ Enhanced features: Apple branding, PDF export, intelligent layouts\n');

  // Create ZIP file
  const zipCommand = process.platform === 'win32' 
    ? `powershell Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${outputDir}\\${zipName}" -Force`
    : `cd "${sourceDir}" && zip -r "../${outputDir}/${zipName}" . -x "node_modules/*" "dist/*" ".git/*"`;

  console.log('🔄 Creating package...');
  execSync(zipCommand, { stdio: 'inherit' });

  // Get file size
  const stats = fs.statSync(path.join(outputDir, zipName));
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n✅ Package created successfully!');
  console.log(`📦 File: ${outputDir}/${zipName}`);
  console.log(`📏 Size: ${fileSizeInMB} MB`);
  
  console.log('\n📋 Package Includes:');
  console.log('  📁 Complete source code');
  console.log('  📄 Setup guides (SETUP_GUIDE.md, QUICK_START.md)');
  console.log('  🔧 Configuration files (package.json, vite.config.ts, etc.)');
  console.log('  🎨 Styling and assets');
  console.log('  📊 Sample data for testing');
  
  console.log('\n🚀 To use the package:');
  console.log(`  1. Extract ${zipName}`);
  console.log('  2. cd marfi-complete-package');
  console.log('  3. npm install');
  console.log('  4. npm run dev');
  console.log('  5. Open http://localhost:8080');

  console.log('\n📖 Documentation:');
  console.log('  📄 QUICK_START.md - 5-minute setup guide');
  console.log('  📄 SETUP_GUIDE.md - Complete installation guide');
  console.log('  📄 README.md - Feature overview');

} catch (error) {
  console.error('\n❌ Error creating package:', error.message);
  
  console.log('\n💡 Alternative manual packaging:');
  console.log('  1. Copy the marfi-complete-package folder');
  console.log('  2. Compress it to a ZIP file');
  console.log('  3. Share the ZIP file');
  
  process.exit(1);
}

console.log('\n🎉 Package ready for distribution!');
