// Simple Node.js script to run database setup
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Setting up database...');
  const setupScript = path.join(__dirname, 'server', 'scripts', 'setup-database.ts');
  execSync(`npx ts-node ${setupScript}`, { stdio: 'inherit' });
  console.log('Database setup completed!');
} catch (error) {
  console.error('Database setup failed:', error.message);
  process.exit(1);
}
