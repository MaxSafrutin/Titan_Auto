var SESSION_TTL_SECONDS = 21600;

function setAdminPassword(pin) {
  if (String(pin || '').length < 4) throw new Error('PIN должен содержать минимум 4 символа.');
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('APP_SECRET') || Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('APP_SECRET', secret);
  props.setProperty('ADMIN_PASSWORD_HASH', sha256(String(pin) + ':' + secret));
  return 'PIN сохранён в виде SHA-256 hash.';
}

function login(payload) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('APP_SECRET');
  var expected = props.getProperty('ADMIN_PASSWORD_HASH');
  if (!secret || !expected) throw apiError('SETUP_REQUIRED', 'Сначала выполните setAdminPassword().');
  if (sha256(String((payload || {}).pin || '') + ':' + secret) !== expected) {
    Utilities.sleep(350);
    throw apiError('INVALID_CREDENTIALS', 'Неверный PIN.');
  }
  var token = Utilities.getUuid() + Utilities.getUuid();
  var session = { token: token, user: 'Администратор', created_at: nowIso() };
  CacheService.getScriptCache().put('session:' + sha256(token), JSON.stringify(session), SESSION_TTL_SECONDS);
  return { session: token, user: session.user, expires_in: SESSION_TTL_SECONDS };
}

function getSession(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var key = 'session:' + sha256(token);
  var raw = cache.get(key);
  if (!raw) return null;
  cache.put(key, raw, SESSION_TTL_SECONDS);
  return jsonParse(raw, null);
}

function requireSession(token) {
  var session = getSession(token);
  if (!session) throw apiError('UNAUTHORIZED', 'Сессия истекла. Войдите снова.');
  return session;
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('session:' + sha256(token));
  return { logged_out: true };
}

function enforceRateLimit(token) {
  var cache = CacheService.getScriptCache();
  var window = Math.floor(Date.now() / 60000);
  var key = 'rate:' + sha256(token || 'public') + ':' + window;
  var count = Number(cache.get(key) || 0) + 1;
  if (count > 120) throw apiError('RATE_LIMIT', 'Слишком много запросов. Повторите через минуту.');
  cache.put(key, String(count), 90);
}

function checkAllowedOrigin(origin) {
  var allowed = PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGIN') || '';
  if (!allowed || allowed === '*') return;
  var list = allowed.split(',').map(function (x) { return x.trim(); });
  if (list.indexOf(String(origin || '')) < 0) throw apiError('ORIGIN_NOT_ALLOWED', 'Этот адрес приложения не разрешён.');
}
