import { Config, saveApiUrl } from './core/config.js';
import { TitanAPI } from './core/titan-api.js';
import { AppState } from './core/state.js';
import { Auth } from './core/auth.js';
import { route, navigate } from './core/router.js';

const root = document.querySelector('#app');
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

const h = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const fmtMoney = (value) => value === '' || value == null ? '—' : money.format(Number(value) || 0);
const fmtDate = (value) => { try { return value ? dateTime.format(new Date(value)) : '—'; } catch { return '—'; } };
const num = (value) => Number(String(value ?? '').replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;
const formObject = (form) => Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
const currentUser = () => AppState.get('user') || { name:'Сотрудник', role:'manager' };
const canFinancial = () => ['admin','director'].includes(currentUser().role);
const canAdmin = () => currentUser().role === 'admin';
const roleLabel = role => ({admin:'Администратор',director:'Руководитель',manager:'Менеджер'})[role] || role;

function toast(message, type = '') {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 4500);
}

function errorMessage(error) {
  return error?.message || 'Не удалось выполнить операцию. Повторите попытку.';
}

function navLink(path, label, current) {
  return `<a href="#/${path}" class="${current === path.split('/')[0] ? 'active' : ''}">${label}</a>`;
}

function shell(content) {
  const current = route().name;
  return `
    ${AppState.get('online') ? '' : '<div class="offline">Нет сети — формы не будут отправлены</div>'}
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#/dashboard"><img src="assets/brand/titan-auto-logo.svg" alt="TITAN AUTO"><span><small>Бизнес-платформа</small></span></a>
        <nav class="nav">
          ${navLink('dashboard','Главная',current)}
          ${navLink('vehicles','Автомобили',current)}
          ${navLink('leads','Лиды',current)}
          ${navLink('tasks','Задачи',current)}
          ${canFinancial()?navLink('sales','Продажи',current):''}
          ${canFinancial()?navLink('analytics','Аналитика',current):''}
          <div class="nav-label">Инструменты</div>
          ${navLink('valuation','Оценка',current)}
          ${navLink('calls','Навигатор звонка',current)}
          ${navLink('price-tags','Ценники',current)}
          ${navLink('stories','Сторис',current)}
          ${navLink('photos','Фото',current)}
          ${navLink('documents','Документы',current)}
          ${canFinancial()?navLink('payments','Калькулятор',current):''}
        </nav>
        <div class="sidebar-footer nav">
          ${canFinancial()?navLink('settings','Настройки',current):''}
          <div class="session-user"><b>${h(currentUser().name)}</b><span>${h(roleLabel(currentUser().role))}</span></div>
          <a href="#/catalog">Публичный каталог ↗</a>
          <button class="btn ghost" data-action="logout">Выйти</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <form class="search" data-form="search"><input name="q" autocomplete="off" placeholder="ID, телефон, VIN, марка или модель"></form>
          <a class="btn ghost public-stock-link" href="#/catalog">Публичный склад ↗</a>
          <button class="btn primary" data-action="new-entry">+ Добавить</button>
        </header>
        ${content}
      </main>
      <nav class="mobile-nav">
        ${navLink('dashboard','Главная',current)}${navLink('vehicles','Авто',current)}${navLink('leads','Лиды',current)}${canFinancial()?navLink('sales','Продажи',current):navLink('calls','Звонки',current)}${canFinancial()?navLink('settings','Ещё',current):navLink('photos','Фото',current)}
      </nav>
    </div>`;
}

function page(title, subtitle, body, actions = '') {
  return `<section class="page"><div class="page-head"><div><div class="eyebrow">TITAN AUTO</div><h1>${h(title)}</h1><div class="muted">${h(subtitle)}</div></div><div class="actions">${actions}</div></div>${body}</section>`;
}

function showModal(title, body) {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" data-modal><div class="modal-card"><div class="modal-head"><h2>${h(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Закрыть">×</button></div>${body}</div></div>`);
}

function closeModal() { document.querySelector('[data-modal]')?.remove(); }

async function loginView() {
  root.innerHTML = `<main class="hero"><section class="login card accent"><img src="assets/brand/titan-auto-logo.svg" alt="TITAN AUTO"><h1>Одна система.<br>Весь цикл сделки.</h1><p class="muted">Внутренний портал автосалона</p>
    ${Config.apiUrl ? `<form data-form="login"><input name="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN" required><button class="btn primary">Войти</button></form>` : `<div class="notice">Backend ещё не подключён. Укажите URL Apps Script.</div><form data-form="api"><input name="api_url" type="url" placeholder="https://script.google.com/macros/s/.../exec" required><button class="btn primary">Подключить</button></form>`}
    <p><a href="#/catalog" class="btn">Открыть публичный склад →</a></p></section></main>`;
}

async function dashboardView() {
  const d = await TitanAPI.dashboard.stats();
  const cards = [
    ['Активные автомобили', d.active_vehicles], ['Новые лиды', d.new_leads],
    ['Перезвонить сегодня', d.callbacks_today], ['Назначенные встречи', d.meetings_upcoming],
    ['Без оценки', d.without_valuation], ['Продано за месяц', d.sold_this_month],
    ...(d.financial_access ? [['Маржа за месяц', fmtMoney(d.margin_this_month)]] : []), ['Задачи сегодня', d.tasks_today],
  ].map(([label,value],i) => `<article class="card stat ${i===2?'accent':''}"><span>${h(label)}</span><b>${h(value ?? 0)}</b></article>`).join('');
  const actions = '<button class="btn primary" data-action="new-vehicle">+ Автомобиль</button><button class="btn" data-action="new-lead">+ Лид</button>';
  root.innerHTML = shell(page('Главная', 'Что требует внимания сегодня', `<div class="grid stats">${cards}</div><div class="grid two" style="margin-top:18px"><section class="card"><h2>Ближайшие действия</h2>${timeline(d.upcoming_actions)}</section><section class="card"><h2>Последние автомобили</h2>${miniVehicles(d.recent_vehicles)}</section></div>`, actions));
}

function timeline(items = []) {
  if (!items.length) return '<div class="empty">Ближайших действий нет</div>';
  return `<div class="timeline">${items.map(x => `<div class="timeline-item"><b>${h(x.next_action || x.title)}</b><div class="muted">${h(x.vehicle_id || x.lead_id || '')} · ${fmtDate(x.next_action_at || x.due_at)}</div></div>`).join('')}</div>`;
}

function miniVehicles(items = []) {
  if (!items.length) return '<div class="empty">Автомобилей пока нет</div>';
  return `<div class="timeline">${items.map(v => `<a class="timeline-item" href="#/vehicles/${h(v.vehicle_id)}"><b>${h([v.brand,v.model,v.year].filter(Boolean).join(' '))}</b><div class="muted">${h(v.vehicle_id)} · ${fmtMoney(v.sale_price)}</div></a>`).join('')}</div>`;
}

async function vehiclesView(query = '') {
  const rows = await TitanAPI.vehicles.list({ q: query });
  const body = rows.length ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Автомобиль</th><th>Год</th><th>Пробег</th><th>Цена</th><th>Статус</th></tr></thead><tbody>${rows.map(v => `<tr data-href="vehicles/${h(v.vehicle_id)}"><td>${h(v.vehicle_id)}</td><td><b>${h([v.brand,v.model,v.generation].filter(Boolean).join(' '))}</b></td><td>${h(v.year || '—')}</td><td>${v.mileage ? `${h(Number(v.mileage).toLocaleString('ru-RU'))} км` : '—'}</td><td>${fmtMoney(v.sale_price)}</td><td><span class="badge ${v.status==='sold'?'success':''}">${h(v.status || 'new')}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Ничего не найдено. Создайте первый автомобиль.</div>';
  root.innerHTML = shell(page('Автомобили', query ? `Результаты поиска: ${query}` : 'Единый реестр автомобилей', body, '<button class="btn primary" data-action="new-vehicle">+ Автомобиль</button>'));
}

