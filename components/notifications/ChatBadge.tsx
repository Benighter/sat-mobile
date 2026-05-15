import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatBubbleLeftRightIcon } from '../icons';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { chatService, ChatThread } from '../../services/chatService';
import { pushNotificationService } from '../../services/pushNotificationService';
import { TabKeys } from '../../types';

const ChatBadge: React.FC = () => {
  const { userProfile, switchTab, currentTab } = useAppContext();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const hasHydratedThreadsRef = useRef(false);
  const knownLastMessagesRef = useRef<Map<string, string>>(new Map());

  const getLastMessageKey = (thread: ChatThread): string => {
    const lastMessage = thread.lastMessage as any;
    const at = lastMessage?.at?.toMillis?.() || lastMessage?.at?.seconds || '';
    return `${lastMessage?.senderId || ''}:${at}:${lastMessage?.text || ''}`;
  };

  const getUnreadForThread = (thread: ChatThread, uid: string): number => {
    const countRaw = thread.unreadCounts?.[uid];
    const count = typeof countRaw === 'number' ? countRaw : undefined;

    const computePredicted = () => {
      try {
        const lastMessage = thread.lastMessage as any;
        const lastRead = (thread.lastReadAt || ({} as any))[uid];
        const messageAt = lastMessage?.at?.toMillis ? lastMessage.at.toMillis() : (lastMessage?.at?.seconds ? lastMessage.at.seconds * 1000 : 0);
        const readAt = lastRead?.toMillis ? lastRead.toMillis() : (lastRead?.seconds ? lastRead.seconds * 1000 : 0);
        const bufferMs = 2000;
        return !!lastMessage && lastMessage.senderId !== uid && (!readAt || (messageAt > (readAt + bufferMs)));
      } catch {
        return false;
      }
    };

    const predicted = computePredicted();
    if (count === undefined) return predicted ? 1 : 0;
    return Math.max(count, predicted ? 1 : 0);
  };

  useEffect(() => {
    if (!userProfile?.uid) return;
    hasHydratedThreadsRef.current = false;
    knownLastMessagesRef.current = new Map();

    const unsub = chatService.onThreadsForUser(userProfile.uid, (items) => {
      setThreads(items);

      const currentKeys = new Map(items.map(thread => [thread.id, getLastMessageKey(thread)]));
      if (!hasHydratedThreadsRef.current) {
        knownLastMessagesRef.current = currentKeys;
        hasHydratedThreadsRef.current = true;
        return;
      }

      if (currentTab.id === TabKeys.CHAT) {
        knownLastMessagesRef.current = currentKeys;
        return;
      }

      const incomingThreads = items.filter(thread => {
        const lastMessage = thread.lastMessage as any;
        if (!lastMessage || lastMessage.senderId === userProfile.uid) return false;
        if (getUnreadForThread(thread, userProfile.uid) <= 0) return false;
        return knownLastMessagesRef.current.get(thread.id) !== currentKeys.get(thread.id);
      });

      knownLastMessagesRef.current = currentKeys;

      incomingThreads.forEach(thread => {
        const lastMessage = thread.lastMessage as any;
        const senderName = lastMessage.senderName || thread.participantProfiles?.[lastMessage.senderId]?.name || 'New message';
        const body = thread.type === 'group'
          ? `${senderName}: ${lastMessage.text || 'Photo'}`
          : (lastMessage.text || 'Photo');

        pushNotificationService.displaySystemNotification({
          title: thread.type === 'group' ? (thread.name || 'Group chat') : senderName,
          body,
          data: {
            activityType: 'chat_message',
            deepLink: `/chat/${thread.id}`,
            threadId: thread.id
          },
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          sound: 'default'
        }, {
          requestPermission: false,
          dedupeKey: `chat:${thread.id}:${currentKeys.get(thread.id)}`
        }).catch(error => {
          console.warn('Failed to display chat notification:', error);
        });
      });
    });
    return () => unsub();
  }, [currentTab.id, userProfile?.uid]);

  const unread = useMemo(() => {
    const uid = userProfile?.uid;
    if (!uid) return 0;
    return threads.reduce((sum, thread) => sum + getUnreadForThread(thread, uid), 0);
  }, [threads, userProfile?.uid]);

  if (!userProfile) return null;

  return (
    <button
      onClick={() => switchTab({ id: TabKeys.CHAT, name: 'Chat' })}
      aria-label="Chat"
      className="relative inline-flex items-center justify-center w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full text-gray-700 hover:text-gray-900 transition-transform duration-200 hover:scale-110 group touch-manipulation bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40 shadow-sm hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50"
    >
      {unread > 0 && (
        <span className="absolute inset-0 rounded-full bg-blue-400 opacity-15 animate-pulse pointer-events-none" />
      )}
      <ChatBubbleLeftRightIcon className="w-5 h-5 group-hover:animate-pulse" />
      {unread > 0 && (
        <span className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 xs:translate-x-1/3 xs:-translate-y-1/3 bg-red-500 text-white rounded-full min-w-[18px] h-[18px] xs:min-w-[20px] xs:h-[20px] px-1 flex items-center justify-center text-[10px] xs:text-xs font-bold shadow-lg ring-2 ring-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
};

export default ChatBadge;

