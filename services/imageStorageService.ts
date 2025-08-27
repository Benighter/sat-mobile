import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

// Simple helper to detect data URLs
export const isDataUrl = (val?: string | null): val is string => !!val && /^data:.+;base64,/.test(val);

const storage = getStorage();

const uploadDataUrl = async (path: string, dataUrl: string, contentType?: string): Promise<string> => {
  const objectRef = ref(storage, path);
  // Use uploadString with 'data_url' to handle full data URLs
  await uploadString(objectRef, dataUrl, 'data_url', contentType ? { contentType } : undefined);
  return await getDownloadURL(objectRef);
};

export const imageStorageService = {
  // Upload a member profile picture under a church-scoped path
  uploadMemberProfilePicture: async (churchId: string, memberId: string, dataUrl: string): Promise<string> => {
    const path = `churches/${churchId}/members/${memberId}/profile.jpg`;
    return await uploadDataUrl(path, dataUrl, undefined);
  },

  // Upload a user profile picture (global user scope)
  uploadUserProfilePicture: async (uid: string, dataUrl: string): Promise<string> => {
    const path = `users/${uid}/profile.jpg`;
    return await uploadDataUrl(path, dataUrl, undefined);
  },

  // Upload a bacenta meeting image under church-scoped path
  uploadMeetingImage: async (churchId: string, meetingId: string, dataUrl: string): Promise<string> => {
    const path = `churches/${churchId}/meetings/${meetingId}/photo.jpg`;
    return await uploadDataUrl(path, dataUrl, undefined);
  },

  // Optional: delete a storage object by URL or path (best-effort)
  deleteByUrlOrPath: async (urlOrPath: string): Promise<void> => {
    try {
      const objectRef = urlOrPath.startsWith('http') ? ref(storage, urlOrPath) : ref(storage, urlOrPath);
      await deleteObject(objectRef);
    } catch (_e) {
      // Ignore failures (object may not exist or insufficient permissions)
    }
  }
};

export default imageStorageService;
