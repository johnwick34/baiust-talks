# 🎙️ BAIUST Talks

> Anonymous hyperlocal discussion board for BAIUST — your campus, your voice.

A Yik Yak–style platform where students can post anonymously, only visible to others within a **5 km radius**. Built with Next.js 14, Firebase, and Tailwind CSS.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 **Anonymous Identity** | Google login for auth; real name never shown — a random alias (e.g. "Silent Scholar") is assigned per UID |
| 📍 **Hyperlocal Feed** | Haversine formula filters posts to within 5 km of your location |
| 🔴 **Real-time** | Firestore `onSnapshot` gives live updates without refresh |
| 👍 **Voting** | Upvote / downvote each Talk; score displayed |
| 💬 **Anonymous Inbox** | DM other users by alias; chats are ephemeral |
| 🛡️ **Identity Reveal** | Both parties must click "Accept" before Google email is shared |
| 🚩 **Report System** | Flag harmful posts; admin sees all reports |
| 🔧 **Admin Dashboard** | `/admin` — delete posts, ban users, resolve reports |

---

## 🗂️ Project Structure

```
baiust-talks/
├── app/
│   ├── layout.tsx          # Root layout — fonts, metadata, background grid
│   ├── page.tsx            # Main feed — auth, geolocation, talks, inbox
│   ├── globals.css         # Tailwind + design tokens + component classes
│   └── admin/
│       └── page.tsx        # Admin moderation dashboard
├── components/
│   └── ReportModal.tsx     # Flag a Talk modal
├── lib/
│   ├── firebase.js         # Firebase init, helpers, Haversine, alias generator
│   ├── AuthContext.tsx     # React context for auth state
│   └── useGeolocation.ts  # Custom geolocation hook
├── firestore.rules         # Security rules — deploy to Firebase
├── tailwind.config.ts
├── next.config.js
├── vercel.json             # Vercel deployment config
└── .env.local.example      # Template for environment variables
```

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-username/baiust-talks.git
cd baiust-talks
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → **Create project**
2. Enable **Authentication** → Sign-in providers → **Google**
3. Enable **Firestore Database** → Start in **production mode**
4. Go to Project Settings → Your Apps → **Add web app** → copy config values

### 3. Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Firebase values. Also add your Firebase UID as `NEXT_PUBLIC_ADMIN_UID` to unlock `/admin`.

> **Find your UID:** Sign into the app once, then check Firebase Console → Authentication → Users.

### 4. Deploy Firestore Rules

In the Firebase Console → Firestore → **Rules** tab, paste the contents of `firestore.rules`.

Or use the CLI:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 5. Run Locally

```bash
npm run dev
# → http://localhost:3000
```

---

## ☁️ Deploy to Vercel (Free)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Add all `NEXT_PUBLIC_FIREBASE_*` variables in the Vercel dashboard
4. Deploy — done!

> The `vercel.json` already sets the region to `sin1` (Singapore) for lowest latency from Bangladesh.

---

## 🔒 Security Notes

- **UIDs are stored in Firestore** (in `talks` and `chats` docs) but **never rendered in the UI** — only aliases are shown.
- Firestore rules enforce that users can only write their own UID.
- The Identity Reveal feature requires **both** users to click "Accept" — only then is the Google email surfaced.
- The `/admin` route checks `NEXT_PUBLIC_ADMIN_UID` client-side. For production, replace with Firebase Admin SDK server-side token verification.

---

## 🎨 Design System

| Token | Value |
|---|---|
| Navy 950 (bg) | `#060d1a` |
| Navy 900 (card) | `#0a1628` |
| Emerald accent | `#10b981` |
| Display font | Syne (800 weight) |
| Body font | DM Sans (400/500) |
| Radius | 5 km (Haversine) |

---

## 📋 Firestore Collections

| Collection | Purpose |
|---|---|
| `talks` | All posts with lat/lon, alias, uid, votes |
| `users/{uid}` | Alias + profile (no PII) |
| `chats/{chatId}` | DM metadata + reveal requests |
| `chats/{chatId}/messages` | Individual messages |
| `reports` | Flagged talks for admin review |
| `bans/{uid}` | Banned user UIDs |

---

## 🗺️ Roadmap

- [ ] Push notifications (FCM) for DM replies
- [ ] Post expiry (Talks auto-delete after 24h)
- [ ] Trending topics by hashtag
- [ ] Dark/light theme toggle
- [ ] Mobile PWA with offline support

---

*Built for the BAIUST community. Speak freely, stay safe.*
