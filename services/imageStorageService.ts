import { httpsCallable } from 'firebase/functions';
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { functions as appFunctions, storage } from '../firebase.config';

type PersistImageOptions = {
  imageValue?: string | null;
  path: string;
};

const DATA_URL_PREFIX = 'data:image/';
const DEFAULT_CACHE_CONTROL = 'public,max-age=31536000,immutable';
export const MAX_INLINE_SAVED_IMAGE_LENGTH = 700000;
export const DEFAULT_INLINE_IMAGE_TARGET_LENGTH = 680000;

type RelayPersistImagePayload = {
  path: string;
  dataUrl: string;
  cacheControl?: string;
};

type RelayPersistImageResult = {
  url: string;
};

export const isImageDataUrl = (value?: string | null): value is string =>
  typeof value === 'string' && value.startsWith(DATA_URL_PREFIX);

export const resolveInlineImageValue = (
  imageValue?: string | null,
  oversizeMessage = 'Image is too large to save right now. Please crop it smaller and try again.'
): string => {
  const normalizedValue = typeof imageValue === 'string' ? imageValue.trim() : '';
  if (!normalizedValue) {
    return '';
  }
  if (!isImageDataUrl(normalizedValue)) {
    return normalizedValue;
  }
  if (normalizedValue.length > MAX_INLINE_SAVED_IMAGE_LENGTH) {
    throw new Error(oversizeMessage);
  }
  return normalizedValue;
};

type CompressInlineImageOptions = {
  maxLength?: number;
  processingErrorMessage?: string;
  oversizeErrorMessage?: string;
};

export const compressImageForInlineSave = async (
  imageValue: string,
  options?: CompressInlineImageOptions
): Promise<string> => {
  const normalizedValue = typeof imageValue === 'string' ? imageValue.trim() : '';
  const maxLength = options?.maxLength ?? DEFAULT_INLINE_IMAGE_TARGET_LENGTH;
  const processingErrorMessage = options?.processingErrorMessage || 'Failed to process image.';
  const oversizeErrorMessage = options?.oversizeErrorMessage || 'Image is still too large after auto-compression. Please crop a smaller area and try again.';

  if (!isImageDataUrl(normalizedValue) || normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(processingErrorMessage));
    img.src = normalizedValue;
  });

  let width = image.naturalWidth;
  let height = image.naturalHeight;
  let quality = 0.88;
  let output = normalizedValue;

  const render = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(processingErrorMessage);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  };

  for (let attempt = 0; attempt < 12; attempt++) {
    output = render();
    if (output.length <= maxLength) {
      return output;
    }

    if (quality > 0.46) {
      quality = Math.max(0.46, quality - 0.12);
      continue;
    }

    const longestSide = Math.max(width, height);
    if (longestSide <= 320) {
      break;
    }

    const scale = longestSide > 1600 ? 0.7 : longestSide > 1000 ? 0.8 : 0.85;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    quality = Math.max(0.4, quality - 0.04);
  }

  throw new Error(oversizeErrorMessage);
};

const isFirebaseStorageUrl = (value?: string | null): value is string =>
  typeof value === 'string' && /(^gs:\/\/)|firebasestorage\.googleapis\.com|storage\.googleapis\.com/i.test(value);

const getFileExtension = (imageValue: string): string => {
  const mimeMatch = imageValue.match(/^data:(image\/[a-zA-Z0-9.+-]+);/i);
  const mimeType = (mimeMatch?.[1] || 'image/jpeg').toLowerCase();
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'jpg';
  }
};

const tryDeleteExistingImage = async (imageUrl?: string | null): Promise<void> => {
  if (!isFirebaseStorageUrl(imageUrl)) return;

  try {
    await deleteObject(ref(storage, imageUrl));
  } catch (error: any) {
    const code = error?.code || '';
    if (code !== 'storage/object-not-found' && code !== 'storage/invalid-url') {
      console.warn('Failed to delete previous image from storage:', error);
    }
  }
};

const shouldAttemptDirectUploadFallback = (error: any): boolean => {
  const code = String(error?.code || '').toLowerCase();
  if (
    code.includes('permission-denied') ||
    code.includes('unauthenticated') ||
    code.includes('invalid-argument') ||
    code.includes('failed-precondition')
  ) {
    return false;
  }
  return true;
};

export const persistImageValue = async ({ imageValue, path }: PersistImageOptions): Promise<string> => {
  const normalizedValue = typeof imageValue === 'string' ? imageValue.trim() : '';

  if (!normalizedValue) {
    return '';
  }

  if (!isImageDataUrl(normalizedValue)) {
    return normalizedValue;
  }

  try {
    const relayPersistImage = httpsCallable<RelayPersistImagePayload, RelayPersistImageResult>(appFunctions, 'relayPersistImage');
    const response = await relayPersistImage({
      path,
      dataUrl: normalizedValue,
      cacheControl: DEFAULT_CACHE_CONTROL
    });
    const relayUrl = response.data?.url?.trim();
    if (relayUrl) {
      return relayUrl;
    }
    throw new Error('relayPersistImage returned an empty URL');
  } catch (relayError: any) {
    if (!shouldAttemptDirectUploadFallback(relayError)) {
      throw new Error(
        relayError?.message ||
        'Image upload is not permitted for the current church context'
      );
    }

    const extension = getFileExtension(normalizedValue);
    const imageRef = ref(storage, `${path}/${Date.now()}.${extension}`);

    try {
      await uploadString(imageRef, normalizedValue, 'data_url', {
        cacheControl: DEFAULT_CACHE_CONTROL
      });

      return getDownloadURL(imageRef);
    } catch (directError: any) {
      console.error('Callable relay and direct image upload both failed:', {
        relayError,
        directError
      });
      throw new Error(
        relayError?.message ||
        directError?.message ||
        'Image upload failed'
      );
    }
  }
};

export const cleanupStoredImage = async (imageUrl?: string | null): Promise<void> => {
  await tryDeleteExistingImage(imageUrl);
};