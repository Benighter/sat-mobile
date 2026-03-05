import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// Types for directory handles and file operations
export interface DirectoryHandle {
  type: 'web' | 'mobile' | 'fallback';
  handle?: FileSystemDirectoryHandle; // For web File System Access API
  path?: string; // For mobile/Capacitor
}

export interface FileSystemCapabilities {
  supportsDirectorySelection: boolean;
  supportsFileSystemAccess: boolean;
  isMobile: boolean;
  platform: string;
}

// Detect platform and capabilities
export const getFileSystemCapabilities = (): FileSystemCapabilities => {
  const isMobile = Capacitor.isNativePlatform();
  const supportsFileSystemAccess = 'showDirectoryPicker' in window && 'showSaveFilePicker' in window;
  
  return {
    supportsDirectorySelection: isMobile || supportsFileSystemAccess,
    supportsFileSystemAccess,
    isMobile,
    platform: Capacitor.getPlatform()
  };
};

// Select a directory for saving files
export const selectDirectory = async (): Promise<DirectoryHandle | null> => {
  const capabilities = getFileSystemCapabilities();
  
  try {
    if (capabilities.isMobile) {
      // For mobile, we'll use the Downloads directory by default
      // Users can change this in their device settings
      return {
        type: 'mobile',
        path: 'Downloads'
      };
    } else if (capabilities.supportsFileSystemAccess) {
      // Use File System Access API for modern browsers
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });
      
      return {
        type: 'web',
        handle: dirHandle
      };
    } else {
      // Fallback for older browsers - no directory selection
      return {
        type: 'fallback'
      };
    }
  } catch (error) {
    console.warn('Directory selection failed or was cancelled:', error);
    return null;
  }
};

// Save file to selected directory
export const saveFileToDirectory = async (
  directory: DirectoryHandle | null,
  filename: string,
  data: ArrayBuffer | Uint8Array | string,
  mimeType: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    if (!directory) {
      // Fallback to blob download
      return downloadFileBlob(filename, data, mimeType);
    }

    if (directory.type === 'mobile') {
      // Use Capacitor Filesystem for mobile
      return await saveFileCapacitor(filename, data, mimeType);
    } else if (directory.type === 'web' && directory.handle) {
      // Use File System Access API for web
      return await saveFileWebAPI(directory.handle, filename, data, mimeType);
    } else {
      // Fallback to blob download
      return downloadFileBlob(filename, data, mimeType);
    }
  } catch (error: any) {
    console.error('File save failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to save file'
    };
  }
};

// Save file using Capacitor Filesystem (mobile)
const saveFileCapacitor = async (
  filename: string,
  data: ArrayBuffer | Uint8Array | string,
  mimeType: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    let base64Data: string;
    
    if (typeof data === 'string') {
      base64Data = btoa(data);
    } else {
      // Convert ArrayBuffer/Uint8Array to base64
      const uint8Array = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
      base64Data = btoa(binaryString);
    }

    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents, // Use Documents directory for better accessibility
      encoding: Encoding.UTF8
    });

    return {
      success: true,
      path: result.uri
    };
  } catch (error: any) {
    console.error('Capacitor file save failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to save file to device'
    };
  }
};

// Save file using File System Access API (modern web browsers)
const saveFileWebAPI = async (
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  data: ArrayBuffer | Uint8Array | string,
  mimeType: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    
    if (typeof data === 'string') {
      await writable.write(data);
    } else {
      await writable.write(data);
    }
    
    await writable.close();
    
    return {
      success: true,
      path: `${dirHandle.name}/${filename}`
    };
  } catch (error: any) {
    console.error('File System Access API save failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to save file using File System Access API'
    };
  }
};

// Fallback blob download (traditional web download)
const downloadFileBlob = (
  filename: string,
  data: ArrayBuffer | Uint8Array | string,
  mimeType: string
): { success: boolean; path?: string; error?: string } => {
  try {
    let blob: Blob;
    
    if (typeof data === 'string') {
      blob = new Blob([data], { type: mimeType });
    } else {
      blob = new Blob([data], { type: mimeType });
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      path: 'Downloads (browser default)'
    };
  } catch (error: any) {
    console.error('Blob download failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to download file'
    };
  }
};

// Utility function to get user-friendly directory description
export const getDirectoryDescription = (directory: DirectoryHandle | null): string => {
  if (!directory) {
    return 'Browser default downloads folder';
  }
  
  switch (directory.type) {
    case 'mobile':
      return 'Device Documents folder';
    case 'web':
      return directory.handle?.name || 'Selected folder';
    case 'fallback':
      return 'Browser default downloads folder';
    default:
      return 'Default location';
  }
};

// Check if we can show directory selection UI
export const canSelectDirectory = (): boolean => {
  const capabilities = getFileSystemCapabilities();
  return capabilities.supportsDirectorySelection;
};
