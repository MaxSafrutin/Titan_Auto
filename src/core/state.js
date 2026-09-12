import { Events } from './events.js';

const data = {
  session: sessionStorage.getItem('titan.session') || '',
  user: null,
  currentVehicle: null,
  online: navigator.onLine,
};

export const AppState = {
  get(key) { return data[key]; },
  set(key, value) {
    data[key] = value;
    if (key === 'session') {
      if (value) sessionStorage.setItem('titan.session', value);
      else sessionStorage.removeItem('titan.session');
    }
    Events.emit(`state:${key}`, value);
  },
  snapshot() { return { ...data }; },
};

addEventListener('online', () => AppState.set('online', true));
addEventListener('offline', () => AppState.set('online', false));
