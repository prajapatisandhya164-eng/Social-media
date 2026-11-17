import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { Avatar } from './Avatar';
import { formatMessageTime, formatRelativeTime } from '../utils/formatters';
import { compressImageFile } from '../utils/imageCompression';
import { MAX_MESSAGE_LENGTH, validateWithServerOrFallback } from '../utils/validation';

interface MessagesViewProps {
  isSlowConnection: boolean;
}

export function MessagesView({ isSlowConnection }: MessagesViewProps) {
  const {
    currentUser,
    allUsers,
    conversations,
    activeConversationId,
    openConversation,
    messagesByConversation,
    startOrOpenDirectChat,
    sendMessage,
    retryMessage,
    markConversationRead,
    openProfile,
  } = useSocial();

  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatPicker, setShowNewChatPicker] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftImage, setDraftImage] = useState<string | undefined>(undefined);
  const [compressing, setCompressing] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const activeMessages = activeConversationId
    ? messagesByConversation[activeConversationId] || []
    : [];

  const getOtherParticipant = (conv: typeof conversations[number]) => {
    const otherUid = conv.participantIds.find((id) => id !== currentUser?.uid) || '';
    const liveUser = allUsers.find((u) => u.uid === otherUid);
    const meta = conv.participants[otherUid];
    return {
      uid: otherUid,
      displayName: liveUser?.displayName || meta?.displayName || 'Member',
      username: liveUser?.username || meta?.username || 'member',
      photoURL: liveUser?.photoURL || meta?.photoURL || '',
      isOnline: liveUser?.isOnline ?? false,
      lastSeenAt: liveUser?.lastSeenAt ?? 0,
    };
  };

  useEffect(() => {
    if (activeConversationId) {
      markConversationRead(activeConversationId);
    }
  }, [activeConversationId, activeMessages.length, markConversationRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeConversationId]);

  const filteredConversations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conv) => {
      const other = getOtherParticipant(conv);
      return (
        other.displayName.toLowerCase().includes(q) ||
        other.username.toLowerCase().includes(q) ||
        conv.lastMessageText.toLowerCase().includes(q)
      );
    });
  }, [conversations, searchTerm, allUsers, currentUser?.uid]);

  const availableContacts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allUsers
      .filter((u) => u.uid !== currentUser?.uid)
      .filter(
        (u) =>
          !q ||
          u.displayName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      );
  }, [allUsers, currentUser?.uid, searchTerm]);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSendError(null);
    setCompressing(true);
    try {
      const res = await compressImageFile(file, {
        lowBandwidth: isSlowConnection,
        maxDimension: isSlowConnection ? 560 : 840,
        maxTargetBytes: isSlowConnection ? 60_000 : 120_000,
      });
      setDraftImage(res.dataUrl);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to attach image.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId) return;
    setSendError(null);

    const check = await validateWithServerOrFallback({
      type: 'message',
      content: draftText,
      hasImage: Boolean(draftImage),
    });

    if (!check.valid) {
      setSendError(check.error || 'Enter a message.');
      return;
    }

    const textToSend = check.sanitizedContent || '';
    const imageToSend = draftImage;
    setDraftText('');
    setDraftImage(undefined);

    await sendMessage(activeConversationId, {
      text: textToSend,
      imageURL: imageToSend,
    });
  };

  const otherActive = activeConversation ? getOtherParticipant(activeConversation) : null;

  return (
    <div className="h-[calc(100dvh-7.25rem)] lg:h-[calc(100dvh-1px)] flex overflow-hidden">
      {/* Left Conversation List */}
      <aside
        className={`w-full md:w-80 lg:w-84 shrink-0 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col bg-zinc-50 dark:bg-[#050507] ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
              Messages
            </h2>
            <button
              type="button"
              onClick={() => setShowNewChatPicker((p) => !p)}
              aria-label="Start new conversation"
              className="min-h-[40px] px-3 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>New</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={showNewChatPicker ? 'Find a user to message...' : 'Search chats...'}
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/70 dark:divide-zinc-800/60">
          {showNewChatPicker ? (
            availableContacts.length === 0 ? (
              <p className="p-6 text-center text-xs text-zinc-500">
                No other registered users found yet.
              </p>
            ) : (
              availableContacts.map((user) => (
                <button
                  key={user.uid}
                  type="button"
                  onClick={async () => {
                    const convId = await startOrOpenDirectChat(user);
                    if (convId) {
                      setShowNewChatPicker(false);
                      openConversation(convId);
                    }
                  }}
                  className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 text-left transition-colors cursor-pointer"
                >
                  <Avatar
                    src={user.photoURL}
                    name={user.displayName}
                    size="md"
                    showPresence
                    isOnline={user.isOnline}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      @{user.username} · {user.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </button>
              ))
            )
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                No conversations yet
              </p>
              <p className="text-xs text-zinc-500">
                Tap New to start a real-time private chat.
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const unread = currentUser ? conv.unreadCounts?.[currentUser.uid] || 0 : 0;
              const isSelected = conv.id === activeConversationId;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => openConversation(conv.id)}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/10 dark:bg-indigo-500/15'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <Avatar
                    src={other.photoURL}
                    name={other.displayName}
                    size="md"
                    showPresence
                    isOnline={other.isOnline}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                        {other.displayName}
                      </span>
                      <span className="text-[11px] text-zinc-500 shrink-0 tabular-nums">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {conv.lastMessageText || 'No messages yet'}
                      </span>
                      {unread > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold inline-flex items-center justify-center tabular-nums shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Chat Thread */}
      <section
        className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-[#08080c] ${
          activeConversationId ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeConversation && otherActive ? (
          <>
            <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center gap-3 bg-zinc-50/90 dark:bg-zinc-950/80 backdrop-blur-md">
              <button
                type="button"
                onClick={() => openConversation('')}
                aria-label="Back to conversations"
                className="md:hidden min-h-[44px] min-w-[44px] -ml-2 inline-flex items-center justify-center rounded-xl text-zinc-600 dark:text-zinc-300 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => openProfile(otherActive.uid)}
                className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
              >
                <Avatar
                  src={otherActive.photoURL}
                  name={otherActive.displayName}
                  size="sm"
                  showPresence
                  isOnline={otherActive.isOnline}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate">
                    {otherActive.displayName}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {otherActive.isOnline
                      ? 'Online'
                      : otherActive.lastSeenAt
                        ? `Last seen ${formatRelativeTime(otherActive.lastSeenAt)}`
                        : `@${otherActive.username}`}
                  </p>
                </div>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
              {activeMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <p className="text-xs text-zinc-500">
                    Say hello to {otherActive.displayName}. Messages sync in real time.
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isMine = msg.senderId === currentUser?.uid;
                  const isRead =
                    msg.status === 'read' ||
                    (otherActive.uid && msg.readBy.includes(otherActive.uid));

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          isMine
                            ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-br-sm'
                            : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm'
                        }`}
                      >
                        {msg.imageURL && (
                          <img
                            src={msg.imageURL}
                            alt="Shared attachment"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="rounded-xl max-h-60 object-cover mb-2"
                          />
                        )}
                        {msg.text && (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                            {msg.text}
                          </p>
                        )}
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums ${
                            isMine ? 'text-indigo-100/80' : 'text-zinc-500'
                          }`}
                        >
                          <span>{formatMessageTime(msg.createdAt)}</span>
                          {isMine && (
                            <>
                              {msg.status === 'sending' && (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              )}
                              {msg.status === 'sent' && !isRead && (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              {isRead && (
                                <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                              )}
                              {msg.status === 'failed' && (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-300" />
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {isMine && msg.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => retryMessage(activeConversation.id, msg.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:underline cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Failed to send · Tap to retry</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {draftImage && (
              <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 bg-zinc-50 dark:bg-zinc-950">
                <img
                  src={draftImage}
                  alt="Attachment preview"
                  className="w-14 h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800"
                />
                <span className="text-xs text-zinc-500 flex-1">Compressed image ready</span>
                <button
                  type="button"
                  onClick={() => setDraftImage(undefined)}
                  aria-label="Remove attachment"
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-zinc-500 hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {sendError && (
              <p className="px-4 py-1 text-xs text-rose-500" role="alert">
                {sendError}
              </p>
            )}

            <form
              onSubmit={handleSend}
              className="p-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImagePick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                aria-label="Attach image"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-zinc-500 hover:text-indigo-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                {compressing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ImagePlus className="w-5 h-5" />
                )}
              </button>

              <input
                type="text"
                maxLength={MAX_MESSAGE_LENGTH}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-h-[44px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={compressing || (!draftText.trim() && !draftImage)}
                aria-label="Send message"
                className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white inline-flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <MessageSquarePlus className="w-7 h-7" />
            </div>
            <h3 className="font-display text-lg font-semibold text-zinc-950 dark:text-white">
              Select a conversation
            </h3>
            <p className="text-sm text-zinc-500 max-w-xs">
              Choose an existing thread or start a new private chat with live read receipts and image sharing.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
