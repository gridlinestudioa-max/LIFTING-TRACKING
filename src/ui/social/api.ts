import * as Crypto from 'expo-crypto';

import { normalizePhone, phoneHashInput, readSummary, type BoardPerson, type BoardSummary } from '@/logic';

import { supabase } from '../cloud';

export type FriendStatus = 'friends' | 'sent' | 'received';

export interface Friend {
  id: string;
  name: string;
  status: FriendStatus;
}

export interface Match {
  id: string;
  /** The name they use in the app. */
  name: string;
  /** The name in your contacts, when found that way. */
  contact?: string;
  status: FriendStatus | null;
}

/** Why a friends call failed: the server tables aren't there yet, not signed in, or anything else (message). */
export class SocialError extends Error {
  constructor(
    public kind: 'setup' | 'signedOut' | 'other',
    message: string,
  ) {
    super(message);
  }
}

function fail(e: { code?: string; message?: string } | null): never {
  const msg = e?.message ?? 'Something went wrong.';
  // Missing table (PGRST205/42P01) or function (PGRST202/42883): supabase/social.sql hasn't been run.
  if (e?.code && ['PGRST205', 'PGRST202', '42P01', '42883'].includes(e.code)) throw new SocialError('setup', 'Friends aren’t switched on for this app yet.');
  if (/sign in first/i.test(msg)) throw new SocialError('signedOut', 'Sign in to use Friends.');
  if (/fetch|network/i.test(msg)) throw new SocialError('other', 'Couldn’t reach the server. Check your connection.');
  if (e?.code === '23505') throw new SocialError('other', 'That phone number is already used by another account.');
  throw new SocialError('other', msg);
}

function client() {
  const sb = supabase();
  if (!sb) throw new SocialError('signedOut', 'Sign in to use Friends.');
  return sb;
}

/** One-way hash of a phone number in international form. */
export async function hashPhone(e164: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, phoneHashInput(e164));
}

export interface MyProfile {
  name: string;
  hasPhone: boolean;
}

/** Your Friends profile, or null when Friends is off. */
export async function getProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await client().from('social_profiles').select('name, phone_hash').eq('user_id', userId).maybeSingle();
  if (error) fail(error);
  return data ? { name: data.name, hasPhone: !!data.phone_hash } : null;
}

/** Turn on Friends, or change your name or number. `phone` undefined leaves the number as it is; null removes it. */
export async function saveProfile(userId: string, name: string, phone?: string | null): Promise<void> {
  const row: Record<string, unknown> = { user_id: userId, name: name.trim().slice(0, 40), updated_at: new Date().toISOString() };
  if (phone !== undefined) row.phone_hash = phone ? await hashPhone(phone) : null;
  const { error } = await client().from('social_profiles').upsert(row);
  if (error) fail(error);
}

/** Turn off Friends: removes your profile, friends and shared stats from the server. */
export async function leave(userId: string): Promise<void> {
  const { error } = await client().from('social_profiles').delete().eq('user_id', userId);
  if (error) fail(error);
}

export async function publishStats(userId: string, stats: BoardSummary): Promise<void> {
  const { error } = await client().from('board_stats').upsert({ user_id: userId, stats, updated_at: new Date().toISOString() });
  if (error) fail(error);
}

/** People in the app with these numbers. `names` maps a number to the contact's name. */
export async function findByPhones(numbers: string[], names: Map<string, string> = new Map()): Promise<Match[]> {
  const e164 = [...new Set(numbers.map(normalizePhone).filter((n): n is string => !!n))].slice(0, 4000);
  if (!e164.length) return [];
  const byHash = new Map<string, string>();
  for (const n of e164) byHash.set(await hashPhone(n), n);
  const hashes = [...byHash.keys()];
  const out = new Map<string, Match>();
  for (let i = 0; i < hashes.length; i += 1000) {
    const { data, error } = await client().rpc('find_by_phone', { hashes: hashes.slice(i, i + 1000) });
    if (error) fail(error);
    for (const r of (data ?? []) as { user_id: string; name: string; phone_hash: string; status: FriendStatus | null }[]) {
      const num = byHash.get(r.phone_hash);
      const contact = num ? names.get(num) : undefined;
      out.set(r.user_id, { id: r.user_id, name: r.name, status: r.status, ...(contact ? { contact } : {}) });
    }
  }
  return [...out.values()].sort((a, b) => (a.contact ?? a.name).localeCompare(b.contact ?? b.name));
}

export async function myFriends(): Promise<Friend[]> {
  const { data, error } = await client().rpc('my_friends');
  if (error) fail(error);
  return ((data ?? []) as { user_id: string; name: string; status: FriendStatus }[]).map((r) => ({ id: r.user_id, name: r.name, status: r.status }));
}

export async function addFriend(id: string): Promise<FriendStatus> {
  const { data, error } = await client().rpc('add_friend', { other: id });
  if (error) fail(error);
  return data as FriendStatus;
}

export async function acceptFriend(id: string): Promise<void> {
  const { error } = await client().rpc('accept_friend', { other: id });
  if (error) fail(error);
}

export async function removeFriend(id: string): Promise<void> {
  const { error } = await client().rpc('remove_friend', { other: id });
  if (error) fail(error);
}

/** You and your friends, with what each shares. */
export async function friendBoard(me: string): Promise<BoardPerson[]> {
  const { data, error } = await client().rpc('friend_board');
  if (error) fail(error);
  return ((data ?? []) as { user_id: string; name: string; stats: unknown }[]).map((r) => ({
    id: r.user_id,
    name: r.name || 'Friend',
    me: r.user_id === me,
    summary: readSummary(r.stats),
  }));
}
