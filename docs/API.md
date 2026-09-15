# TITAN AUTO API

## Транспорт

Один Apps Script Web App endpoint. Frontend отправляет `POST` как `text/plain`, чтобы браузер не создавал CORS preflight:

```json
{"action":"vehicle.get","payload":{"vehicle_id":"TA-000001"},"session":"...","origin":"https://maxsafrutin.github.io"}
```

Ответ всегда имеет форму:

```json
{"ok":true,"data":{},"error":null}
```

или:

```json
{"ok":false,"data":null,"error":{"code":"VEHICLE_NOT_FOUND","message":"Автомобиль не найден"}}
```

## Actions

- Public: `health`, `auth.login`, `vehicle.publicList`, `vehicle.publicGet`. Публичная карточка содержит только разрешённые поля автомобиля, публичные фото и контакт компании.
- Auth: `auth.check`, `auth.logout`.
- Vehicles: `vehicle.list`, `vehicle.get`, `vehicle.create`, `vehicle.update`, `vehicle.archive`, `vehicle.markSold`.
- Leads: `lead.list`, `lead.get`, `lead.create`, `lead.update`.
- Contacts: `contact.list`, `contact.create`.
- Valuations: `valuation.list`, `valuation.create`.
- Sales: `sale.list`, `sale.create`, `sale.update`. Изменение продажи и расчётов выплат требует действующую сессию и записывается в аудит.
- Files: `file.list`, `file.upload`, `file.delete`, `file.getDownload`.
- Tasks: `task.list`, `task.create`, `task.update`.
- Dashboard: `dashboard.stats`.
- Settings: `settings.get`, `settings.update` — только с действующей сессией.
- Counterparties: `counterparty.list`, `counterparty.create`, `counterparty.update`.
- Deals: `deal.list`, `deal.create`, `deal.update`.
- Templates: `template.list` — закрытые DOCX из Google Drive, только с действующей сессией.

## Клиент

Любой сетевой запрос находится только в `src/core/titan-api.js`. Модули используют методы `TitanAPI.vehicles.*`, `TitanAPI.leads.*`, `TitanAPI.contacts.*` и т. д. URL меняется в одном месте или в экране настроек браузера.

## Авторизация

PIN не хранится во frontend. Backend сравнивает SHA-256 hash и выдаёт случайный session token на 6 часов в `CacheService`. Все внутренние actions проверяют session и rate limit. Секреты хранятся только в Script Properties.

## Ошибки

Коды предназначены для программы, сообщения — для человека. Stack trace наружу не возвращается. Техническая ошибка пишется через `console.error` Apps Script.
