import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { upsertUserProfile, getMyProfile } from "@/lib/supabase-storage";
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
      await upsertUserProfile(u.id, u.email ?? "");
      const p = await getMyProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const SESSION_TIMEOUT_MS = 10_000;

    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Session check timed out")), SESSION_TIMEOUT_MS)
    );

    Promise.race([sessionPromise, timeoutPromise])
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          currentUserId.current = session.user.id;
          await loadProfile(session.user);
        }
      })
      .catch(() => {
        // Timed out or errored — treat as logged-out so the user reaches the login screen
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUserId = session?.user?.id ?? null;
      const prevUserId = currentUserId.current;
      const userChanged = !newUserId || newUserId !== prevUserId;

      currentUserId.current = newUserId;
      setSession(session);
      setUser(session?.user ?? null);

      if (userChanged) {
        clearAllStorageForSignOut().catch(() => {});
      }

      if (session?.user) {
        await loadProfile(session.user);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    // Clear any stale Supabase session before signing in to prevent hangs
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}
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
