import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  ChevronLeft,
  Coffee,
  Crown,
  Flame,
  Gift,
  MessageCircle,
  Mic,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type { LabMessage, LabTopic } from '../../types';

const ADMIN_NAME = 'ThisBeatIzBananaz™';
const FAMZ_NAME = 'FAMZ';
const ADMIN_AVATAR = '/assets/images/thisbeatizbananazmainlogo copy.png';
const FAMZ_ICON = '/assets/images/thisbeatizbananazmainlogo copy.png';

const TOPICS: { id: LabTopic; label: string; icon: ReactNode }[] = [
  { id: 'chat', label: 'Chat', icon: <MessageCircle size={18} /> },
  { id: 'drops', label: 'Drops', icon: <Zap size={18} /> },
  { id: 'exclusives', label: 'Exclusives', icon: <Flame size={18} /> },
  { id: 'giftdrop', label: 'Gift Drop', icon: <Gift size={18} /> },
  { id: 'updates', label: 'Updates', icon: <Bell size={18} /> },
  { id: 'colab', label: 'Co-Lab Corner', icon: <Users size={18} /> },
  { id: 'prodtalk', label: 'Prod Talk', icon: <Mic size={18} /> },
  { id: 'cookup', label: 'The Cookup', icon: <Coffee size={18} /> },
];

const REACTIONS = ['🔥', '👏', '💯', '😎', '💪', '🍌', '⚡'];

