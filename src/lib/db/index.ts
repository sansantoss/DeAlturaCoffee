import 'server-only';
import type { Repository } from './repository';
import { localRepository } from './local';
import { supabaseRepository } from './supabase';

export const backend = (process.env.DATA_BACKEND ?? 'local') as 'local' | 'supabase';

export const repo: Repository = backend === 'supabase' ? supabaseRepository : localRepository;
