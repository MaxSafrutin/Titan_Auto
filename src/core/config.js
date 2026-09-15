const deployedApiUrl = 'https://script.google.com/macros/s/AKfycbxvY4vxJKj32-9Up0mlkLl5Fa_XK6eaMSuFykFRooS9HA-URta9D8GUJgsb8SjLVlVnXQ/exec';
const storedApiUrl = localStorage.getItem('titan.apiUrl') || deployedApiUrl;

export const Config = Object.freeze({
  apiUrl: storedApiUrl,
  requestTimeoutMs: 25000,
  appName: 'TITAN AUTO',
  version: '0.9.0',
});

export function saveApiUrl(value) {
  const url = String(value || '').trim();
  if (url && !/^https:\/\/script\.google\.com\//i.test(url)) {
    throw new Error('Укажите URL развёрнутого Google Apps Script Web App.');
  }
  if (url) localStorage.setItem('titan.apiUrl', url);
  else localStorage.removeItem('titan.apiUrl');
  location.reload();
}
