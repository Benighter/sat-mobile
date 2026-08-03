import { getSupabaseClient } from './client';
import { getApps } from 'firebase/app';

const DEFAULT_BUCKET = String(import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'sat-mobile-media').trim();

export interface StorageReference {
  bucket: string;
  fullPath: string;
  name: string;
  parent: StorageReference | null;
  root: StorageReference;
  storage: SupabaseStorage;
  toString(): string;
}

interface SupabaseStorage {
  bucket: string;
}

interface UploadMetadata {
  contentType?: string;
  cacheControl?: string;
  customMetadata?: Record<string, string>;
}

interface UploadSnapshot {
  bytesTransferred: number;
  totalBytes: number;
  state: 'running' | 'success' | 'error';
  ref: StorageReference;
  metadata: UploadMetadata & { size: number };
}

const normalizePath = (value: string): string => value.replace(/^\/+/, '').replace(/\\/g, '/');

const decodePath = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const pathFromStorageReference = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith('gs://')) {
    const withoutScheme = trimmed.slice(5);
    return normalizePath(withoutScheme.slice(withoutScheme.indexOf('/') + 1));
  }
  if (trimmed.startsWith('supabase://')) {
    const withoutScheme = trimmed.slice('supabase://'.length);
    return normalizePath(withoutScheme.slice(withoutScheme.indexOf('/') + 1));
  }

  if (/^https?:/i.test(trimmed)) {
    const url = new URL(trimmed);
    const firebaseObjectMatch = url.pathname.match(/\/o\/(.+)$/);
    if (firebaseObjectMatch) return normalizePath(decodePath(firebaseObjectMatch[1]));

    const supabaseObjectMatch = url.pathname.match(/\/storage\/v1\/object\/(?:sign|authenticated)\/[^/]+\/(.+)$/);
    if (supabaseObjectMatch) return normalizePath(decodePath(supabaseObjectMatch[1]));

    const segments = url.pathname.split('/').filter(Boolean);
    const bucketIndex = segments.findIndex((segment) =>
      segment === 'sat-mobile-de6f1.firebasestorage.app' || segment === DEFAULT_BUCKET
    );
    if (bucketIndex >= 0) return normalizePath(decodePath(segments.slice(bucketIndex + 1).join('/')));
  }

  return normalizePath(trimmed);
};

const createReference = (storage: SupabaseStorage, value: string): StorageReference => {
  const fullPath = pathFromStorageReference(value);
  const root = {} as StorageReference;
  const build = (path: string, isRoot = false): StorageReference => {
    const segments = path.split('/').filter(Boolean);
    const reference = {
      bucket: storage.bucket,
      fullPath: path,
      name: segments.at(-1) || '',
      parent: isRoot || segments.length <= 1 ? null : build(segments.slice(0, -1).join('/')),
      root,
      storage,
      toString: () => `supabase://${storage.bucket}/${path}`,
    } as StorageReference;
    return reference;
  };
  const reference = build(fullPath);
  const rootReference = build('', true);
  Object.assign(root, rootReference, { root });
  reference.root = root;
  return reference;
};

export const getStorage = (): SupabaseStorage => ({ bucket: DEFAULT_BUCKET });

export const ref = (storageOrReference: SupabaseStorage | StorageReference, path?: string): StorageReference => {
  if ('fullPath' in storageOrReference) {
    const joined = path ? `${storageOrReference.fullPath}/${path}` : storageOrReference.fullPath;
    return createReference(storageOrReference.storage, joined);
  }
  return createReference(storageOrReference, path || '');
};

const requirePath = (reference: StorageReference): string => {
  if (!reference.fullPath) throw Object.assign(new Error('Storage object path is required'), { code: 'storage/invalid-url' });
  return reference.fullPath;
};

export const getDownloadURL = async (reference: StorageReference): Promise<string> => {
  const path = requirePath(reference);
  const { data, error } = await getSupabaseClient().storage.from(reference.bucket).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    throw Object.assign(new Error(error?.message || 'Unable to create a private media URL'), { code: 'storage/object-not-found' });
  }
  return data.signedUrl;
};

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const signedUrlRequests = new Map<string, Promise<string>>();
const signedUrlWaiters: Array<() => void> = [];
const MAX_SIGNED_URL_REQUESTS = 6;
let activeSignedUrlRequests = 0;

const withSignedUrlSlot = async <T>(operation: () => Promise<T>): Promise<T> => {
  if (activeSignedUrlRequests >= MAX_SIGNED_URL_REQUESTS) {
    await new Promise<void>((resolve) => signedUrlWaiters.push(resolve));
  }
  activeSignedUrlRequests += 1;
  try {
    return await operation();
  } finally {
    activeSignedUrlRequests -= 1;
    signedUrlWaiters.shift()?.();
  }
};

