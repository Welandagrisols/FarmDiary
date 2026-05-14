import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { upsertAndGetProfile } from "@/lib/supabase-storage";
import { clearAllStorageForSignOut } from "@/lib/offline-storage";
import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/storage";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (u: User) => {
    try {
      const p = await upsertAndGetProfile(u.id, u.email ?? "");
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // 30s timeout — covers slow devices reading AsyncStorage on cold start
    const SESSION_TIMEOUT_MS = 30_000;

    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Session check timed out")), SESSION_TIMEOUT_MS)
    );

    Promise.race([sessionPromise, timeoutPromise])
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          currentUserId.current = session.user.id;
          // Non-blocking — don't await, let the app navigate immediately
          loadProfile(session.user).catch(() => {});
        }
      })
      .catch(() => {
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      const prevUserId = currentUserId.current;
      // Only clear storage when a DIFFERENT authenticated user signs in
      // (not on first load, not on sign-out — signOut() handles that explicitly)
      const userChanged = prevUserId !== null && newUserId !== null && newUserId !== prevUserId;

      currentUserId.current = newUserId;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (userChanged) {
        clearAllStorageForSignOut().catch(() => {});
      }

      if (session?.user) {
        // Non-blocking — navigation happens immediately when user is set above
        loadProfile(session.user).catch(() => {});
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Refresh session token whenever the app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.refreshSession().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    // Sign out from Supabase first (best-effort — may fail if token already invalid)
    try {
      await supabase.auth.signOut();
    } catch {}
    // Wipe all local caches, offline queue, AND Supabase session keys
    await clearAllStorageForSignOut();
    setProfile(null);
  }, []);

  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
