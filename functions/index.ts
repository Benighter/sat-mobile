// Barrel exports for Cloud Functions (TypeScript)
export { sendPushNotification } from './sendPushNotification';
export { onMessageCreated } from './chatTriggers';

// Bridge exports for ministry sync triggers/callables implemented in CommonJS (index.js)
// This ensures deployments that use the TypeScript entry also expose the ministry sync functions.
// Note: Admin SDK bypasses Firestore rules; these functions are defined in functions/index.js.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const legacy = require('./index.js') as any;

export const syncMemberToMinistry = legacy.syncMemberToMinistry;
export const syncMinistryToDefault = legacy.syncMinistryToDefault;
export const backfillMinistrySync = legacy.backfillMinistrySync;
export const backfillMinistrySyncHttp = legacy.backfillMinistrySyncHttp;
export const crossMinistrySync = legacy.crossMinistrySync;
export const crossMinistrySyncHttp = legacy.crossMinistrySyncHttp;
export const searchAdminUserByEmail = legacy.searchAdminUserByEmail;
