const storedApiUrl = localStorage.getItem('titan.apiUrl') || '';

export const Config = Object.freeze({
  apiUrl: storedApiUrl,
  requestTimeoutMs: 25000,
  appName: 'TITAN AUTO',
  version: '0.1.0',
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
