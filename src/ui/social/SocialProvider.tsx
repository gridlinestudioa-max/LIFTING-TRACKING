import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { shareSummary, type BoardPerson } from '@/logic';

import { useAccount } from '../account';
import { useTracker } from '../store';
import { SocialError, friendBoard, getProfile, leave as leaveApi, myFriends, publishStats, saveProfile, type Friend, type MyProfile } from './api';

export type SocialStatus = 'signedOut' | 'loading' | 'off' | 'on' | 'setup' | 'error';

interface Social {
  status: SocialStatus;
  error: string | null;
  profile: MyProfile | null;
  userId: string | null;
  /** Turn on Friends with this name and (optionally) your number. Returns an error message or null. */
  join: (name: string, phone: string | null) => Promise<string | null>;
  /** Add, change (a number) or remove (null) your phone number. */
  setPhone: (phone: string | null) => Promise<string | null>;
  leave: () => Promise<string | null>;
  reload: () => void;
  /** Goes up after your stats are shared, so the leaderboard can refresh. */
  published: number;
  /** Friends and requests, and you and your friends with what each shares. Null until loaded. */
  friends: Friend[] | null;
  board: BoardPerson[] | null;
  /** A problem loading them. */
  listError: string | null;
  /** Load friends and the board again. */
  refresh: () => void;
}

const Ctx = createContext<Social | null>(null);

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/**
 * Friends for a signed-in person: whether it's on, and keeping their shared summary (cardio totals and
 * bests) and name up to date on the server as they log.
 */
export function SocialProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAccount();
  const { state, today } = useTracker();
  const userId = mode === 'account' && user ? user.id : null;
  const [status, setStatus] = useState<SocialStatus>(userId ? 'loading' : 'signedOut');
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [n, setN] = useState(0);
  const [published, setPublished] = useState(0);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    getProfile(userId)
      .then((p) => {
        if (!live) return;
        setProfile(p);
        setStatus(p ? 'on' : 'off');
        setError(null);
      })
      .catch((e) => {
        if (!live) return;
        setStatus(e instanceof SocialError && e.kind === 'setup' ? 'setup' : 'error');
        setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [userId, n]);

  // Share the latest summary a few seconds after cardio changes (and once on open).
  const share = state.settings.share;
  const summary = useMemo(() => JSON.stringify(shareSummary(state, today, share)), [state, today, share]);
  const name = state.settings.name.trim();
  useEffect(() => {
    if (status !== 'on' || !userId) return;
    const key = `${name}|${summary}`;
    if (sent.current === key) return;
    const t = setTimeout(async () => {
      try {
        if (name && profile && name !== profile.name) {
          await saveProfile(userId, name);
          setProfile({ ...profile, name });
        }
        await publishStats(userId, JSON.parse(summary));
        sent.current = key;
        setPublished((v) => v + 1);
      } catch {
        // Tried again on the next change or open.
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [status, userId, summary, name, profile]);

  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [board, setBoard] = useState<BoardPerson[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [m, setM] = useState(0);
  useEffect(() => {
    if (status !== 'on' || !userId) return;
    let live = true;
    Promise.all([friendBoard(userId), myFriends()])
      .then(([b, f]) => {
        if (!live) return;
        setBoard(b);
        setFriends(f);
        setListError(null);
      })
      .catch((e) => live && setListError(message(e)));
    return () => {
      live = false;
    };
  }, [status, userId, m, published]);

  const join = useCallback(
    async (nm: string, phone: string | null) => {
      if (!userId) return 'Sign in to use Friends.';
      try {
        await saveProfile(userId, nm, phone);
        setProfile({ name: nm.trim(), hasPhone: !!phone });
        setStatus('on');
        return null;
      } catch (e) {
        return message(e);
      }
    },
    [userId],
  );

  const setPhone = useCallback(
    async (phone: string | null) => {
      if (!userId || !profile) return 'Turn on Friends first.';
      try {
        await saveProfile(userId, profile.name, phone);
        setProfile({ ...profile, hasPhone: !!phone });
        return null;
      } catch (e) {
        return message(e);
      }
    },
    [userId, profile],
  );

  const leave = useCallback(async () => {
    if (!userId) return null;
    try {
      await leaveApi(userId);
      setProfile(null);
      setStatus('off');
      sent.current = null;
      return null;
    } catch (e) {
      return message(e);
    }
  }, [userId]);

  const value = useMemo<Social>(
    () => ({
      status: userId ? status : 'signedOut',
      error,
      profile,
      userId,
      join,
      setPhone,
      leave,
      reload: () => setN((v) => v + 1),
      published,
      friends: status === 'on' ? friends : null,
      board: status === 'on' ? board : null,
      listError,
      refresh: () => setM((v) => v + 1),
    }),
    [userId, status, error, profile, join, setPhone, leave, published, friends, board, listError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSocial(): Social {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSocial needs SocialProvider');
  return v;
}
