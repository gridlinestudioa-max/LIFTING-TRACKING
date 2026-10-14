import './urlPolyfill';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { TrackerState } from '@/logic';

// Set in .env or Vercel (see README). The publishable/anon key is public by design; Row Level Security protects the data.
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Accounts are switched on (the Supabase project is set). Without it the app works on this device only. */
export const cloudConfigured = !!URL && !!KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
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
