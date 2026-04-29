import { dataUrlToBlob, deleteStorageObjectIfExists, extensionFromContentType, isBlobUrl, uploadMediaToStorage } from './mediaStorageService';

type PersistImageOptions = {
  imageValue?: string | null;
  path: string;
  processingErrorMessage?: string;
  oversizeErrorMessage?: string;
};

const DATA_URL_PREFIX = 'data:image/';

export const isImageDataUrl = (value?: string | null): value is string =>
  typeof value === 'string' && value.startsWith(DATA_URL_PREFIX);

export const isUnsavedImageValue = (value?: string | null): value is string =>
  isImageDataUrl(value) || isBlobUrl(value);

const ensureImageStoragePath = (path: string, contentType: string): string => {
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '');
  if (!normalizedPath) {
    throw new Error('Image storage path is required.');
  }
  if (/\.[a-z0-9]{2,8}$/i.test(normalizedPath)) {
    return normalizedPath;
  }
  return `${normalizedPath}.${extensionFromContentType(contentType)}`;
};

const blobUrlToBlob = async (blobUrl: string): Promise<Blob> => {
  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error('Failed to load selected image.');
  }
  return response.blob();
};

export const persistImageValue = async ({
  imageValue,
  path,
  processingErrorMessage,
  oversizeErrorMessage
}: PersistImageOptions): Promise<string> => {
  const normalizedValue = typeof imageValue === 'string' ? imageValue.trim() : '';

  if (!normalizedValue) {
    return '';
  }

  if (!isUnsavedImageValue(normalizedValue)) {
    return normalizedValue;
  }

  try {
    const imageBlob = isBlobUrl(normalizedValue)
      ? await blobUrlToBlob(normalizedValue)
      : dataUrlToBlob(normalizedValue);
    const contentType = imageBlob.type || 'image/jpeg';

    if (!contentType.startsWith('image/')) {
      throw new Error(oversizeErrorMessage || 'Please select a valid image file.');
    }

    const uploaded = await uploadMediaToStorage({
      file: imageBlob,
      storagePath: ensureImageStoragePath(path, contentType),
      contentType,
      cacheControl: 'public,max-age=31536000'
    });

    return uploaded.url;
  } catch (error: any) {
    throw new Error(error?.message || processingErrorMessage || 'Failed to upload image.');
  }
};

export const cleanupStoredImage = async (imageUrl?: string | null): Promise<void> => {
  await deleteStorageObjectIfExists(imageUrl);
};