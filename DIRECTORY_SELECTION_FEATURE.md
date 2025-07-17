# Directory Selection Feature for Excel Downloads

## Overview

This feature adds the ability to choose where Excel files are downloaded, especially useful for mobile devices where users may not know the default download location.

## Features Added

### 1. **Directory Selection UI**
- Added a "Save Location" section in the Excel Export Modal
- Shows current selected directory or default location
- "Choose Folder" button to select custom directory
- Only appears on supported platforms

### 2. **Cross-Platform File System Support**
- **Web (Modern Browsers)**: Uses File System Access API (`showDirectoryPicker`)
- **Mobile (Capacitor)**: Uses Capacitor Filesystem plugin with Documents directory
- **Fallback**: Traditional blob download for older browsers

### 3. **Enhanced Toast Notifications**
- Toasts now appear on the Export Modal screen (not dashboard)
- Shows the actual save location in success messages
- Better error handling with specific error messages

## Technical Implementation

### New Files Created
- `utils/fileSystemUtils.ts` - Cross-platform file system utilities

### Modified Files
- `components/ExcelExportModal.tsx` - Added directory selection UI
- `utils/advancedExcelExport.ts` - Updated to use new file system utility
- `utils/excelExport.ts` - Updated to use new file system utility
- `components/icons/index.tsx` - Added FolderIcon
- `capacitor.config.ts` - Added Filesystem plugin configuration

### Dependencies Added
- `@capacitor/filesystem` - For mobile file system access

## How It Works

### For Web Users (Modern Browsers)
1. Click "Choose Folder" button
2. Browser opens directory picker dialog
3. Select desired folder
4. Files are saved directly to selected folder

### For Mobile Users
1. Files are automatically saved to the device's Documents folder
2. Users can access files through their device's file manager
3. Location is clearly indicated in the UI

### For Older Browsers
1. Falls back to traditional download behavior
2. Files go to browser's default download folder

## User Experience Improvements

### Before
- Files downloaded to unknown location (especially on mobile)
- Success toast appeared on dashboard (not visible during export)
- No control over save location

### After
- Clear indication of where files will be saved
- Option to choose custom directory (on supported platforms)
- Success toast appears on export screen with save location
- Better error handling and user feedback

## Browser Support

### Full Support (Directory Selection)
- Chrome 86+
- Edge 86+
- Opera 72+

### Mobile Support
- All mobile devices via Capacitor Filesystem

### Fallback Support
- All other browsers (traditional download)

## Usage Instructions

### For Users
1. Open Excel Export Modal
2. Configure export options as usual
3. (Optional) Click "Choose Folder" to select custom save location
4. Click export button
5. File is saved to selected or default location
6. Success message shows exact save location

### For Developers
```typescript
// Check if directory selection is supported
if (canSelectDirectory()) {
  // Show directory selection UI
}

// Select directory
const directory = await selectDirectory();

// Save file to directory
const result = await saveFileToDirectory(
  directory,
  filename,
  data,
  mimeType
);
```

## Security Considerations

- File System Access API requires user gesture (button click)
- Only works in secure contexts (HTTPS)
- User must explicitly grant permission for each directory
- Capacitor Filesystem uses app-scoped directories

## Future Enhancements

- Remember last selected directory (with user permission)
- Support for additional file formats
- Batch export to multiple formats
- Cloud storage integration (Google Drive, OneDrive, etc.)

## Testing

### Web Testing
1. Use Chrome/Edge 86+ for full functionality
2. Test directory selection and file saving
3. Verify fallback behavior in older browsers

### Mobile Testing
1. Build and install APK
2. Test file saving to Documents folder
3. Verify files are accessible via file manager
4. Test toast notifications appear correctly

## Troubleshooting

### Common Issues
1. **Directory selection not working**: Check browser support and HTTPS
2. **Files not found on mobile**: Check Documents folder in file manager
3. **Permission errors**: Ensure proper Capacitor permissions are set

### Error Messages
- "Directory Selection Failed": Browser doesn't support File System Access API
- "Failed to save file to device": Capacitor Filesystem permission issue
- "Failed to save file using File System Access API": User denied permission or API error
