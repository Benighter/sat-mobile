import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from '../firebase.config';

type PersistImageOptions = {
  imageValue?: string | null;
  path: string;
};

const DATA_URL_PREFIX = 'data:image/';

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

export const persistImageValue = async ({ imageValue, path }: PersistImageOptions): Promise<string> => {
  const normalizedValue = typeof imageValue === 'string' ? imageValue.trim() : '';

  if (!normalizedValue) {
    return '';
  }

  if (!isImageDataUrl(normalizedValue)) {
    return normalizedValue;
  }

  const extension = getFileExtension(normalizedValue);
  const imageRef = ref(storage, `${path}/${Date.now()}.${extension}`);

  await uploadString(imageRef, normalizedValue, 'data_url', {
    cacheControl: 'public,max-age=31536000,immutable'
  });

  return getDownloadURL(imageRef);
};

export const cleanupStoredImage = async (imageUrl?: string | null): Promise<void> => {
  await tryDeleteExistingImage(imageUrl);
};