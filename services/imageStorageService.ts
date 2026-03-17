import { deleteObject, ref } from 'firebase/storage';
import { storage } from '../firebase.config';

type PersistImageOptions = {
  imageValue?: string | null;
  path: string;
  maxLength?: number;
  processingErrorMessage?: string;
  oversizeErrorMessage?: string;
};

const DATA_URL_PREFIX = 'data:image/';
export const MAX_INLINE_SAVED_IMAGE_LENGTH = 700000;
export const DEFAULT_INLINE_IMAGE_TARGET_LENGTH = 680000;
export const DEFAULT_INLINE_IMAGE_COLLECTION_LENGTH = 780000;
export const MAX_INLINE_IMAGE_COLLECTION_LENGTH = 850000;

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

const compressLoadedImageForInlineSave = async (
  image: HTMLImageElement,
  options?: CompressInlineImageOptions
): Promise<string> => {
  const maxLength = options?.maxLength ?? DEFAULT_INLINE_IMAGE_TARGET_LENGTH;
  const processingErrorMessage = options?.processingErrorMessage || 'Failed to process image.';
  const oversizeErrorMessage = options?.oversizeErrorMessage || 'Image is still too large after auto-compression. Please crop a smaller area and try again.';

  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;
  let quality = 0.82;
  let output = '';
  let smallestOutput = '';

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

  for (let attempt = 0; attempt < 24; attempt += 1) {
    output = render();

    if (!smallestOutput || output.length < smallestOutput.length) {
      smallestOutput = output;
    }

    if (output.length <= maxLength) {
      return output;
    }

    const longestSide = Math.max(width, height);
    if (quality > 0.2) {
      quality = Math.max(0.2, quality - (longestSide > 1800 ? 0.12 : 0.08));
      continue;
    }

    if (longestSide <= 96) {
      break;
    }

    const scale = longestSide > 2400 ? 0.5 : longestSide > 1600 ? 0.6 : longestSide > 1000 ? 0.72 : 0.82;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    quality = Math.max(0.18, quality - 0.02);
  }

  if (smallestOutput && smallestOutput.length <= MAX_INLINE_SAVED_IMAGE_LENGTH) {
    return smallestOutput;
  }

  throw new Error(oversizeErrorMessage);
};

const loadImageElement = (src: string, processingErrorMessage: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(processingErrorMessage));
  image.src = src;
});

export const compressImageForInlineSave = async (
  imageValue: string,
  options?: CompressInlineImageOptions
): Promise<string> => {
  const normalizedValue = typeof imageValue === 'string' ? imageValue.trim() : '';
  const processingErrorMessage = options?.processingErrorMessage || 'Failed to process image.';
  const maxLength = options?.maxLength ?? DEFAULT_INLINE_IMAGE_TARGET_LENGTH;

  if (!isImageDataUrl(normalizedValue) || normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  const image = await loadImageElement(normalizedValue, processingErrorMessage);

  return compressLoadedImageForInlineSave(image, options);
};

export const compressImageFileForInlineSave = async (
  file: File,
  options?: CompressInlineImageOptions
): Promise<string> => {
  const processingErrorMessage = options?.processingErrorMessage || 'Failed to process image.';
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl, processingErrorMessage);
    return compressLoadedImageForInlineSave(image, options);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const isFirebaseStorageUrl = (value?: string | null): value is string =>
  typeof value === 'string' && /(^gs:\/\/)|firebasestorage\.googleapis\.com|storage\.googleapis\.com/i.test(value);

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

export const persistImageValue = async ({
  imageValue,
  path,
  maxLength,
  processingErrorMessage,
  oversizeErrorMessage
}: PersistImageOptions): Promise<string> => {
  const normalizedValue = typeof imageValue === 'string' ? imageValue.trim() : '';

  if (!normalizedValue) {
    return '';
  }

  if (!isImageDataUrl(normalizedValue)) {
    return normalizedValue;
  }

  void path;

  return resolveInlineImageValue(
    await compressImageForInlineSave(normalizedValue, {
      maxLength: maxLength ?? DEFAULT_INLINE_IMAGE_TARGET_LENGTH,
      processingErrorMessage: processingErrorMessage || 'Failed to process image.',
      oversizeErrorMessage: oversizeErrorMessage || 'Image is still too large after compression. Please crop a smaller area and try again.'
    }),
    oversizeErrorMessage || 'Image is too large to save right now. Please crop it smaller and try again.'
  );
};

export const cleanupStoredImage = async (imageUrl?: string | null): Promise<void> => {
  await tryDeleteExistingImage(imageUrl);
};