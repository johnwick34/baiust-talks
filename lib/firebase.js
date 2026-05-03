// lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  doc,
  increment,
  where,
  getDoc,
  setDoc,
} from "firebase/firestore";

// ─── CONFIG ─────────────────────────────────────────────────────────────────
// Replace these placeholder values with your actual Firebase project credentials.
// Get them from: Firebase Console → Project Settings → Your Apps → SDK setup
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ─── SINGLETON INIT ──────────────────────────────────────────────────────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ─── ALIAS GENERATION ────────────────────────────────────────────────────────
const ADJECTIVES = [
  "Silent", "Rapid", "Curious", "Phantom", "Stellar", "Neon",
  "Wandering", "Digital", "Cosmic", "Hidden", "Swift", "Noble",
  "Quantum", "Iron", "Serene", "Bold", "Mystic", "Urban",
];
const NOUNS = [
  "Scholar", "Nomad", "Coder", "Thinker", "Pioneer", "Voyager",
  "Architect", "Hawk", "Oracle", "Sage", "Ranger", "Cipher",
  "Beacon", "Nexus", "Specter", "Falcon", "Raven", "Pulsar",
];

export function generateAlias(uid) {
  // Deterministic alias from uid so it stays consistent per user
  const hash = uid
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const adj = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length];
  return `${adj} ${noun}`;
}

// ─── HAVERSINE DISTANCE ───────────────────────────────────────────────────────
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── FIRESTORE HELPERS ────────────────────────────────────────────────────────

/** Create a new Talk (post) */
export async function createTalk({ content, uid, lat, lon }) {
  const alias = generateAlias(uid);
  return await addDoc(collection(db, "talks"), {
    content,
    alias,
    uid,          // stored server-side only; never rendered in UI
    lat,
    lon,
    upvotes: 0,
    downvotes: 0,
    createdAt: serverTimestamp(),
  });
}

/** Real-time listener — returns unsub function */
export function subscribeToTalks(callback) {
  const q = query(collection(db, "talks"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const talks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(talks);
  });
}

/** Vote on a talk */
export async function voteTalk(talkId, type) {
  const ref = doc(db, "talks", talkId);
  await updateDoc(ref, {
    [type === "up" ? "upvotes" : "downvotes"]: increment(1),
  });
}

/** Ensure user profile exists in Firestore */
export async function ensureUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      alias: generateAlias(uid),
      createdAt: serverTimestamp(),
      revealRequests: [],
    });
  }
  return generateAlias(uid);
}

/** Send a DM */
export async function sendMessage({ chatId, senderUid, content }) {
  const alias = generateAlias(senderUid);
  await addDoc(collection(db, "chats", chatId, "messages"), {
    alias,
    senderUid,
    content,
    createdAt: serverTimestamp(),
  });
}

/** Subscribe to DM messages */
export function subscribeToMessages(chatId, callback) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/** Request identity reveal in a chat */
export async function requestReveal(chatId, uid) {
  const ref = doc(db, "chats", chatId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : { revealRequests: [] };
  const requests = data.revealRequests || [];
  if (!requests.includes(uid)) {
    await setDoc(ref, { revealRequests: [...requests, uid] }, { merge: true });
  }
}

export { auth, db, googleProvider };
