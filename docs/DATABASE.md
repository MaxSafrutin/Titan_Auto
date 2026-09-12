# TITAN AUTO — модель данных

## Принципы

- Одна машина — одна строка в `VEHICLES` и постоянный `vehicle_id` вида `TA-000001`.
- Повторяющиеся события (контакты, оценки, файлы, задачи, продажи) хранятся отдельными строками, а не колонками `call1`, `call2`.
- Поля исходных приложений не теряются. Общие поля нормализуются; редкие/ещё нестабильные структуры временно сохраняются в `payload_json`.
- Даты передаются в ISO 8601; денежные суммы — числа в рублях.
- Удаление бизнес-сущностей в v1 заменяется архивированием; изменения фиксируются в `AUDIT_LOG`.

## Листы

`setupDatabase()` идемпотентно создаёт: `VEHICLES`, `LEADS`, `CONTACTS`, `VALUATIONS`, `SALES`, `DEALS`, `COUNTERPARTIES`, `FILES`, `TASKS`, `AUDIT_LOG`, `SETTINGS`.

### VEHICLES

Идентификаторы/статус: `vehicle_id`, `created_at`, `updated_at`, `status`, `public_status`.

Автомобиль: `brand`, `model`, `generation`, `year`, `vin`, `mileage`, `engine_volume`, `engine_power`, `fuel_type`, `transmission`, `drive_type`, `body_type`, `color`, `owners_count`, `registration_plate`.

Документы и номера из генератора документов: `category`, `vehicle_type`, `engine_number`, `chassis_number`, `body_number`, `pts_number`, `pts_issued`, `sts_number`, `sts_issued`, `special_notes`.

Источник/владелец: `seller_name`, `seller_phone`, `owner_id`, `source`, `source_url`, `acquisition_type`, `manager`, `responsible_manager`.

Цена: `seller_price`, `market_price`, `buyout_price`, `purchase_price`, `sale_price`, `estimated_investments`, `commission`.

Прочее: `location`, `description`, `notes`, `cover_file_id`, `payload_json`.

### LEADS

Кроме базовых полей хранятся сведения Навигатора: канал, объявление, последовательность звонка, потребность, возражение, позиция рынка, готовность, встреча, следующий контакт и текст сообщения. Неизменяемые касания переносятся в `CONTACTS`.

### CONTACTS

`contact_id`, связь с автомобилем/лидом, тип и время контакта, менеджер, результат, резюме, договорённость, возражение, комментарий, следующее действие, дата, канал, сообщение, `payload_json`.

### VALUATIONS

Одна машина может иметь много оценок. Базовые цены и вложения — отдельные колонки; подробный акт осмотра и ещё не нормализованные чек-листы — `payload_json`.

### SALES и DEALS

`SALES` — финансовый факт продажи и поля калькулятора (маржа, кредитная комиссия, участники, расчёты, налог/расходы). `DEALS` — юридическая сделка и выбранные документы. Контрагенты вынесены в `COUNTERPARTIES`, чтобы паспортные реквизиты не дублировались.

### FILES

Только метаданные: `file_id`, `vehicle_id`, `type`, Drive ID, имя, MIME, размер, версия, описание и автор. Бинарные данные находятся в Drive.

### TASKS, AUDIT_LOG, SETTINGS

Задачи содержат дедлайн, исполнителя и статус. Аудит — одно изменение поля на строку. Настройки — пары `key/value` с описанием; секреты там не хранятся, они находятся в Apps Script Properties.

## Дедупликация при миграции

Порядок поиска существующей сущности: внутренний ID → VIN → телефон + автомобиль → URL/ID объявления → госномер. Имя само по себе не считается уникальным ключом.

