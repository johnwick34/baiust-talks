"use client";

// components/ReportModal.tsx
// Slide-up modal that lets a user flag a Talk for moderation.

import { useState } from "react";
import { Flag, X, Send, Loader2 } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const REASONS = [
  "Hate speech or harassment",
  "Spam or repeated posts",
  "Misinformation",
  "Privacy violation",
  "Other",
];

interface Props {
  talkId: string;
  talkContent: string;
  reporterUid: string;
  onClose: () => void;
}

export default function ReportModal({ talkId, talkContent, reporterUid, onClose }: Props) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setLoading(true);
    await addDoc(collection(db, "reports"), {
      talkId,
      talkContent: talkContent.slice(0, 200),
      reporterUid,
      reason: note.trim() ? `${reason} — ${note.trim()}` : reason,
      createdAt: serverTimestamp(),
    });
    setDone(true);
    setLoading(false);
    setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-sm mx-4 mb-0 sm:mb-auto glass rounded-t-2xl sm:rounded-2xl border border-navy-700 p-5 animate-slide-up space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-display font-700 text-sm text-slate-200 flex items-center gap-2">
            <Flag size={13} className="text-amber-400" /> Report Talk
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6 text-emerald-400 text-sm font-display font-600">
            ✓ Report submitted. Thanks for keeping Talks safe.
          </div>
        ) : (
          <>
            {/* Preview */}
            <p className="text-xs text-slate-500 bg-navy-800 rounded-lg px-3 py-2 line-clamp-2 border border-navy-700">
              "{talkContent}"
            </p>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-xs text-slate-500 font-display font-600">Reason</label>
              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                      reason === r ? "border-emerald-500 bg-emerald-500" : "border-navy-600 group-hover:border-slate-500"
                    }`}>
                      {reason === r && <div className="w-1.5 h-1.5 rounded-full bg-navy-950" />}
                    </div>
                    <span className={`text-xs transition-colors ${reason === r ? "text-slate-200" : "text-slate-500 group-hover:text-slate-400"}`}>
                      {r}
                    </span>
                    <input type="radio" className="sr-only" checked={reason === r} onChange={() => setReason(r)} />
                  </label>
                ))}
              </div>
            </div>

            {/* Optional note */}
            <textarea
              className="textarea-base text-xs"
              rows={2}
              placeholder="Additional context (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
            />

            <button onClick={submit} disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Submit Report
            </button>
          </>
        )}
      </div>
    </div>
  );
}
