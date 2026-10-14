import './urlPolyfill';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { TrackerState } from '@/logic';

// Set in .env or Vercel (see README). The publishable/anon key is public by design; Row Level Security protects the data.
// Only the project address is used, so a URL copied with a path (like ".../rest/v1/") still works.
const URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/^(https?:\/\/[^/]+).*$/, '$1');
const KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/** Accounts are switched on (the Supabase project is set). Without it the app works on this device only. */
export const cloudConfigured = !!URL && !!KEY;

let client: SupabaseClient | null = null;

/** What an email link brought the person here to do. */
export type Arrival = 'confirmed' | 'recovery' | null;

/**
 * On the web, an email link (confirm your email, reset your password) opens the site with the result in the
 * address: "#access_token=…&type=signup", or "#error=…&error_description=…" when the link is used or expired.
 * Read it once, before Supabase signs the person in from it.
 */
function readLink(): { arrival: Arrival; error: string | null } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { arrival: null, error: null };
  const params = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`);
  const error = params.get('error_description') || params.get('error');
  if (error) {
    const code = params.get('error_code') ?? '';
    const expired = code.includes('expired') || /expired|invalid/i.test(error);
    return { arrival: null, error: expired ? 'That link has expired or was already used. Sign in, or ask for a new link.' : error.replace(/\+/g, ' ') };
  }
  if (!params.get('access_token') && !params.get('code')) return { arrival: null, error: null };
  const type = params.get('type');
  return { arrival: type === 'recovery' ? 'recovery' : type === 'signup' || type === 'email' || type === 'invite' ? 'confirmed' : null, error: null };
}

export const link = readLink();

/** Take the link's details out of the address bar once they've been used. */
export function clearLinkFromUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (window.location.hash || window.location.search) window.history.replaceState(null, '', window.location.pathname);
}

/** Where email links should open: this website (so a link from a preview opens that preview). */
export function linkTarget(): string | undefined {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
}

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' },
    });
    if (Platform.OS !== 'web') {
      // Refresh the session only while the app is in the foreground.
      AppState.addEventListener('change', (s) => {
        if (s === 'active') client!.auth.startAutoRefresh();
        else client!.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}

/** Where one person's data lives in their account. */
export interface RemoteStore {
  load(): Promise<{ data: unknown; updatedAt: number } | null>;
  save(data: TrackerState): Promise<void>;
}

export function remoteStore(userId: string): RemoteStore | null {
  const sb = supabase();
  if (!sb) return null;
  return {
    async load() {
      const { data, error } = await sb.from('tracker_data').select('data, updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data ? { data: data.data, updatedAt: Number(data.updated_at) || 0 } : null;
    },
    async save(state) {
      const { error } = await sb.from('tracker_data').upsert({ user_id: userId, data: state, updated_at: state.updatedAt });
      if (error) throw error;
    },
  };
}
