import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storageKey } from '@/logic';

import { clearLinkFromUrl, cloudConfigured, link, linkTarget, supabase, type Arrival } from './cloud';

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
  /** Opened from an email link: just confirmed the email, or here to set a new password. */
  arrival: Arrival;
  /** A problem with the email link (expired, already used). */
  linkError: string | null;
  /** Done with the welcome or new-password page. */
  dismissArrival: () => void;
  /** Returns an error message, or null. */
  updatePassword: (password: string) => Promise<string | null>;
  /** Deletes the account and everything stored with it on the server, and this device's copy. Returns an error message, or null. */
  deleteAccount: () => Promise<string | null>;
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
  if (m.includes('should be different')) return 'Choose a password different from your old one.';
  return msg;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AccountMode>('loading');
  const [user, setUser] = useState<Account['user']>(null);
  const [arrival, setArrival] = useState<Arrival>(link.arrival);
  const [linkError, setLinkError] = useState<string | null>(link.error);

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
        // Supabase has read the email link (if any) by now.
        clearLinkFromUrl();
        if (!live) return;
        if (!data.session) setArrival(null);
        if (data.session) {
          setUser({ id: data.session.user.id, email: data.session.user.email ?? '' });
          setMode('account');
        } else fallback();
      })
      .catch(fallback);
    const { data: sub } = sb.auth.onAuthStateChange((e, session) => {
      if (!live) return;
      if (e === 'PASSWORD_RECOVERY') setArrival('recovery');
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
    setLinkError(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendly(error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = supabase();
    if (!sb) return { error: 'Accounts aren’t set up yet.', confirm: false };
    // The confirmation link opens this website and signs the person in.
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: linkTarget() } });
    if (error) return { error: friendly(error.message), confirm: false };
    // With email confirmation on, there's no session until the link is opened.
    return { error: null, confirm: !data.session };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const sb = supabase();
    if (!sb) return 'Accounts aren’t set up yet.';
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: linkTarget() });
    return error ? friendly(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(MODE_KEY).catch(() => {});
    const sb = supabase();
    if (sb) await sb.auth.signOut().catch(() => {});
    setUser(null);
    setMode('signedOut');
  }, []);

  const dismissArrival = useCallback(() => setArrival(null), []);

  const updatePassword = useCallback(async (password: string) => {
    const sb = supabase();
    if (!sb) return 'Accounts aren’t set up yet.';
    const { error } = await sb.auth.updateUser({ password });
    return error ? friendly(error.message) : null;
  }, []);

  const deleteAccount = useCallback(async () => {
    const sb = supabase();
    if (!sb || !user) return 'Accounts aren’t set up yet.';
    // Profile pictures are files, which the database can't delete for us: remove them first.
    try {
      const { data: pics } = await sb.storage.from('avatars').list(user.id, { limit: 100 });
      if (pics?.length) await sb.storage.from('avatars').remove(pics.map((f) => `${user.id}/${f.name}`));
    } catch {
      // No pictures, or no picture storage set up.
    }
    const { error } = await sb.rpc('delete_my_account');
    if (error) {
      const m = error.message.toLowerCase();
      if (error.code === 'PGRST202' || m.includes('could not find') || m.includes('does not exist'))
        return 'Deleting accounts isn’t switched on for this app yet. Whoever runs it needs to run supabase/privacy.sql once.';
      return friendly(error.message);
    }
    // The account is gone. Clear this device's copy, then leave (local sign-out: the server session no longer exists).
    await AsyncStorage.multiRemove([storageKey(user.id), MODE_KEY]).catch(() => {});
    await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    setUser(null);
    setMode('signedOut');
    return null;
  }, [user]);

  const useWithoutAccount = useCallback(() => {
    AsyncStorage.setItem(MODE_KEY, 'local').catch(() => {});
    setMode('local');
  }, []);

  const value = useMemo(
    () => ({
      mode, user, cloud: cloudConfigured, signIn, signUp, resetPassword, signOut, useWithoutAccount,
      arrival, linkError, dismissArrival, updatePassword, deleteAccount,
    }),
    [mode, user, signIn, signUp, resetPassword, signOut, useWithoutAccount, arrival, linkError, dismissArrival, updatePassword, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): Account {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount must be used inside AccountProvider');
  return v;
}
