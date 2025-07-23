// Version management utilities for the SAT Mobile app

export interface VersionInfo {
  version: string;
  releaseDate: string;
  features: string[];
  improvements: string[];
  bugFixes: string[];
}

// Current version information
export const CURRENT_VERSION_INFO: VersionInfo = {
  version: '1.1.0',
  releaseDate: '2025-01-22',
  features: [
    'Member profile pictures - Add photos to member profiles',
    'Smart image cropping - Built-in image editor with preset sizes',
    'Enhanced member directory - Visual and organized member management'
  ],
  improvements: [
    'Better mobile experience for image uploads',
    'Touch-friendly cropping interface',
    'Faster image processing'
  ],
  bugFixes: [
    'Fixed image upload size validation',
    'Improved error handling for file uploads'
  ]
};

// Version history for reference
export const VERSION_HISTORY: VersionInfo[] = [
  CURRENT_VERSION_INFO,
  {
    version: '1.0.0',
    releaseDate: '2025-01-15',
    features: [
      'Initial release',
      'Member management system',
      'Bacenta organization',
      'Attendance tracking',
      'Firebase integration'
    ],
    improvements: [],
    bugFixes: []
  }
];

// Get version info by version string
export const getVersionInfo = (version: string): VersionInfo | undefined => {
  return VERSION_HISTORY.find(v => v.version === version);
};

// Check if a version is newer than another
export const isNewerVersion = (version1: string, version2: string): boolean => {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return true;
    if (v1Part < v2Part) return false;
  }
  
  return false;
};

// Format version for display
export const formatVersion = (version: string): string => {
  return `v${version}`;
};

// Get release notes for a version
export const getReleaseNotes = (version: string): string => {
  const versionInfo = getVersionInfo(version);
  if (!versionInfo) return '';
  
  let notes = `# Release Notes - ${formatVersion(version)}\n\n`;
  notes += `**Release Date:** ${versionInfo.releaseDate}\n\n`;
  
  if (versionInfo.features.length > 0) {
    notes += `## 🎉 New Features\n`;
    versionInfo.features.forEach(feature => {
      notes += `- ${feature}\n`;
    });
    notes += '\n';
  }
  
  if (versionInfo.improvements.length > 0) {
    notes += `## ⚡ Improvements\n`;
    versionInfo.improvements.forEach(improvement => {
      notes += `- ${improvement}\n`;
    });
    notes += '\n';
  }
  
  if (versionInfo.bugFixes.length > 0) {
    notes += `## 🐛 Bug Fixes\n`;
    versionInfo.bugFixes.forEach(fix => {
      notes += `- ${fix}\n`;
    });
    notes += '\n';
  }
  
  return notes;
};

// Utility to simulate version update (for testing)
export const simulateVersionUpdate = (newVersion: string): void => {
  localStorage.removeItem('sat_mobile_whats_new_shown');
  console.log(`Simulated version update to ${formatVersion(newVersion)}`);
  window.location.reload();
};
