import React, { useEffect, useMemo, useState } from 'react';
import { ChatBubbleLeftRightIcon } from '../icons';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { chatService, ChatThread } from '../../services/chatService';
import { TabKeys } from '../../types';

const ChatBadge: React.FC = () => {
  const { userProfile, switchTab } = useAppContext();
  const [threads, setThreads] = useState<ChatThread[]>([]);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsub = chatService.onThreadsForUser(userProfile.uid, setThreads);
    return () => unsub();
  }, [userProfile?.uid]);

  const unread = useMemo(() => {
    const uid = userProfile?.uid;
    if (!uid) return 0;
    return threads.reduce((sum, t) => {
      const countRaw = t.unreadCounts?.[uid];
      const count = typeof countRaw === 'number' ? countRaw : undefined;

      const computePredicted = () => {
        try {
          const lm = t.lastMessage as any;
          const lastRead = (t.lastReadAt || ({} as any))[uid];
          const lmAt = lm?.at?.toMillis ? lm.at.toMillis() : (lm?.at?.seconds ? lm.at.seconds * 1000 : 0);
          const lrAt = lastRead?.toMillis ? lastRead.toMillis() : (lastRead?.seconds ? lastRead.seconds * 1000 : 0);
          const bufferMs = 2000; // 2s buffer to avoid flip-flop races
          return !!lm && lm.senderId !== uid && (!lrAt || (lmAt > (lrAt + bufferMs)));
        } catch {
          return false;
        }
      };

      const predicted = computePredicted();

      // If CF-provided count is missing, rely on predicted (legacy / emulator cases)
      if (count === undefined) {
        return sum + (predicted ? 1 : 0);
      }

      // Otherwise, use the max of authoritative count and prediction (never sum),
      // which prevents 1→2→1 bounce while still surfacing unread in CF lag.
      return sum + Math.max(count, predicted ? 1 : 0);
    }, 0);
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

