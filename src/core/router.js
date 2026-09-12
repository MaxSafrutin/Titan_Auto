export function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [value, queryString = ''] = raw.split('?');
  const parts = value.split('/').filter(Boolean);
  return { name: parts[0] || 'dashboard', id: parts[1] || '', query: new URLSearchParams(queryString).get('q') || '' };
}

export function navigate(path) {
  location.hash = `#/${String(path).replace(/^\//, '')}`;
}
