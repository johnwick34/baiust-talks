"use client";

// lib/AuthContext.tsx
// Provides Firebase auth state + alias throughout the app.
// Wrap _app or layout with <AuthProvider>.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, generateAlias, ensureUserProfile } from "./firebase";

interface AuthCtx {
  user: User | null;
  alias: string;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({ user: null, alias: "", loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await ensureUserProfile(u.uid);
        setAlias(generateAlias(u.uid));
      } else {
        setAlias("");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, alias, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
