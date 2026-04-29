import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebase.config';

export interface MediaUploadResult {
  url: string;
  storagePath: string;
  size: number;
  contentType: string;
}

interface UploadMediaOptions {
  file: Blob;
  storagePath: string;
  contentType?: string;
  cacheControl?: string;
  customMetadata?: Record<string, string>;
}

const DATA_URL_PATTERN = /^data:([^;,]+)?(;base64)?,(.*)$/;

export const isDataUrl = (value?: string | null): value is string =>
  typeof value === 'string' && value.startsWith('data:');

export const isBlobUrl = (value?: string | null): value is string =>
  typeof value === 'string' && value.startsWith('blob:');

export const getDataUrlContentType = (dataUrl: string): string => {
  const match = dataUrl.match(DATA_URL_PATTERN);
  return match?.[1] || 'application/octet-stream';
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error('Selected file format is invalid.');
  }

  const contentType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: contentType });
  }

  return new Blob([decodeURIComponent(payload)], { type: contentType });
};

export const sanitizeStorageFileName = (fileName: string): string => {
  const cleaned = (fileName || 'upload')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'upload';
};

export const extensionFromContentType = (contentType?: string | null): string => {
  const normalized = (contentType || '').toLowerCase();
  if (normalized.includes('pdf')) return 'pdf';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  return 'bin';
};

export const ensureFileExtension = (fileName: string, contentType?: string | null): string => {
  const sanitized = sanitizeStorageFileName(fileName);
  if (/\.[a-z0-9]{2,8}$/i.test(sanitized)) {
    return sanitized;
  }
  return `${sanitized}.${extensionFromContentType(contentType)}`;
};

export const uploadMediaToStorage = async ({
  file,
  storagePath,
  contentType,
  cacheControl = 'private,max-age=604800',
  customMetadata
}: UploadMediaOptions): Promise<MediaUploadResult> => {
  const storageRef = ref(storage, storagePath);
  const resolvedContentType = contentType || file.type || 'application/octet-stream';

  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: resolvedContentType,
    cacheControl,
    customMetadata
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on('state_changed', undefined, reject, () => resolve());
  });

  const url = await getDownloadURL(storageRef);

  return {
    url,
    storagePath,
    size: file.size,
    contentType: resolvedContentType
  };
};

export const isFirebaseStorageUrl = (value?: string | null): value is string =>
  typeof value === 'string' && /(^gs:\/\/)|firebasestorage\.googleapis\.com|storage\.googleapis\.com/i.test(value);

export const isStoragePath = (value?: string | null): value is string =>
  typeof value === 'string' && Boolean(value.trim()) && !/^(https?:|data:|blob:)/i.test(value);

export const deleteStorageObjectIfExists = async (storageReference?: string | null): Promise<void> => {
  const normalizedReference = typeof storageReference === 'string' ? storageReference.trim() : '';
  if (!normalizedReference || (!isFirebaseStorageUrl(normalizedReference) && !isStoragePath(normalizedReference))) {
    return;
  }

  try {
    await deleteObject(ref(storage, normalizedReference));
  } catch (error: any) {
    const code = error?.code || '';
    if (code !== 'storage/object-not-found' && code !== 'storage/invalid-url') {
      console.warn('Failed to delete stored media:', error);
    }
  }
};