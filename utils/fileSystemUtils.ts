import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const BASE64_CHUNK_SIZE = 0x8000;

type DownloadsSaverProgressEvent = {
  filename?: string;
  percent?: number;
  bytesWritten?: number;
  totalBytes?: number;
  stage?: string;
};

type DownloadsSaverResult = {
  uri?: string;
  path?: string;
};

type DownloadsSaverPlugin = {
  saveToDownloads(options: {
    filename: string;
    base64Data: string;
    mimeType: string;
  }): Promise<DownloadsSaverResult>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: DownloadsSaverProgressEvent) => void
  ): Promise<{ remove: () => Promise<void> }>;
};

const DownloadsSaver = registerPlugin<DownloadsSaverPlugin>('DownloadsSaver');

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

export interface FileSaveProgress {
  percent: number;
  stage: 'preparing' | 'saving' | 'completed';
  message: string;
}

// Detect platform and capabilities
export const getFileSystemCapabilities = (): FileSystemCapabilities => {
  const isMobile = Capacitor.isNativePlatform();
  const supportsFileSystemAccess = 'showDirectoryPicker' in window && 'showSaveFilePicker' in window;
  
  return {
    supportsDirectorySelection: supportsFileSystemAccess,
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
  mimeType: string,
  onProgress?: (progress: FileSaveProgress) => void
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    if (!directory) {
      if (Capacitor.isNativePlatform()) {
        return await saveFileCapacitor(filename, data, mimeType, onProgress);
      }

      return downloadFileBlob(filename, data, mimeType);
    }

    if (directory.type === 'mobile') {
      // Use Capacitor Filesystem for mobile
      return await saveFileCapacitor(filename, data, mimeType, onProgress);
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
  mimeType: string,
  onProgress?: (progress: FileSaveProgress) => void
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    onProgress?.({
      percent: 15,
      stage: 'preparing',
      message: 'Preparing file save...'
    });

    if (Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('DownloadsSaver')) {
      return await saveFileAndroidDownloads(filename, data, mimeType, onProgress);
    }

    if (Capacitor.getPlatform() === 'android') {
      const permissionStatus = await Filesystem.checkPermissions();

      if (permissionStatus.publicStorage !== 'granted') {
        const requestedStatus = await Filesystem.requestPermissions();

        if (requestedStatus.publicStorage !== 'granted') {
          return {
            success: false,
            error: 'Storage permission is required to save exported files on Android.'
          };
        }
      }
    }

    const writeOptions = typeof data === 'string' && isTextMimeType(mimeType)
      ? {
          path: filename,
          data,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        }
      : {
          path: filename,
          data: toBase64(data),
          directory: Directory.Documents,
          recursive: true
        };

    const result = await Filesystem.writeFile(writeOptions);

    onProgress?.({
      percent: 100,
      stage: 'completed',
      message: 'File saved successfully.'
    });

    return {
      success: true,
      path: result.uri || `Documents/${filename}`
    };
  } catch (error: any) {
    console.error('Capacitor file save failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to save file to device'
    };
  }
};

const saveFileAndroidDownloads = async (
  filename: string,
  data: ArrayBuffer | Uint8Array | string,
  mimeType: string,
  onProgress?: (progress: FileSaveProgress) => void
): Promise<{ success: boolean; path?: string; error?: string }> => {
  const base64Data = typeof data === 'string' && isTextMimeType(mimeType)
    ? toBase64(new TextEncoder().encode(data))
    : toBase64(data);

  const listener = await DownloadsSaver.addListener('downloadProgress', event => {
    if (event.filename !== filename) {
      return;
    }

    const percent = Math.max(20, Math.min(99, Math.round(event.percent || 0)));
    onProgress?.({
      percent,
      stage: 'saving',
      message: percent >= 99 ? 'Finalizing download...' : `Saving to Downloads... ${percent}%`
    });
  });

  try {
    const result = await DownloadsSaver.saveToDownloads({
      filename,
      base64Data,
      mimeType
    });

    onProgress?.({
      percent: 100,
      stage: 'completed',
      message: 'Saved to Downloads.'
    });

    return {
      success: true,
      path: result.path || `Downloads/${filename}`
    };
  } catch (error: any) {
    console.error('Android Downloads save failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to save file to Downloads'
    };
  } finally {
    await listener.remove();
  }
};

const isTextMimeType = (mimeType: string): boolean => {
  return mimeType.startsWith('text/') || mimeType === 'application/json';
};

const toBase64 = (data: ArrayBuffer | Uint8Array | string): string => {
  if (typeof data === 'string') {
    return btoa(data);
  }

  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
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
    return Capacitor.getPlatform() === 'android'
      ? 'Device Downloads folder'
      : Capacitor.isNativePlatform()
        ? 'Device Documents folder'
        : 'Browser default downloads folder';
  }
  
  switch (directory.type) {
    case 'mobile':
      return Capacitor.getPlatform() === 'android' ? 'Device Downloads folder' : 'Device Documents folder';
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
