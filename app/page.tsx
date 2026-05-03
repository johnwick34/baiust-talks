"use client";

// app/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// BAIUST Talks — Main Feed
// Features: Google Auth (anonymous alias), 5km Haversine radius filter,
//           real-time Talks feed, upvote/downvote, Anonymous Inbox with
//           identity-reveal handshake.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  MapPin, LogIn, LogOut, Send, ChevronUp, ChevronDown,
  MessageSquare, Shield, ShieldCheck, RefreshCw, Loader2,
  AlertTriangle, Radio, X, Lock, Unlock, PlusCircle, Eye,
} from "lucide-react";

import {
  auth,
  db,
  googleProvider,
  generateAlias,
  haversineDistance,
  createTalk,
  subscribeToTalks,
  voteTalk,
  ensureUserProfile,
  sendMessage,
  subscribeToMessages,
  requestReveal,
} from "@/lib/firebase";

import {
  collection, doc, getDoc, setDoc, onSnapshot,
  query, orderBy, where, getDocs,
} from "firebase/firestore";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Talk {
  id: string;
  content: string;
  alias: string;
  uid: string;
  lat: number;
  lon: number;
  upvotes: number;
  downvotes: number;
  createdAt?: { seconds: number };
}

interface Message {
  id: string;
  alias: string;
  senderUid: string;
  content: string;
  createdAt?: { seconds: number };
}

