#!/usr/bin/env node

/**
 * Church Connect Mobile - Deployment Setup Script
 * This script helps prepare your app for Median.co deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🏗️  Church Connect Mobile - Deployment Setup');
console.log('===============================================\n');

// Check if required files exist
const requiredFiles = [
  'median.json',
  'public/manifest.json',
  'public/icon-192.svg',
  'public/icon-512.svg',
  'generate-app-icons.html'
];

console.log('📋 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing. Please run the setup again.');
  process.exit(1);
}

console.log('\n✅ All required files are present!');

// Check package.json scripts
console.log('\n📋 Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredScripts = ['build:mobile', 'serve'];
requiredScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    console.log(`✅ ${script} script available`);
  } else {
    console.log(`❌ ${script} script missing`);
  }
});

// Display next steps
console.log('\n🚀 Next Steps:');
console.log('==============');
console.log('1. Build your app: npm run build:mobile');
console.log('2. Test locally: npm run serve');
console.log('3. Generate icons: Open generate-app-icons.html in browser');
console.log('4. Deploy to hosting (Vercel/Netlify/GitHub Pages)');
console.log('5. Create Median.co app with your hosted URL');
console.log('6. Upload median.json configuration');
console.log('7. Upload app icons');
console.log('8. Build and download APK');
console.log('\n📖 See DEPLOYMENT_GUIDE.md for detailed instructions');

// Display configuration summary
console.log('\n⚙️  Configuration Summary:');
console.log('=========================');
console.log(`App Name: ${packageJson.name}`);
console.log(`Version: ${packageJson.version}`);
console.log(`Description: ${packageJson.description || 'N/A'}`);

const medianConfig = JSON.parse(fs.readFileSync('median.json', 'utf8'));
console.log(`Android Package: ${medianConfig.androidCustomizations.applicationId}`);
console.log(`iOS Bundle ID: ${medianConfig.iosCustomizations.bundleId}`);

console.log('\n🎉 Your app is ready for Median.co deployment!');
console.log('📱 Follow the deployment guide to create your APK.');
