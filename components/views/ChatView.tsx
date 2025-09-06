import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { chatService, ChatThread, ChatMessage } from '../../services/chatService';
import { userService } from '../../services/userService';
import { User } from '../../types';
import { ChatBubbleLeftRightIcon, ArrowRightIcon, ArrowLeftIcon, EllipsisVerticalIcon, XMarkIcon, SmileIcon, PhotoIcon, CheckIcon } from '../icons';


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
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
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
      const id = await chatService.createDirectThread(uid, userProfile);
      setActiveThreadId(id);
    }
    setIsCreating(false);
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
    // Only show threads with at least one message
    const withMessages = threads.filter(t => !!t.lastMessage);
    const scoped = withMessages.filter(t => (showArchived ? !!t.archived : !t.archived));
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(t => threadTitle(t).toLowerCase().includes(q));
  }, [threads, search, showArchived]);

  const activeThread = threads.find(t => t.id === activeThreadId) || null;

  return (
    <div className="flex h-[var(--available-height-dvh)] min-h-[var(--available-height-dvh)] max-h-[var(--available-height-dvh)] overflow-hidden">
      {/* Left: thread list (WhatsApp-like) */}
      <div className={`md:w-[34%] md:min-w-[300px] w-full border-r border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 flex-col ${activeThread ? 'hidden md:flex' : 'flex'}`} style={{height: '100%'}} >
        <div className="p-4 border-b border-gray-200 dark:border-dark-600">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ChatBubbleLeftRightIcon className="w-5 h-5"/> Chat</h2>
            <div className="flex items-center gap-2">
              <button className={`px-2 py-1 rounded-md text-xs ${!showArchived ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={()=>setShowArchived(false)}>Active</button>
              <button className={`px-2 py-1 rounded-md text-xs ${showArchived ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={()=>setShowArchived(true)}>Archived</button>
              <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm shadow-sm hover:bg-blue-700" onClick={()=>setIsCreating(true)}>New</button>
            </div>
          </div>
          <div className="mt-3">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-600 bg-slate-50 dark:bg-dark-700 focus:ring-2 focus:ring-blue-300 outline-none" placeholder={`Search ${showArchived ? 'archived' : 'conversations'}`} />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {!isCreating ? (
            <div className="h-full overflow-y-auto divide-y divide-gray-100 dark:divide-dark-700">
              {filteredThreads.map(t => {
                const title = threadTitle(t);
                const last = t.lastMessage?.text || '';
                const time = t.lastMessage?.at ? formatTime(t.lastMessage.at) : '';
                const unread = t.unreadCounts?.[userProfile?.uid || ''] || 0;
                const otherId = (t.participants || []).find(p => p !== userProfile?.uid);
                const photo = avatarForUid(otherId);
                const isMenuOpen = menuOpenId === t.id;
                return (
                  <div key={t.id} className={`group w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-dark-700 transition ${activeThreadId===t.id ? 'bg-blue-50/60 dark:bg-dark-700' : ''}`}>
                    <button onClick={()=>setActiveThreadId(t.id)} className="flex items-center gap-3 flex-1 text-left">
                      <div className="flex-shrink-0">
                        {photo ? (
                          <img
                            src={photo}
                            alt={title}
                            className="w-11 h-11 rounded-full object-cover shadow cursor-zoom-in"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewPhoto(photo); }}
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow text-sm font-semibold">{initialsForName(title)}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
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
                    <div className="relative">
                      <button className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition p-1 rounded hover:bg-gray-100" onClick={()=>setMenuOpenId(isMenuOpen ? null : t.id)} aria-label="More">
                        <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
                      </button>
                      {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg shadow-lg z-20">
                          {!t.archived ? (
                            <button className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={async()=>{ setMenuOpenId(null); await chatService.archiveThread(t.id); showToast('success','Archived','Conversation archived.'); }}>Archive</button>
                          ) : (
                            <button className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={async()=>{ setMenuOpenId(null); await chatService.unarchiveThread(t.id); showToast('success','Unarchived','Conversation restored.'); }}>Unarchive</button>
                          )}
                          <button className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={async()=>{
                            setMenuOpenId(null);
                            const choice = window.prompt('Delete conversation: type DELETE to confirm. Type SOFT to hide only for you.');
                            if (!choice) return;
                            try {
                              if (choice.toUpperCase() === 'DELETE') {
                                await chatService.hardDeleteThread(t.id);
                                if (activeThreadId === t.id) setActiveThreadId(null);
                                showToast('success','Deleted','Conversation permanently deleted.');
                              } else if (userProfile?.uid && choice.toUpperCase() === 'SOFT') {
                                await chatService.softDeleteForUser(t.id, userProfile.uid);
                                if (activeThreadId === t.id) setActiveThreadId(null);
                                showToast('success','Hidden','Conversation hidden for you.');
                              }
                            } catch(e: any) {
                              showToast('error','Failed', e?.message || '');
                            }
                          }}>Delete…</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-600 flex items-center gap-2">
                <button className="md:hidden p-1 rounded-full hover:bg-gray-100" onClick={()=>setIsCreating(false)}>Back</button>
                <div className="font-semibold">Start a conversation</div>
                <div className="ml-auto">
                  <button className="text-sm text-gray-600 hover:text-gray-800" onClick={()=>{setIsCreating(false); setParticipantIds([]); setGroupName('');}}>Close</button>
                </div>
              </div>
              <div className="p-3 border-b border-gray-200 dark:border-dark-600">
                <input value={userSearch} onChange={(e)=>setUserSearch(e.target.value)} placeholder="Search people" className="w-full px-3 py-2 rounded-lg border" />
              </div>
              <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allUsers.filter(u => u.uid !== userProfile?.uid).filter(u => {
                  const q = userSearch.trim().toLowerCase();
                  if (!q) return true;
                  const name = (u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '').toLowerCase();
                  return name.includes(q);
                }).map(u => {
                  const name = u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                  const photo = u.profilePicture;
                  const initials = (name || 'M').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
                  const isSelected = participantIds.includes(u.uid);
                  return (
                    <div key={u.uid} className={`w-full p-2 rounded-xl border flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-dark-700 ${isSelected ? 'ring-2 ring-blue-400 border-blue-300' : ''}`} onClick={() => openDirectWith(u.uid)} role="button" tabIndex={0}>
                      {photo ? <img src={photo} alt={name} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold">{initials}</div>}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{name}</div>
                        <div className="text-xs text-gray-500 truncate">Tap to chat. Use checkbox to multi-select.</div>
                      </div>
                      <input type="checkbox" className="w-4 h-4" checked={isSelected} onClick={e => e.stopPropagation()} onChange={(e) => {
                        e.stopPropagation();
                        setParticipantIds(prev => e.target.checked ? [...prev, u.uid] : prev.filter(id => id !== u.uid));
                      }} />
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-dark-600 bg-white/70 dark:bg-dark-800/70 backdrop-blur">
                <div className="flex items-center gap-2">
                  <input value={groupName} onChange={(e)=>setGroupName(e.target.value)} placeholder="Group name (optional)" className="flex-1 px-3 py-2 rounded-lg border" />
                  <button disabled={participantIds.length<2} className="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50" onClick={startGroup}>Create Group</button>
                </div>
                <div className="text-xs text-gray-500 mt-1">Select 2+ people then Create Group. Tapping a single person opens/reuses a DM.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: conversation */}
      <div className={`flex-1 flex flex-col bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cg fill=%22%23e5e7eb%22 fill-opacity=%220.5%22%3E%3Ccircle cx=%220%22 cy=%220%22 r=%221%22/%3E%3C/g%3E%3C/svg%3E')] bg-repeat dark:bg-none bg-white dark:bg-dark-800 ${activeThread ? 'flex' : 'hidden md:flex'}`} style={{height: '100%'}} >
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
                    {photo ? (
                      <img
                        src={photo}
                        alt={title}
                        className="w-8 h-8 rounded-full object-cover cursor-zoom-in"
                        onClick={() => setPreviewPhoto(photo)}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-semibold">
                        {initialsForName(title)}
                      </div>
                    )}
                    <div className="font-semibold text-gray-800 dark:text-dark-100 truncate">{title}</div>
                  </>
                );
              })()}
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4" style={{minHeight: 0}}>
              <div className="space-y-2 pb-10">
                {messages.map(m => {
                  const mine = m.senderId===userProfile?.uid;
                  // Determine status ticks for my messages only
                  let ticks: 'one' | 'two' | 'three' | null = null;
                  if (mine) {
                    // 1 tick (sent/offline) when pending write or from cache
                    if ((m as any)._pending || (m as any)._fromCache) {
                      ticks = 'one';
                    } else {
                      // Check if any other participant has read after message time
                      const created = (m as any).createdAt?.toMillis?.() || 0;
                      const others = (activeThread?.participants || []).filter(p => p !== userProfile?.uid);
                      const anyRead = others.some(p => (activeThread?.lastReadAt?.[p]?.toMillis?.() || 0) >= created);
                      ticks = anyRead ? 'three' : 'two';
                    }
                  }
                  return (
                  <div key={m.id} className={`max-w-[86%] sm:max-w-[78%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed ${mine ? 'ml-auto bg-blue-600 text-white rounded-br-md' : 'bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-dark-100 rounded-bl-md'}`}>
                    {m.attachments?.length ? (
                      <div className="space-y-2">
                        {m.attachments.filter(a=>a.type==='image').map((a,i)=>(
                          <img key={i} src={a.url} alt={a.name||'image'} className="max-h-64 rounded-lg object-cover cursor-zoom-in" onClick={()=> setPreviewPhoto(a.url)} />
                        ))}
                        {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{m.text}</div>
                    )}
                    <div className={`mt-1 text-[10px] flex items-center gap-1 ${mine ? 'text-blue-100' : 'text-gray-500'}`}>
                      <span>{formatTime((m as any).createdAt)}</span>
                      {mine && (
                        <span className="inline-flex items-center ml-1">
                          {ticks === 'one' && (
                            <CheckIcon className="w-3.5 h-3.5 text-gray-200" />
                          )}
                          {ticks === 'two' && (
                            <>
                              <CheckIcon className="w-3.5 h-3.5 -mr-1 text-emerald-300" />
                              <CheckIcon className="w-3.5 h-3.5 text-emerald-300" />
                            </>
                          )}
                          {ticks === 'three' && (
                            <>
                              <CheckIcon className="w-3.5 h-3.5 -mr-1 text-sky-300" />
                              <CheckIcon className="w-3.5 h-3.5 -mr-1 text-sky-300" />
                              <CheckIcon className="w-3.5 h-3.5 text-sky-300" />
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );})}
                <div ref={endRef} />
              </div>
            </div>

            <div className="p-2 sm:p-3 border-t border-gray-200 dark:border-dark-600 sticky bottom-0 bg-white/90 dark:bg-dark-800/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
              <div className="max-w-3xl mx-auto flex items-end gap-2 relative">
                {/* Emoji popover */}
                {isEmojiOpen && (
                  <div ref={emojiPopoverRef} className="absolute bottom-12 left-2 z-[2000] bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-xl p-1">
                    {/* Lazy-load the web component */}
                    <EmojiPickerHost onEmoji={(emoji) => {
                      // Insert emoji at caret
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
                        // trigger autosize
                        el.style.height = 'auto';
                        const max = 160;
                        el.style.height = Math.min(el.scrollHeight, max) + 'px';
                      });
                    }} onClose={() => setIsEmojiOpen(false)} />
                  </div>
                )}

                {pendingImage && (
                  <div className="absolute -top-24 left-0 w-full flex items-center gap-3 bg-white dark:bg-dark-800 p-2 rounded-lg border border-gray-300 dark:border-dark-600 mb-2 shadow">
                    <img src={pendingImage.url} alt="preview" className="h-16 w-16 object-cover rounded" />
                    <div className="flex-1 text-xs text-gray-600 dark:text-dark-300 truncate">{pendingImage.file.name}</div>
                    <button className="text-xs text-red-600 hover:underline" onClick={()=>{ setPendingImage(null); }}>Remove</button>
                  </div>
                )}
                <textarea
                  ref={textAreaRef}


                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}

                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
                  placeholder="Type a message"
                  rows={1}
                  className="flex-1 rounded-xl border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-4 py-2 outline-none focus:ring-2 focus:ring-blue-300 resize-none max-h-40"
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
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button
                  type="button"
                  className="self-end h-10 w-10 inline-flex items-center justify-center rounded-full border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 hover:bg-slate-50 dark:hover:bg-dark-700 shadow-sm"
                  aria-label="Image"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <PhotoIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="self-end h-10 w-10 inline-flex items-center justify-center rounded-full border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 hover:bg-slate-50 dark:hover:bg-dark-700 shadow-sm"
                  aria-label="Emoji"
                  onClick={() => setIsEmojiOpen((v) => !v)}
                >
                  <SmileIcon className="w-5 h-5" />
                </button>
                <button onClick={pendingImage ? sendImage : send} disabled={uploading} className="self-end h-10 px-4 rounded-full bg-blue-600 text-white shadow hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 shrink-0">
                  {uploading ? 'Uploading' : (pendingImage ? 'Send Photo' : 'Send')} <ArrowRightIcon className="w-4 h-4" />
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
      {previewPhoto && (
        <div className="fixed inset-0 z-[11000] bg-black/80 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewPhoto(null)}>
          <button
            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); setPreviewPhoto(null); }}
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <img src={previewPhoto} alt="Profile" className="max-w-[92vw] max-h-[85vh] rounded-xl shadow-2xl object-contain" />
        </div>
      )}



    </div>

  );
};

export default ChatView;
