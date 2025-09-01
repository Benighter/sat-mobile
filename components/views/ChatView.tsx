import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { chatService, ChatThread, ChatMessage } from '../../services/chatService';
import { userService } from '../../services/userService';
import { TabKeys, User } from '../../types';
import { ChatBubbleLeftRightIcon, ArrowRightIcon, ArrowLeftIcon } from '../icons';

const ChatView: React.FC = () => {
  const { userProfile, currentChurchId, currentTab, showToast } = useAppContext();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  // Load users for participant picker and name resolution
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (currentChurchId) {
        const users = await userService.getChurchUsers(currentChurchId);
        if (mounted) setAllUsers(users);
      }
    })();
    return () => { mounted = false; };
  }, [currentChurchId]);

  // Subscribe to threads
  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsub = chatService.onThreadsForUser(userProfile.uid, (items) => setThreads(items));
    return () => unsub();
  }, [userProfile?.uid]);

  // Subscribe to messages for active thread
  useEffect(() => {
    if (!activeThreadId) return;
    const unsub = chatService.onMessages(activeThreadId, setMessages);
    return () => unsub();
  }, [activeThreadId]);

  // Auto-scroll to latest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeThreadId]);

  // Keep unread count clean while viewing
  useEffect(() => {
    if (!activeThreadId || !userProfile?.uid || messages.length === 0) return;
    const t = setTimeout(() => {
      chatService.markThreadRead(activeThreadId, userProfile.uid).catch(() => {});
    }, 120);
    return () => clearTimeout(t);
  }, [messages.length, activeThreadId, userProfile?.uid]);

  // When opening a thread, mark as read shortly after
  useEffect(() => {
    if (!activeThreadId || !userProfile?.uid) return;
    const t = setTimeout(() => {
      chatService.markThreadRead(activeThreadId, userProfile.uid).catch(() => {});
    }, 80);
    return () => clearTimeout(t);
  }, [activeThreadId, userProfile?.uid]);

  useEffect(() => {
    const deepLinkThreadId = (currentTab.data as any)?.threadId;
    if (deepLinkThreadId) setActiveThreadId(deepLinkThreadId);
  }, [currentTab.id]);

  const startDirect = async (uid: string) => {
    if (!userProfile) return;
    const id = await chatService.createDirectThread(uid, userProfile);
    setActiveThreadId(id);
  };

  const startGroup = async () => {
    if (!userProfile) return;
    if (participantIds.length === 0) return;
    const id = await chatService.createGroupThread(groupName || 'Group', participantIds, userProfile);
    setActiveThreadId(id);
    setIsCreating(false);
    setParticipantIds([]);
    setGroupName('');
  };

  const send = async () => {
    if (!activeThreadId || !userProfile || !messageText.trim()) return;
    const text = messageText.trim();
    setMessageText('');
    try {
      await chatService.sendMessage(activeThreadId, text, userProfile.uid);
    } catch (e: any) {
      showToast('error', 'Failed to send', e?.message || '');
    }
  };

  const getUserById = (uid?: string) => allUsers.find(u => u.uid === uid);
  const nameForUid = (uid?: string, t?: ChatThread) => {
    if (!uid) return '';
    const fromProfiles = t?.participantProfiles?.[uid]?.name;
    const fromUsers = getUserById(uid);
    const name = fromProfiles || fromUsers?.displayName || `${fromUsers?.firstName || ''} ${fromUsers?.lastName || ''}`.trim();
    return name || fromUsers?.email || 'Member';
  };
  const avatarForUid = (uid?: string) => getUserById(uid)?.profilePicture;
  const initialsForName = (n: string) => (n || 'M').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();

  const threadTitle = (t: ChatThread) => {
    const others = (t.participants || []).filter(p => p !== userProfile?.uid);
    if (t.type === 'group') return t.name || others.map(id => nameForUid(id, t)).join(', ');
    return nameForUid(others[0], t) || 'Direct Message';
  };

  const formatTime = (val?: any) => {
    try {
      const d: Date = val?.toDate ? val.toDate() : (val ? new Date(val) : new Date());
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(t => threadTitle(t).toLowerCase().includes(q));
  }, [threads, search]);

  const activeThread = threads.find(t => t.id === activeThreadId) || null;

  return (
    <div className="flex h-full">
      {/* Left: thread list (WhatsApp-like) */}
      <div className={`md:w-[34%] md:min-w-[300px] w-full border-r border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 flex-col ${activeThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 dark:border-dark-600">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ChatBubbleLeftRightIcon className="w-5 h-5"/> Chat</h2>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm shadow-sm hover:bg-blue-700" onClick={()=>setIsCreating(true)}>New</button>
          </div>
          <div className="mt-3">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-600 bg-slate-50 dark:bg-dark-700 focus:ring-2 focus:ring-blue-300 outline-none" placeholder="Search conversations" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-dark-700">
          {filteredThreads.map(t => {
            const title = threadTitle(t);
            const last = t.lastMessage?.text || 'No messages yet';
            const time = t.lastMessage?.at ? formatTime(t.lastMessage.at) : '';
            const unread = t.unreadCounts?.[userProfile?.uid || ''] || 0;
            const otherId = (t.participants || []).find(p => p !== userProfile?.uid);
            const photo = avatarForUid(otherId);
            return (
              <button key={t.id} onClick={()=>setActiveThreadId(t.id)} className={`w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-dark-700 transition ${activeThreadId===t.id ? 'bg-blue-50/60 dark:bg-dark-700' : ''}`}>
                <div className="flex-shrink-0">
                  {photo ? (
                    <img src={photo} alt={title} className="w-11 h-11 rounded-full object-cover shadow" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow text-sm font-semibold">{initialsForName(title)}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{title}</div>
                    <div className="text-[11px] text-gray-500 whitespace-nowrap">{time}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-600 dark:text-dark-300 truncate max-w-[75%]">{last}</div>
                    {unread > 0 && (
                      <span className="ml-auto bg-blue-600 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow">{unread > 99 ? '99+' : unread}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: conversation */}
      <div className={`flex-1 flex flex-col bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cg fill=%22%23e5e7eb%22 fill-opacity=%220.5%22%3E%3Ccircle cx=%220%22 cy=%220%22 r=%221%22/%3E%3C/g%3E%3C/svg%3E')] bg-repeat dark:bg-none bg-white dark:bg-dark-800 ${activeThread ? 'flex' : 'hidden md:flex'}`}>
        {activeThread ? (
          <>
            <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-600 flex items-center gap-3">
              {/* Mobile back to list */}
              <button className="md:hidden mr-1 p-1 rounded-full hover:bg-gray-100" onClick={()=>setActiveThreadId(null)} aria-label="Back">
                <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              {(() => {
                const title = threadTitle(activeThread);
                const otherId = (activeThread.participants || []).find(p => p !== userProfile?.uid);
                const photo = avatarForUid(otherId);
                return (
                  <>
                    {photo ? <img src={photo} alt={title} className="w-8 h-8 rounded-full object-cover"/> : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-semibold">{initialsForName(title)}</div>}
                    <div className="font-semibold text-gray-800 dark:text-dark-100 truncate">{title}</div>
                  </>
                );
              })()}
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="space-y-2">
                {messages.map(m => (
                  <div key={m.id} className={`max-w-[86%] sm:max-w-[78%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed ${m.senderId===userProfile?.uid ? 'ml-auto bg-blue-600 text-white rounded-br-md' : 'bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-dark-100 rounded-bl-md'}`}>
                    <div>{m.text}</div>
                    <div className={`mt-1 text-[10px] ${m.senderId===userProfile?.uid ? 'text-blue-100' : 'text-gray-500'}`}>{formatTime((m as any).createdAt)}</div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </div>

            <div className="p-2 sm:p-3 border-t border-gray-200 dark:border-dark-600">
              <div className="max-w-3xl mx-auto flex gap-2">
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message"
                  className="flex-1 rounded-full border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-4 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button onClick={send} className="px-4 py-2 rounded-full bg-blue-600 text-white shadow hover:bg-blue-700 flex items-center gap-1">
                  Send <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-dark-700 dark:text-dark-100 shadow-sm">
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
              </div>
              <div className="text-sm sm:text-base text-gray-600 dark:text-dark-300 font-medium">Select a conversation or start a new one</div>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700" onClick={()=>setIsCreating(true)}>New conversation</button>
            </div>
          </div>
        )}
      </div>

      {/* New chat modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-2xl p-5 border border-gray-100 dark:border-dark-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Start a conversation</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={()=>{setIsCreating(false); setParticipantIds([]);}}>Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Select participants</div>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2 bg-slate-50/60 dark:bg-dark-700/50">
                  {allUsers.filter(u => u.uid !== userProfile?.uid).map(u => (
                    <label key={u.uid} className="flex items-center gap-2 p-2 rounded hover:bg-white dark:hover:bg-dark-700">
                      <input type="checkbox" checked={participantIds.includes(u.uid)} onChange={(e) => {
                        setParticipantIds(prev => e.target.checked ? [...prev, u.uid] : prev.filter(id => id !== u.uid));
                      }} />
                      <span className="text-sm">{u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Group options</div>
                <input value={groupName} onChange={(e)=>setGroupName(e.target.value)} placeholder="Group name (optional)" className="w-full border rounded-lg px-3 py-2" />
                <div className="text-xs text-gray-500 mt-2">Select more than one person to create a group chat</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-3 py-1.5 rounded-md border" onClick={()=>{setIsCreating(false); setParticipantIds([]);}}>Cancel</button>
              {participantIds.length===1 ? (
                <button className="px-3 py-1.5 rounded-md bg-blue-600 text-white" onClick={()=>startDirect(participantIds[0])}>Start DM</button>
              ) : (
                <button disabled={participantIds.length===0} className="px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-50" onClick={startGroup}>Create Group</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
