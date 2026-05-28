import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { chatService, ChatThread, ChatMessage } from '../../services/chatService';
import { userService } from '../../services/userService';
import { User } from '../../types';
import { 
  ChatBubbleLeftRightIcon, 
  ArrowRightIcon, 
  ArrowLeftIcon, 
  EllipsisVerticalIcon, 
  XMarkIcon, 
  SmileIcon, 
  PhotoIcon, 
  CheckIcon, 
  SearchIcon, 
  PlusIcon, 
  ShieldCheckIcon 
} from '../icons';


// Host component to use emoji-picker-element web component safely in React 19
const EmojiPickerHost: React.FC<{ onEmoji: (val: string) => void; onClose: () => void; }> = ({ onEmoji, onClose }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onEmojiRef = useRef(onEmoji);
  const onCloseRef = useRef(onClose);

  // Keep refs updated without re-running mount effect
  useEffect(() => { onEmojiRef.current = onEmoji; }, [onEmoji]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    let pickerEl: any;

    (async () => {
      await import('emoji-picker-element');
      const host = hostRef.current;
      if (!host) return;

      // Clear any previous children to avoid duplicates (StrictMode/dev)
      while (host.firstChild) host.removeChild(host.firstChild);

      pickerEl = document.createElement('emoji-picker');
      pickerEl.setAttribute('class', 'max-h-[320px] w-[320px]');
      pickerEl.addEventListener('emoji-click', (e: any) => {
        const char = e?.detail?.unicode || e?.detail?.emoji?.unicode || '';
        if (char) {
          onEmojiRef.current?.(char);
          onCloseRef.current?.();
        }
      });
      host.appendChild(pickerEl);
    })();

    return () => {
      try {
        const host = hostRef.current;
        if (pickerEl && host?.contains(pickerEl)) host.removeChild(pickerEl);
      } catch {}
    };
  }, []);

  return <div ref={hostRef} />;
};