interface ChatMeta {
  chatId: string;
  partnerAlias: string;
  partnerUid: string;
  revealRequests: string[];
  partnerEmail?: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RADIUS_KM = 5;

function timeAgo(seconds?: number): string {
  if (!seconds) return "just now";
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

/** Top navigation bar */
function Navbar({
  alias,
  onLogin,
  onLogout,
  isAuthed,
  onOpenInbox,
}: {
  alias: string;
  onLogin: () => void;
  onLogout: () => void;
  isAuthed: boolean;
  onOpenInbox: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 glass border-b border-navy-800">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Radio size={14} className="text-emerald-400" />
          </div>
          <span className="font-display font-800 text-base tracking-tight text-slate-100">
            BAIUST<span className="text-emerald-400">Talks</span>
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {isAuthed ? (
            <>
              <span className="badge-emerald hidden sm:flex">{alias}</span>
              <button
                onClick={onOpenInbox}
                className="btn-ghost px-3 py-2 text-xs"
                aria-label="Open inbox"
              >
                <MessageSquare size={14} />
                <span className="hidden sm:inline">Inbox</span>
              </button>
              <button onClick={onLogout} className="btn-ghost px-3 py-2 text-xs">
                <LogOut size={13} />
              </button>
            </>
          ) : (
            <button onClick={onLogin} className="btn-primary text-xs py-2">
              <LogIn size={13} />
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/** Single Talk card */
function TalkCard({
  talk,
  myUid,
  onDm,
  userVotes,
  onVote,
}: {
  talk: Talk;
  myUid: string;
  onDm: (uid: string, alias: string) => void;
  userVotes: Record<string, "up" | "down">;
  onVote: (id: string, type: "up" | "down") => void;
}) {
  const score = talk.upvotes - talk.downvotes;
  const voted = userVotes[talk.id];
  const isOwn = talk.uid === myUid;

  return (
    <article className="card-hover animate-slide-up group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-xs font-display font-700 text-emerald-400 select-none">
            {talk.alias.charAt(0)}
          </div>
          <div>
            <span className="text-xs font-display font-600 text-slate-300">
              {talk.alias}
            </span>
            {isOwn && (
              <span className="ml-1.5 badge-slate text-[10px]">you</span>
            )}
            <p className="text-[10px] text-slate-600">
              {timeAgo(talk.createdAt?.seconds)}
            </p>
          </div>
        </div>
        <span className="badge-slate text-[10px] shrink-0">
          <MapPin size={9} />
          &lt;{RADIUS_KM}km
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-slate-300 leading-relaxed mb-4">{talk.content}</p>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onVote(talk.id, "up")}
          disabled={!!voted || isOwn}
          className={`vote-btn-up ${voted === "up" ? "text-emerald-400 border-emerald-900/40" : ""}`}
        >
          <ChevronUp size={14} />
          <span>{talk.upvotes}</span>
        </button>
        <button
          onClick={() => onVote(talk.id, "down")}
          disabled={!!voted || isOwn}
          className={`vote-btn-down ${voted === "down" ? "text-red-400 border-red-900/40" : ""}`}
        >
          <ChevronDown size={14} />
          <span>{talk.downvotes}</span>
        </button>

        <span className={`ml-1 text-xs font-display font-700 ${
          score > 0 ? "text-emerald-400" : score < 0 ? "text-red-400" : "text-slate-500"
        }`}>
          {score > 0 ? "+" : ""}{score}
        </span>

        {!isOwn && (
          <button
            onClick={() => onDm(talk.uid, talk.alias)}
            className="ml-auto btn-ghost text-xs py-1.5 px-3"
          >
            <MessageSquare size={12} />
            DM
          </button>
        )}
      </div>
    </article>
  );
}

/** Compose new Talk */
function ComposeBox({
  onSubmit,
  disabled,
}: {
  onSubmit: (content: string) => Promise<void>;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const MAX = 280;

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    await onSubmit(trimmed);
    setText("");
    setLoading(false);
  }

  return (
    <div className="card border-emerald-900/30">
      <textarea
        className="textarea-base mb-3"
        rows={3}
        placeholder="What's happening on campus? (anonymous)"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
        }}
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${text.length > MAX * 0.85 ? "text-amber-400" : "text-slate-600"}`}>
          {text.length}/{MAX}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading || disabled}
          className="btn-primary text-xs"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Post Talk
        </button>
      </div>
    </div>
  );
}

/** Anonymous Inbox — sidebar panel */
function InboxPanel({
  myUid,
  myAlias,
  onClose,
}: {
  myUid: string;
  myAlias: string;
  onClose: () => void;
}) {
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [activeChat, setActiveChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load chats where this user is a participant
  useEffect(() => {
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", myUid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: ChatMeta[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const partnerUid = (data.participants as string[]).find((u) => u !== myUid) ?? "";
        return {
          chatId: d.id,
          partnerAlias: generateAlias(partnerUid),
          partnerUid,
          revealRequests: data.revealRequests ?? [],
          partnerEmail: data.emails?.[partnerUid],
        };
      });
      setChats(list);
    });
    return () => unsub();
  }, [myUid]);

  // Subscribe to active chat messages
  useEffect(() => {
    if (!activeChat) return;
    const unsub = subscribeToMessages(activeChat.chatId, setMessages);
    return () => unsub();
  }, [activeChat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!draft.trim() || !activeChat) return;
    await sendMessage({ chatId: activeChat.chatId, senderUid: myUid, content: draft.trim() });
    setDraft("");
  }

  async function handleRevealRequest() {
    if (!activeChat) return;
    await requestReveal(activeChat.chatId, myUid);
  }

  const bothRevealed =
    activeChat &&
    activeChat.revealRequests.includes(myUid) &&
    activeChat.revealRequests.includes(activeChat.partnerUid);

  const myRevealRequested = activeChat?.revealRequests.includes(myUid);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-end sm:justify-end animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full sm:w-96 h-full sm:h-[90vh] sm:max-h-[680px] sm:my-auto sm:mr-4 glass sm:rounded-2xl flex flex-col overflow-hidden animate-slide-up border border-navy-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-navy-800">
          <span className="font-display font-700 text-sm text-slate-200 flex items-center gap-2">
            <MessageSquare size={14} className="text-emerald-400" />
            Anonymous Inbox
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {!activeChat ? (
          /* Chat list */
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                <MessageSquare size={28} className="opacity-30" />
                <p className="text-xs">No conversations yet.</p>
                <p className="text-[11px] text-slate-700">DM someone from the feed.</p>
              </div>
            ) : (
              chats.map((c) => (
                <button
                  key={c.chatId}
                  onClick={() => setActiveChat(c)}
                  className="w-full text-left card hover:border-slate-600 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-xs font-display font-700 text-emerald-400">
                      {c.partnerAlias.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-display font-600 text-slate-300">{c.partnerAlias}</p>
                      {c.revealRequests.length > 0 && (
                        <p className="text-[10px] text-amber-400 flex items-center gap-1">
                          <Eye size={9} /> Reveal requested
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          /* Active conversation */
          <>
            {/* Chat header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-navy-800">
              <button onClick={() => { setActiveChat(null); setMessages([]); }} className="text-slate-500 hover:text-slate-300">
                <X size={13} />
              </button>
              <div className="w-6 h-6 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-xs font-display font-700 text-emerald-400">
                {activeChat.partnerAlias.charAt(0)}
              </div>
              <span className="text-xs font-display font-600 text-slate-300 flex-1">{activeChat.partnerAlias}</span>

              {/* Identity reveal status */}
              {bothRevealed ? (
                <span className="badge-emerald text-[10px] flex items-center gap-1">
                  <ShieldCheck size={10} /> Revealed
                </span>
              ) : (
                <button
                  onClick={handleRevealRequest}
                  disabled={myRevealRequested ?? false}
                  className={`text-[10px] flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
                    myRevealRequested
                      ? "text-amber-400 border-amber-900/40 cursor-default"
                      : "text-slate-400 border-navy-700 hover:border-amber-800/40 hover:text-amber-400"
                  }`}
                  title="Request identity reveal — both must accept"
                >
                  {myRevealRequested ? <ShieldCheck size={10} /> : <Shield size={10} />}
                  {myRevealRequested ? "Requested" : "Request Reveal"}
                </button>
              )}
            </div>

            {/* Identity reveal banner */}
            {bothRevealed && activeChat.partnerEmail && (
              <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-xs text-emerald-400 flex items-center gap-2">
                <Unlock size={11} />
                Partner email: <span className="font-medium">{activeChat.partnerEmail}</span>
              </div>
            )}
            {!bothRevealed && activeChat.revealRequests.includes(activeChat.partnerUid) && !myRevealRequested && (
              <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-800/30 text-xs text-amber-400 flex items-center gap-2">
                <Eye size={11} />
                Partner requested identity reveal.
                <button onClick={handleRevealRequest} className="underline font-medium">Accept</button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m) => {
                const isMe = m.senderUid === myUid;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      isMe
                        ? "bg-emerald-600/20 border border-emerald-800/30 text-emerald-100 rounded-tr-sm"
                        : "bg-navy-800 border border-navy-700 text-slate-300 rounded-tl-sm"
                    }`}>
                      {!isMe && (
                        <p className="text-[10px] font-display font-600 text-slate-500 mb-1">{m.alias}</p>
                      )}
                      <p>{m.content}</p>
                      <p className="text-[9px] text-slate-600 mt-1 text-right">
                        {timeAgo(m.createdAt?.seconds)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-navy-800 flex gap-2">
              <input
                className="input-base text-xs py-2"
                placeholder="Type anonymously…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button onClick={handleSend} disabled={!draft.trim()} className="btn-primary px-3 py-2">
                <Send size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Page() {
  // ── Auth state
  const [user, setUser] = useState<any>(null);
  const [alias, setAlias] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(true);

  // ── Location state
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [locationLoading, setLocationLoading] = useState(false);

  // ── Feed state
  const [allTalks, setAllTalks] = useState<Talk[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down">>({});

  // ── UI state
  const [inboxOpen, setInboxOpen] = useState(false);

  // ─── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await ensureUserProfile(u.uid);
        setAlias(generateAlias(u.uid));
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── Real-time feed ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToTalks((talks) => {
      setAllTalks(talks);
      setFeedLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── Geolocation ─────────────────────────────────────────────────────────
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationError("");
        setLocationLoading(false);
      },
      (err) => {
        setLocationError("Location access denied. Please allow location to see nearby Talks.");
        setLocationLoading(false);
      },
      { timeout: 10000 }
    );
  }, []);

  // Request location on mount
  useEffect(() => { requestLocation(); }, [requestLocation]);

  // ─── Radius filter ────────────────────────────────────────────────────────
  const filteredTalks = location
    ? allTalks.filter(
        (t) => haversineDistance(location.lat, location.lon, t.lat, t.lon) <= RADIUS_KM
      )
    : [];

  // ─── Auth actions ─────────────────────────────────────────────────────────
  async function handleLogin() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login failed", e);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setUser(null);
    setAlias("");
  }

  // ─── Post a Talk ──────────────────────────────────────────────────────────
  async function handlePost(content: string) {
    if (!user || !location) return;
    await createTalk({ content, uid: user.uid, lat: location.lat, lon: location.lon });
  }

  // ─── Vote ─────────────────────────────────────────────────────────────────
  async function handleVote(talkId: string, type: "up" | "down") {
    if (!user || userVotes[talkId]) return;
    setUserVotes((prev) => ({ ...prev, [talkId]: type }));
    await voteTalk(talkId, type);
  }

  // ─── Open DM ─────────────────────────────────────────────────────────────
  async function handleDm(partnerUid: string, partnerAlias: string) {
    if (!user) return;
    // Chat ID: sorted UIDs joined so it's deterministic
    const chatId = [user.uid, partnerUid].sort().join("_");
    const ref = doc(db, "chats", chatId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        participants: [user.uid, partnerUid],
        createdAt: new Date(),
        revealRequests: [],
        emails: {},
      });
    }
    setInboxOpen(true);
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  return (
    <>
      <Navbar
        alias={alias}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isAuthed={!!user}
        onOpenInbox={() => setInboxOpen(true)}
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* ── Hero banner ──────────────────────────────────────────────── */}
        <div className="card border-emerald-900/30 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Radio size={18} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="font-display font-800 text-lg text-slate-100 text-glow">
              BAIUST<span className="text-emerald-400">Talks</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Anonymous hyperlocal discussions — only visible within a {RADIUS_KM} km radius.
              Your real identity stays hidden.
            </p>
          </div>
        </div>

        {/* ── Location status ───────────────────────────────────────────── */}
        {locationError ? (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-900/40 bg-amber-900/10 text-xs text-amber-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{locationError}</span>
            <button onClick={requestLocation} className="ml-auto flex items-center gap-1 underline">
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        ) : location ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <div className="status-dot" />
            <span>
              Broadcasting within {RADIUS_KM} km · {filteredTalks.length} Talks nearby
            </span>
          </div>
        ) : locationLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Loader2 size={11} className="animate-spin" />
            Detecting your location…
          </div>
        ) : null}

