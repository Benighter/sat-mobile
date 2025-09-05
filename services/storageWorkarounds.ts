// Storage CORS workaround utilities.
// Primary fix: ensure firebase.config.ts uses the canonical bucket name (<project-id>.appspot.com).
// If an environment still blocks direct PUT/POST (e.g., restrictive corporate proxy),
// you can fall back to a Cloud Function relay that accepts a base64 image and writes it to Storage server-side.
// This file provides a client helper; implement the matching HTTPS callable function separately.

import { httpsCallable, getFunctions } from 'firebase/functions';

export interface UploadViaFunctionParams {
  threadId: string;
  churchId: string;
  file: File | Blob;
  caption?: string;
}

export async function uploadImageViaFunction(params: UploadViaFunctionParams): Promise<{ url: string }> {
  const { threadId, churchId, file, caption } = params;
  const arrayBuf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
  const functions = getFunctions(undefined as any, 'us-central1');
  const call = httpsCallable<any, { url: string }>(functions as any, 'relayUploadChatImage');
  const res = await call({ threadId, churchId, data: b64, mimeType: (file as any).type || 'image/png', caption });
  return res.data;
}