const ChatView: React.FC = () => {
  const { userProfile, currentChurchId, currentTab, showToast } = useAppContext();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'archived'>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);

  // Emoji picker state
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const emojiPopoverRef = useRef<HTMLDivElement | null>(null);

  // Close emoji picker on outside click or Escape
  useEffect(() => {
    if (!isEmojiOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        emojiPopoverRef.current &&
        !emojiPopoverRef.current.contains(target) &&
        !(textAreaRef.current && textAreaRef.current.contains(target))
      ) {
        setIsEmojiOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEmojiOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isEmojiOpen]);


  // Load users for participant picker and name resolution
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoadingUsers(true);
      try {
        const users = await userService.getAllActiveUsers();
        if (mounted) setAllUsers(users);
      } catch (error: any) {
        console.warn('Failed to load global chat users, falling back to current church:', error);
        if (currentChurchId) {
          const users = await userService.getChurchUsers(currentChurchId);
          if (mounted) setAllUsers(users);
          showToast('warning', 'Limited Chat Directory', 'Could only load accounts in your current church.');
        }
      } finally {
        if (mounted) setIsLoadingUsers(false);
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

  // Auto-size message textarea when content changes or thread switches
  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 160; // px max height (~8 lines)
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, [messageText, activeThreadId]);

  const findExistingDmWith = (uid: string) => {
    const me = userProfile?.uid;
    if (!me) return null;
    return threads.find(t => t.type === 'dm' && (t.participants || []).length === 2 && t.participants.includes(uid) && t.participants.includes(me)) || null;
  };

  const openDirectWith = async (uid: string) => {
    if (!userProfile) return;
    const existing = findExistingDmWith(uid);
    if (existing) {
      setActiveThreadId(existing.id);
    } else {
      const partner = allUsers.find(user => user.uid === uid) || uid;
      const id = await chatService.createDirectThread(partner, userProfile);
      setActiveThreadId(id);
    }
    setIsCreating(false);
  };

  const startGroup = async () => {
    if (!userProfile) return;
    if (participantIds.length === 0) return;
    const selectedUsers = allUsers.filter(user => participantIds.includes(user.uid));
    const id = await chatService.createGroupThread(groupName || 'Group', participantIds, userProfile, selectedUsers);
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
      const senderName = userProfile.displayName || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email;
      await chatService.sendMessage(activeThreadId, text, userProfile.uid, senderName);
    } catch (e: any) {
      showToast('error', 'Failed to send', e?.message || '');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Unsupported', 'Please choose an image file');
      return;
    }
    const url = URL.createObjectURL(file);
    setPendingImage({ file, url });
  };

  const sendImage = async () => {
    if (!pendingImage || !activeThreadId || !userProfile) return;
    setUploading(true);
    try {
      await chatService.sendImageMessage(activeThreadId, pendingImage.file, userProfile.uid, { caption: messageText.trim() || '' });
      setMessageText('');
      setPendingImage(null);
    } catch (e: any) {
      showToast('error', 'Upload failed', e?.message || '');
    } finally {
      setUploading(false);
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
    let scoped = threads;
    if (filterType === 'archived') {
      scoped = threads.filter(t => !!t.archived);
    } else {
      scoped = threads.filter(t => !t.archived);
      if (filterType === 'unread') {
        scoped = scoped.filter(t => {
          const unread = t.unreadCounts?.[userProfile?.uid || ''] || 0;
          return unread > 0;
        });
      }
    }
    const withMessages = scoped.filter(t => !!t.lastMessage);
    const q = search.trim().toLowerCase();
    if (!q) return withMessages;
    return withMessages.filter(t => threadTitle(t).toLowerCase().includes(q));
  }, [threads, search, filterType, userProfile?.uid]);

  const activeThread = threads.find(t => t.id === activeThreadId) || null;

  return (
    <div className="flex h-full min-h-full max-h-full w-full overflow-hidden bg-slate-50">
      {/* Left: thread list (WhatsApp-like) */}
      <div className={`md:w-[34%] md:min-w-[320px] md:max-w-[400px] w-full border-r border-slate-200 bg-white flex flex-col ${activeThread ? 'hidden md:flex' : 'flex'} h-full overflow-hidden`} >
        {!isCreating ? (
          <>
            {/* Thread List Header */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                  </span>
                  Chats
                </h2>
                <button
                  onClick={() => setIsCreating(true)}
                  className="p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all duration-200 shadow-md shadow-indigo-500/5"
                  aria-label="New Conversation"
                  title="New Conversation"
                >
                  <PlusIcon className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
              
              {/* Segmented Control Pill Tabs (WhatsApp Filter Style) */}
              <div className="flex gap-2 mb-3 select-none overflow-x-auto no-scrollbar">
                <button
                  className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                    filterType === 'all'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  onClick={() => setFilterType('all')}
                >
                  All
                </button>
                <button
                  className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                    filterType === 'unread'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  onClick={() => setFilterType('unread')}
                >
                  Unread
                </button>
                <button
                  className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                    filterType === 'archived'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  onClick={() => setFilterType('archived')}
                >
                  Archived
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-800 placeholder-slate-400 focus:bg-slate-50 focus:ring-1 focus:ring-indigo-500 outline-none transition duration-200"
                  placeholder="Search or start a new chat"
                />
                <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                {search && (
                  <button 
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  No {filterType === 'archived' ? 'archived' : filterType === 'unread' ? 'unread' : 'active'} conversations found
                </div>
              ) : (
                filteredThreads.map(t => {
                  const title = threadTitle(t);
                  const last = t.lastMessage?.text || '';
                  const time = t.lastMessage?.at ? formatTime(t.lastMessage.at) : '';
                  const unread = t.unreadCounts?.[userProfile?.uid || ''] || 0;
                  const otherId = (t.participants || []).find(p => p !== userProfile?.uid);
                  const photo = avatarForUid(otherId);
                  const isMenuOpen = menuOpenId === t.id;

                  const isMine = t.lastMessage?.senderId === userProfile?.uid;
                  let lastTicks: 'one' | 'two' | 'three' | null = null;
                  if (isMine && t.lastMessage?.at) {
                    const created = t.lastMessage.at.toDate ? t.lastMessage.at.toDate().getTime() : new Date(t.lastMessage.at).getTime();
                    const others = (t.participants || []).filter(p => p !== userProfile?.uid);
                    const anyRead = others.some(p => {
                      const readTime = t.lastReadAt?.[p];
                      const readMillis = readTime?.toDate ? readTime.toDate().getTime() : (readTime ? new Date(readTime).getTime() : 0);
                      return readMillis >= created;
                    });
                    if ((t.lastMessage as any)._pending || (t.lastMessage as any)._fromCache) {
                      lastTicks = 'one';
                    } else {
                      lastTicks = anyRead ? 'three' : 'two';
                    }
                  }

                  const isActive = activeThreadId === t.id;

                  return (
                    <div 
                      key={t.id} 
                      className={`group w-full px-5 py-3.5 flex items-center gap-4 border-b border-slate-100 hover:bg-slate-50 transition duration-150 relative cursor-pointer ${
                        isActive 
                          ? 'bg-[#f0f2f5]' 
                          : ''
                      }`}
                    >
                      <button 
                        onClick={() => setActiveThreadId(t.id)} 
                        className="flex items-center gap-4 flex-1 text-left min-w-0"
                      >
                        <div className="flex-shrink-0 relative">
                          {photo ? (
                            <div className="relative group/avatar">
                              <img
                                src={photo}
                                alt={title}
                                className={`w-12 h-12 rounded-full object-cover shadow-sm cursor-pointer transition duration-300 ring-2 ${
                                  unread > 0 
                                    ? 'ring-indigo-600' 
                                    : 'ring-transparent'
                                }`}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewPhoto(photo); }}
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shadow-sm text-sm font-bold transition duration-300">
                              {initialsForName(title)}
                            </div>
                          )}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="font-semibold text-[15px] text-gray-900 truncate">
                              {title}
                            </div>
                            <div className={`text-[11px] whitespace-nowrap transition-colors ${
                              unread > 0 
                                ? 'text-indigo-600 font-semibold' 
                                : 'text-gray-400'
                            }`}>
                              {time}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[13px] text-gray-500 truncate flex items-center gap-1.5 max-w-[85%]">
                              {isMine && t.lastMessage && (
                                <span className="flex items-center shrink-0">
                                  {lastTicks === 'one' && (
                                    <CheckIcon className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                  {lastTicks === 'two' && (
                                    <div className="flex -space-x-1.5 shrink-0">
                                      <CheckIcon className="w-3.5 h-3.5 text-gray-400" />
                                      <CheckIcon className="w-3.5 h-3.5 text-gray-400" />
                                    </div>
                                  )}
                                  {lastTicks === 'three' && (
                                    <div className="flex -space-x-1.5 shrink-0">
                                      <CheckIcon className="w-3.5 h-3.5 text-[#53bdeb]" />
                                      <CheckIcon className="w-3.5 h-3.5 text-[#53bdeb]" />
                                    </div>
                                  )}
                                </span>
                              )}
                              <span className="truncate">{last || ((t.lastMessage as any)?.attachments?.length ? '📷 Photo' : '')}</span>
                            </div>
                            
                            {unread > 0 && (
                              <span className="ml-auto bg-indigo-600 text-white text-[11px] font-bold min-w-[20px] h-[20px] px-1.5 rounded-full flex items-center justify-center animate-scale-in">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Thread Context Menu */}
                      <div className="relative shrink-0 ml-1">
                        <button 
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600" 
                          onClick={() => setMenuOpenId(isMenuOpen ? null : t.id)} 
                          aria-label="Thread actions"
                        >
                          <EllipsisVerticalIcon className="w-4 h-4" />
                        </button>
                        {isMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-150 rounded-xl shadow-xl z-20 animate-scale-in overflow-hidden">
                              {!t.archived ? (
                                <button 
                                  className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition" 
                                  onClick={async () => { 
                                    setMenuOpenId(null); 
                                    await chatService.archiveThread(t.id); 
                                    showToast('success', 'Archived', 'Conversation archived.'); 
                                  }}
                                >
                                  Archive
                                </button>
                              ) : (
                                <button 
                                  className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition" 
                                  onClick={async () => { 
                                    setMenuOpenId(null); 
                                    await chatService.unarchiveThread(t.id); 
                                    showToast('success', 'Unarchived', 'Conversation restored.'); 
                                  }}
                                >
                                  Unarchive
                                </button>
                              )}
                              <button 
                                className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition border-t border-slate-150" 
                                onClick={async () => {
                                  setMenuOpenId(null);
                                  const choice = window.prompt('Delete conversation: type DELETE to confirm. Type SOFT to hide only for you.');
                                  if (!choice) return;
                                  try {
                                    if (choice.toUpperCase() === 'DELETE') {
                                      await chatService.hardDeleteThread(t.id);
                                      if (activeThreadId === t.id) setActiveThreadId(null);
                                      showToast('success', 'Deleted', 'Conversation permanently deleted.');
                                    } else if (userProfile?.uid && choice.toUpperCase() === 'SOFT') {
                                      await chatService.softDeleteForUser(t.id, userProfile.uid);
                                      if (activeThreadId === t.id) setActiveThreadId(null);
                                      showToast('success', 'Hidden', 'Conversation hidden for you.');
                                    }
                                  } catch (e: any) {
                                    showToast('error', 'Failed', e?.message || '');
                                  }
                                }}
                              >
                                Delete Chat…
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Start New Chat / Directory Panel */
          <div className="h-full flex flex-col bg-white">
            <div className="px-4 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition shrink-0" 
                  onClick={() => setIsCreating(false)}
                  aria-label="Go back"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-900 text-base">New Chat</span>
              </div>
              <button 
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition" 
                onClick={() => { setIsCreating(false); setParticipantIds([]); setGroupName(''); }}
              >
                Cancel
              </button>
            </div>

            <div className="p-3 bg-white border-b border-slate-100">
              <div className="relative">
                <input 
                  value={userSearch} 
                  onChange={(e) => setUserSearch(e.target.value)} 
                  placeholder="Search people by name or church..." 
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition duration-200" 
                />
                <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoadingUsers ? (
                <div className="h-40 flex flex-col items-center justify-center text-sm text-slate-400 gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent"></div>
                  <span>Loading directory...</span>
                </div>
              ) : allUsers.filter(u => u.uid !== userProfile?.uid).filter(u => {
                const q = userSearch.trim().toLowerCase();
                if (!q) return true;
                const searchable = [
                  u.displayName,
                  `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                  u.email,
                  u.churchName
                ].filter(Boolean).join(' ').toLowerCase();
                return searchable.includes(q);
              }).length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                  No accounts match your search
                </div>
              ) : allUsers.filter(u => u.uid !== userProfile?.uid).filter(u => {
                const q = userSearch.trim().toLowerCase();
                if (!q) return true;
                const searchable = [
                  u.displayName,
                  `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                  u.email,
                  u.churchName
                ].filter(Boolean).join(' ').toLowerCase();
                return searchable.includes(q);
              }).map(u => {
                const name = u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                const photo = u.profilePicture;
                const initials = (name || 'M').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
                const isSelected = participantIds.includes(u.uid);
                return (
                  <div 
                    key={u.uid} 
                    className={`w-full p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'border-indigo-300 bg-indigo-50/20 ring-1 ring-indigo-300' 
                        : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`} 
                    onClick={() => openDirectWith(u.uid)} 
                    role="button" 
                    tabIndex={0}
                  >
                    <div className="shrink-0">
                      {photo ? (
                        <img src={photo} alt={name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 text-white flex items-center justify-center text-xs font-semibold shadow-sm">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-400 truncate">{u.churchName || u.email || 'Community Member'}</div>
                    </div>
                    
                    <div className="relative flex items-center" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        id={`checkbox-${u.uid}`}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-1 cursor-pointer" 
                        checked={isSelected} 
                        onChange={(e) => {
                          setParticipantIds(prev => e.target.checked ? [...prev, u.uid] : prev.filter(id => id !== u.uid));
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Group Creator Panel */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <input 
                  value={groupName} 
                  onChange={(e)=>setGroupName(e.target.value)} 
                  placeholder="Group Subject..." 
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" 
                />
                <button 
                  disabled={participantIds.length < 2} 
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white disabled:opacity-40 disabled:scale-100 transition-all shadow-md shadow-indigo-500/10" 
                  onClick={startGroup}
                >
                  Create
                </button>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                <span>Select 2+ members to form a group. Tap one person for a DM.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: conversation pane */}
      <div className={`flex-1 flex flex-col bg-white ${activeThread ? 'flex' : 'hidden md:flex'} h-full overflow-hidden`} >
        {activeThread ? (
          <>
            {/* Active Thread Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-[#f0f2f5] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile back to list */}
                <button 
                  className="md:hidden p-2 rounded-full hover:bg-slate-200 text-slate-600 transition shrink-0" 
                  onClick={() => setActiveThreadId(null)} 
                  aria-label="Back to conversations"
                >
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
                
                {(() => {
                  const title = threadTitle(activeThread);
                  const otherId = (activeThread.participants || []).find(p => p !== userProfile?.uid);
                  const photo = avatarForUid(otherId);
                  return (
                    <>
                      <div className="shrink-0 relative">
                        {photo ? (
                          <img
                            src={photo}
                            alt={title}
                            className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer transition hover:scale-102"
                            onClick={() => setPreviewPhoto(photo)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                            {initialsForName(title)}
                          </div>
                        )}
                      </div>
                      
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate text-sm sm:text-base leading-tight">{title}</div>
                        {activeThread.type === 'group' ? (
                          <div className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                            {(activeThread.participants || []).map(id => nameForUid(id, activeThread)).join(', ')}
                          </div>
                        ) : (
                          <div className="text-[10px] sm:text-xs text-indigo-500 font-semibold truncate mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                            <span>Active chat room</span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Header actions dropdown */}
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button 
                    className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                    onClick={() => {
                      const t = activeThread;
                      setMenuOpenId(menuOpenId === t.id ? null : t.id);
                    }}
                    aria-label="Thread Settings"
                  >
                    <EllipsisVerticalIcon className="w-5 h-5" />
                  </button>
                  
                  {menuOpenId === activeThread.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-150 rounded-xl shadow-xl z-20 animate-scale-in overflow-hidden">
                        {!activeThread.archived ? (
                          <button 
                            className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition" 
                            onClick={async () => { 
                              setMenuOpenId(null); 
                              await chatService.archiveThread(activeThread.id); 
                              setActiveThreadId(null);
                              showToast('success', 'Archived', 'Conversation archived.'); 
                            }}
                          >
                            Archive
                          </button>
                        ) : (
                          <button 
                            className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition" 
                            onClick={async () => { 
                              setMenuOpenId(null); 
                              await chatService.unarchiveThread(activeThread.id); 
                              setActiveThreadId(null);
                              showToast('success', 'Unarchived', 'Conversation restored.'); 
                            }}
                          >
                            Unarchive
                          </button>
                        )}
                        <button 
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition border-t border-slate-150" 
                          onClick={async () => {
                            setMenuOpenId(null);
                            const choice = window.prompt('Delete conversation: type DELETE to confirm. Type SOFT to hide only for you.');
                            if (!choice) return;
                            try {
                              if (choice.toUpperCase() === 'DELETE') {
                                await chatService.hardDeleteThread(activeThread.id);
                                setActiveThreadId(null);
                                showToast('success', 'Deleted', 'Conversation permanently deleted.');
                              } else if (userProfile?.uid && choice.toUpperCase() === 'SOFT') {
                                await chatService.softDeleteForUser(activeThread.id, userProfile.uid);
                                setActiveThreadId(null);
                                showToast('success', 'Hidden', 'Conversation hidden for you.');
                              }
                            } catch (e: any) {
                              showToast('error', 'Failed', e?.message || '');
                            }
                          }}
                        >
                          Delete Chat…
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Conversation Canvas Wallpaper */}
            <div 
              className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 relative bg-[#efeae2]" 
              style={{
                minHeight: 0,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%239C92AC' fill-opacity='0.08'%3E%3Cpath d='M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10zm10 8c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm40 40c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z'/%3E%3C/g%3E%3C/svg%3E")`
              }}
            >
              <div className="space-y-1.5 pb-8 max-w-5xl mx-auto">
                {messages.map((m) => {
                  const mine = m.senderId === userProfile?.uid;
                  
                  // Ticks for sender's messages
                  let ticks: 'one' | 'two' | 'three' | null = null;
                  if (mine) {
                    if ((m as any)._pending || (m as any)._fromCache) {
                      ticks = 'one';
                    } else {
                      const created = (m as any).createdAt?.toMillis?.() || (m.createdAt ? new Date(m.createdAt).getTime() : 0);
                      const others = (activeThread?.participants || []).filter(p => p !== userProfile?.uid);
                      const anyRead = others.some(p => {
                        const readAt = activeThread?.lastReadAt?.[p];
                        const readMillis = readAt?.toMillis?.() || (readAt ? new Date(readAt).getTime() : 0);
                        return readMillis >= created;
                      });
                      ticks = anyRead ? 'three' : 'two';
                    }
                  }

                  const senderName = nameForUid(m.senderId, activeThread);

                  return (
                    <div 
                      key={m.id} 
                      className={`flex w-full mb-1 ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[85%] sm:max-w-[70%] px-3 py-1.5 rounded-2xl shadow-sm text-sm relative transition-all duration-200 hover:shadow-md ${
                          mine 
                            ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none' 
                            : 'bg-white text-[#111b21] rounded-tl-none border border-slate-100'
                        }`}
                      >
                        {/* Group Chat Participant Name (if not me and it's a group thread) */}
                        {activeThread?.type === 'group' && !mine && (
                          <div className="text-[11px] font-bold text-indigo-600 mb-0.5 truncate select-none">
                            {senderName}
                          </div>
                        )}

                        {m.attachments?.length ? (
                          <div className="space-y-1.5">
                            {m.attachments.filter(a => a.type === 'image').map((a, i) => (
                              <div key={i} className="relative group/img overflow-hidden rounded-xl bg-slate-100">
                                <img 
                                  src={a.url} 
                                  alt={a.name || 'image'} 
                                  className="max-h-72 w-full object-cover cursor-pointer transition duration-300 group-hover/img:scale-[1.01]" 
                                  onClick={() => setPreviewPhoto(a.url)} 
                                />
                              </div>
                            ))}
                            {m.text && <div className="whitespace-pre-wrap leading-relaxed select-text">{m.text}</div>}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap leading-relaxed select-text">{m.text}</div>
                        )}

                        {/* Message Info Row (Time & Read Ticks) */}
                        <div className="mt-1 text-[9.5px] flex items-center justify-end gap-1 select-none text-slate-400 float-right ml-4 -mr-1 -mb-0.5">
                          <span>{formatTime((m as any).createdAt)}</span>
                          {mine && (
                            <span className="inline-flex items-center ml-0.5">
                              {ticks === 'one' && (
                                <CheckIcon className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              {ticks === 'two' && (
                                <div className="flex -space-x-1.5 shrink-0">
                                  <CheckIcon className="w-3.5 h-3.5 text-slate-400" />
                                  <CheckIcon className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                              )}
                              {ticks === 'three' && (
                                <div className="flex -space-x-1.5 shrink-0">
                                  <CheckIcon className="w-3.5 h-3.5 text-[#53bdeb]" />
                                  <CheckIcon className="w-3.5 h-3.5 text-[#53bdeb]" />
                                </div>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
            </div>

            {/* Premium Floating Typing Console */}
            <div className="p-3 sm:p-4 bg-[#f0f2f5] border-t border-slate-200/60 sticky bottom-0 z-10">
              <div className="max-w-4xl mx-auto flex items-end gap-2 relative">
                {/* Emoji Popover */}
                {isEmojiOpen && (
                  <div 
                    ref={emojiPopoverRef} 
                    className="absolute bottom-16 left-2 z-[2000] bg-white border border-slate-150 rounded-2xl shadow-2xl p-1.5 animate-scale-in"
                  >
                    <EmojiPickerHost 
                      onEmoji={(emoji) => {
                        const el = textAreaRef.current;
                        if (!el) return;
                        const start = el.selectionStart || messageText.length;
                        const end = el.selectionEnd || messageText.length;
                        const next = messageText.slice(0, start) + emoji + messageText.slice(end);
                        setMessageText(next);
                        requestAnimationFrame(() => {
                          el.focus();
                          const pos = start + emoji.length;
                          el.setSelectionRange(pos, pos);
                          // Trigger autosize
                          el.style.height = 'auto';
                          const max = 160;
                          el.style.height = Math.min(el.scrollHeight, max) + 'px';
                        });
                      }} 
                      onClose={() => setIsEmojiOpen(false)} 
                    />
                  </div>
                )}

                {/* Pending Image Preview */}
                {pendingImage && (
                  <div className="absolute -top-24 left-0 w-full flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 mb-2 shadow-xl animate-slide-up">
                    <img src={pendingImage.url} alt="preview" className="h-16 w-16 object-cover rounded-xl shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">{pendingImage.file.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">Pending attachment</div>
                    </div>
                    <button 
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 transition" 
                      onClick={() => setPendingImage(null)}
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Main Pill Input Container */}
                <div className="flex-1 flex items-end gap-2 bg-white px-3.5 py-2 rounded-xl shadow-sm border border-slate-200">
                  {/* Emoji Toggle */}
                  <button
                    type="button"
                    className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition duration-150"
                    aria-label="Emoji Menu"
                    onClick={() => setIsEmojiOpen((v) => !v)}
                  >
                    <SmileIcon className="w-5.5 h-5.5" />
                  </button>

                  {/* Attachment Media Trigger */}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <button
                    type="button"
                    className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition duration-150"
                    aria-label="Attach File"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <PhotoIcon className="w-5.5 h-5.5" />
                  </button>

                  {/* Message Input TextArea */}
                  <textarea
                    ref={textAreaRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter' && !e.shiftKey) { 
                        e.preventDefault(); 
                        if (pendingImage) {
                          sendImage();
                        } else {
                          send();
                        }
                      } 
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 bg-transparent border-none text-sm text-slate-900 placeholder-slate-400 focus:ring-0 outline-none resize-none max-h-40 py-1"
                    style={{ height: 'auto' }}
                    onInput={() => {
                      const el = textAreaRef.current;
                      if (el) {
                        el.style.height = 'auto';
                        const max = 160;
                        el.style.height = Math.min(el.scrollHeight, max) + 'px';
                      }
                    }}
                  />
                </div>

                {/* Main Send Trigger */}
                <button 
                  onClick={pendingImage ? sendImage : send} 
                  disabled={uploading || (!messageText.trim() && !pendingImage)} 
                  className="h-11 w-11 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 active:scale-90 text-white shadow-md flex items-center justify-center transition-all duration-150"
                  title="Send Message"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <ArrowRightIcon className="w-5 h-5 stroke-[2.2]" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty Chat Room Workspace Placeholder */
          <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f8f9fa] border-l border-slate-200">
            <div className="max-w-md w-full px-6 text-center space-y-6 flex flex-col items-center">
              {/* WhatsApp-like Elegant Chat Icon */}
              <div className="w-24 h-24 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
                <ChatBubbleLeftRightIcon className="w-12 h-12 stroke-[1.5]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">SAT Mobile Web Chat</h3>
                <p className="text-[13.5px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Send and receive messages in real-time. Keep your phone connected. Select an existing thread or start a new conversation.
                </p>
              </div>

              <button 
                className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-semibold text-sm shadow-md transition duration-200" 
                onClick={() => setIsCreating(true)}
              >
                New Conversation
              </button>

              {/* End-to-end Encrypted Shield Banner */}
              <div className="pt-8 border-t border-slate-200 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 select-none">
                <ShieldCheckIcon className="w-4 h-4 text-indigo-500/80" />
                <span>End-to-end encrypted. Protected by Benighter Global Limited.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox photo preview */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[11000] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setPreviewPhoto(null)}>
          <button
            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition"
            onClick={(e) => { e.stopPropagation(); setPreviewPhoto(null); }}
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <img src={previewPhoto} alt="Preview" className="max-w-[92vw] max-h-[85vh] rounded-xl shadow-2xl object-contain animate-scale-in" />
        </div>
      )}
    </div>
  );
};

export default ChatView;
