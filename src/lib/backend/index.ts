import { LocalBackend } from './local';
import { SupabaseBackend, isSupabaseConfigured } from './supabase';
import type { Backend } from './types';

let instance: Backend | null = null;

export const getBackend = (): Backend => {
  if (!instance) {
    instance = isSupabaseConfigured() ? new SupabaseBackend() : new LocalBackend();
  }
  return instance;
};

export * from './types';
export { isSupabaseConfigured };