export const isRemoteStorageReference = (value: unknown): value is string =>
  typeof value === 'string' && (
    value.startsWith('gs://')
    || /firebasestorage\.googleapis\.com|storage\.googleapis\.com/i.test(value)
    || /\/storage\/v1\/object\/(?:sign|authenticated)\//i.test(value)
    || value.startsWith(`supabase://${DEFAULT_BUCKET}/`)
  );

export const resolvePrivateStorageUrl = async (value: string): Promise<string> => {
  if (!isRemoteStorageReference(value)) return value;
  const path = pathFromStorageReference(value);
  if (!path) return value;
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const existing = signedUrlRequests.get(path);
  if (existing) return existing;
  const pending = withSignedUrlSlot(async () => {
    try {
      const url = await getDownloadURL(createReference(getStorage(), path));
      signedUrlCache.set(path, { url, expiresAt: Date.now() + 45 * 60 * 1_000 });
      return url;
    } catch {
      return value;
    }
  });
  signedUrlRequests.set(path, pending);
  void pending.finally(() => {
    if (signedUrlRequests.get(path) === pending) signedUrlRequests.delete(path);
  }).catch(() => undefined);
  return pending;
};

export const resolvePrivateStorageReferences = async (value: unknown): Promise<unknown> => {
  if (isRemoteStorageReference(value)) return resolvePrivateStorageUrl(value);
  if (Array.isArray(value)) return Promise.all(value.map(resolvePrivateStorageReferences));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const entries = await Promise.all(Object.entries(value).map(async ([key, child]) => [key, await resolvePrivateStorageReferences(child)]));
    return Object.fromEntries(entries);
  }
  return value;
};

export const getBlob = async (reference: StorageReference, maxDownloadSizeBytes?: number): Promise<Blob> => {
  const path = requirePath(reference);
  const { data, error } = await getSupabaseClient().storage.from(reference.bucket).download(path);
  if (error || !data) {
    throw Object.assign(new Error(error?.message || 'Unable to download media'), { code: 'storage/object-not-found' });
  }
  if (maxDownloadSizeBytes !== undefined && data.size > maxDownloadSizeBytes) {
    throw Object.assign(new Error('Downloaded object exceeds the permitted size'), { code: 'storage/max-download-size-exceeded' });
  }
  return data;
};

export const deleteObject = async (reference: StorageReference): Promise<void> => {
  const path = requirePath(reference);
  const { data, error } = await getSupabaseClient().storage.from(reference.bucket).remove([path]);
  if (error) throw Object.assign(new Error(error.message), { code: 'storage/unknown' });
  if (!data?.length) throw Object.assign(new Error('Stored object was not found'), { code: 'storage/object-not-found' });
  if (import.meta.env.VITE_FIREBASE_ROLLBACK_WRITES !== 'false') {
    const firebase = await import('sat-firebase-storage-original');
    const app = getApps()[0];
    if (!app) throw new Error('Firebase rollback mirror is unavailable');
    try {
      await firebase.deleteObject(firebase.ref(firebase.getStorage(app), path));
    } catch (error: any) {
      if (error?.code !== 'storage/object-not-found') throw error;
    }
  }
};

export const uploadBytesResumable = (
  reference: StorageReference,
  data: Blob | Uint8Array | ArrayBuffer,
  metadata: UploadMetadata = {}
) => {
  const path = requirePath(reference);
  const size = data instanceof Blob ? data.size : data.byteLength;
  let snapshot: UploadSnapshot = {
    bytesTransferred: 0,
    totalBytes: size,
    state: 'running',
    ref: reference,
    metadata: { ...metadata, size },
  };
  const promise = getSupabaseClient().storage.from(reference.bucket).upload(path, data, {
    cacheControl: metadata.cacheControl,
    contentType: metadata.contentType,
    metadata: metadata.customMetadata,
    upsert: false,
  }).then(({ error }) => {
    if (error) throw Object.assign(new Error(error.message), { code: 'storage/unknown' });
    return Promise.resolve().then(async () => {
      if (import.meta.env.VITE_FIREBASE_ROLLBACK_WRITES !== 'false') {
        const firebase = await import('sat-firebase-storage-original');
        const app = getApps()[0];
        if (!app) throw new Error('Firebase rollback mirror is unavailable');
        await firebase.uploadBytes(firebase.ref(firebase.getStorage(app), path), data, {
          cacheControl: metadata.cacheControl,
          contentType: metadata.contentType,
          customMetadata: metadata.customMetadata,
        });
      }
      snapshot = { ...snapshot, bytesTransferred: size, state: 'success' };
      return snapshot;
    });
  });

  return {
    get snapshot() { return snapshot; },
    on: (
      event: 'state_changed',
      next?: ((value: UploadSnapshot) => void) | null,
      error?: ((reason: unknown) => void) | null,
      complete?: (() => void) | null
    ) => {
      if (event !== 'state_changed') throw new Error(`Unsupported upload event: ${event}`);
      next?.(snapshot);
      promise.then((value) => { next?.(value); complete?.(); }).catch((reason) => error?.(reason));
      return () => undefined;
    },
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
};
