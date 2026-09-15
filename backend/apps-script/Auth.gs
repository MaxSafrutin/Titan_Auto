var SESSION_TTL_SECONDS = 21600;

function setAdminPassword(pin) {
  if (String(pin || '').length < 4) throw new Error('PIN должен содержать минимум 4 символа.');
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('APP_SECRET') || Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('APP_SECRET', secret);
  props.setProperty('ADMIN_PASSWORD_HASH', sha256(String(pin) + ':' + secret));
  return 'PIN сохранён в виде SHA-256 hash.';
}

function staffUsersRaw() {
  var row = findRecord('SETTINGS', 'key', 'staff_users_json');
  var users = jsonParse(row && row.value, []);
  return Array.isArray(users) ? users : [];
}

function saveStaffUsers(users) {
  upsertSetting('staff_users_json', JSON.stringify(users || []), 'Пользователи внутреннего портала');
}

function publicSessionUser(session) {
  return { user_id: session.user_id || 'admin', name: session.user || 'Администратор', role: session.role || 'admin' };
}

function staffUserList(session) {
  requireRole(session, ['admin']);
  return staffUsersRaw().map(function (user) { return { user_id: user.user_id, name: user.name, role: user.role, active: user.active !== false, updated_at: user.updated_at || '' }; });
}

function staffUserUpsert(payload, session) {
  requireRole(session, ['admin']);
  var data = cleanObject(payload), roles = ['admin','director','manager'];
  if (!String(data.name || '').trim()) throw apiError('VALIDATION_ERROR', 'Укажите имя сотрудника.');
  if (roles.indexOf(String(data.role)) < 0) throw apiError('VALIDATION_ERROR', 'Неизвестная роль сотрудника.');
  var users = staffUsersRaw(), index = -1;
  for (var i = 0; i < users.length; i += 1) if ((data.user_id && users[i].user_id === data.user_id) || (!data.user_id && String(users[i].name).toLowerCase() === String(data.name).toLowerCase())) { index = i; break; }
  var current = index >= 0 ? users[index] : { user_id: 'USER-' + Utilities.getUuid(), active: true };
  current.name = String(data.name).trim(); current.role = String(data.role); current.active = data.active !== false; current.updated_at = nowIso();
  if (data.pin) {
    if (String(data.pin).length < 4) throw apiError('VALIDATION_ERROR', 'PIN должен содержать минимум 4 символа.');
    var candidateHash = sha256(String(data.pin) + ':' + PropertiesService.getScriptProperties().getProperty('APP_SECRET'));
    if (candidateHash === PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH') || users.some(function (user) { return user.user_id !== current.user_id && user.pin_hash === candidateHash; })) throw apiError('PIN_ALREADY_USED', 'Этот PIN уже назначен другому пользователю.');
    current.pin_hash = candidateHash;
  } else if (!current.pin_hash) throw apiError('VALIDATION_ERROR', 'Для нового сотрудника задайте PIN.');
  if (index >= 0) users[index] = current; else users.push(current);
  saveStaffUsers(users); auditChanges(session, 'USER', current.user_id, index >= 0 ? 'UPDATE' : 'CREATE', {}, { name: current.name, role: current.role, active: current.active });
  return { user_id: current.user_id, name: current.name, role: current.role, active: current.active, updated_at: current.updated_at };
}

function requireRole(session, roles) {
  var role = (session && session.role) || 'admin';
  if ((roles || []).indexOf(role) < 0) throw apiError('FORBIDDEN', 'Недостаточно прав для этого действия.');
  return session;
}

function authorizeAction(action, session) {
  if (action.indexOf('user.') === 0) return requireRole(session, ['admin']);
  if (['settings.get','settings.update','sale.list','sale.create','sale.update'].indexOf(action) >= 0) return requireRole(session, ['admin','director']);
  return session;
}

function login(payload) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('APP_SECRET');
  var expected = props.getProperty('ADMIN_PASSWORD_HASH');
  if (!secret || !expected) throw apiError('SETUP_REQUIRED', 'Сначала выполните setAdminPassword().');
  var suppliedHash = sha256(String((payload || {}).pin || '') + ':' + secret);
  var matched = null, users = staffUsersRaw();
  for (var i = 0; i < users.length; i += 1) if (users[i].active !== false && users[i].pin_hash === suppliedHash) { matched = users[i]; break; }
  if (!matched && suppliedHash !== expected) {
    Utilities.sleep(350);
    throw apiError('INVALID_CREDENTIALS', 'Неверный PIN.');
  }
  var token = Utilities.getUuid() + Utilities.getUuid();
  var session = { token: token, user_id: matched ? matched.user_id : 'admin', user: matched ? matched.name : 'Администратор', role: matched ? matched.role : 'admin', created_at: nowIso() };
  CacheService.getScriptCache().put('session:' + sha256(token), JSON.stringify(session), SESSION_TTL_SECONDS);
  return { session: token, user: publicSessionUser(session), expires_in: SESSION_TTL_SECONDS };
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
