import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { cloudConfigured, supabase } from './cloud';

/** Remembers "use without an account" on this device. */
const MODE_KEY = 'mm_mode';

export type AccountMode = 'loading' | 'signedOut' | 'account' | 'local';

interface Account {
  mode: AccountMode;
  user: { id: string; email: string } | null;
  /** Accounts are available (Supabase is set up). */
  cloud: boolean;
  /** Returns an error message, or null. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Returns an error message, or null. `confirm` = check your email before signing in. */
  signUp: (email: string, password: string) => Promise<{ error: string | null; confirm: boolean }>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  useWithoutAccount: () => void;
}

const Ctx = createContext<Account | null>(null);

/** Plain-language versions of Supabase's auth errors. */
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password don’t match.';
  if (m.includes('email not confirmed')) return 'Confirm your email first: open the link we sent, then sign in.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'There’s already an account with that email. Sign in instead.';
  if (m.includes('password should be')) return 'Use a password of at least 6 characters.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'That email address doesn’t look right.';
  if (m.includes('fetch') || m.includes('network')) return 'Couldn’t reach the server. Check your connection.';
  if (m.includes('rate limit')) return 'Too many tries. Wait a minute and try again.';
  return msg;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AccountMode>('loading');
  const [user, setUser] = useState<Account['user']>(null);

  useEffect(() => {
    const sb = supabase();
    let live = true;
    const fallback = async () => {
      const m = await AsyncStorage.getItem(MODE_KEY).catch(() => null);
      if (live) setMode(m === 'local' ? 'local' : 'signedOut');
    };
    if (!sb) {
      fallback();
      return () => {
        live = false;
      };
    }
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!live) return;
        if (data.session) {
          setUser({ id: data.session.user.id, email: data.session.user.email ?? '' });
          setMode('account');
        } else fallback();
      })
      .catch(fallback);
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (!live) return;
      if (session) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        setMode('account');
        AsyncStorage.removeItem(MODE_KEY).catch(() => {});
      } else {
        setUser(null);
        setMode((m) => (m === 'local' ? 'local' : 'signedOut'));
      }
    });
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = supabase();
    if (!sb) return 'Accounts aren’t set up yet.';
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendly(error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = supabase();
    if (!sb) return { error: 'Accounts aren’t set up yet.', confirm: false };
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
    if (error) return { error: friendly(error.message), confirm: false };
    // With email confirmation on, there's no session until the link is opened.
    return { error: null, confirm: !data.session };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const sb = supabase();
    if (!sb) return 'Accounts aren’t set up yet.';
    const { error } = await sb.auth.resetPasswordForEmail(email.trim());
    return error ? friendly(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(MODE_KEY).catch(() => {});
    const sb = supabase();
    if (sb) await sb.auth.signOut().catch(() => {});
    setUser(null);
    setMode('signedOut');
  }, []);

  const useWithoutAccount = useCallback(() => {
    AsyncStorage.setItem(MODE_KEY, 'local').catch(() => {});
    setMode('local');
  }, []);

  const value = useMemo(
    () => ({ mode, user, cloud: cloudConfigured, signIn, signUp, resetPassword, signOut, useWithoutAccount }),
    [mode, user, signIn, signUp, resetPassword, signOut, useWithoutAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): Account {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount must be used inside AccountProvider');
  return v;
}
