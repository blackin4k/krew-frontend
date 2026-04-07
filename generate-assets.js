# generate-assets.js
// Run with: node generate-assets.js
// Requires: npm install -D @capacitor/assets
//
// Place YOUR brand images here first:
//   public/assets/icon.png    → 1024x1024px PNG (your app icon)
//   public/assets/splash.png  → 2732x2732px PNG (centered logo on dark bg)
//
// Then run:
//   npx capacitor-assets generate --android

import { execSync } from 'child_process';
import fs from 'fs';

const iconPath = 'public/assets/icon.png';
const splashPath = 'public/assets/splash.png';

if (!fs.existsSync(iconPath) || !fs.existsSync(splashPath)) {
  console.error('❌ Missing source images!');
  console.error('   → Place public/assets/icon.png (1024x1024)');
  console.error('   → Place public/assets/splash.png (2732x2732)');
  process.exit(1);
}

console.log('✅ Source images found. Generating Android assets...');
execSync('npx capacitor-assets generate --android', { stdio: 'inherit' });
console.log('✅ Done! Run: npm run build && npx cap sync android');
