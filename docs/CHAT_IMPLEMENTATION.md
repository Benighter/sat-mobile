# Chat Implementation (SAT Mobile)

## Approach
- Firestore for real-time messaging (no CORS)
- Cloud Functions trigger on message create for updating thread metadata, unread counts, and push notifications
- Device tokens already managed via services/pushNotificationService.ts
- Deep links: /chat/{threadId}

## Data Model
- churches/{churchId}/chatThreads/{threadId}
  - type: 'dm' | 'group'
  - participants: string[]
  - participantProfiles: { [uid]: { name, photoUrl? } }
  - name
  - createdBy, createdAt, updatedAt
  - lastMessage: { text, senderId, at }
  - unreadCounts: { [uid]: number }
  - lastReadAt: { [uid]: Timestamp }
- messages subcollection: { senderId, text, attachments?, createdAt }

## Key Files Added
- services/chatService.ts — CRUD and real-time listeners for threads/messages
- components/views/ChatView.tsx — UI (thread list + conversation + new chat modal)
- functions/chatTriggers.ts — Firestore trigger to maintain thread state and send FCM
- TabKeys.CHAT added; App.tsx renders LazyChatView; drawers link to "Chat"

## CORS vs non-CORS
- Firestore client SDK and Cloud Function triggers avoid CORS entirely (Priority 1)
- Optional callable function sendPushNotification remains available as fallback for client-initiated sends

## Notifications
- Push via Admin SDK in chatTriggers.ts to recipients' device tokens under churches/{churchId}/deviceTokens
- Web SW and Capacitor are already configured

## Unread Badges
- unreadCounts map maintained by trigger; client can aggregate for header badge in future follow-up

## Next Steps
- Firestore security rules: restrict access to participants
- Optional attachments via Firebase Storage
- Typing indicators and read receipts
- Header unread dot indicator and deep link handler routing to /chat/{threadId}