        {/* ── Auth gate ─────────────────────────────────────────────────── */}
        {!user ? (
          <div className="card text-center py-10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-900/20 border border-emerald-800/30 flex items-center justify-center mx-auto">
              <Lock size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-display font-700 text-slate-200 text-sm">
                Sign in to join the conversation
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Your Google account is only used for auth.<br />
                A random alias is shown to everyone, including you.
              </p>
            </div>
            <button onClick={handleLogin} className="btn-primary mx-auto">
              <LogIn size={14} />
              Continue with Google
            </button>
          </div>
        ) : (
          <>
            {/* Compose box */}
            {location ? (
              <ComposeBox onSubmit={handlePost} disabled={!location} />
            ) : (
              <div className="card text-center py-6 text-xs text-slate-600">
                <MapPin size={16} className="mx-auto mb-2 opacity-40" />
                Enable location to post a Talk
              </div>
            )}

            {/* Feed */}
            <div className="space-y-3">
              {feedLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card space-y-3">
                    <div className="flex gap-2 items-center">
                      <div className="skeleton w-7 h-7 rounded-full" />
                      <div className="skeleton w-24 h-3 rounded" />
                    </div>
                    <div className="skeleton w-full h-4 rounded" />
                    <div className="skeleton w-3/4 h-4 rounded" />
                    <div className="skeleton w-20 h-3 rounded" />
                  </div>
                ))
              ) : !location ? (
                <div className="card py-12 text-center text-slate-600 text-xs">
                  <MapPin size={24} className="mx-auto mb-3 opacity-20" />
                  Allow location access to see Talks near you.
                </div>
              ) : filteredTalks.length === 0 ? (
                <div className="card py-12 text-center">
                  <PlusCircle size={24} className="mx-auto mb-3 text-slate-700" />
                  <p className="text-sm text-slate-500 font-display font-600">No Talks near you yet.</p>
                  <p className="text-xs text-slate-700 mt-1">Be the first to post!</p>
                </div>
              ) : (
                filteredTalks.map((talk) => (
                  <TalkCard
                    key={talk.id}
                    talk={talk}
                    myUid={user.uid}
                    onDm={handleDm}
                    userVotes={userVotes}
                    onVote={handleVote}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="pt-6 pb-12 text-center text-[11px] text-slate-700 space-y-1">
          <p>BAIUST Talks · Anonymity is a right, not a privilege.</p>
          <p>Posts are visible only within {RADIUS_KM} km of their origin.</p>
        </footer>
      </main>

      {/* Inbox panel */}
      {inboxOpen && user && (
        <InboxPanel
          myUid={user.uid}
          myAlias={alias}
          onClose={() => setInboxOpen(false)}
        />
      )}
    </>
  );
}
