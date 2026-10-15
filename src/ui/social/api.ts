import * as Crypto from 'expo-crypto';

import { normalizePhone, phoneHashInput, readSummary, type BoardPerson, type BoardSummary } from '@/logic';

import { supabase } from '../cloud';

export type FriendStatus = 'friends' | 'sent' | 'received';

/** How someone shows up: name, and (once profiles.sql is run) username, city and picture. */
export interface Person {
  id: string;
  name: string;
  username: string | null;
  city: string;
  photo: string;
}

export interface Friend extends Person {
  status: FriendStatus;
}

export interface Match extends Person {
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
  if (e?.code === '23505') throw new SocialError('other', /username/i.test(msg) ? 'That username is taken. Try another.' : 'That phone number is already used by another account.');
  // A column from profiles.sql that isn't there yet.
  if (e?.code === 'PGRST204' || e?.code === '42703') throw new SocialError('other', 'Usernames, city and pictures need a server update (supabase/profiles.sql).');
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
  username: string | null;
  city: string;
  photo: string;
}

/** Fields of a row from the server, whether or not profiles.sql has been run. */
function person(r: Record<string, unknown>): Person {
  return {
    id: String(r.user_id),
    name: String(r.name ?? '') || 'Friend',
    username: typeof r.username === 'string' && r.username ? r.username : null,
    city: typeof r.city === 'string' ? r.city : '',
    photo: typeof r.avatar_url === 'string' && r.avatar_url.startsWith('https://') ? r.avatar_url : '',
  };
}

/** Your Friends profile, or null when Friends is off. */
export async function getProfile(userId: string): Promise<MyProfile | null> {
  // All columns, so this works before and after profiles.sql.
  const { data, error } = await client().from('social_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const p = person(data);
  return { name: data.name, hasPhone: !!data.phone_hash, username: p.username, city: p.city, photo: p.photo };
}

/** What can change on your Friends profile. Anything left out stays as it is. */
export interface ProfilePatch {
  name?: string;
  /** null removes your number. */
  phone?: string | null;
  /** null removes your username. */
  username?: string | null;
  city?: string;
  photo?: string;
}

/** Turn on Friends, or change your profile. */
export async function saveProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 40);
  if (patch.phone !== undefined) row.phone_hash = patch.phone ? await hashPhone(patch.phone) : null;
  if (patch.username !== undefined) row.username = patch.username;
  if (patch.city !== undefined) row.city = patch.city.trim().slice(0, 60);
  if (patch.photo !== undefined) row.avatar_url = patch.photo;
  const { error } = await client().from('social_profiles').upsert(row);
  if (error) fail(error);
}

/** Whether a username is free (or already yours). */
export async function usernameFree(userId: string, username: string): Promise<boolean> {
  const { data, error } = await client().rpc('find_by_username', { q: username });
  if (error) fail(error);
  return !((data ?? []) as Record<string, unknown>[]).some((r) => r.username === username && r.user_id !== userId);
}

/** People whose username starts with `q`. */
export async function findByUsername(q: string): Promise<Match[]> {
  const { data, error } = await client().rpc('find_by_username', { q });
  if (error) fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...person(r), status: (r.status as FriendStatus | null) ?? null }));
}

const AVATARS = 'avatars';

/** Uploads a profile picture (a small JPEG) and returns its web address. Old pictures are removed. */
export async function uploadPhoto(userId: string, jpeg: Uint8Array): Promise<string> {
  const sb = client();
  const path = `${userId}/${Date.now().toString(36)}.jpg`;
  const { error } = await sb.storage.from(AVATARS).upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new SocialError('setup', 'Profile pictures need a server update (supabase/profiles.sql).');
    throw new SocialError('other', /fetch|network/i.test(error.message) ? 'Couldn’t reach the server. Check your connection.' : error.message);
  }
  await removePhotos(userId, path).catch(() => {});
  return sb.storage.from(AVATARS).getPublicUrl(path).data.publicUrl;
}

/** Removes your profile pictures from the server, except `keep`. */
export async function removePhotos(userId: string, keep?: string): Promise<void> {
  const sb = client();
  const { data } = await sb.storage.from(AVATARS).list(userId, { limit: 100 });
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await sb.storage.from(AVATARS).remove(old);
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
      out.set(r.user_id, { ...person(r as unknown as Record<string, unknown>), status: r.status, ...(contact ? { contact } : {}) });
    }
  }
  return [...out.values()].sort((a, b) => (a.contact ?? a.name).localeCompare(b.contact ?? b.name));
}

export async function myFriends(): Promise<Friend[]> {
  const { data, error } = await client().rpc('my_friends');
  if (error) fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...person(r), status: r.status as FriendStatus }));
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
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...person(r),
    me: r.user_id === me,
    summary: readSummary(r.stats),
  }));
}
