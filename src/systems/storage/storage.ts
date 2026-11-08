import { defaultProfile, sanitizeProfile, type Profile } from './profileSchema';

const KEY = 'driftcity.profile.v1';

/**
 * Persistence adapter. LocalStorage today; swap `load`/`save` for API calls to add a backend.
 */
export const storage = {
  load(): Profile {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultProfile();
      return sanitizeProfile(JSON.parse(raw));
    } catch {
      return defaultProfile();
    }
  },
  save(profile: Profile) {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {
      /* storage full or unavailable (private mode) — progress lives for this session only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
