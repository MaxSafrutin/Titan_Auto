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
- Users: `user.list`, `user.upsert` — только администратор; PIN передаётся только при создании/смене и хранится как хеш.
- Vehicles: `vehicle.list`, `vehicle.get`, `vehicle.create`, `vehicle.update`, `vehicle.archive`, `vehicle.markSold`.
- Leads: `lead.list`, `lead.get`, `lead.create`, `lead.update`.
- Contacts: `contact.list`, `contact.create`.
- Valuations: `valuation.list`, `valuation.create`.
- Sales: `sale.list`, `sale.create`, `sale.update`. Изменение продажи и расчётов выплат требует действующую сессию и записывается в аудит.
- Files: `file.list`, `file.upload`, `file.publicSet`, `file.getDownload`, `file.delete`. `file.upload` принимает `public_photo: true` только для JPG, PNG, WebP в папке `photos`; по умолчанию фото внутреннее. `file.publicSet` принимает `file_id`, `public_photo` и необязательное `set_cover`. `file.reconcilePhotoAccess` — административная разовая сверка доступа к ранее загруженным фото.
- Tasks: `task.list`, `task.create`, `task.update`.
- Dashboard: `dashboard.stats`.
- Settings: `settings.get`, `settings.update` — только с действующей сессией.
- Counterparties: `counterparty.list`, `counterparty.create`, `counterparty.update`.
- Deals: `deal.list`, `deal.create`, `deal.update`.
- Templates: `template.list` — закрытые DOCX из Google Drive, только с действующей сессией.

## Клиент

Любой сетевой запрос находится только в `src/core/titan-api.js`. Модули используют методы `TitanAPI.vehicles.*`, `TitanAPI.leads.*`, `TitanAPI.contacts.*` и т. д. URL меняется в одном месте или в экране настроек браузера.

## Авторизация

PIN не хранится во frontend. Backend сравнивает SHA-256 hash и выдаёт случайный session token на 6 часов в `CacheService`. Сессия содержит роль `admin`, `director` или `manager`; права проверяются backend для каждого action. Администратор управляет доступами сотрудников, руководитель видит финансовые разделы, менеджер работает с операционным контуром без доступа к общим продажам, аналитике, выплатам и настройкам. Секреты хранятся только в Script Properties, пользовательские хеши — в закрытом листе `SETTINGS`.

## Ошибки

Коды предназначены для программы, сообщения — для человека. Stack trace наружу не возвращается. Техническая ошибка пишется через `console.error` Apps Script.
