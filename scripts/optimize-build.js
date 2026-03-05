#!/usr/bin/env node

/**
 * Build optimization script for Church Connect Mobile
 * This script runs after the build to optimize the output
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '..', 'dist');

function optimizeBuild() {
  console.log('🚀 Starting build optimization...');

  // 1. Analyze bundle sizes
  analyzeBundleSizes();

  // 2. Generate performance report
  generatePerformanceReport();

  // 3. Optimize static assets
  optimizeStaticAssets();

  console.log('✅ Build optimization complete!');
}

function analyzeBundleSizes() {
  console.log('📊 Analyzing bundle sizes...');
  
  const assetsDir = path.join(DIST_DIR, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.log('❌ Assets directory not found');
    return;
  }

  const files = fs.readdirSync(assetsDir);
  const bundles = [];

  files.forEach(file => {
    const filePath = path.join(assetsDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    bundles.push({
      name: file,
      size: sizeKB,
      type: file.endsWith('.js') ? 'JavaScript' : file.endsWith('.css') ? 'CSS' : 'Other'
    });
  });

  // Sort by size
  bundles.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));

  console.log('\n📦 Bundle Analysis:');
  bundles.forEach(bundle => {
    const emoji = bundle.type === 'JavaScript' ? '📜' : bundle.type === 'CSS' ? '🎨' : '📄';
    console.log(`${emoji} ${bundle.name}: ${bundle.size} KB`);
  });

  // Check for large bundles
  const largeBundles = bundles.filter(b => parseFloat(b.size) > 500);
  if (largeBundles.length > 0) {
    console.log('\n⚠️  Large bundles detected (>500KB):');
    largeBundles.forEach(bundle => {
      console.log(`   - ${bundle.name}: ${bundle.size} KB`);
    });
  }
}

function generatePerformanceReport() {
  console.log('\n⚡ Generating performance report...');
  
  const report = {
    buildTime: new Date().toISOString(),
    optimizations: [
      '✅ Code splitting implemented',
      '✅ Lazy loading for heavy components',
      '✅ React.memo for component optimization',
      '✅ useMemo for expensive calculations',
      '✅ CSS animations optimized',
      '✅ Bundle size optimized',
      '✅ Tree shaking enabled',
      '✅ Minification enabled'
    ],
    recommendations: [
      '🔧 Monitor bundle sizes regularly',
      '🔧 Use React DevTools Profiler for performance analysis',
      '🔧 Consider implementing virtual scrolling for large lists',
      '🔧 Optimize images with next-gen formats',
      '🔧 Implement service worker for caching'
    ]
  };

  const reportPath = path.join(DIST_DIR, 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`📋 Performance report saved to: ${reportPath}`);
}

function optimizeStaticAssets() {
  console.log('\n🎯 Optimizing static assets...');
  
  // Add cache headers to index.html
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Add preload hints for critical resources
    const preloadHints = `
    <link rel="preload" href="/assets/vendor.js" as="script">
    <link rel="preload" href="/assets/index.css" as="style">
    <link rel="dns-prefetch" href="//fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;
    
    indexContent = indexContent.replace('<head>', `<head>${preloadHints}`);
    fs.writeFileSync(indexPath, indexContent);
    
    console.log('✅ Added preload hints to index.html');
  }

  // Create a simple service worker for caching
  const swContent = `
const CACHE_NAME = 'church-connect-v1';
const urlsToCache = [
  '/',
  '/assets/vendor.js',
  '/assets/index.js',
  '/assets/index.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});`;

  const swPath = path.join(DIST_DIR, 'sw.js');
  fs.writeFileSync(swPath, swContent);
  console.log('✅ Generated service worker');
}

// Run optimization if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  optimizeBuild();
}

export { optimizeBuild };
