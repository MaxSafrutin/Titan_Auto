import { TitanAPI } from './titan-api.js?v=1.6.1';
import { AppState } from './state.js';

export const Auth = {
  async login(pin) {
    const result = await TitanAPI.auth.login(pin);
    AppState.set('session', result.session);
    AppState.set('user', result.user);
    return result;
  },
  async restore() {
    if (!AppState.get('session')) return false;
    try {
      const result = await TitanAPI.auth.check();
      AppState.set('user', result.user);
      return true;
    } catch {
      AppState.set('session', '');
      return false;
    }
  },
  async logout() {
    try { await TitanAPI.auth.logout(); } finally {
      AppState.set('session', '');
      AppState.set('user', null);
    }
  },
};
