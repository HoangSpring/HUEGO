import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getCurrentProfile, upsertProfile } from '../services/supabase/profiles';
import { supabase } from '../services/supabase/client';
import type { ProfileRow } from '../types/database';
import { AuthContext, type AuthContextValue } from './authContext';

async function loadProfile(userId: string | undefined) {
  if (!userId) {
    return null;
  }

  try {
    return await getCurrentProfile();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(activeSession);
      setUser(activeSession?.user ?? null);
      setProfile(activeSession?.user ? await loadProfile(activeSession.user.id) : null);
      setLoading(false);
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setProfile(nextSession?.user ? await loadProfile(nextSession.user.id) : null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!import.meta.env.VITE_SUPABASE_URL || !publishableKey) {
      throw new Error('Supabase environment variables are not configured.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!import.meta.env.VITE_SUPABASE_URL || !publishableKey) {
      throw new Error('Supabase environment variables are not configured.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      throw error;
    }

    const registeredUser = data.user;

    if (registeredUser) {
      try {
        await upsertProfile({
          id: registeredUser.id,
          display_name: displayName || registeredUser.email || 'HUEGO traveler',
          preferred_language: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Keep the app resilient if the profile is unavailable.
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [user, session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