function safeTime(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function uniqueReactionName(isAdmin: boolean) {
  return isAdmin ? ADMIN_NAME : FAMZ_NAME;
}

function isDuplicateMessage(existing: LabMessage[], incoming: LabMessage) {
  return existing.some((message) => message.id === incoming.id);
}

function getMessagePreview(message?: LabMessage) {
  if (!message?.text) return '';

  return `${message.text.slice(0, 50)}${message.text.length > 50 ? '...' : ''}`;
}

export function TheLabRoom() {
  const { goBack, isAdmin, addToast } = useApp();
  const [activeTopic, setActiveTopic] = useState<LabTopic>('chat');
  const [messages, setMessages] = useState<LabMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<LabMessage | null>(null);
  const [announcementMode, setAnnouncementMode] = useState(false);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);

  const currentDisplayName = isAdmin ? ADMIN_NAME : FAMZ_NAME;

  const activeTopicLabel = useMemo(() => {
    return TOPICS.find((topic) => topic.id === activeTopic)?.label || 'The Lab';
  }, [activeTopic]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('lab_messages')
      .select('*')
      .eq('room', activeTopic)
      .eq('admin_approved', true)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      addToast('The Lab messages could not load.', 'error');
      setMessages([]);
    } else {
      setMessages((data || []) as LabMessage[]);
    }

    setLoading(false);
  }, [activeTopic, addToast]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`lab-${activeTopic}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lab_messages',
          filter: `room=eq.${activeTopic}`,
        },
        (payload) => {
          const nextMessage = payload.new as LabMessage;

          if (nextMessage.admin_approved === false) {
            return;
          }

          setMessages((currentMessages) => {
            if (isDuplicateMessage(currentMessages, nextMessage)) return currentMessages;
            return [...currentMessages, nextMessage];
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lab_messages',
          filter: `room=eq.${activeTopic}`,
        },
        (payload) => {
          const updatedMessage = payload.new as LabMessage;

          setMessages((currentMessages) =>
            currentMessages
              .map((message) => (message.id === updatedMessage.id ? updatedMessage : message))
              .filter((message) => message.admin_approved !== false),
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'lab_messages',
          filter: `room=eq.${activeTopic}`,
        },
        (payload) => {
          const deletedMessage = payload.old as LabMessage;

          setMessages((currentMessages) =>
            currentMessages.filter((message) => message.id !== deletedMessage.id),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTopic, fetchMessages]);

  const sendMessage = async () => {
    if (!isAdmin) {
      addToast('Tap a post to react.', 'info');
      return;
    }

    const cleanText = text.trim();

    if (!cleanText || sending) return;

    setSending(true);

    const messageBody: Partial<LabMessage> = {
      sender_type: 'admin',
      sender_name: ADMIN_NAME,
      sender_avatar: ADMIN_AVATAR,
      text: cleanText,
      room: activeTopic,
      topic: activeTopic,
      reactions: {},
      attachments: [],
      is_automated: false,
      admin_approved: true,
    };

    if (replyTo?.id) {
      messageBody.reply_to = replyTo.id;
    }

    const { error } = await supabase.from('lab_messages').insert(messageBody);

    if (error) {
      addToast('Message failed to send.', 'error');
    } else {
      setText('');
      setReplyTo(null);
      setAnnouncementMode(false);
      addToast('Update posted.', 'success');
    }

    setSending(false);
  };

  const addReaction = async (msgId: string, emoji: string) => {
    const targetMessage = messages.find((message) => message.id === msgId);
    if (!targetMessage || busyMessageId) return;

    setBusyMessageId(msgId);

    const reactions = { ...(targetMessage.reactions || {}) };
    const userName = uniqueReactionName(isAdmin);
    const currentUsers = reactions[emoji] || [];
    const nextUsers = currentUsers.includes(userName)
      ? currentUsers.filter((name) => name !== userName)
      : [...currentUsers, userName];

    reactions[emoji] = nextUsers;

    const { error } = await supabase.from('lab_messages').update({ reactions }).eq('id', msgId);

    if (error) {
      addToast('Reaction failed.', 'error');
      setBusyMessageId(null);
      return;
    }

    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === msgId ? { ...message, reactions } : message,
      ),
    );

    setBusyMessageId(null);
  };

  const deleteMessage = async (msgId: string) => {
    if (!isAdmin || busyMessageId) return;

    const confirmed = window.confirm('Delete this Lab post?');
    if (!confirmed) return;

    setBusyMessageId(msgId);

    const { error } = await supabase.from('lab_messages').delete().eq('id', msgId);

    if (error) {
      addToast('Lab post delete failed.', 'error');
      setBusyMessageId(null);
      return;
    }

    setMessages((currentMessages) => currentMessages.filter((message) => message.id !== msgId));
    addToast('Lab post deleted.', 'success');
    setBusyMessageId(null);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    sendMessage();
  };

  const insertAdminAllTag = () => {
    if (!isAdmin) return;

    setText((currentText) => `${currentText.trim()} @ALL `.trimStart());
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070707] text-white">
      <div className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft size={20} />
            </button>

            <div>
              <h1 className="font-display font-800 text-xl uppercase tracking-wide text-white leading-none">
                The Lab
              </h1>
              <p className="text-[10px] text-[#555] mt-0.5">
                drops � previews � updates
              </p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[#111] border border-[#1e1e1e] text-xs text-[#888]">
            {isAdmin ? currentDisplayName : 'Tapped In'}
          </div>
        </div>

        <div className="scroll-x flex gap-2 px-4 pb-3">
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setActiveTopic(topic.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition-all ${
                activeTopic === topic.id
                  ? 'bg-[#f5c518] text-black shadow-lg shadow-[#f5c518]/10'
                  : 'bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-white hover:border-[#2a2a2a]'
              }`}
            >
              {topic.icon}
              {topic.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-40">
        <div className="rounded-2xl border border-[#1d1d1d] bg-[#101010] p-4">
          <div className="flex items-center gap-2 text-[#f5c518] text-xs font-bold uppercase tracking-[0.2em]">
            <ShieldCheck size={14} />
            {activeTopicLabel}
          </div>

          <p className="mt-2 text-xs text-[#777] leading-relaxed">
            Welcome to The Cookup Lab. New drops, updates, behind-the-scenes previews here.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#f5c518] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-[#444]">
            <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
            <div className="text-sm">Nothing posted here yet.</div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              msg={message}
              isAdminMessage={message.sender_type === 'admin'}
              replyMsg={
                message.reply_to
                  ? messages.find((replyMessage) => replyMessage.id === message.reply_to)
                  : undefined
              }
              onReply={() => {
                if (isAdmin) {
                  setReplyTo(message);
                }
              }}
              onReact={(emoji) => addReaction(message.id, emoji)}
              onDelete={() => deleteMessage(message.id)}
              currentUser={isAdmin ? currentDisplayName : 'Tapped In'}
              isAdmin={isAdmin}
              busy={busyMessageId === message.id}
            />
          ))
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#1a1a1a] pb-safe">
        {replyTo && isAdmin && (
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <div className="text-xs text-[#888]">
              Replying to <span className="text-[#f5c518]">{ADMIN_NAME}</span>
            </div>

            <button
              onClick={() => setReplyTo(null)}
              className="text-[#555] hover:text-white p-1"
              aria-label="Cancel reply"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {isAdmin && announcementMode && (
          <div className="px-4 pt-2">
            <div className="rounded-xl border border-[#f5c518]/25 bg-[#f5c518]/10 px-3 py-2 text-[11px] text-[#f5c518]">
              Spotlight post active. Use it when you want this update to hit harder.
            </div>
          </div>
        )}

        {isAdmin ? (
          <div className="flex flex-col items-center gap-2 px-4 py-3">
            <div className="flex items-center gap-2 w-full">
              <input
                className="input-dark flex-1 px-4 py-3 text-sm"
                placeholder={`Drop an update in #${activeTopic}...`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleInputKeyDown}
              />

              <button
                onClick={sendMessage}
                disabled={!text.trim() || sending}
                className="btn-gold px-4 py-3 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 w-full">
              <button
                onClick={() => setAnnouncementMode((value) => !value)}
                className={`px-3 py-2 rounded-xl text-xs border transition-all ${
                  announcementMode
                    ? 'bg-[#f5c518] text-black border-[#f5c518]'
                    : 'bg-[#111] text-[#888] border-[#1e1e1e] hover:text-white'
                }`}
              >
                Spotlight
              </button>

              <button
                onClick={insertAdminAllTag}
                className="px-3 py-2 rounded-xl text-xs bg-[#111] text-[#888] border border-[#1e1e1e] hover:text-white transition-all"
              >
                @ALL
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 text-center">
            <div className="rounded-2xl bg-[#111] border border-[#1e1e1e] px-4 py-3">
              <div className="text-xs text-[#f5c518] uppercase tracking-[0.18em] font-bold">
                Updates from ThisBeatIzBananaz�
              </div>
              <div className="text-[11px] text-[#666] mt-1">
                Tap in, react, and catch what's cooking.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  isAdminMessage,
  replyMsg,
  onReply,
  onReact,
  onDelete,
  currentUser,
  isAdmin,
  busy,
}: {
  msg: LabMessage;
  isAdminMessage: boolean;
  replyMsg?: LabMessage;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  currentUser: string;
  isAdmin: boolean;
  busy: boolean;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const visibleName = isAdminMessage ? ADMIN_NAME : FAMZ_NAME;
  const avatarSrc = isAdminMessage ? msg.sender_avatar || ADMIN_AVATAR : FAMZ_ICON;
  const totalReactions = Object.entries(msg.reactions || {}).filter(([, users]) => users.length > 0);

  return (
    <div className={`flex gap-2 group ${isAdminMessage ? 'flex-row-reverse' : ''}`}>
      <div
        className={`relative w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-visible mt-1 ${
          isAdminMessage ? 'bg-[#f5c518] shadow-lg shadow-[#f5c518]/20' : 'bg-[#1a1a1a] border border-[#252525]'
        }`}
      >
        {isAdminMessage && (
          <Crown
            size={14}
            className="absolute -top-2 -left-1 z-10 text-[#f5c518] drop-shadow-[0_0_6px_rgba(245,197,24,0.6)]"
            style={{ transform: 'rotate(-45deg)' }}
          />
        )}

        <img
          src={avatarSrc}
          alt={visibleName}
          className={isAdminMessage ? 'w-full h-full rounded-full object-cover' : 'w-5 h-5 object-contain opacity-70'}
        />
      </div>

      <div className={`flex-1 ${isAdminMessage ? 'items-end' : 'items-start'} flex flex-col gap-1 max-w-[80%] relative`}>
        <div className={`flex items-center gap-2 ${isAdminMessage ? 'flex-row-reverse' : ''}`}>
          <span className={`text-xs font-bold ${isAdminMessage ? 'text-[#f5c518]' : 'text-[#aaa]'}`}>
            {visibleName}
          </span>
          <span className="text-[10px] text-[#444]">{safeTime(msg.created_at)}</span>
          {msg.is_automated && <span className="text-[9px] text-[#333]">· live</span>}
        </div>

        {replyMsg && (
          <div className="px-2 py-1 rounded-lg border-l-2 border-[#f5c518]/40 bg-[#0f0f0f] text-xs text-[#666] max-w-full">
            <span className="text-[#f5c518]">{replyMsg.sender_type === 'admin' ? ADMIN_NAME : FAMZ_NAME}</span>
            {getMessagePreview(replyMsg) ? `: ${getMessagePreview(replyMsg)}` : ''}
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactions((value) => !value)}
            className={`block text-left px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isAdminMessage
                ? 'bg-gradient-to-br from-[#f5c518] to-[#c99700] text-black rounded-tr-sm shadow-lg shadow-[#f5c518]/20'
                : 'bg-[#161616] text-[#e0e0e0] border border-[#1e1e1e] rounded-tl-sm'
            }`}
          >
            {msg.text}
          </button>
        </div>

        {totalReactions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {totalReactions.map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                disabled={busy}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all disabled:opacity-40 ${
                  users.includes(currentUser)
                    ? 'bg-[#f5c518]/10 border-[#f5c518]/30'
                    : 'bg-[#111] border-[#1e1e1e] hover:border-[#2a2a2a]'
                }`}
              >
                {emoji} <span className="text-[#888]">{users.length}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-1 opacity-100 transition-opacity ${isAdminMessage ? 'flex-row-reverse' : ''}`}>
          {isAdmin && (
            <button
              onClick={onReply}
              className="text-[10px] text-[#555] hover:text-[#888] px-1 py-0.5 rounded transition-colors"
            >
              Reply
            </button>
          )}

          <button
            onClick={() => setShowReactions((value) => !value)}
            className="text-[10px] text-[#555] hover:text-[#888] px-1 py-0.5 rounded transition-colors"
          >
            React
          </button>

          {isAdmin && (
            <button
              onClick={onDelete}
              disabled={busy}
              className="text-[10px] text-red-500 hover:text-red-300 px-1 py-0.5 rounded transition-colors disabled:opacity-40"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {showReactions && (
          <div className="flex gap-1 bg-[#111] border border-[#1e1e1e] rounded-full px-2 py-1 shadow-xl">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(emoji);
                  setShowReactions(false);
                }}
                disabled={busy}
                className="hover:scale-125 transition-transform text-base disabled:opacity-40"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