async function leadsView(query = '') {
  const rows = await TitanAPI.leads.list({ q: query });
  const body = rows.length ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Клиент</th><th>Автомобиль</th><th>Телефон</th><th>Следующий контакт</th><th>Статус</th></tr></thead><tbody>${rows.map(v => `<tr data-href="leads/${h(v.lead_id)}"><td>${h(v.lead_id)}</td><td>${h(v.seller_name || '—')}</td><td><b>${h([v.brand,v.model,v.year].filter(Boolean).join(' '))}</b></td><td>${h(v.phone || '—')}</td><td>${fmtDate(v.next_contact_at)}</td><td><span class="badge">${h(v.status || 'new')}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Лидов пока нет</div>';
  root.innerHTML = shell(page('Лиды', 'Входящие обращения и следующие действия', body, '<button class="btn primary" data-action="new-lead">+ Лид</button>'));
}

async function tasksView() {
  const rows = await TitanAPI.tasks.list();
  const now = new Date().toISOString();
  const open = rows.filter(item => item.status !== 'done').sort((a,b) => String(a.due_at || '9999').localeCompare(String(b.due_at || '9999')));
  const done = rows.filter(item => item.status === 'done').sort((a,b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const taskRows = [...open, ...done];
  const body = taskRows.length ? `<div class="table-wrap"><table><thead><tr><th>Задача</th><th>Связь</th><th>Срок</th><th>Исполнитель</th><th>Приоритет</th><th>Статус</th><th></th></tr></thead><tbody>${taskRows.map(item => {
    const relation = item.vehicle_id ? `<a href="#/vehicles/${h(item.vehicle_id)}">${h(item.vehicle_id)}</a>` : item.lead_id ? `<a href="#/leads/${h(item.lead_id)}">${h(item.lead_id)}</a>` : 'Общая';
    const overdue = item.status !== 'done' && item.due_at && String(item.due_at) < now;
    return `<tr class="${item.status==='done'?'task-done':''}"><td><b>${h(item.title)}</b>${item.comment?`<small class="table-note">${h(item.comment)}</small>`:''}</td><td>${relation}</td><td><span class="badge ${overdue?'danger':''}">${fmtDate(item.due_at)}</span></td><td>${h(item.assignee || '—')}</td><td>${h(item.priority || 'normal')}</td><td>${h(item.status || 'open')}</td><td>${item.status!=='done'?`<button class="btn ghost" data-task-done="${h(item.task_id)}">Готово</button>`:''}</td></tr>`;
  }).join('')}</tbody></table></div>` : '<div class="card empty">Задач пока нет. Создайте первое напоминание.</div>';
  root.innerHTML = shell(page('Задачи', `Открыто: ${open.length} · выполнено: ${done.length}`, body, '<button class="btn primary" data-action="new-task">+ Задача</button>'));
}

async function salesView() {
  const snapshot = await TitanAPI.workspace.snapshot();
  const sales = snapshot.sales || [], vehicles = snapshot.vehicles || [];
  const vehiclesById = Object.fromEntries(vehicles.map(v => [v.vehicle_id, v]));
  const totals = sales.reduce((result, sale) => {
    result.revenue += num(sale.sale_price);
    result.commission += num(sale.commission);
    result.rewards += num(sale.actual_manager_payment) + num(sale.actual_director_payment);
    result.profit += num(sale.profit);
    return result;
  }, { revenue: 0, commission: 0, rewards: 0, profit: 0 });
  const metrics = [
    ['Продаж', sales.length], ['Оборот', fmtMoney(totals.revenue)],
    ['Комиссия', fmtMoney(totals.commission)], ['Доход компании', fmtMoney(totals.profit)],
  ].map(([label, value], index) => `<article class="card stat ${index === 3 ? 'accent' : ''}"><span>${h(label)}</span><b>${h(value)}</b></article>`).join('');
  const table = sales.length ? `<div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Дата</th><th>Автомобиль</th><th>Тип</th><th>Цена</th><th>Комиссия</th><th>Сотрудникам</th><th>Компании</th></tr></thead><tbody>${sales.map(sale => {
    const vehicle = vehiclesById[sale.vehicle_id] || {};
    const title = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || sale.vehicle_id;
    const rewards = num(sale.actual_manager_payment) + num(sale.actual_director_payment);
    return `<tr data-href="vehicles/${h(sale.vehicle_id)}"><td>${h(String(sale.sale_date || '').split('-').reverse().join('.'))}</td><td><b>${h(title)}</b><div class="muted">${h(sale.sale_id)}</div></td><td><span class="badge success">${sale.deal_type === 'commission' ? 'Комиссия' : 'Собственный'}</span></td><td>${fmtMoney(sale.sale_price)}</td><td>${fmtMoney(sale.commission)}</td><td>${fmtMoney(rewards)}</td><td><b>${fmtMoney(sale.profit)}</b></td></tr>`;
  }).join('')}</tbody></table></div>` : '<div class="card empty">Продаж пока нет</div>';
  const note = totals.rewards ? `<div class="notice" style="margin-top:18px">Вознаграждения сотрудников: ${fmtMoney(totals.rewards)}. Они уже исключены из дохода компании.</div>` : '';
  root.innerHTML = shell(page('Продажи', 'Финансовый результат и распределение комиссии', `<div class="grid stats">${metrics}</div>${note}${table}`, '<button class="btn primary" data-action="new-sale">+ Оформить продажу</button>'));
}

function analyticsBar(label, value, max, detail = '') {
  const width = max > 0 ? Math.max(4, Math.round(value / max * 100)) : 0;
  return `<div class="analytics-row"><div><b>${h(label)}</b>${detail ? `<span class="muted">${h(detail)}</span>` : ''}</div><div class="analytics-track"><i style="width:${width}%"></i></div><strong>${h(value)}</strong></div>`;
}

async function analyticsView() {
  const snapshot = await TitanAPI.workspace.snapshot();
  const vehicles = snapshot.vehicles || [], leads = snapshot.leads || [], sales = snapshot.sales || [], valuations = snapshot.valuations || [];
  const active = vehicles.filter(v => !['sold', 'archived'].includes(v.status));
  const sold = vehicles.filter(v => v.status === 'sold');
  const pipeline = active.reduce((sum, v) => sum + num(v.sale_price), 0);
  const revenue = sales.reduce((sum, v) => sum + num(v.sale_price), 0);
  const profit = sales.reduce((sum, v) => sum + num(v.profit), 0);
  const commission = sales.reduce((sum, v) => sum + num(v.commission), 0);
  const conversionBase = leads.length || 1;
  const conversion = Math.round(leads.filter(v => v.status === 'won').length / conversionBase * 100);
  const cards = [
    ['Портфель в работе', fmtMoney(pipeline)], ['Продажи', fmtMoney(revenue)],
    ['Комиссия', fmtMoney(commission)], ['Чистый доход', fmtMoney(profit)],
    ['Средний чек', fmtMoney(sales.length ? revenue / sales.length : 0)], ['Конверсия лидов', `${conversion}%`],
    ['Активные автомобили', active.length], ['Оценки', valuations.length],
  ].map(([label, value], index) => `<article class="card stat ${index === 3 ? 'accent' : ''}"><span>${h(label)}</span><b>${h(value)}</b></article>`).join('');
  const statusRows = [
    ['В работе', active.length], ['Продано', sold.length], ['Архив', vehicles.filter(v => v.status === 'archived').length],
  ];
  const maxStatus = Math.max(1, ...statusRows.map(([, value]) => value));
  const leadRows = [
    ['Активные', leads.filter(v => !['won','lost','archived','closed'].includes(v.status)).length],
    ['Успешные', leads.filter(v => v.status === 'won').length],
    ['Закрытые', leads.filter(v => ['lost','archived','closed'].includes(v.status)).length],
  ];
  const maxLeads = Math.max(1, ...leadRows.map(([, value]) => value));
  const body = `<div class="grid stats">${cards}</div><div class="grid two analytics-grid" style="margin-top:18px"><section class="card"><h2>Автомобили по статусам</h2><div class="analytics-list">${statusRows.map(([label,value]) => analyticsBar(label,value,maxStatus)).join('')}</div></section><section class="card"><h2>Воронка лидов</h2><div class="analytics-list">${leadRows.map(([label,value]) => analyticsBar(label,value,maxLeads)).join('')}</div></section><section class="card"><h2>Экономика продаж</h2><div class="metric-list"><div><span>Комиссия всего</span><b>${fmtMoney(commission)}</b></div><div><span>Сотрудникам</span><b>${fmtMoney(sales.reduce((sum,v)=>sum+num(v.actual_manager_payment)+num(v.actual_director_payment),0))}</b></div><div><span>Компании</span><b>${fmtMoney(profit)}</b></div></div></section><section class="card"><h2>Контроль данных</h2><div class="metric-list"><div><span>Без VIN</span><b>${vehicles.filter(v=>!v.vin).length}</b></div><div><span>Без телефона</span><b>${vehicles.filter(v=>!v.seller_phone).length}</b></div><div><span>Без оценки</span><b>${active.filter(v=>!valuations.some(x=>x.vehicle_id===v.vehicle_id)).length}</b></div></div></section></div>`;
  root.innerHTML = shell(page('Аналитика', 'Живые показатели из единой базы TITAN AUTO', body));
}

async function leadView(id) {
  const data = await TitanAPI.leads.get(id);
  const lead = data.lead;
  AppState.set('currentLead', lead);
  AppState.set('currentVehicle', null);
  const vehicleTitle = [lead.brand, lead.model, lead.year].filter(Boolean).join(' ') || 'Автомобиль не указан';
  const linkedVehicle = lead.vehicle_id ? `<a class="btn" href="#/vehicles/${h(lead.vehicle_id)}">Открыть ${h(lead.vehicle_id)}</a>` : '<button class="btn primary" data-action="convert-lead">Создать автомобиль</button>';
  const body = `<div class="grid two"><section class="card accent"><div class="vehicle-title"><span class="badge">${h(lead.status || 'new')}</span><span class="muted">${h(lead.lead_id)}</span></div><h2 style="margin-top:22px">${h(vehicleTitle)}</h2><p class="muted">Цена продавца: ${fmtMoney(lead.seller_price)}</p><div class="actions">${linkedVehicle}${lead.source_url ? `<a class="btn" href="${h(lead.source_url)}" target="_blank" rel="noopener">Объявление</a>` : ''}</div></section><section class="card"><h2>Продавец</h2><p><b>${h(lead.seller_name || 'Имя не указано')}</b><br><span class="muted">${h(lead.phone || 'Телефон не указан')}</span></p><p>Следующий контакт: <b>${fmtDate(lead.next_contact_at)}</b></p><p class="muted">${h(lead.notes || 'Заметок нет')}</p><div class="actions"><a class="btn primary" href="tel:${h(lead.phone)}">Позвонить</a><button class="btn" data-action="open-calls">Открыть навигатор</button><button class="btn" data-action="new-contact">Новый контакт</button><button class="btn" data-action="new-task">Задача</button></div></section></div><section class="card" style="margin-top:18px"><h2>История контактов</h2>${timeline((data.contacts || []).map(x => ({ ...x, title: x.result || x.type, next_action_at: x.created_at })))}</section>`;
  root.innerHTML = shell(page(lead.lead_id, vehicleTitle, body, '<button class="btn" data-action="edit-lead">Изменить</button>'));
}

async function vehicleView(id) {
  const data = await TitanAPI.vehicles.get(id);
  const v = data.vehicle;
  AppState.set('currentVehicle', v);
  const title = [v.brand,v.model].filter(Boolean).join(' ') || v.vehicle_id;
  const metrics = [['Цена продавца',v.seller_price],['Рыночная',v.market_price],['Выкуп',v.buyout_price],['Цена продажи',v.sale_price],['Вложения',v.estimated_investments],['Комиссия',v.commission]].map(([k,val]) => `<div class="metric"><span class="muted">${k}</span><strong>${fmtMoney(val)}</strong></div>`).join('');
  const body = `<div class="grid two"><section class="card accent"><div class="vehicle-title"><span class="badge">${h(v.status)}</span><span class="muted">${h(v.public_status || 'private')}</span></div><h2 style="margin-top:22px">${h(title)}</h2><p class="muted">${h([v.year, v.engine_volume, v.transmission, v.mileage ? `${Number(v.mileage).toLocaleString('ru-RU')} км` : ''].filter(Boolean).join(' · '))}</p><div class="grid stats">${metrics}</div></section><section class="card"><h2>Контакт</h2><p><b>${h(v.seller_name || 'Имя не указано')}</b><br><span class="muted">${h(v.seller_phone || 'Телефон не указан')}</span></p><p class="muted">${h(v.notes || 'Заметок нет')}</p><div class="actions"><a class="btn primary" href="tel:${h(v.seller_phone)}">Позвонить</a><button class="btn" data-action="new-contact">Новый контакт</button><button class="btn" data-action="open-valuation">Полная оценка</button></div></section></div>
  <div class="grid two" style="margin-top:18px"><section class="card"><h2>История контактов</h2>${timeline((data.contacts||[]).map(x=>({...x,title:x.result||x.type,next_action_at:x.created_at})))}</section><section class="card"><h2>Оценки</h2>${(data.valuations||[]).length ? timeline(data.valuations.map(x=>({title:`Рынок ${fmtMoney(x.market_price)} · Выкуп ${fmtMoney(x.buyout_price)}`,due_at:x.created_at}))) : '<div class="empty">Оценок пока нет</div>'}</section><section class="card"><h2>Файлы</h2>${fileList(data.files)}</section><section class="card"><h2>История изменений</h2>${(data.audit||[]).length ? timeline(data.audit.map(x=>({title:`${x.field}: ${x.old_value||'—'} → ${x.new_value||'—'}`,due_at:x.created_at}))) : '<div class="empty">Изменений пока нет</div>'}</section></div>`;
  const actions = `<button class="btn" data-action="edit-vehicle">Изменить</button><button class="btn ${v.public_status==='published'?'':'primary'}" data-action="toggle-publish">${v.public_status==='published'?'Снять с публикации':'Опубликовать на складе'}</button>${v.public_status==='published'?`<a class="btn" href="#/catalog/${h(v.vehicle_id)}">Посмотреть публично ↗</a>`:''}<button class="btn" data-action="new-task">Задача</button><button class="btn" data-action="open-price-tag">Ценник</button><button class="btn" data-action="open-stories">Сторис</button><button class="btn" data-action="open-photos">Фото</button><button class="btn" data-action="upload-file">Загрузить файл</button><button class="btn primary" data-action="mark-sold">Продано</button>`;
  root.innerHTML = shell(page(v.vehicle_id, title, body, actions));
}

async function priceTagsView() {
  const vehicle = AppState.get('currentVehicle');
  if (!vehicle) {
    const rows = await TitanAPI.vehicles.list();
    const picker = rows.length ? `<div class="tool-picker">${rows.map(v => `<button class="card tool-choice" data-price-tag-vehicle="${h(v.vehicle_id)}"><span class="eyebrow">${h(v.vehicle_id)}</span><strong>${h([v.brand,v.model,v.year].filter(Boolean).join(' '))}</strong><span class="muted">${fmtMoney(v.sale_price)}</span></button>`).join('')}</div>` : '<div class="card empty">Сначала создайте автомобиль</div>';
    root.innerHTML = shell(page('Ценники', 'Выберите автомобиль — его данные подставятся автоматически', picker));
    return;
  }
  const title = [vehicle.brand,vehicle.model,vehicle.year].filter(Boolean).join(' ');
  const settings = await TitanAPI.settings.get();
  const company = settings.company || {};
  root.innerHTML = shell(page('Ценник', `${vehicle.vehicle_id} · ${title}`, '<div class="tool-frame-wrap"><iframe class="tool-frame" title="Генератор ценников" src="src/modules/price-tags/legacy/index.html"></iframe></div>', '<button class="btn" data-action="change-price-tag-vehicle">Сменить автомобиль</button>'));
  const frame = document.querySelector('.tool-frame');
  frame.addEventListener('load', () => frame.contentWindow.postMessage({ type: 'TITAN_PRICE_TAG_LOAD', vehicle, company }, location.origin), { once: true });
}

function documentVehicle(v = {}) {
  const statusMap={sold:'sold',archived:'archived',reserved:'reserved',in_stock:'in_stock'};
  const makeModel=[v.brand,v.model,v.generation].filter(Boolean).join(' ');
  return { ...v, id:v.vehicle_id, make_model:makeModel, registration_plate:v.registration_plate||'', pts:v.pts_number||'', sts:v.sts_number||'', owner_id:v.owner_id||'', acquisition_type:v.acquisition_type||'other', status:statusMap[v.status]||(v.acquisition_type==='commission'?'consignment':'in_stock'), data:{vin:v.vin||'',category:v.category||'',type:v.vehicle_type||v.body_type||'',make_model:makeModel,year:String(v.year||''),engine:v.engine_number||[v.engine_volume,v.engine_power&&`${v.engine_power} л.с.`].filter(Boolean).join(' / '),chassis:v.chassis_number||'',body_number:v.body_number||'',color:v.color||'',pts:v.pts_number||'',pts_issued:v.pts_issued||'',sts:v.sts_number||'',sts_issued:v.sts_issued||'',registration_plate:v.registration_plate||'',special_notes:v.special_notes||''},created_at:v.created_at||'',updated_at:v.updated_at||'' };
}
function documentCompany(c = {}) { return {id:'titan-auto',kind:'organization',name:c.legal_name||'ТИТАН АВТО',inn:c.inn||'',kpp:c.kpp||'',ogrn:c.ogrn||'',director:c.director||'',bank_name:c.bank_name||'',bank_account:c.bank_account||'',correspondent_account:c.correspondent_account||'',bik:c.bik||'',birth_date:'',passport_series:'',passport_number:'',passport_issue_date:'',passport_issued_by:'',division_code:'',address:c.address||'',phone:c.phone||'',is_own_company:true,created_at:'',updated_at:''}; }
function documentParty(p = {}) { return {...p,id:p.counterparty_id||p.id}; }
function vehiclePayload(v = {}) { const words=String(v.make_model||'').trim().split(/\s+/); return {brand:v.brand||words.shift()||'Без марки',model:v.model||words.join(' ')||'Без модели',generation:v.generation||'',vin:v.vin||v.data?.vin||'',year:v.year||v.data?.year||'',color:v.color||v.data?.color||'',registration_plate:v.registration_plate||v.data?.registration_plate||'',category:v.data?.category||'',vehicle_type:v.data?.type||'',engine_number:v.data?.engine||'',chassis_number:v.data?.chassis||'',body_number:v.data?.body_number||'',pts_number:v.pts||v.data?.pts||'',pts_issued:v.data?.pts_issued||'',sts_number:v.sts||v.data?.sts||'',sts_issued:v.data?.sts_issued||'',special_notes:v.data?.special_notes||'',owner_id:v.owner_id||'',acquisition_type:v.acquisition_type||'other',status:v.status==='consignment'?'in_stock':v.status||'in_stock'}; }

async function documentsView() {
  const snapshot=await TitanAPI.documents.snapshot();
  const vehicles=snapshot.vehicles||[],counterparties=snapshot.counterparties||[],deals=snapshot.deals||[],settings=snapshot.settings||{},templates=snapshot.templates||[];
  const company=documentCompany(settings.company||{}),templateMap=Object.fromEntries(templates.map(item=>[item.name,item.data_url]));
  const payload={company,vehicles:vehicles.map(documentVehicle),counterparties:[company,...counterparties.filter(p=>(p.counterparty_id||p.id)!=='titan-auto').map(documentParty)],deals:deals.map(d=>({...d,id:d.deal_id||d.id})),templates:templateMap};
  root.innerHTML=shell(page('Документы','Сделки, контрагенты и защищённые DOCX-шаблоны','<div class="tool-frame-wrap"><iframe class="tool-frame documents-frame" title="Конструктор документов" src="src/modules/documents/app/index.html"></iframe></div>'));
  const frame=document.querySelector('.documents-frame');
  frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'TITAN_DOCUMENTS_LOAD',payload},location.origin),{once:true});
}

async function saveDocumentRecord(store,value){
  if(store==='counterparties'){
    if(value.id==='titan-auto')throw new Error('Реквизиты нашей компании редактируются в настройках TITAN AUTO.');
    const data={...value};delete data.id;delete data.counterparty_id;
    const saved=String(value.id||'').startsWith('CP-')?await TitanAPI.counterparties.update(value.id,data):await TitanAPI.counterparties.create(data);
    return documentParty(saved);
  }
  if(store==='vehicles'){
    const data=vehiclePayload(value),saved=String(value.id||'').startsWith('TA-')?await TitanAPI.vehicles.update(value.id,data):await TitanAPI.vehicles.create(data);
    return documentVehicle(saved);
  }
  if(store==='deals'){
    const data={...value};delete data.id;delete data.deal_id;
    const saved=String(value.id||'').startsWith('DEAL-')?await TitanAPI.deals.update(value.id,data):await TitanAPI.deals.create(data);
    return {...saved,id:saved.deal_id||saved.id};
  }
  throw new Error('Неизвестный раздел документов.');
}

function fileList(items = []) {
  if (!items.length) return '<div class="empty">Файлов пока нет</div>';
  return `<div class="timeline">${items.map(x => `<div class="timeline-item"><b>${h(x.filename)}</b><div class="muted">${h(x.type)} · версия ${h(x.version)}</div><button class="btn ghost" data-download="${h(x.file_id)}">Скачать</button></div>`).join('')}</div>`;
}

async function catalogView() {
  root.innerHTML = `<main class="page public-catalog"><div class="page-head"><a class="brand" href="#/catalog"><img src="assets/brand/titan-auto-logo.svg" alt="TITAN AUTO"></a><a class="btn" href="#/dashboard">Вход для сотрудников</a></div><div class="loading-card"><i></i><b>Загружаем публичный склад…</b></div></main>`;
  const cacheKey = 'titan.publicCatalog';
  let rows = [];
  let warning = '';
  try {
    rows = await TitanAPI.vehicles.publicList();
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), rows }));
  } catch (e) {
    const cached = (() => { try { return JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch { return null; } })();
    if (cached?.rows?.length) {
      rows = cached.rows;
      warning = `<div class="notice">Показана последняя загруженная версия склада. Обновление временно недоступно.</div>`;
    } else warning = `<div class="notice">${h(errorMessage(e))}</div>`;
  }
  const available = rows.filter(v => v.stock_type === 'in_stock').length;
  const virtual = rows.length - available;
  root.innerHTML = `<main class="page public-catalog"><div class="page-head"><a class="brand" href="#/catalog"><img src="assets/brand/titan-auto-logo.svg" alt="TITAN AUTO"></a><a class="btn" href="#/dashboard">Вход для сотрудников</a></div><div class="eyebrow">ТИТАН АВТО · САМАРА</div><h1>Публичный склад</h1><p class="muted">Автомобили в наличии и виртуальный склад проверенных предложений.</p><div class="actions catalog-summary"><span class="badge success">В наличии: ${available}</span><span class="badge">Виртуальный склад: ${virtual}</span></div>${warning}<div class="grid catalog-grid" style="margin-top:28px">${rows.length ? rows.map(v => `<a class="card catalog-card" href="#/catalog/${h(v.vehicle_id)}"><div class="catalog-media">${v.cover_url ? `<img src="${h(v.cover_url)}" alt="${h(v.brand+' '+v.model)}">` : '<span>Фото добавляется</span>'}</div><div class="catalog-body"><div class="vehicle-title"><span class="badge ${v.stock_type==='in_stock'?'success':''}">${v.stock_type==='in_stock'?'В наличии':'Виртуальный склад'}</span><span class="muted">${h(v.vehicle_id)}</span></div><div class="eyebrow" style="margin-top:18px">${h(v.year || '')}</div><h2>${h([v.brand,v.model].filter(Boolean).join(' '))}</h2><p class="muted">${h([v.mileage ? `${Number(v.mileage).toLocaleString('ru-RU')} км` : '',v.transmission,v.engine_volume ? `${v.engine_volume} л` : ''].filter(Boolean).join(' · '))}</p><strong class="catalog-price">${fmtMoney(v.sale_price)}</strong><span class="catalog-more">Подробнее →</span></div></a>`).join('') : '<div class="card empty"><h2>Склад готов к публикации</h2><p>В кабинете сотрудника откройте автомобиль и нажмите «Опубликовать на складе».</p></div>'}</div></main>`;
}

async function catalogVehicleView(id) {
  root.innerHTML = `<main class="page public-catalog"><div class="loading-card"><i></i><b>Загружаем автомобиль…</b></div></main>`;
  try {
    const data=await TitanAPI.vehicles.publicGet(id),v=data.vehicle,company=data.company||{},photos=v.photos?.length?v.photos:(v.cover_url?[v.cover_url]:[]),title=[v.brand,v.model,v.generation].filter(Boolean).join(' ');
    const specs=[['Год',v.year],['Пробег',v.mileage?`${Number(v.mileage).toLocaleString('ru-RU')} км`:''],['Двигатель',[v.engine_volume&&`${v.engine_volume} л`,v.engine_power&&`${v.engine_power} л.с.`,v.fuel_type].filter(Boolean).join(' · ')],['Коробка',v.transmission],['Привод',v.drive_type],['Кузов',v.body_type],['Цвет',v.color]].filter(([,value])=>value);
    root.innerHTML=`<main class="page public-catalog"><div class="page-head"><a class="brand" href="#/catalog"><img src="assets/brand/titan-auto-logo.svg" alt="TITAN AUTO"></a><a class="btn" href="#/dashboard">Вход для сотрудников</a></div><a class="catalog-back" href="#/catalog">← Все автомобили</a><div class="public-vehicle-layout"><section><div class="public-gallery">${photos.length?photos.map((url,index)=>`<img class="${index?'':'main'}" src="${h(url)}" alt="${h(title)} · фото ${index+1}">`).join(''):'<div class="catalog-media public-placeholder">Фото готовится</div>'}</div></section><section class="card public-offer"><span class="badge ${v.stock_type==='in_stock'?'success':''}">${v.stock_type==='in_stock'?'В наличии':'Виртуальный склад'}</span><div class="eyebrow">${h(v.vehicle_id)}</div><h1>${h(title)}</h1><strong class="catalog-price">${fmtMoney(v.sale_price)}</strong><div class="public-specs">${specs.map(([label,value])=>`<div><span>${h(label)}</span><b>${h(value)}</b></div>`).join('')}</div>${v.description?`<p class="public-description">${h(v.description)}</p>`:''}<div class="public-contact"><b>${h(company.legal_name||'ТИТАН АВТО')}</b>${company.address?`<span>${h(company.address)}</span>`:''}${company.phone?`<a class="btn primary" href="tel:${h(company.phone)}">Позвонить ${h(company.phone)}</a>`:'<span class="muted">Свяжитесь с менеджером TITAN AUTO</span>'}</div></section></div></main>`;
  } catch(error) {
    root.innerHTML=`<main class="page public-catalog"><div class="card empty"><h2>Автомобиль недоступен</h2><p>${h(errorMessage(error))}</p><a class="btn" href="#/catalog">Вернуться на склад</a></div></main>`;
  }
}

async function valuationsView(vehicleId = '') {
  if(vehicleId){
    const [data,settings,history]=await Promise.all([TitanAPI.vehicles.get(vehicleId),TitanAPI.settings.get(),TitanAPI.valuations.list(vehicleId)]),vehicle=data.vehicle,title=[vehicle.brand,vehicle.model,vehicle.year].filter(Boolean).join(' ');
    AppState.set('currentVehicle',vehicle);
    const body=`<div class="story-context card"><div><span class="badge">${h(vehicle.status||'new')}</span><b>${h(title)}</b><span class="muted">${h(vehicle.vehicle_id)} · оценок в базе: ${(history||[]).length}</span></div><div class="actions"><a class="btn" href="#/vehicles/${h(vehicle.vehicle_id)}">Карточка авто</a></div></div><div class="tool-frame-wrap valuation-frame-wrap"><iframe class="tool-frame valuation-frame" title="Полная оценка автомобиля" src="src/modules/valuation/legacy/index.html?embedded=1"></iframe></div>`;
    root.innerHTML=shell(page('Полная оценка',`${vehicle.vehicle_id} · акт осмотра, диагностика, рынок и предложения`,body,'<a class="btn" href="#/valuation">← Все автомобили</a>'));
    const frame=document.querySelector('.valuation-frame');frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'TITAN_VALUATION_LOAD',vehicle,company:settings.company||{}},location.origin),{once:true});return;
  }
  const snapshot=await TitanAPI.workspace.snapshot(),vehicles=snapshot.vehicles||[],valuations=snapshot.valuations||[],latest={};valuations.forEach(item=>{if(!latest[item.vehicle_id]||String(item.created_at)>String(latest[item.vehicle_id].created_at))latest[item.vehicle_id]=item});
  const body=vehicles.length?`<div class="table-wrap"><table><thead><tr><th>Автомобиль</th><th>Последняя оценка</th><th>Рынок</th><th>Выкуп</th><th>Вложения</th><th></th></tr></thead><tbody>${vehicles.map(vehicle=>{const item=latest[vehicle.vehicle_id]||{};return`<tr data-valuation-vehicle="${h(vehicle.vehicle_id)}"><td><b>${h([vehicle.brand,vehicle.model,vehicle.year].filter(Boolean).join(' '))}</b><div class="muted">${h(vehicle.vehicle_id)}</div></td><td>${item.created_at?fmtDate(item.created_at):'<span class="muted">Не проводилась</span>'}</td><td>${fmtMoney(item.market_price||vehicle.market_price)}</td><td>${fmtMoney(item.buyout_price||vehicle.buyout_price)}</td><td>${fmtMoney(item.estimated_investments||vehicle.estimated_investments)}</td><td><button class="btn primary" data-valuation-vehicle="${h(vehicle.vehicle_id)}">Открыть оценку</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="card empty">Сначала создайте автомобиль.</div>';
  root.innerHTML=shell(page('Оценка','Все автомобили: журнал, акт осмотра, диагностика и расчёт предложений',body));
}

async function callsView(leadId = '') {
  if(leadId){
    const data=await TitanAPI.leads.get(leadId),lead=data.lead,title=[lead.brand,lead.model,lead.year].filter(Boolean).join(' ');
    AppState.set('currentLead',lead);
    const body=`<div class="story-context card"><div><span class="badge">${h(lead.status||'new')}</span><b>${h(lead.seller_name||lead.lead_id)} · ${h(title||'автомобиль не указан')}</b><span class="muted">${h(lead.phone||'нет телефона')}</span></div><div class="actions"><a class="btn" href="#/leads/${h(lead.lead_id)}">Карточка лида</a>${lead.phone?`<a class="btn primary" href="tel:${h(lead.phone)}">Позвонить</a>`:''}</div></div><div class="tool-frame-wrap calls-frame-wrap"><iframe class="tool-frame calls-frame" title="Навигатор звонка" src="src/modules/calls/legacy/titan_auto_call_navigator_improved.html?embedded=1"></iframe></div>`;
    root.innerHTML=shell(page('Навигатор звонка',`${lead.lead_id} · сценарий, возражения, итоги и следующий контакт`,body,'<a class="btn" href="#/calls">← Очередь звонков</a>'));
    const frame=document.querySelector('.calls-frame');frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'TITAN_CALL_LOAD',lead},location.origin),{once:true});return;
  }
  const snapshot=await TitanAPI.workspace.snapshot(),leads=(snapshot.leads||[]).sort((a,b)=>Number(['won','lost','archived','closed'].includes(a.status))-Number(['won','lost','archived','closed'].includes(b.status))||String(a.next_contact_at||'9999').localeCompare(String(b.next_contact_at||'9999')));
  const body=leads.length?`<div class="table-wrap"><table><thead><tr><th>Следующий контакт</th><th>Клиент</th><th>Автомобиль</th><th>Телефон</th><th>Навигатор</th></tr></thead><tbody>${leads.map(lead=>`<tr data-call-lead="${h(lead.lead_id)}"><td>${fmtDate(lead.next_contact_at)}</td><td><b>${h(lead.seller_name||lead.lead_id)}</b><div class="muted">${h(lead.lead_id)}</div></td><td>${h([lead.brand,lead.model,lead.year].filter(Boolean).join(' ')||'—')}</td><td>${h(lead.phone||'—')}</td><td><button class="btn primary" data-call-lead="${h(lead.lead_id)}">Открыть сценарий</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="card empty">Создайте первый лид — он появится в очереди.</div>';
  root.innerHTML=shell(page('Навигатор звонка','Все лиды: сценарий разговора, переписка, контроль качества и договорённости',body,'<button class="btn primary" data-action="new-lead">+ Новый лид</button>'));
}

async function photosView(vehicleId = '') {
  if(vehicleId){
    const [data,files]=await Promise.all([TitanAPI.vehicles.get(vehicleId),TitanAPI.files.list(vehicleId)]),vehicle=data.vehicle,title=[vehicle.brand,vehicle.model,vehicle.year].filter(Boolean).join(' '),photos=(files||[]).filter(file=>file.type==='photos');
    AppState.set('currentVehicle',vehicle);
    const body=`<div class="story-context card"><div><span class="badge ${vehicle.status==='in_stock'?'success':''}">${h(vehicle.status||'new')}</span><b>${h(title)}</b><span class="muted">${h(vehicle.vehicle_id)} · фото на Drive: ${photos.length}</span></div><div class="actions"><a class="btn" href="#/vehicles/${h(vehicle.vehicle_id)}">Карточка авто</a><button class="btn primary" data-action="upload-file" data-default-type="photos">Загрузить фотографии</button>${photos.length?'<button class="btn" data-action="show-photo-files">Файлы на Drive</button>':''}</div></div><div class="photo-files" hidden>${fileList(photos)}</div><div class="tool-frame-wrap photos-frame-wrap"><iframe class="tool-frame photos-frame" title="Редактор фотографий" src="src/modules/photos/legacy/index.html?embedded=1"></iframe></div>`;
    root.innerHTML=shell(page('Редактор фотографий',`${vehicle.vehicle_id} · подготовка единого кадра для площадок`,body,'<a class="btn" href="#/photos">← Все автомобили</a>'));
    const frame=document.querySelector('.photos-frame');frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'TITAN_PHOTOS_LOAD',vehicle},location.origin),{once:true});return;
  }
  const snapshot=await TitanAPI.workspace.snapshot(),vehicles=(snapshot.vehicles||[]).sort((a,b)=>Number(['sold','archived'].includes(a.status))-Number(['sold','archived'].includes(b.status))||String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
  const body=vehicles.length?`<div class="table-wrap"><table><thead><tr><th>Автомобиль</th><th>Статус</th><th>Цена</th><th>Действия</th></tr></thead><tbody>${vehicles.map(v=>`<tr data-photo-vehicle="${h(v.vehicle_id)}"><td><b>${h([v.brand,v.model,v.year].filter(Boolean).join(' '))}</b><div class="muted">${h(v.vehicle_id)}${v.color?` · ${h(v.color)}`:''}</div></td><td><span class="badge ${v.status==='in_stock'?'success':''}">${h(v.status||'new')}</span></td><td>${fmtMoney(v.sale_price||v.market_price||v.seller_price)}</td><td><div class="actions"><button class="btn primary" data-photo-vehicle="${h(v.vehicle_id)}">Открыть редактор</button><button class="btn" data-upload-vehicle="${h(v.vehicle_id)}">Загрузить фото</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="card empty">Сначала создайте автомобиль — он появится в реестре фотографий.</div>';
  root.innerHTML=shell(page('Фото','Все автомобили и полный редактор публикационных кадров',body));
}

async function storiesView(vehicleId = '') {
  if (vehicleId) {
    const [data,settings,files] = await Promise.all([TitanAPI.vehicles.get(vehicleId),TitanAPI.settings.get(),TitanAPI.files.list(vehicleId)]);
    const vehicle=data.vehicle,company=settings.company||{},title=[vehicle.brand,vehicle.model,vehicle.year].filter(Boolean).join(' ');
    AppState.set('currentVehicle',vehicle);
    const stored=(files||[]).filter(file=>file.type==='stories');
    const body=`<div class="story-context card"><div><span class="badge ${vehicle.public_status==='published'?'success':''}">${vehicle.public_status==='published'?'Опубликован':'Не опубликован'}</span><b>${h(title)}</b><span class="muted">${h(vehicle.vehicle_id)} · сохранено файлов: ${stored.length}</span></div><div class="actions"><a class="btn" href="#/vehicles/${h(vehicle.vehicle_id)}">Карточка авто</a>${stored.length?`<button class="btn" data-action="show-story-files">Файлы на Drive</button>`:''}</div></div><div class="story-files" hidden>${fileList(stored)}</div><div class="tool-frame-wrap stories-frame-wrap"><iframe class="tool-frame stories-frame" title="Редактор сторис" src="src/modules/stories/legacy/index.html?embedded=1"></iframe></div>`;
    root.innerHTML=shell(page('Редактор сторис',`${vehicle.vehicle_id} · все функции исходного генератора`,body,'<a class="btn" href="#/stories">← Все автомобили</a>'));
    const frame=document.querySelector('.stories-frame');
    frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'TITAN_STORIES_LOAD',vehicle,company},location.origin),{once:true});
    return;
  }
  const snapshot = await TitanAPI.workspace.snapshot();
  const vehicles = (snapshot.vehicles || []).sort((a,b)=>Number(['sold','archived'].includes(a.status))-Number(['sold','archived'].includes(b.status))||String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
  const status={new:'Новый',in_work:'В работе',in_stock:'В наличии',reserved:'Резерв',sold:'Продан',archived:'Архив'};
  const body = vehicles.length ? `<div class="table-wrap story-registry"><table><thead><tr><th>Автомобиль</th><th>Статус</th><th>Публикация</th><th>Цена</th><th>Сторис</th></tr></thead><tbody>${vehicles.map(v=>`<tr data-story-vehicle="${h(v.vehicle_id)}"><td><b>${h([v.brand,v.model,v.year].filter(Boolean).join(' '))}</b><div class="muted">${h(v.vehicle_id)}${v.mileage?` · ${Number(v.mileage).toLocaleString('ru-RU')} км`:''}</div></td><td><span class="badge ${v.status==='in_stock'?'success':''}">${h(status[v.status]||v.status||'Новый')}</span></td><td>${v.public_status==='published'?'<span class="badge success">Опубликован</span>':'<span class="muted">Скрыт</span>'}</td><td><b>${fmtMoney(v.sale_price||v.market_price||v.seller_price)}</b></td><td><button class="btn primary" data-story-vehicle="${h(v.vehicle_id)}">Открыть редактор</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Сначала создайте автомобиль — он сразу появится в реестре сторис.</div>';
  root.innerHTML = shell(page('Сторис', 'Все автомобили: выберите строку и продолжите работу в полном редакторе', body));
}

async function paymentsView() {
  const [snapshot, settings] = await Promise.all([TitanAPI.workspace.snapshot(), TitanAPI.settings.get()]);
  const vehicles = snapshot.vehicles || [];
  const sales = snapshot.sales || [];
  const body = `<div class="story-context card"><div><span class="badge success">Общая база</span><b>${sales.length} ${sales.length === 1 ? 'сделка' : 'сделок'}</b><span class="muted">${vehicles.length} авто · выплаты, фактические расчёты и аналитика</span></div><div class="actions"><a class="btn" href="#/sales">Продажи</a><a class="btn" href="#/analytics">Аналитика</a></div></div><div class="tool-frame-wrap payments-frame-wrap"><iframe class="tool-frame payments-frame" title="Калькулятор выплат TITAN AUTO" src="src/modules/payments/legacy/index.html?embedded=1"></iframe></div>`;
  root.innerHTML = shell(page('Калькулятор оплаты', 'Полный расчёт маржи, вознаграждений, фактических выплат и прибыли директора', body));
  const frame = document.querySelector('.payments-frame');
  frame.addEventListener('load', () => frame.contentWindow.postMessage({
    type: 'TITAN_PAYMENTS_LOAD',
    sales,
    vehicles,
    company: settings.company || {},
  }, location.origin), { once: true });
}

async function settingsView() {
  const [settings,users] = await Promise.all([TitanAPI.settings.get(),canAdmin()?TitanAPI.users.list():Promise.resolve([])]);
  const company = settings.company || {};
  const managersText = (company.managers || []).map(item => `${item.name || ''} | ${item.phone || ''}`).join('\n');
  const accessCard=canAdmin()?`<section class="card access-card"><h2>Доступ сотрудников</h2><p class="muted">У каждого сотрудника отдельный PIN. PIN хранится только в виде хеша и не показывается после сохранения.</p><div class="access-users">${users.length?users.map(user=>`<div><span><b>${h(user.name)}</b><small>${h(user.user_id)}</small></span><span class="badge ${user.active?'success':''}">${h(roleLabel(user.role))}</span></div>`).join(''):'<div class="empty">Дополнительных пользователей пока нет</div>'}</div><form class="form-grid" data-form="staff-user"><div class="field"><label>Имя сотрудника *</label><input name="name" required></div><div class="field"><label>Роль *</label><select name="role"><option value="manager">Менеджер</option><option value="director">Руководитель</option><option value="admin">Администратор</option></select></div><div class="field"><label>Новый PIN *</label><input name="pin" type="password" inputmode="numeric" minlength="4" autocomplete="new-password" required></div><div class="wide actions"><button class="btn primary">Добавить сотрудника</button></div></form></section>`:'';
  const body = `<div class="grid ${canAdmin()?'two':''}"><section class="card accent"><h2>Реквизиты и сотрудники</h2><p class="muted">Хранятся в закрытой Google Таблице и загружаются только после входа. В публичном коде этих данных нет.</p><form class="form-grid" data-form="company-settings">
    <div class="field wide"><label>Юридическое наименование</label><input name="legal_name" value="${h(company.legal_name)}"></div>
    <div class="field"><label>ОГРН</label><input name="ogrn" value="${h(company.ogrn)}"></div><div class="field"><label>ИНН</label><input name="inn" value="${h(company.inn)}"></div>
    <div class="field"><label>КПП</label><input name="kpp" value="${h(company.kpp)}"></div><div class="field"><label>Руководитель</label><input name="director" value="${h(company.director)}"></div>
    <div class="field"><label>Телефон компании</label><input name="phone" type="tel" value="${h(company.phone)}"></div>
    <div class="field wide"><label>Юридический адрес</label><input name="address" value="${h(company.address)}"></div>
    <div class="field"><label>Банк</label><input name="bank_name" value="${h(company.bank_name)}"></div><div class="field"><label>БИК</label><input name="bik" value="${h(company.bik)}"></div>
    <div class="field"><label>Расчётный счёт</label><input name="bank_account" value="${h(company.bank_account)}"></div><div class="field"><label>Корреспондентский счёт</label><input name="correspondent_account" value="${h(company.correspondent_account)}"></div>
    <div class="field wide"><label>Сотрудники — по одному в строке: Имя | Телефон</label><textarea name="managers_text" rows="7">${h(managersText)}</textarea></div>
    <div class="wide actions"><button class="btn primary">Сохранить реквизиты</button></div>
  </form></section>${accessCard}</div><div class="grid two" style="margin-top:18px"><section class="card"><h2>Подключение API</h2><form class="form-grid" data-form="api"><div class="field wide"><label>Google Apps Script Web App URL</label><input name="api_url" type="url" value="${h(Config.apiUrl)}" placeholder="https://script.google.com/macros/s/.../exec"></div><div class="wide actions"><button class="btn primary">Сохранить</button></div></form></section><section class="card"><h2>Архитектура</h2><p class="muted">Таблица и Drive подключаются только на backend через Script Properties. Секретов в браузере нет.</p><p>Версия ${h(Config.version)}</p></section></div>`;
  root.innerHTML = shell(page('Настройки', 'Защищённые данные компании и конфигурация', body));
}

function placeholderView(name) {
  root.innerHTML = shell(page(name, 'Модуль подготовлен к подключению через адаптер', `<section class="card empty"><h2>${h(name)}</h2><p>Рабочий legacy-инструмент пока не переносился. Он будет подключён к текущему автомобилю через TitanAPI без переписывания основной логики.</p><a href="#/vehicles" class="btn">Выбрать автомобиль</a></section>`));
}

function newEntryModal(kind = 'lead') {
  showModal('Новая запись', `<div class="actions"><button class="btn ${kind==='lead'?'primary':''}" data-action="new-lead">Лид</button><button class="btn ${kind==='vehicle'?'primary':''}" data-action="new-vehicle">Автомобиль</button></div><p class="muted">Лид можно создать по трём полям, остальное добавить позже.</p>`);
}

const selected = (value, expected) => String(value ?? '') === String(expected) ? ' selected' : '';
const dateValue = value => h(String(value || '').slice(0, 10));
const dateTimeValue = value => h(String(value || '').slice(0, 16));

function vehicleForm(vehicle = {}) {
  closeModal(); showModal(vehicle.vehicle_id ? `Изменить ${vehicle.vehicle_id}` : 'Новый автомобиль', `<form class="form-grid" data-form="vehicle" data-id="${h(vehicle.vehicle_id||'')}">
    <fieldset class="form-section wide"><legend>Карточка автомобиля</legend>
      <div class="field"><label>Марка *</label><input name="brand" value="${h(vehicle.brand)}" required></div><div class="field"><label>Модель *</label><input name="model" value="${h(vehicle.model)}" required></div>
      <div class="field"><label>Поколение</label><input name="generation" value="${h(vehicle.generation)}"></div><div class="field"><label>Год</label><input name="year" type="number" min="1900" max="2100" value="${h(vehicle.year)}"></div>
      <div class="field"><label>Статус</label><select name="status"><option value="new"${selected(vehicle.status||'new','new')}>Новый</option><option value="in_work"${selected(vehicle.status,'in_work')}>В работе</option><option value="in_stock"${selected(vehicle.status,'in_stock')}>В наличии</option><option value="reserved"${selected(vehicle.status,'reserved')}>Резерв</option><option value="sold"${selected(vehicle.status,'sold')}>Продан</option><option value="archived"${selected(vehicle.status,'archived')}>Архив</option></select></div>
      <div class="field"><label>Публикация</label><select name="public_status"><option value="private"${selected(vehicle.public_status||'private','private')}>Скрыт</option><option value="published"${selected(vehicle.public_status,'published')}>Опубликован</option></select></div>
    </fieldset>
    <fieldset class="form-section wide"><legend>Технические характеристики</legend>
      <div class="field"><label>VIN</label><input name="vin" value="${h(vehicle.vin)}"></div><div class="field"><label>Пробег, км</label><input name="mileage" type="number" min="0" value="${h(vehicle.mileage)}"></div>
      <div class="field"><label>Объём двигателя, л</label><input name="engine_volume" type="number" min="0" step="0.1" value="${h(vehicle.engine_volume)}"></div><div class="field"><label>Мощность, л.с.</label><input name="engine_power" type="number" min="0" value="${h(vehicle.engine_power)}"></div>
      <div class="field"><label>Топливо</label><input name="fuel_type" value="${h(vehicle.fuel_type)}"></div><div class="field"><label>Коробка</label><input name="transmission" value="${h(vehicle.transmission)}"></div>
      <div class="field"><label>Привод</label><input name="drive_type" value="${h(vehicle.drive_type)}"></div><div class="field"><label>Кузов</label><input name="body_type" value="${h(vehicle.body_type)}"></div>
      <div class="field"><label>Цвет</label><input name="color" value="${h(vehicle.color)}"></div><div class="field"><label>Количество владельцев</label><input name="owners_count" type="number" min="0" value="${h(vehicle.owners_count)}"></div>
      <div class="field"><label>Госномер</label><input name="registration_plate" value="${h(vehicle.registration_plate)}"></div><div class="field"><label>Место нахождения</label><input name="location" value="${h(vehicle.location)}"></div>
    </fieldset>
    <fieldset class="form-section wide"><legend>Документы и номера агрегатов</legend>
      <div class="field"><label>Категория ТС</label><input name="category" value="${h(vehicle.category)}"></div><div class="field"><label>Тип ТС</label><input name="vehicle_type" value="${h(vehicle.vehicle_type)}"></div>
      <div class="field"><label>Номер двигателя</label><input name="engine_number" value="${h(vehicle.engine_number)}"></div><div class="field"><label>Шасси / рама</label><input name="chassis_number" value="${h(vehicle.chassis_number)}"></div>
      <div class="field"><label>Номер кузова</label><input name="body_number" value="${h(vehicle.body_number)}"></div><div class="field"><label>ПТС / ЭПТС</label><input name="pts_number" value="${h(vehicle.pts_number)}"></div>
      <div class="field"><label>ПТС выдан</label><input name="pts_issued" type="date" value="${dateValue(vehicle.pts_issued)}"></div><div class="field"><label>СТС</label><input name="sts_number" value="${h(vehicle.sts_number)}"></div>
      <div class="field"><label>СТС выдан</label><input name="sts_issued" type="date" value="${dateValue(vehicle.sts_issued)}"></div><div class="field wide"><label>Особые отметки</label><textarea name="special_notes">${h(vehicle.special_notes)}</textarea></div>
    </fieldset>
    <fieldset class="form-section wide"><legend>Источник и ответственные</legend>
      <div class="field"><label>Имя продавца</label><input name="seller_name" value="${h(vehicle.seller_name)}"></div><div class="field"><label>Телефон продавца</label><input name="seller_phone" type="tel" value="${h(vehicle.seller_phone)}"></div>
      <div class="field"><label>ID владельца / контрагента</label><input name="owner_id" value="${h(vehicle.owner_id)}"></div><div class="field"><label>Источник</label><input name="source" value="${h(vehicle.source)}"></div>
      <div class="field wide"><label>Ссылка на источник</label><input name="source_url" type="url" value="${h(vehicle.source_url)}"></div>
      <div class="field"><label>Тип поступления</label><select name="acquisition_type"><option value=""${selected(vehicle.acquisition_type,'')}>Не указан</option><option value="commission"${selected(vehicle.acquisition_type,'commission')}>Комиссия</option><option value="purchase"${selected(vehicle.acquisition_type,'purchase')}>Выкуп</option><option value="trade_in"${selected(vehicle.acquisition_type,'trade_in')}>Trade-in</option><option value="virtual"${selected(vehicle.acquisition_type,'virtual')}>Виртуальный склад</option><option value="other"${selected(vehicle.acquisition_type,'other')}>Другое</option></select></div>
      <div class="field"><label>Менеджер</label><input name="manager" value="${h(vehicle.manager)}"></div><div class="field"><label>Ответственный менеджер</label><input name="responsible_manager" value="${h(vehicle.responsible_manager)}"></div>
    </fieldset>
    <fieldset class="form-section wide"><legend>Цены и экономика</legend>
      <div class="field"><label>Цена продавца</label><input name="seller_price" type="number" min="0" value="${h(vehicle.seller_price)}"></div><div class="field"><label>Рыночная цена</label><input name="market_price" type="number" min="0" value="${h(vehicle.market_price)}"></div>
      <div class="field"><label>Цена выкупа</label><input name="buyout_price" type="number" min="0" value="${h(vehicle.buyout_price)}"></div><div class="field"><label>Цена закупки</label><input name="purchase_price" type="number" min="0" value="${h(vehicle.purchase_price)}"></div>
      <div class="field"><label>Цена продажи</label><input name="sale_price" type="number" min="0" value="${h(vehicle.sale_price)}"></div><div class="field"><label>Плановые вложения</label><input name="estimated_investments" type="number" min="0" value="${h(vehicle.estimated_investments)}"></div>
      <div class="field"><label>Комиссия салона</label><input name="commission" type="number" min="0" value="${h(vehicle.commission)}"></div>
    </fieldset>
    <fieldset class="form-section wide"><legend>Описание</legend>
      <div class="field wide"><label>Публичное описание</label><textarea name="description">${h(vehicle.description)}</textarea></div><div class="field wide"><label>Внутренние заметки</label><textarea name="notes">${h(vehicle.notes)}</textarea></div>
    </fieldset>
    <div class="wide actions sticky-actions"><button class="btn primary">Сохранить</button><button type="button" class="btn" data-action="close-modal">Отмена</button></div></form>`);
}

function leadForm(lead = {}) {
  closeModal(); showModal(lead.lead_id ? `Изменить ${lead.lead_id}` : 'Новый лид', `<form class="form-grid" data-form="lead" data-id="${h(lead.lead_id || '')}">
    <fieldset class="form-section wide"><legend>Клиент и автомобиль</legend>
      <div class="field"><label>Имя продавца</label><input name="seller_name" value="${h(lead.seller_name)}"></div><div class="field"><label>Телефон *</label><input name="phone" type="tel" value="${h(lead.phone)}" required></div>
      <div class="field"><label>Марка *</label><input name="brand" value="${h(lead.brand)}" required></div><div class="field"><label>Модель *</label><input name="model" value="${h(lead.model)}" required></div>
      <div class="field"><label>Год</label><input name="year" type="number" min="1900" max="2100" value="${h(lead.year)}"></div><div class="field"><label>Цена продавца</label><input name="seller_price" type="number" min="0" value="${h(lead.seller_price)}"></div>
      <div class="field"><label>Связанный автомобиль</label><input name="vehicle_id" value="${h(lead.vehicle_id)}" placeholder="TA-000001"></div><div class="field"><label>Статус</label><select name="status"><option value="new"${selected(lead.status||'new','new')}>Новый</option><option value="in_work"${selected(lead.status,'in_work')}>В работе</option><option value="qualified"${selected(lead.status,'qualified')}>Квалифицирован</option><option value="won"${selected(lead.status,'won')}>Успешно</option><option value="lost"${selected(lead.status,'lost')}>Отказ</option><option value="closed"${selected(lead.status,'closed')}>Закрыт</option><option value="archived"${selected(lead.status,'archived')}>Архив</option></select></div>
    </fieldset>
    <fieldset class="form-section wide"><legend>Источник объявления</legend>
      <div class="field"><label>Источник</label><input name="source" value="${h(lead.source)}"></div><div class="field"><label>Канал лида</label><input name="lead_channel" value="${h(lead.lead_channel)}"></div>
      <div class="field wide"><label>Ссылка на объявление</label><input name="source_url" type="url" value="${h(lead.source_url)}"></div>
      <div class="field"><label>Дата публикации</label><input name="listing_date" type="date" value="${dateValue(lead.listing_date)}"></div><div class="field"><label>Возраст объявления, дней</label><input name="listing_age" type="number" min="0" value="${h(lead.listing_age)}"></div>
      <div class="field"><label>Позиция относительно рынка</label><input name="market_position" value="${h(lead.market_position)}"></div><div class="field"><label>Ограничения объявления</label><input name="listing_restriction" value="${h(lead.listing_restriction)}"></div>
    </fieldset>
    <fieldset class="form-section wide"><legend>Подготовка и история контакта</legend>
      <div class="field"><label>Последовательность звонка</label><input name="call_sequence" value="${h(lead.call_sequence)}"></div><div class="field"><label>Предыдущий контакт</label><input name="previous_contact" value="${h(lead.previous_contact)}"></div>
      <div class="field"><label>Предыдущий результат</label><input name="previous_outcome" value="${h(lead.previous_outcome)}"></div><div class="field"><label>Предыдущая договорённость</label><input name="previous_agreement" value="${h(lead.previous_agreement)}"></div>
      <div class="field"><label>Предыдущее возражение</label><input name="previous_objection" value="${h(lead.previous_objection)}"></div><div class="field"><label>Акцент перед звонком</label><input name="pre_call_accent" value="${h(lead.pre_call_accent)}"></div>
      <div class="field wide"><label>Предыдущие заметки</label><textarea name="previous_notes">${h(lead.previous_notes)}</textarea></div>
    </fieldset>
    <fieldset class="form-section wide"><legend>Квалификация и договорённости</legend>
      <div class="field"><label>Потребность</label><input name="need" value="${h(lead.need)}"></div><div class="field"><label>Возражение</label><input name="objection" value="${h(lead.objection)}"></div>
      <div class="field"><label>Готовность</label><input name="readiness" value="${h(lead.readiness)}"></div><div class="field"><label>Менеджер</label><input name="manager" value="${h(lead.manager)}"></div>
      <div class="field"><label>Встреча</label><input name="meet_at" type="datetime-local" value="${dateTimeValue(lead.meet_at)}"></div><div class="field"><label>Место встречи</label><input name="meeting_place" value="${h(lead.meeting_place)}"></div>
      <div class="field"><label>Следующий контакт</label><input name="next_contact_at" type="datetime-local" value="${dateTimeValue(lead.next_contact_at)}"></div><div class="field"><label>Тип следующего контакта</label><input name="next_contact_type" value="${h(lead.next_contact_type)}"></div>
      <div class="field wide"><label>Текст после звонка</label><textarea name="post_call_text">${h(lead.post_call_text)}</textarea></div><div class="field wide"><label>Заметки</label><textarea name="notes">${h(lead.notes)}</textarea></div>
    </fieldset>
    <div class="wide actions sticky-actions"><button class="btn primary">${lead.lead_id ? 'Сохранить' : 'Создать лид'}</button><button type="button" class="btn" data-action="close-modal">Отмена</button></div></form>`);
}

function contactForm() { showModal('Новый контакт', `<form class="form-grid" data-form="contact"><div class="field"><label>Тип</label><select name="type"><option>Звонок</option><option>Сообщение</option><option>Встреча</option><option>Осмотр</option></select></div><div class="field"><label>Результат *</label><input name="result" required></div><div class="field wide"><label>Комментарий</label><textarea name="comment"></textarea></div><div class="field"><label>Следующее действие</label><input name="next_action"></div><div class="field"><label>Когда</label><input name="next_action_at" type="datetime-local"></div><div class="wide actions"><button class="btn primary">Сохранить контакт</button></div></form>`); }
function valuationForm() { showModal('Новая оценка', `<form class="form-grid" data-form="valuation"><div class="field"><label>Рыночная цена</label><input name="market_price" type="number"></div><div class="field"><label>Рекомендуемая цена</label><input name="recommended_price" type="number"></div><div class="field"><label>Цена выкупа</label><input name="buyout_price" type="number"></div><div class="field"><label>Вложения</label><input name="estimated_investments" type="number"></div><div class="field wide"><label>Комментарий</label><textarea name="comment"></textarea></div><div class="wide actions"><button class="btn primary">Сохранить оценку</button></div></form>`); }
function taskForm(context = {}) { showModal('Новая задача', `<form class="form-grid" data-form="task"><div class="field wide"><label>Задача *</label><input name="title" required autofocus></div><div class="field"><label>Срок</label><input name="due_at" type="datetime-local"></div><div class="field"><label>Исполнитель</label><input name="assignee" value="${h(currentUser().name)}"></div><div class="field"><label>Приоритет</label><select name="priority"><option value="normal">Обычный</option><option value="high">Высокий</option><option value="urgent">Срочный</option><option value="low">Низкий</option></select></div><div class="field"><label>Автомобиль</label><input name="vehicle_id" value="${h(context.vehicle_id)}" placeholder="TA-000001"></div><div class="field"><label>Лид</label><input name="lead_id" value="${h(context.lead_id)}" placeholder="LEAD-000001"></div><div class="field wide"><label>Комментарий</label><textarea name="comment"></textarea></div><div class="wide actions"><button class="btn primary">Создать задачу</button><button type="button" class="btn" data-action="close-modal">Отмена</button></div></form>`); }
function uploadForm(defaultType = 'documents') {
  showModal('Загрузить файлы', `<form class="form-grid" data-form="file"><div class="field"><label>Папка автомобиля на Google Drive</label><select name="type"><option value="photos"${selected(defaultType,'photos')}>Фото</option><option value="documents"${selected(defaultType,'documents')}>Документы</option><option value="price-tags"${selected(defaultType,'price-tags')}>Ценники</option><option value="stories"${selected(defaultType,'stories')}>Сторис</option><option value="reports"${selected(defaultType,'reports')}>Отчёты</option></select></div><div class="field"><label>Отдельные файлы</label><input name="file" type="file" multiple></div><div class="field wide"><label>Или целая папка с компьютера</label><input name="folder" type="file" webkitdirectory multiple></div><div class="field wide"><label>Общее описание</label><input name="description" placeholder="Например: фото с объявления или документы осмотра"></div><div class="wide notice">Файлы будут скопированы в папку выбранного автомобиля. Первая загруженная фотография станет обложкой; у опубликованного автомобиля фотографии получат доступ по ссылке.</div><div class="wide upload-progress" data-upload-progress hidden><b>Подготовка загрузки…</b><progress max="1" value="0"></progress></div><div class="wide actions"><button class="btn primary">Загрузить на Google Drive</button><button type="button" class="btn" data-action="close-modal">Отмена</button></div></form>`);
}

function saleForm(vehicle = {}, vehicles = []) {
  closeModal();
  const options = (vehicles.length ? vehicles : [vehicle]).filter(Boolean).map(v => `<option value="${h(v.vehicle_id)}">${h(`${v.vehicle_id} · ${[v.brand,v.model,v.year].filter(Boolean).join(' ')}`)}</option>`).join('');
  showModal('Оформить продажу', `<form class="form-grid" data-form="sale">
    <div class="field wide"><label>Автомобиль *</label><select name="vehicle_id" required>${options}</select></div>
    <div class="field"><label>Дата продажи *</label><input name="sale_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></div><div class="field"><label>Тип сделки</label><select name="deal_type"><option value="commission">Комиссионный автомобиль</option><option value="company_purchase">Автомобиль компании</option></select></div>
    <div class="field"><label>Цена продажи *</label><input name="sale_price" type="number" min="0" value="${h(vehicle.sale_price)}" required></div><div class="field"><label>Комиссия салона</label><input name="commission" type="number" min="0" value="${h(vehicle.commission)}"></div>
    <div class="field"><label>Цена закупки</label><input name="purchase_price" type="number" min="0" value="${h(vehicle.purchase_price || vehicle.buyout_price)}"></div><div class="field"><label>Фактические расходы</label><input name="expenses" type="number" min="0" value="0"></div>
    <div class="field"><label>Поставил на комиссию *</label><input name="accepted_by" value="${h(vehicle.responsible_manager || vehicle.manager || 'Максим Сафрутин')}" required></div><div class="field"><label>Продал *</label><input name="sold_by" value="" required></div>
    <div class="field"><label>Доля постановщика, % комиссии</label><input name="acquisition_reward_percent" type="number" min="0" max="100" step="0.1" value="15"></div><div class="field"><label>Доля продавца, % комиссии</label><input name="sales_reward_percent" type="number" min="0" max="100" step="0.1" value="15"></div>
    <div class="field"><label>Комиссия по кредиту</label><input name="credit_commission" type="number" min="0" value="0"></div><div class="field"><label>Налог</label><input name="tax" type="number" min="0" value="0"></div>
    <div class="field wide"><label>Комментарий</label><textarea name="comment"></textarea></div>
    <div class="wide notice">Правило комиссионной реализации: 30% комиссии сотрудникам. Если роли разделены — по 15%; если один сотрудник выполнил обе роли — он получает все 30%.</div>
    <div class="wide actions"><button class="btn primary">Завершить сделку</button><button type="button" class="btn" data-action="close-modal">Отмена</button></div>
  </form>`);
  const form = document.querySelector('[data-form="sale"]');
  if (vehicle.vehicle_id) form.vehicle_id.value = vehicle.vehicle_id;
  form.addEventListener('change', event => {
    if (event.target.name !== 'vehicle_id') return;
    const selected = vehicles.find(v => v.vehicle_id === event.target.value); if (!selected) return;
    form.sale_price.value = selected.sale_price || '';
    form.commission.value = selected.commission || '';
    form.purchase_price.value = selected.purchase_price || selected.buyout_price || '';
    form.expenses.value = 0;
    form.accepted_by.value = selected.responsible_manager || selected.manager || 'Максим Сафрутин';
  });
}

async function render() {
  const r = route();
  if (r.name === 'catalog') return r.id ? catalogVehicleView(r.id) : catalogView();
  if (!AppState.get('session')) return loginView();
  if (['sales','analytics','payments','settings'].includes(r.name) && !canFinancial()) return root.innerHTML=shell(page('Раздел недоступен','Для этой страницы нужна роль руководителя или администратора','<div class="card empty"><p>Ваша роль: менеджер. Операционные разделы — автомобили, лиды и рабочие инструменты — доступны в меню.</p><a class="btn primary" href="#/dashboard">На главную</a></div>'));
  const loadingTitles = {dashboard:'Главная',vehicles:'Автомобили',leads:'Лиды',tasks:'Задачи',sales:'Продажи',analytics:'Аналитика',valuation:'Оценка',calls:'Навигатор звонка','price-tags':'Ценники',stories:'Сторис',photos:'Фото',documents:'Документы',payments:'Калькулятор оплаты',settings:'Настройки'};
  root.innerHTML = shell(page(loadingTitles[r.name] || 'TITAN AUTO', 'Загружаем актуальные данные', '<div class="loading-card"><i></i><b>Подождите немного…</b></div>'));
  try {
    if (r.name === 'dashboard') return dashboardView();
    if (r.name === 'vehicles' && r.id) return vehicleView(r.id);
    if (r.name === 'vehicles') return vehiclesView(r.query);
    if (r.name === 'leads' && r.id) return leadView(r.id);
    if (r.name === 'leads') return leadsView(r.query);
    if (r.name === 'tasks') return tasksView();
    if (r.name === 'sales') return salesView();
    if (r.name === 'analytics') return analyticsView();
    if (r.name === 'valuation') return valuationsView(r.id);
    if (r.name === 'calls') return callsView(r.id);
    if (r.name === 'price-tags') return priceTagsView();
    if (r.name === 'stories') return storiesView(r.id);
    if (r.name === 'photos') return photosView(r.id);
    if (r.name === 'payments') return paymentsView();
    if (r.name === 'settings') return settingsView();
    if (r.name === 'documents') return documentsView();
    const names = {valuation:'Оценка',calls:'Навигатор звонка','price-tags':'Ценники',stories:'Сторис',photos:'Фото',documents:'Документы',payments:'Калькулятор оплаты'};
    return placeholderView(names[r.name] || 'Раздел');
  } catch (e) {
    root.innerHTML = shell(page('Не удалось загрузить раздел', errorMessage(e), '<div class="card empty"><button class="btn" data-action="retry">Повторить</button></div>'));
  }
}

document.addEventListener('click', async (event) => {
  const completedTaskId=event.target.closest('[data-task-done]')?.dataset.taskDone;
  if(completedTaskId){try{await TitanAPI.tasks.update(completedTaskId,{status:'done'});toast('Задача выполнена');return render();}catch(error){return toast(errorMessage(error),'error');}}
  const uploadVehicleId=event.target.closest('[data-upload-vehicle]')?.dataset.uploadVehicle;
  if(uploadVehicleId){try{const data=await TitanAPI.vehicles.get(uploadVehicleId);AppState.set('currentVehicle',data.vehicle);return uploadForm('photos');}catch(error){return toast(errorMessage(error),'error');}}
  const callLeadId=event.target.closest('[data-call-lead]')?.dataset.callLead;
  if(callLeadId){navigate(`calls/${callLeadId}`);return render();}
  const valuationVehicleId=event.target.closest('[data-valuation-vehicle]')?.dataset.valuationVehicle;
  if(valuationVehicleId){navigate(`valuation/${valuationVehicleId}`);return render();}
  const photoVehicleId=event.target.closest('[data-photo-vehicle]')?.dataset.photoVehicle;
  if(photoVehicleId){navigate(`photos/${photoVehicleId}`);return render();}
  const storyVehicleId=event.target.closest('[data-story-vehicle]')?.dataset.storyVehicle;
  if(storyVehicleId){navigate(`stories/${storyVehicleId}`);return render();}
  const priceTagVehicleId=event.target.closest('[data-price-tag-vehicle]')?.dataset.priceTagVehicle;
  if(priceTagVehicleId){
    try { const data=await TitanAPI.vehicles.get(priceTagVehicleId); AppState.set('currentVehicle',data.vehicle); return render(); }
    catch(e) { return toast(errorMessage(e),'error'); }
  }
  const row = event.target.closest('[data-href]'); if (row) return navigate(row.dataset.href);
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'close-modal') return closeModal();
  if (action === 'new-entry') return newEntryModal();
  if (action === 'new-vehicle') return vehicleForm();
  if (action === 'new-lead') return leadForm();
  if (action === 'edit-lead') return leadForm(AppState.get('currentLead') || {});
  if (action === 'edit-vehicle') return vehicleForm(AppState.get('currentVehicle') || {});
  if (action === 'toggle-publish') {
    const vehicle=AppState.get('currentVehicle');if(!vehicle)return;
    try { const published=vehicle.public_status==='published';await TitanAPI.vehicles.update(vehicle.vehicle_id,{public_status:published?'private':'published'});toast(published?'Автомобиль снят с публичного склада':'Автомобиль опубликован на складе');return render(); }
    catch(error) { return toast(errorMessage(error),'error'); }
  }
  if (action === 'new-contact') return contactForm();
  if (action === 'new-task') {
    const currentRoute=route(),vehicle=currentRoute.name==='vehicles'?AppState.get('currentVehicle'):null,lead=currentRoute.name==='leads'?AppState.get('currentLead'):null;
    return taskForm({vehicle_id:vehicle?.vehicle_id||'',lead_id:lead?.lead_id||''});
  }
  if (action === 'new-valuation') return valuationForm();
  if (action === 'open-valuation') { const vehicle=AppState.get('currentVehicle'); if(vehicle) navigate(`valuation/${vehicle.vehicle_id}`); return render(); }
  if (action === 'open-calls') { const lead=AppState.get('currentLead'); if(lead) navigate(`calls/${lead.lead_id}`); return render(); }
  if (action === 'upload-for') {
    try { const data=await TitanAPI.vehicles.get(event.target.closest('[data-vehicle-id]').dataset.vehicleId); AppState.set('currentVehicle',data.vehicle); uploadForm(); const type=event.target.closest('[data-file-type]')?.dataset.fileType; if(type) document.querySelector('[data-form="file"] select[name="type"]').value=type; return; }
    catch(e) { return toast(errorMessage(e),'error'); }
  }
  if (action === 'copy-story') {
    const text=event.target.closest('.card')?.querySelector('textarea')?.value||'';
    try { await navigator.clipboard.writeText(text); return toast('Текст скопирован'); } catch { return toast('Не удалось скопировать текст','error'); }
  }
  if (action === 'show-story-files') { const panel=document.querySelector('.story-files'); if(panel) panel.hidden=!panel.hidden; return; }
  if (action === 'show-photo-files') { const panel=document.querySelector('.photo-files'); if(panel) panel.hidden=!panel.hidden; return; }
  if (action === 'upload-file') return uploadForm(event.target.closest('[data-action]')?.dataset.defaultType || 'documents');
  if (action === 'new-sale') {
    try { const vehicles = (await TitanAPI.vehicles.list({ include_archived: true })).filter(v => !['sold','archived'].includes(v.status)); return saleForm(vehicles[0] || {}, vehicles); }
    catch(e) { return toast(errorMessage(e),'error'); }
  }
  if (action === 'open-price-tag') { navigate('price-tags'); return render(); }
  if (action === 'open-stories') { const vehicle=AppState.get('currentVehicle'); if(vehicle) navigate(`stories/${vehicle.vehicle_id}`); return render(); }
  if (action === 'open-photos') { const vehicle=AppState.get('currentVehicle'); if(vehicle) navigate(`photos/${vehicle.vehicle_id}`); return render(); }
  if (action === 'change-price-tag-vehicle') { AppState.set('currentVehicle', null); return render(); }
  if (action === 'retry') return render();
  if (action === 'logout') { await Auth.logout(); navigate('dashboard'); return render(); }
  if (action === 'convert-lead') {
    const lead = AppState.get('currentLead');
    if (!lead || lead.vehicle_id) return;
    try {
      const vehicle = await TitanAPI.vehicles.create({ brand: lead.brand, model: lead.model, year: lead.year, seller_name: lead.seller_name, seller_phone: lead.phone, source: lead.source, source_url: lead.source_url, seller_price: lead.seller_price, manager: lead.manager, notes: lead.notes, status: 'new' });
      await TitanAPI.leads.update(lead.lead_id, { vehicle_id: vehicle.vehicle_id, status: 'qualified' });
      toast(`Создан автомобиль ${vehicle.vehicle_id}`);
      navigate(`vehicles/${vehicle.vehicle_id}`);
      return render();
    } catch(e) { toast(errorMessage(e), 'error'); }
  }
  if (action === 'mark-sold') {
    const v = AppState.get('currentVehicle');
    if (!v) return;
    return saleForm(v, [v]);
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form'); if (!form) return;
  event.preventDefault(); const type = form.dataset.form; const button = form.querySelector('[type="submit"],button:not([type])'); if (button) button.disabled = true;
  try {
    if (type === 'api') return saveApiUrl(formObject(form).api_url);
    if (type === 'login') { await Auth.login(formObject(form).pin); navigate('dashboard'); return render(); }
    if (type === 'search') { const q=formObject(form).q; return navigate(`vehicles?q=${encodeURIComponent(q)}`); }
    if (type === 'payment-calculator') {
      const value=formObject(form), price=num(value.price), down=Math.min(price,num(value.down_payment)), months=Math.max(1,num(value.months)), principal=Math.max(0,price-down), monthlyRate=num(value.annual_rate)/1200;
      const payment=monthlyRate ? principal*monthlyRate*Math.pow(1+monthlyRate,months)/(Math.pow(1+monthlyRate,months)-1) : principal/months;
      const total=payment*months+down, overpayment=total-price;
      document.querySelector('[data-payment-result]').innerHTML=`<h2>Результат</h2><div class="metric-list"><div><span>Сумма кредита</span><b>${fmtMoney(principal)}</b></div><div><span>Платёж в месяц</span><b>${fmtMoney(payment)}</b></div><div><span>Общая выплата</span><b>${fmtMoney(total)}</b></div><div><span>Переплата</span><b>${fmtMoney(overpayment)}</b></div></div><p class="muted">Предварительный расчёт, не является офертой банка.</p>`;
      return;
    }
    if (type === 'staff-user') {
      await TitanAPI.users.upsert(formObject(form));
      toast('Доступ сотрудника сохранён');
      return render();
    }
    if (type === 'task') { await TitanAPI.tasks.create(formObject(form)); closeModal(); toast('Задача создана'); return render(); }
    if (type === 'company-settings') {
      const payload=formObject(form);
      const managers=payload.managers_text.split(/\r?\n/).map(line=>{const parts=line.split('|');return {name:(parts.shift()||'').trim(),phone:parts.join('|').trim()};}).filter(item=>item.name||item.phone);
      delete payload.managers_text;
      await TitanAPI.settings.update({...payload,managers});
      toast('Реквизиты сохранены');
      return render();
    }
    if (type === 'vehicle') { const payload=formObject(form); const id=form.dataset.id; const result=id ? await TitanAPI.vehicles.update(id,payload) : await TitanAPI.vehicles.create(payload); closeModal(); toast('Автомобиль сохранён'); navigate(`vehicles/${id || result.vehicle_id}`); return render(); }
    if (type === 'lead') { const payload=formObject(form); const id=form.dataset.id; const result=id ? await TitanAPI.leads.update(id,payload) : await TitanAPI.leads.create(payload); closeModal(); toast(id ? 'Лид сохранён' : 'Лид создан'); navigate(`leads/${id || result.lead_id}`); return render(); }
    const vehicle=AppState.get('currentVehicle');
    const lead=AppState.get('currentLead');
    if (type === 'contact') { await TitanAPI.contacts.create({vehicle_id:vehicle?.vehicle_id || '',lead_id:vehicle ? '' : lead?.lead_id || '',...formObject(form)}); closeModal(); toast('Контакт сохранён'); return render(); }
    if (type === 'valuation') { await TitanAPI.valuations.create({vehicle_id:vehicle.vehicle_id,...formObject(form)}); closeModal(); toast('Оценка сохранена'); return render(); }
    if (type === 'sale') {
      const payload=formObject(form), commission=num(payload.commission), salePrice=num(payload.sale_price), purchasePrice=num(payload.purchase_price), expenses=num(payload.expenses), tax=num(payload.tax), creditCommission=num(payload.credit_commission);
      const salesPercent=num(payload.sales_reward_percent), acquisitionPercent=num(payload.acquisition_reward_percent);
      if (salesPercent+acquisitionPercent>100) throw new Error('Сумма долей сотрудников не может превышать 100% комиссии.');
      const salesReward=Math.round(commission*salesPercent)/100, acquisitionReward=Math.round(commission*acquisitionPercent)/100;
      const ownerAmount=payload.deal_type==='commission' ? salePrice-commission : 0;
      const profit=payload.deal_type==='commission' ? commission+creditCommission-expenses-tax-salesReward-acquisitionReward : salePrice-purchasePrice+creditCommission-expenses-tax-salesReward-acquisitionReward;
      const participants=`${payload.sold_by||'Продавец'} — ${salesPercent}% комиссии (${fmtMoney(salesReward)}); ${payload.accepted_by||'Постановщик'} — ${acquisitionPercent}% комиссии (${fmtMoney(acquisitionReward)}); компания — ${100-salesPercent-acquisitionPercent}%`;
      await TitanAPI.vehicles.markSold(payload.vehicle_id,{...payload,sale_price:salePrice,purchase_price:purchasePrice,owner_amount:ownerAmount,commission,expenses,tax,credit_commission:creditCommission,profit,margin:payload.deal_type==='commission'?commission:salePrice-purchasePrice,participation:participants,actual_buyer_payment:salePrice,actual_manager_payment:salesReward,actual_director_payment:acquisitionReward,responsible_manager:payload.accepted_by,manager:payload.accepted_by,comment:[payload.comment,`Распределение: ${participants}. Чистый доход компании: ${fmtMoney(profit)}.`].filter(Boolean).join('\n')});
      closeModal();toast('Продажа оформлена и автомобиль закрыт');navigate('sales');return render();
    }
    if (type === 'file') {
      const candidates=[...form.elements.file.files,...form.elements.folder.files],seen=new Set(),files=candidates.filter(file=>{const key=`${file.webkitRelativePath||file.name}:${file.size}`;if(seen.has(key))return false;seen.add(key);return true});
      if(!vehicle?.vehicle_id)throw new Error('Сначала выберите автомобиль.');
      if(!files.length)throw new Error('Выберите хотя бы один файл.');
      if(files.length>50)throw new Error('За один раз можно загрузить не более 50 файлов.');
      if(form.elements.type.value==='photos'){
        const nonImage=files.find(file=>!String(file.type).startsWith('image/')&&!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name));
        if(nonImage)throw new Error(`Файл ${nonImage.name} не является фотографией. Документы загрузите в раздел «Документы».`);
      }
      const oversized=files.find(file=>file.size>8*1024*1024);if(oversized)throw new Error(`Файл ${oversized.name} больше 8 МБ.`);
      const progress=form.querySelector('[data-upload-progress]'),bar=progress.querySelector('progress'),label=progress.querySelector('b');progress.hidden=false;bar.max=files.length;
      for(let index=0;index<files.length;index+=1){
        const file=files[index],sourceName=file.webkitRelativePath||file.name,uploadedName=file.webkitRelativePath?file.webkitRelativePath.replace(/[\\/]+/g,' — '):file.name;label.textContent=`${index+1} из ${files.length}: ${sourceName}`;bar.value=index;
        const data_url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error(`Не удалось прочитать ${file.name}`));reader.readAsDataURL(file)});
        await TitanAPI.files.upload({vehicle_id:vehicle.vehicle_id,type:form.elements.type.value,description:[form.elements.description.value,file.webkitRelativePath?`Источник: ${file.webkitRelativePath}`:''].filter(Boolean).join(' · '),filename:uploadedName,mime_type:file.type||'application/octet-stream',data_url});bar.value=index+1;
      }
      closeModal();toast(`Загружено файлов: ${files.length}`);return render();
    }
  } catch(e) { toast(errorMessage(e),'error'); } finally { if(button) button.disabled=false; }
});

document.addEventListener('click', async (event) => {
  const id=event.target.closest('[data-download]')?.dataset.download; if(!id) return;
  try { const file=await TitanAPI.files.getDownload(id); const a=document.createElement('a'); a.href=file.data_url; a.download=file.filename; a.click(); } catch(e) { toast(errorMessage(e),'error'); }
});

addEventListener('hashchange', render);
addEventListener('online', render);
addEventListener('offline', render);

addEventListener('message',async event=>{
  if(event.origin!==location.origin)return;
  if(event.data?.type==='TITAN_PAYMENT_SAVE'){
    const frame=document.querySelector('.payments-frame');if(!frame||event.source!==frame.contentWindow)return;
    const message=event.data,deal=message.deal||{};
    try{
      const names=value=>String(value||'').split(/[,;\n]+/).map(item=>item.trim().toLocaleLowerCase('ru-RU')).filter(Boolean),payments=deal.managerActualPayments||{},accepted=names(deal.acceptedBy),sold=names(deal.soldBy);
      const totalFor=(group,other)=>group.reduce((sum,name)=>sum+num(payments[name])*(other.includes(name)?.5:1),0);
      const saved=await TitanAPI.sales.update(message.saleId,{sale_date:deal.date,sale_price:num(deal.salePrice),owner_amount:num(deal.ownerAmount),commission:deal.type==='commission'?num(deal.margin):undefined,margin:num(deal.margin),credit_commission:num(deal.creditCommission),expenses:num(deal.directorExpenses),deal_type:deal.type,accepted_by:deal.acceptedBy,sold_by:deal.soldBy,responsible_manager:deal.responsible,avito_days:num(deal.avitoDays),actual_buyer_payment:num(deal.buyerReceivedActual),actual_owner_payment:num(deal.ownerPaidActual),actual_manager_payment:totalFor(sold,accepted),actual_director_payment:totalFor(accepted,sold),comment:deal.note,payload_json:{calculator_state:deal}});
      event.source.postMessage({type:'TITAN_PAYMENT_SAVE_RESULT',requestId:message.requestId,ok:true,sale:saved},location.origin);toast('Расчёт выплаты сохранён');
    }catch(error){event.source.postMessage({type:'TITAN_PAYMENT_SAVE_RESULT',requestId:message.requestId,ok:false,error:errorMessage(error)},location.origin)}
    return;
  }
  if(event.data?.type==='TITAN_STORY_UPLOAD'){
    const frame=document.querySelector('.stories-frame');if(!frame||event.source!==frame.contentWindow)return;
    const message=event.data,file=message.file||{};
    try{
      if(!file.dataUrl||!file.filename)throw new Error('Редактор не передал файл.');
      const comma=String(file.dataUrl).indexOf(','),approximateBytes=Math.ceil((String(file.dataUrl).length-comma-1)*3/4);if(approximateBytes>8*1024*1024)throw new Error(`Файл ${file.filename} больше 8 МБ.`);
      const saved=await TitanAPI.files.upload({vehicle_id:message.vehicleId,type:'stories',description:message.description||'Материал из редактора сторис',filename:file.filename,mime_type:file.mimeType||'application/octet-stream',data_url:file.dataUrl});
      event.source.postMessage({type:'TITAN_STORY_UPLOAD_RESULT',requestId:message.requestId,ok:true,file:saved},location.origin);
    }catch(error){event.source.postMessage({type:'TITAN_STORY_UPLOAD_RESULT',requestId:message.requestId,ok:false,error:errorMessage(error)},location.origin)}
    return;
  }
  if(event.data?.type==='TITAN_PHOTO_UPLOAD'){
    const frame=document.querySelector('.photos-frame');if(!frame||event.source!==frame.contentWindow)return;
    const message=event.data,file=message.file||{};
    try{
      if(!file.dataUrl||!file.filename)throw new Error('Редактор не передал фотографию.');
      const comma=String(file.dataUrl).indexOf(','),approximateBytes=Math.ceil((String(file.dataUrl).length-comma-1)*3/4);if(approximateBytes>8*1024*1024)throw new Error('Обработанный JPG больше 8 МБ.');
      const saved=await TitanAPI.files.upload({vehicle_id:message.vehicleId,type:'photos',description:file.description||'Обработанное фото из редактора TITAN AUTO',filename:file.filename,mime_type:file.mimeType||'image/jpeg',data_url:file.dataUrl});
      event.source.postMessage({type:'TITAN_PHOTO_UPLOAD_RESULT',requestId:message.requestId,ok:true,file:saved},location.origin);toast('Фото сохранено в Google Drive');
    }catch(error){event.source.postMessage({type:'TITAN_PHOTO_UPLOAD_RESULT',requestId:message.requestId,ok:false,error:errorMessage(error)},location.origin)}
    return;
  }
  if(event.data?.type==='TITAN_CALL_SAVE'){
    const frame=document.querySelector('.calls-frame');if(!frame||event.source!==frame.contentWindow)return;
    const message=event.data,packet=message.packet||{},client=packet.client||{},vehicle=packet.vehicle||{},contact=packet.contact||{},currentLead=AppState.get('currentLead')||{};
    try{
      const phone=/\d{7}/.test(String(client.contact||''))?client.contact:currentLead.phone||'';
      await TitanAPI.leads.update(message.leadId,{seller_name:client.name||currentLead.seller_name||'',phone,source:vehicle.source||currentLead.source||'',source_url:vehicle.listingUrl||currentLead.source_url||'',seller_price:num(vehicle.price),listing_date:vehicle.listingDate||'',lead_channel:vehicle.source||'',call_sequence:contact.sequence||'',previous_outcome:contact.result||'',previous_agreement:contact.agreement||'',market_position:vehicle.marketPosition||'',listing_restriction:vehicle.listingRestriction||'',need:contact.need||'',objection:contact.objection||'',next_contact_at:contact.nextContactAt||'',next_contact_type:contact.nextContactType||'',meeting_place:contact.meetingPlace||'',notes:contact.summary||'',post_call_text:packet.message?.maxTelegram||'',status:'in_work'});
      const saved=await TitanAPI.contacts.create({lead_id:message.leadId,vehicle_id:currentLead.vehicle_id||'',type:contact.mode||'Звонок',result:contact.result||'Контакт зафиксирован',summary:contact.summary||'',agreement:contact.agreement||'',objection:contact.objection||'',comment:(contact.history||[]).map(item=>`${item.time||''} ${item.answer||''}`.trim()).join('\n'),next_action:contact.nextAction||contact.nextContactType||'',next_action_at:contact.nextContactAt||'',channel:contact.mode||'',message:packet.message?.maxTelegram||'',payload_json:JSON.stringify(packet)});
      event.source.postMessage({type:'TITAN_CALL_SAVE_RESULT',requestId:message.requestId,ok:true,contact:saved},location.origin);toast('Лид и контакт сохранены');
    }catch(error){event.source.postMessage({type:'TITAN_CALL_SAVE_RESULT',requestId:message.requestId,ok:false,error:errorMessage(error)},location.origin)}
    return;
  }
  if(event.data?.type==='TITAN_VALUATION_SAVE'){
    const frame=document.querySelector('.valuation-frame');if(!frame||event.source!==frame.contentWindow)return;
    const message=event.data,record=message.record||{},photos=Array.isArray(record.photos)?record.photos:[],documents=record.documents||{},compact={...record,photos:photos.map(item=>({name:item.name,type:item.type})),documents:Object.fromEntries(Object.entries(documents).map(([key,item])=>[key,item?{name:item.name,type:item.type}:null]))};
    try{
      const investments=(record.defects||[]).filter(item=>item.enabled!==false).reduce((sum,item)=>sum+num(item.cost),0)+(record.techResults||[]).filter(item=>item.checked).reduce((sum,item)=>sum+num(item.cost),0);
      const saved=await TitanAPI.valuations.create({vehicle_id:message.vehicleId,market_price:num(record.marketAvg),recommended_price:num(record.commissionPrice),buyout_price:num(record.buyoutPrice),trade_in_price:num(record.tradeinPrice),commission_price:num(record.commissionPrice),estimated_investments:investments,demand_level:record.demandLevel||'',market_min:num(record.marketMin),market_max:num(record.marketMax),agreed_option:record.agreedChoice||'',comment:[record.inspectionNote,record.marketNote,record.agreedNote].filter(Boolean).join('\n'),payload_json:JSON.stringify(compact)});
      const jsonBlob=new Blob([JSON.stringify(compact,null,2)],{type:'application/json'}),jsonUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(jsonBlob)});
      await TitanAPI.files.upload({vehicle_id:message.vehicleId,type:'reports',description:`Полная карточка оценки ${saved.valuation_id}`,filename:`${message.vehicleId} — ${saved.valuation_id} — оценка.json`,mime_type:'application/json',data_url:jsonUrl});
      for(let i=0;i<photos.length;i++){const item=photos[i];if(!item?.data)continue;await TitanAPI.files.upload({vehicle_id:message.vehicleId,type:'photos',description:`Фото осмотра · ${saved.valuation_id}`,filename:`${saved.valuation_id} — ${String(i+1).padStart(2,'0')} — ${item.name||'фото.jpg'}`,mime_type:item.type||'image/jpeg',data_url:item.data})}
      for(const [key,item] of Object.entries(documents)){if(!item?.data)continue;await TitanAPI.files.upload({vehicle_id:message.vehicleId,type:'documents',description:`${key.toUpperCase()} из оценки ${saved.valuation_id}`,filename:`${saved.valuation_id} — ${item.name||key}`,mime_type:item.type||'application/octet-stream',data_url:item.data})}
      event.source.postMessage({type:'TITAN_VALUATION_SAVE_RESULT',requestId:message.requestId,ok:true,valuation:saved},location.origin);toast('Оценка и материалы сохранены');
    }catch(error){event.source.postMessage({type:'TITAN_VALUATION_SAVE_RESULT',requestId:message.requestId,ok:false,error:errorMessage(error)},location.origin)}
    return;
  }
  if(event.data?.type!=='TITAN_DOCUMENTS_SAVE')return;
  const frame=document.querySelector('.documents-frame');if(!frame||event.source!==frame.contentWindow)return;
  try{const value=await saveDocumentRecord(event.data.store,event.data.value);event.source.postMessage({type:'TITAN_DOCUMENTS_SAVE_RESULT',request_id:event.data.request_id,value},location.origin);toast('Данные документа сохранены');}
  catch(error){event.source.postMessage({type:'TITAN_DOCUMENTS_SAVE_RESULT',request_id:event.data.request_id,error:errorMessage(error)},location.origin);}
});

if (Config.apiUrl && AppState.get('session')) await Auth.restore();
render();
