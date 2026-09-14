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
const formObject = (form) => Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));

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
          ${navLink('sales','Продажи',current)}
          ${navLink('analytics','Аналитика',current)}
          <div class="nav-label">Инструменты</div>
          ${navLink('valuation','Оценка',current)}
          ${navLink('calls','Навигатор звонка',current)}
          ${navLink('price-tags','Ценники',current)}
          ${navLink('stories','Сторис',current)}
          ${navLink('photos','Фото',current)}
          ${navLink('documents','Документы',current)}
          ${navLink('payments','Калькулятор',current)}
        </nav>
        <div class="sidebar-footer nav">
          ${navLink('settings','Настройки',current)}
          <a href="#/catalog">Публичный каталог ↗</a>
          <button class="btn ghost" data-action="logout">Выйти</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <form class="search" data-form="search"><input name="q" autocomplete="off" placeholder="ID, телефон, VIN, марка или модель"></form>
          <button class="btn primary" data-action="new-entry">+ Добавить</button>
        </header>
        ${content}
      </main>
      <nav class="mobile-nav">
        ${navLink('dashboard','Главная',current)}${navLink('vehicles','Авто',current)}${navLink('leads','Лиды',current)}${navLink('sales','Продажи',current)}${navLink('settings','Ещё',current)}
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
    <p><a href="#/catalog" class="muted">Открыть публичный каталог →</a></p></section></main>`;
}

async function dashboardView() {
  const d = await TitanAPI.dashboard.stats();
  const cards = [
    ['Активные автомобили', d.active_vehicles], ['Новые лиды', d.new_leads],
    ['Перезвонить сегодня', d.callbacks_today], ['Назначенные встречи', d.meetings_upcoming],
    ['Без оценки', d.without_valuation], ['Продано за месяц', d.sold_this_month],
    ['Маржа за месяц', fmtMoney(d.margin_this_month)], ['Задачи сегодня', d.tasks_today],
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

async function leadView(id) {
  const data = await TitanAPI.leads.get(id);
  const lead = data.lead;
  AppState.set('currentLead', lead);
  AppState.set('currentVehicle', null);
  const vehicleTitle = [lead.brand, lead.model, lead.year].filter(Boolean).join(' ') || 'Автомобиль не указан';
  const linkedVehicle = lead.vehicle_id ? `<a class="btn" href="#/vehicles/${h(lead.vehicle_id)}">Открыть ${h(lead.vehicle_id)}</a>` : '<button class="btn primary" data-action="convert-lead">Создать автомобиль</button>';
  const body = `<div class="grid two"><section class="card accent"><div class="vehicle-title"><span class="badge">${h(lead.status || 'new')}</span><span class="muted">${h(lead.lead_id)}</span></div><h2 style="margin-top:22px">${h(vehicleTitle)}</h2><p class="muted">Цена продавца: ${fmtMoney(lead.seller_price)}</p><div class="actions">${linkedVehicle}${lead.source_url ? `<a class="btn" href="${h(lead.source_url)}" target="_blank" rel="noopener">Объявление</a>` : ''}</div></section><section class="card"><h2>Продавец</h2><p><b>${h(lead.seller_name || 'Имя не указано')}</b><br><span class="muted">${h(lead.phone || 'Телефон не указан')}</span></p><p>Следующий контакт: <b>${fmtDate(lead.next_contact_at)}</b></p><p class="muted">${h(lead.notes || 'Заметок нет')}</p><div class="actions"><a class="btn primary" href="tel:${h(lead.phone)}">Позвонить</a><button class="btn" data-action="new-contact">Новый контакт</button></div></section></div><section class="card" style="margin-top:18px"><h2>История контактов</h2>${timeline((data.contacts || []).map(x => ({ ...x, title: x.result || x.type, next_action_at: x.created_at })))}</section>`;
  root.innerHTML = shell(page(lead.lead_id, vehicleTitle, body, '<button class="btn" data-action="edit-lead">Изменить</button>'));
}

async function vehicleView(id) {
  const data = await TitanAPI.vehicles.get(id);
  const v = data.vehicle;
  AppState.set('currentVehicle', v);
  const title = [v.brand,v.model].filter(Boolean).join(' ') || v.vehicle_id;
  const metrics = [['Цена продавца',v.seller_price],['Рыночная',v.market_price],['Выкуп',v.buyout_price],['Цена продажи',v.sale_price],['Вложения',v.estimated_investments],['Комиссия',v.commission]].map(([k,val]) => `<div class="metric"><span class="muted">${k}</span><strong>${fmtMoney(val)}</strong></div>`).join('');
  const body = `<div class="grid two"><section class="card accent"><div class="vehicle-title"><span class="badge">${h(v.status)}</span><span class="muted">${h(v.public_status || 'private')}</span></div><h2 style="margin-top:22px">${h(title)}</h2><p class="muted">${h([v.year, v.engine_volume, v.transmission, v.mileage ? `${Number(v.mileage).toLocaleString('ru-RU')} км` : ''].filter(Boolean).join(' · '))}</p><div class="grid stats">${metrics}</div></section><section class="card"><h2>Контакт</h2><p><b>${h(v.seller_name || 'Имя не указано')}</b><br><span class="muted">${h(v.seller_phone || 'Телефон не указан')}</span></p><p class="muted">${h(v.notes || 'Заметок нет')}</p><div class="actions"><a class="btn primary" href="tel:${h(v.seller_phone)}">Позвонить</a><button class="btn" data-action="new-contact">Новый контакт</button><button class="btn" data-action="new-valuation">Оценить</button></div></section></div>
  <div class="grid two" style="margin-top:18px"><section class="card"><h2>История контактов</h2>${timeline((data.contacts||[]).map(x=>({...x,title:x.result||x.type,next_action_at:x.created_at})))}</section><section class="card"><h2>Оценки</h2>${(data.valuations||[]).length ? timeline(data.valuations.map(x=>({title:`Рынок ${fmtMoney(x.market_price)} · Выкуп ${fmtMoney(x.buyout_price)}`,due_at:x.created_at}))) : '<div class="empty">Оценок пока нет</div>'}</section><section class="card"><h2>Файлы</h2>${fileList(data.files)}</section><section class="card"><h2>История изменений</h2>${(data.audit||[]).length ? timeline(data.audit.map(x=>({title:`${x.field}: ${x.old_value||'—'} → ${x.new_value||'—'}`,due_at:x.created_at}))) : '<div class="empty">Изменений пока нет</div>'}</section></div>`;
  const actions = '<button class="btn" data-action="edit-vehicle">Изменить</button><button class="btn" data-action="open-price-tag">Ценник</button><button class="btn" data-action="upload-file">Загрузить файл</button><button class="btn primary" data-action="mark-sold">Продано</button>';
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
  const [vehicles,counterparties,deals,settings,templates]=await Promise.all([TitanAPI.vehicles.list({include_archived:true}),TitanAPI.counterparties.list(),TitanAPI.deals.list(),TitanAPI.settings.get(),TitanAPI.templates.list(true)]);
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
  let rows = [];
  let warning = '';
  try { rows = await TitanAPI.vehicles.publicList(); } catch (e) { warning = `<div class="notice">${h(errorMessage(e))}</div>`; }
  root.innerHTML = `<main class="page"><div class="page-head"><a class="brand" href="#/catalog"><img src="assets/brand/titan-auto-logo.svg" alt="TITAN AUTO"></a><a class="btn" href="#/dashboard">Вход для сотрудников</a></div><div class="eyebrow">Автомобили с пробегом</div><h1>В наличии</h1><p class="muted">Честные автомобили и понятное сопровождение сделки.</p>${warning}<div class="grid catalog-grid" style="margin-top:28px">${rows.length ? rows.map(v => `<article class="card catalog-card"><div class="catalog-media">${v.cover_url ? `<img src="${h(v.cover_url)}" alt="${h(v.brand+' '+v.model)}" style="width:100%;height:100%;object-fit:cover">` : 'Фото готов'}</div><div class="catalog-body"><div class="eyebrow">${h(v.year || '')}</div><h2>${h([v.brand,v.model].filter(Boolean).join(' '))}</h2><p class="muted">${h([v.mileage ? `${Number(v.mileage).toLocaleString('ru-RU')} км` : '',v.transmission,v.engine_volume].filter(Boolean).join(' · '))}</p><strong style="font-size:24px">${fmtMoney(v.sale_price)}</strong></div></article>`).join('') : '<div class="card empty">Опубликованных автомобилей пока нет</div>'}</div></main>`;
}

async function settingsView() {
  const settings = await TitanAPI.settings.get();
  const company = settings.company || {};
  const managersText = (company.managers || []).map(item => `${item.name || ''} | ${item.phone || ''}`).join('\n');
  const body = `<section class="card accent"><h2>Реквизиты и сотрудники</h2><p class="muted">Хранятся в закрытой Google Таблице и загружаются только после входа. В публичном коде этих данных нет.</p><form class="form-grid" data-form="company-settings">
    <div class="field wide"><label>Юридическое наименование</label><input name="legal_name" value="${h(company.legal_name)}"></div>
    <div class="field"><label>ОГРН</label><input name="ogrn" value="${h(company.ogrn)}"></div><div class="field"><label>ИНН</label><input name="inn" value="${h(company.inn)}"></div>
    <div class="field"><label>КПП</label><input name="kpp" value="${h(company.kpp)}"></div><div class="field"><label>Руководитель</label><input name="director" value="${h(company.director)}"></div>
    <div class="field"><label>Телефон компании</label><input name="phone" type="tel" value="${h(company.phone)}"></div>
    <div class="field wide"><label>Юридический адрес</label><input name="address" value="${h(company.address)}"></div>
    <div class="field"><label>Банк</label><input name="bank_name" value="${h(company.bank_name)}"></div><div class="field"><label>БИК</label><input name="bik" value="${h(company.bik)}"></div>
    <div class="field"><label>Расчётный счёт</label><input name="bank_account" value="${h(company.bank_account)}"></div><div class="field"><label>Корреспондентский счёт</label><input name="correspondent_account" value="${h(company.correspondent_account)}"></div>
    <div class="field wide"><label>Сотрудники — по одному в строке: Имя | Телефон</label><textarea name="managers_text" rows="7">${h(managersText)}</textarea></div>
    <div class="wide actions"><button class="btn primary">Сохранить реквизиты</button></div>
  </form></section><div class="grid two" style="margin-top:18px"><section class="card"><h2>Подключение API</h2><form class="form-grid" data-form="api"><div class="field wide"><label>Google Apps Script Web App URL</label><input name="api_url" type="url" value="${h(Config.apiUrl)}" placeholder="https://script.google.com/macros/s/.../exec"></div><div class="wide actions"><button class="btn primary">Сохранить</button></div></form></section><section class="card"><h2>Архитектура</h2><p class="muted">Таблица и Drive подключаются только на backend через Script Properties. Секретов в браузере нет.</p><p>Версия ${h(Config.version)}</p></section></div>`;
  root.innerHTML = shell(page('Настройки', 'Защищённые данные компании и конфигурация', body));
}

function placeholderView(name) {
  root.innerHTML = shell(page(name, 'Модуль подготовлен к подключению через адаптер', `<section class="card empty"><h2>${h(name)}</h2><p>Рабочий legacy-инструмент пока не переносился. Он будет подключён к текущему автомобилю через TitanAPI без переписывания основной логики.</p><a href="#/vehicles" class="btn">Выбрать автомобиль</a></section>`));
}

function newEntryModal(kind = 'lead') {
  showModal('Новая запись', `<div class="actions"><button class="btn ${kind==='lead'?'primary':''}" data-action="new-lead">Лид</button><button class="btn ${kind==='vehicle'?'primary':''}" data-action="new-vehicle">Автомобиль</button></div><p class="muted">Лид можно создать по трём полям, остальное добавить позже.</p>`);
}

function vehicleForm(vehicle = {}) {
  closeModal(); showModal(vehicle.vehicle_id ? `Изменить ${vehicle.vehicle_id}` : 'Новый автомобиль', `<form class="form-grid" data-form="vehicle" data-id="${h(vehicle.vehicle_id||'')}">
    <div class="field"><label>Марка *</label><input name="brand" value="${h(vehicle.brand)}" required></div><div class="field"><label>Модель *</label><input name="model" value="${h(vehicle.model)}" required></div>
    <div class="field"><label>Год</label><input name="year" type="number" min="1900" max="2100" value="${h(vehicle.year)}"></div><div class="field"><label>Пробег, км</label><input name="mileage" type="number" min="0" value="${h(vehicle.mileage)}"></div>
    <div class="field"><label>VIN</label><input name="vin" value="${h(vehicle.vin)}"></div><div class="field"><label>Коробка</label><input name="transmission" value="${h(vehicle.transmission)}"></div>
    <div class="field"><label>Телефон продавца</label><input name="seller_phone" value="${h(vehicle.seller_phone)}"></div><div class="field"><label>Имя продавца</label><input name="seller_name" value="${h(vehicle.seller_name)}"></div>
    <div class="field"><label>Цена продавца</label><input name="seller_price" type="number" min="0" value="${h(vehicle.seller_price)}"></div><div class="field"><label>Цена продажи</label><input name="sale_price" type="number" min="0" value="${h(vehicle.sale_price)}"></div>
    <div class="field"><label>Статус</label><select name="status"><option value="new">Новый</option><option value="in_work">В работе</option><option value="in_stock">В наличии</option><option value="reserved">Резерв</option><option value="sold">Продан</option></select></div><div class="field"><label>Публикация</label><select name="public_status"><option value="private">Скрыт</option><option value="published">Опубликован</option></select></div>
    <div class="field wide"><label>Заметки</label><textarea name="notes">${h(vehicle.notes)}</textarea></div><div class="wide actions"><button class="btn primary">Сохранить</button><button type="button" class="btn" data-action="close-modal">Отмена</button></div></form>`);
  const f = document.querySelector('[data-form="vehicle"]');
  f.status.value = vehicle.status || 'new'; f.public_status.value = vehicle.public_status || 'private';
}

function leadForm(lead = {}) {
  closeModal(); showModal(lead.lead_id ? `Изменить ${lead.lead_id}` : 'Новый лид', `<form class="form-grid" data-form="lead" data-id="${h(lead.lead_id || '')}"><div class="field"><label>Марка *</label><input name="brand" value="${h(lead.brand)}" required></div><div class="field"><label>Модель *</label><input name="model" value="${h(lead.model)}" required></div><div class="field"><label>Телефон *</label><input name="phone" type="tel" value="${h(lead.phone)}" required></div><div class="field"><label>Год</label><input name="year" type="number" value="${h(lead.year)}"></div><div class="field wide"><label>Ссылка на объявление</label><input name="source_url" type="url" value="${h(lead.source_url)}"></div><div class="field"><label>Имя продавца</label><input name="seller_name" value="${h(lead.seller_name)}"></div><div class="field"><label>Цена продавца</label><input name="seller_price" type="number" value="${h(lead.seller_price)}"></div><div class="field"><label>Следующий контакт</label><input name="next_contact_at" type="datetime-local" value="${h(String(lead.next_contact_at || '').slice(0, 16))}"></div><div class="field"><label>Статус</label><select name="status"><option value="new">Новый</option><option value="in_work">В работе</option><option value="qualified">Квалифицирован</option><option value="closed">Закрыт</option></select></div><div class="field wide"><label>Заметки</label><textarea name="notes">${h(lead.notes)}</textarea></div><div class="wide actions"><button class="btn primary">${lead.lead_id ? 'Сохранить' : 'Создать лид'}</button><button type="button" class="btn" data-action="close-modal">Отмена</button></div></form>`);
  document.querySelector('[data-form="lead"]').status.value = lead.status || 'new';
}

function contactForm() { showModal('Новый контакт', `<form class="form-grid" data-form="contact"><div class="field"><label>Тип</label><select name="type"><option>Звонок</option><option>Сообщение</option><option>Встреча</option><option>Осмотр</option></select></div><div class="field"><label>Результат *</label><input name="result" required></div><div class="field wide"><label>Комментарий</label><textarea name="comment"></textarea></div><div class="field"><label>Следующее действие</label><input name="next_action"></div><div class="field"><label>Когда</label><input name="next_action_at" type="datetime-local"></div><div class="wide actions"><button class="btn primary">Сохранить контакт</button></div></form>`); }
function valuationForm() { showModal('Новая оценка', `<form class="form-grid" data-form="valuation"><div class="field"><label>Рыночная цена</label><input name="market_price" type="number"></div><div class="field"><label>Рекомендуемая цена</label><input name="recommended_price" type="number"></div><div class="field"><label>Цена выкупа</label><input name="buyout_price" type="number"></div><div class="field"><label>Вложения</label><input name="estimated_investments" type="number"></div><div class="field wide"><label>Комментарий</label><textarea name="comment"></textarea></div><div class="wide actions"><button class="btn primary">Сохранить оценку</button></div></form>`); }
function uploadForm() { showModal('Загрузить файл', `<form class="form-grid" data-form="file"><div class="field"><label>Раздел</label><select name="type"><option value="photos">Фото</option><option value="documents">Документы</option><option value="price-tags">Ценники</option><option value="stories">Сторис</option><option value="reports">Отчёты</option></select></div><div class="field"><label>Файл</label><input name="file" type="file" required></div><div class="field wide"><label>Описание</label><input name="description"></div><div class="wide actions"><button class="btn primary">Загрузить</button></div></form>`); }

async function render() {
  const r = route();
  if (r.name === 'catalog') return catalogView();
  if (!AppState.get('session')) return loginView();
  try {
    if (r.name === 'dashboard') return dashboardView();
    if (r.name === 'vehicles' && r.id) return vehicleView(r.id);
    if (r.name === 'vehicles') return vehiclesView(r.query);
    if (r.name === 'leads' && r.id) return leadView(r.id);
    if (r.name === 'leads') return leadsView(r.query);
    if (r.name === 'price-tags') return priceTagsView();
    if (r.name === 'settings') return settingsView();
    if (r.name === 'documents') return documentsView();
    const names = {sales:'Продажи',analytics:'Аналитика',valuation:'Оценка',calls:'Навигатор звонка','price-tags':'Ценники',stories:'Сторис',photos:'Фото',documents:'Документы',payments:'Калькулятор оплаты'};
    return placeholderView(names[r.name] || 'Раздел');
  } catch (e) {
    root.innerHTML = shell(page('Не удалось загрузить раздел', errorMessage(e), '<div class="card empty"><button class="btn" data-action="retry">Повторить</button></div>'));
  }
}

document.addEventListener('click', async (event) => {
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
  if (action === 'new-contact') return contactForm();
  if (action === 'new-valuation') return valuationForm();
  if (action === 'upload-file') return uploadForm();
  if (action === 'open-price-tag') { navigate('price-tags'); return render(); }
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
    if (!v || !confirm(`Отметить ${v.vehicle_id} как проданный?`)) return;
    try { await TitanAPI.vehicles.markSold(v.vehicle_id, { sale_price: v.sale_price }); toast('Автомобиль отмечен как проданный'); render(); } catch(e) { toast(errorMessage(e),'error'); }
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form'); if (!form) return;
  event.preventDefault(); const type = form.dataset.form; const button = form.querySelector('[type="submit"],button:not([type])'); if (button) button.disabled = true;
  try {
    if (type === 'api') return saveApiUrl(formObject(form).api_url);
    if (type === 'login') { await Auth.login(formObject(form).pin); navigate('dashboard'); return render(); }
    if (type === 'search') { const q=formObject(form).q; return navigate(`vehicles?q=${encodeURIComponent(q)}`); }
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
    if (type === 'file') { const file=form.elements.file.files[0]; if(file.size>8*1024*1024) throw new Error('В первой версии размер файла ограничен 8 МБ.'); const data_url=await new Promise((resolve,reject)=>{const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file);}); await TitanAPI.files.upload({vehicle_id:vehicle.vehicle_id,type:form.elements.type.value,description:form.elements.description.value,filename:file.name,mime_type:file.type,data_url}); closeModal(); toast('Файл загружен'); return render(); }
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
  if(event.origin!==location.origin||event.data?.type!=='TITAN_DOCUMENTS_SAVE')return;
  const frame=document.querySelector('.documents-frame');if(!frame||event.source!==frame.contentWindow)return;
  try{const value=await saveDocumentRecord(event.data.store,event.data.value);event.source.postMessage({type:'TITAN_DOCUMENTS_SAVE_RESULT',request_id:event.data.request_id,value},location.origin);toast('Данные документа сохранены');}
  catch(error){event.source.postMessage({type:'TITAN_DOCUMENTS_SAVE_RESULT',request_id:event.data.request_id,error:errorMessage(error)},location.origin);}
});

if (Config.apiUrl && AppState.get('session')) await Auth.restore();
render();
