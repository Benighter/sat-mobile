import { httpsCallable } from 'firebase/functions';
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { functions as appFunctions, storage } from '../firebase.config';

type PersistImageOptions = {
  imageValue?: string | null;
  path: string;
};

const DATA_URL_PREFIX = 'data:image/';
const DEFAULT_CACHE_CONTROL = 'public,max-age=31536000,immutable';

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