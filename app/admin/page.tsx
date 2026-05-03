"use client";

// app/admin/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// BAIUST Talks — Admin Dashboard
// Access: only the UID in NEXT_PUBLIC_ADMIN_UID can use this page.
// Features: live talk feed, delete posts, view reports, ban users, stats.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  collection, onSnapshot, query, orderBy,
  deleteDoc, doc, getDocs, getDoc, setDoc,
  updateDoc, where, limit,
} from "firebase/firestore";
import {
  Shield, LogIn, LogOut, Trash2, Flag, Users,
  MessageSquare, TrendingUp, RefreshCw, Loader2,
  AlertTriangle, ChevronDown, ChevronUp, Eye, Ban,
  CheckCircle, Radio,
} from "lucide-react";
import { auth, db, googleProvider, generateAlias } from "@/lib/firebase";

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

interface Report {
  id: string;
  talkId: string;
  talkContent: string;
  reporterUid: string;
  reason: string;
  createdAt?: { seconds: number };
}

interface StatCard {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID ?? "";

function timeAgo(seconds?: number): string {
  if (!seconds) return "just now";
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function Stat({ label, value, icon, color }: StatCard) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-display font-800 text-slate-100">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<"talks" | "reports" | "users">("talks");

  // Data
  const [talks, setTalks] = useState<Talk[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [bannedUids, setBannedUids] = useState<Set<string>>(new Set());
  const [totalUsers, setTotalUsers] = useState(0);
  const [actionLoading, setActionLoading] = useState<string>("");

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const isAdmin = !!user && user.uid === ADMIN_UID;

  // ── Live data (only if admin) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;

    // Talks
    const talkQ = query(collection(db, "talks"), orderBy("createdAt", "desc"), limit(100));
    const unsubTalks = onSnapshot(talkQ, (snap) => {
      setTalks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Talk)));
    });

    // Reports
    const reportQ = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(50));
    const unsubReports = onSnapshot(reportQ, (snap) => {
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report)));
    });

    // Users count
    getDocs(collection(db, "users")).then((snap) => setTotalUsers(snap.size));

    // Bans
    getDocs(collection(db, "bans")).then((snap) => {
      setBannedUids(new Set(snap.docs.map((d) => d.id)));
    });

    return () => {
      unsubTalks();
      unsubReports();
    };
  }, [isAdmin]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function deleteTalk(id: string) {
    setActionLoading(id);
    await deleteDoc(doc(db, "talks", id));
    setActionLoading("");
  }

  async function resolveReport(reportId: string) {
    setActionLoading(reportId);
    await deleteDoc(doc(db, "reports", reportId));
    setActionLoading("");
  }

  async function toggleBan(uid: string) {
    setActionLoading(uid);
    const banRef = doc(db, "bans", uid);
    if (bannedUids.has(uid)) {
      await deleteDoc(banRef);
      setBannedUids((prev) => { const s = new Set(prev); s.delete(uid); return s; });
    } else {
      await setDoc(banRef, { bannedAt: new Date(), bannedBy: user.uid });
      setBannedUids((prev) => new Set(prev).add(uid));
    }
    setActionLoading("");
  }

  async function deleteTalkAndBan(talk: Talk) {
    setActionLoading(talk.id + "_ban");
    await deleteDoc(doc(db, "talks", talk.id));
    await setDoc(doc(db, "bans", talk.uid), { bannedAt: new Date(), bannedBy: user.uid });
    setBannedUids((prev) => new Set(prev).add(talk.uid));
    setActionLoading("");
  }

  // ── Unique authors in talks ───────────────────────────────────────────────
  const uniqueAuthors = new Set(talks.map((t) => t.uid)).size;
  const reportedTalkIds = new Set(reports.map((r) => r.talkId));

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="card text-center py-12 px-10 space-y-5 max-w-sm w-full mx-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-900/20 border border-emerald-800/30 flex items-center justify-center mx-auto">
            <Shield size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="font-display font-800 text-slate-100">Admin Access</h1>
            <p className="text-xs text-slate-600 mt-1">BAIUST Talks moderation panel</p>
          </div>
          <button
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="btn-primary w-full justify-center"
          >
            <LogIn size={14} /> Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="card text-center py-12 px-10 space-y-4 max-w-sm w-full mx-4">
          <AlertTriangle size={28} className="text-red-400 mx-auto" />
          <p className="font-display font-700 text-slate-200">Access Denied</p>
          <p className="text-xs text-slate-500">
            Your account is not authorised for this panel.
          </p>
          <button onClick={() => signOut(auth)} className="btn-ghost w-full justify-center">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 glass border-b border-navy-800">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Shield size={13} className="text-emerald-400" />
            </div>
            <span className="font-display font-800 text-sm text-slate-100">
              BAIUST<span className="text-emerald-400">Talks</span>
              <span className="text-slate-500 font-400 ml-1.5 text-xs">Admin</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge-emerald text-[10px]">
              {generateAlias(user.uid)}
            </span>
            <button onClick={() => signOut(auth)} className="btn-ghost text-xs px-3 py-1.5">
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat
            label="Total Talks"
            value={talks.length}
            icon={<Radio size={16} className="text-emerald-400" />}
            color="bg-emerald-900/20 border border-emerald-800/30"
          />
          <Stat
            label="Active Authors"
            value={uniqueAuthors}
            icon={<Users size={16} className="text-sky-400" />}
            color="bg-sky-900/20 border border-sky-800/30"
          />
          <Stat
            label="Open Reports"
            value={reports.length}
            icon={<Flag size={16} className="text-amber-400" />}
            color="bg-amber-900/20 border border-amber-800/30"
          />
          <Stat
            label="Banned Users"
            value={bannedUids.size}
            icon={<Ban size={16} className="text-red-400" />}
            color="bg-red-900/20 border border-red-800/30"
          />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-navy-900 border border-navy-700 rounded-xl p-1 w-fit">
          {(["talks", "reports", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-display font-600 capitalize transition-all ${
                tab === t
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-800/30"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}
              {t === "reports" && reports.length > 0 && (
                <span className="ml-1.5 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] inline-flex items-center justify-center">
                  {reports.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Talks tab ── */}
        {tab === "talks" && (
          <div className="space-y-2">
            {talks.length === 0 ? (
              <div className="card py-12 text-center text-slate-600 text-xs">No talks yet.</div>
            ) : (
              talks.map((talk) => {
                const isBanned = bannedUids.has(talk.uid);
                const isReported = reportedTalkIds.has(talk.id);
                return (
                  <div
                    key={talk.id}
                    className={`card group transition-all ${
                      isReported ? "border-amber-900/40 bg-amber-900/5" : ""
                    } ${isBanned ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Author chip */}
                      <div className="shrink-0 mt-0.5">
                        <span className={`badge text-[10px] ${isBanned ? "bg-red-900/30 text-red-400 border-red-800/30" : "badge-slate"}`}>
                          {isBanned ? <Ban size={9} /> : null}
                          {talk.alias}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 leading-relaxed break-words">
                          {talk.content}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-600">
                          <span>{timeAgo(talk.createdAt?.seconds)}</span>
                          <span className="flex items-center gap-1">
                            <ChevronUp size={9} className="text-emerald-500" /> {talk.upvotes}
                          </span>
                          <span className="flex items-center gap-1">
                            <ChevronDown size={9} className="text-red-400" /> {talk.downvotes}
                          </span>
                          {isReported && (
                            <span className="text-amber-400 flex items-center gap-1">
                              <Flag size={9} /> Reported
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleBan(talk.uid)}
                          disabled={actionLoading === talk.uid}
                          title={isBanned ? "Unban user" : "Ban user"}
                          className={`p-1.5 rounded-lg border text-xs transition-all ${
                            isBanned
                              ? "border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/20"
                              : "border-amber-800/40 text-amber-400 hover:bg-amber-900/20"
                          }`}
                        >
                          {actionLoading === talk.uid ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isBanned ? (
                            <CheckCircle size={12} />
                          ) : (
                            <Ban size={12} />
                          )}
                        </button>

                        <button
                          onClick={() => deleteTalk(talk.id)}
                          disabled={actionLoading === talk.id}
                          title="Delete talk"
                          className="p-1.5 rounded-lg border border-red-800/40 text-red-400 hover:bg-red-900/20 transition-all"
                        >
                          {actionLoading === talk.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>

                        <button
                          onClick={() => deleteTalkAndBan(talk)}
                          disabled={actionLoading === talk.id + "_ban"}
                          title="Delete & ban author"
                          className="p-1.5 rounded-lg border border-red-800/40 text-red-400 hover:bg-red-900/20 transition-all text-[10px] font-600"
                        >
                          {actionLoading === talk.id + "_ban" ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <span className="px-0.5">D+B</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Reports tab ── */}
        {tab === "reports" && (
          <div className="space-y-2">
            {reports.length === 0 ? (
              <div className="card py-12 text-center text-slate-600 text-xs flex flex-col items-center gap-2">
                <CheckCircle size={20} className="text-emerald-500 opacity-40" />
                No open reports. Community is clean!
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="card border-amber-900/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Flag size={12} className="text-amber-400 shrink-0" />
                        <span className="text-xs font-display font-600 text-amber-400">
                          Reported Talk
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {timeAgo(r.createdAt?.seconds)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 bg-navy-800 rounded-lg px-3 py-2 mb-2">
                        "{r.talkContent}"
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Reason: <span className="text-slate-300">{r.reason}</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={async () => {
                          await deleteTalk(r.talkId);
                          await resolveReport(r.id);
                        }}
                        className="btn-danger text-[11px] px-2.5 py-1.5"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                      <button
                        onClick={() => resolveReport(r.id)}
                        className="btn-ghost text-[11px] px-2.5 py-1.5"
                      >
                        <CheckCircle size={11} /> Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Users tab ── */}
        {tab === "users" && (
          <div className="space-y-2">
            <div className="card">
              <p className="text-xs text-slate-500 mb-3">
                Showing {uniqueAuthors} active authors from the last 100 talks.
                Real emails are never stored — only Firebase UIDs.
              </p>
              <div className="divider mb-3" />
              {Array.from(new Map(talks.map((t) => [t.uid, t])).values()).map((t) => {
                const isBanned = bannedUids.has(t.uid);
                const postCount = talks.filter((x) => x.uid === t.uid).length;
                return (
                  <div
                    key={t.uid}
                    className="flex items-center justify-between py-2.5 border-b border-navy-800 last:border-0 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-xs font-display font-700 text-emerald-400">
                        {t.alias.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-display font-600 text-slate-300">{t.alias}</p>
                        <p className="text-[10px] text-slate-600">{postCount} talks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isBanned && (
                        <span className="badge text-[9px] bg-red-900/20 text-red-400 border-red-800/30">
                          Banned
                        </span>
                      )}
                      <button
                        onClick={() => toggleBan(t.uid)}
                        disabled={actionLoading === t.uid}
                        className={`text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
                          isBanned
                            ? "border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/20"
                            : "border-red-800/40 text-red-400 hover:bg-red-900/20"
                        }`}
                      >
                        {actionLoading === t.uid ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : isBanned ? (
                          <><CheckCircle size={10} /> Unban</>
                        ) : (
                          <><Ban size={10} /> Ban</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
