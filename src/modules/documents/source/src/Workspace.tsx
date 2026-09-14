import { useEffect, useMemo, useRef, useState } from "react";
import DealEditor from "./App";
import { EMPTY_DEAL } from "./data";
import { loadCatalog, newCounterparty, newVehicle, putRecord } from "./catalog";
import type {
  Counterparty,
  DealData,
  DealRecord,
  ScanAttachment,
  StockVehicle,
} from "./types";
import "./workspace.css";
import "./workspace-import.css";

type Tab = "deals" | "counterparties" | "stock";
const clone = <T,>(x: T): T => structuredClone(x);
const now = () => new Date().toISOString();
const dealTypes: Record<DealRecord["type"], string> = {
  commission: "Приём на комиссию",
  private_sale: "ДКП между физлицами",
  company_purchase: "Выкуп автомобиля",
  company_sale: "Продажа автомобиля",
  termination: "Расторжение",
};
const statuses: Record<StockVehicle["status"], string> = {
  in_stock: "На складе",
  consignment: "На комиссии",
  reserved: "Резерв",
  sold: "Продан",
  archived: "Архив",
};
const acquisitionTypes: Record<StockVehicle["acquisition_type"], string> = {
  purchase: "Выкупленный",
  commission: "Комиссионный",
  other: "Прочий",
};

function fromParty(p: Counterparty | undefined) {
  return {
    full_name: p?.name || "",
    birth_date: p?.birth_date || "",
    inn: p?.inn || "",
    passport_series: p?.passport_series || "",
    passport_number: p?.passport_number || "",
    passport_issue_date: p?.passport_issue_date || "",
    passport_issued_by: p?.passport_issued_by || "",
    division_code: p?.division_code || "",
    registration_address: p?.address || "",
    phone: p?.phone || "",
  };
}
function toBuyer(p: Counterparty | undefined) {
  return {
    full_name: p?.name || "",
    birth_date: p?.birth_date || "",
    passport_series: p?.passport_series || "",
    passport_number: p?.passport_number || "",
    passport_issued_by: p?.passport_issued_by || "",
    registration_address: p?.address || "",
    phone: p?.phone || "",
  };
}

export default function Workspace() {
  const [tab, setTab] = useState<Tab>("deals"),
    [counterparties, setCounterparties] = useState<Counterparty[]>([]),
    [vehicles, setVehicles] = useState<StockVehicle[]>([]),
    [deals, setDeals] = useState<DealRecord[]>([]),
    [editingParty, setEditingParty] = useState<Counterparty | null>(null),
    [editingVehicle, setEditingVehicle] = useState<StockVehicle | null>(null),
    [editingDeal, setEditingDeal] = useState<DealRecord | null>(null),
    [creatingDeal, setCreatingDeal] = useState(false),
    [search, setSearch] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [stockView, setStockView] = useState<"active" | "sold">("active");
  const reload = async () => {
    const x = await loadCatalog();
    setCounterparties(x.counterparties);
    setVehicles(x.vehicles);
    setDeals(x.deals);
  };
  useEffect(() => {
    reload().catch(console.error);
  }, []);
  const q = search.toLowerCase();
  const filteredParties = useMemo(
    () =>
      counterparties.filter((x) =>
        [x.name, x.inn, x.phone].some((v) => v.toLowerCase().includes(q)),
      ),
    [counterparties, q],
  );
  const filteredVehicles = useMemo(
    () =>
      vehicles.filter(
        (x) =>
          (stockView === "sold"
            ? x.status === "sold" || x.status === "archived"
            : x.status !== "sold" && x.status !== "archived") &&
          [x.make_model, x.vin, x.registration_plate].some((v) =>
            v.toLowerCase().includes(q),
          ),
      ),
    [vehicles, q, stockView],
  );
  const filteredDeals = useMemo(
    () =>
      deals.filter((x) =>
        [
          x.number,
          dealTypes[x.type],
          x.data.seller.full_name,
          x.data.vehicle.make_model,
          x.data.vehicle.vin,
        ].some((v) => v.toLowerCase().includes(q)),
      ),
    [deals, q],
  );
  const importJson = async (file: File) => {
    const value = JSON.parse(await file.text());
    if (!value || Array.isArray(value) || typeof value !== "object")
      throw new Error("В файле нет карточки");
    if (tab === "counterparties") {
      if (!value.id || !value.name || !value.kind)
        throw new Error("Это не JSON контрагента");
      await putRecord("counterparties", value as Counterparty);
    } else if (tab === "stock") {
      if (!value.id || !value.data || !("vin" in value))
        throw new Error("Это не JSON автомобиля");
      await putRecord("vehicles", value as StockVehicle);
    } else {
      if (!value.id || !value.data || !value.type || !("vehicle_id" in value))
        throw new Error("Это не JSON сделки");
      await putRecord("deals", value as DealRecord);
    }
    await reload();
  };
  if (editingDeal) {
    const seller = counterparties.find((x) => x.id === editingDeal.seller_id),
      buyer = counterparties.find((x) => x.id === editingDeal.buyer_id),
      vehicle = vehicles.find((x) => x.id === editingDeal.vehicle_id),
      initialScans: ScanAttachment[] = [
        [...(seller?.attachments || []), ...(buyer?.attachments || [])].map(
          (file) => ({
            id: crypto.randomUUID(),
            file,
            kind: "passport" as const,
          }),
        ),
        (vehicle?.attachments || []).map((file) => ({
          id: crypto.randomUUID(),
          file,
          kind: "vehicle" as const,
        })),
      ].flat();
    return (
      <>
      <DealEditor
        key={editingDeal.id}
        dealType={editingDeal.type}
        templateFile={editingDeal.template_file}
        templateName={editingDeal.template_name}
        initialScans={initialScans}
        initialData={editingDeal.data}
        onBack={() => setEditingDeal(null)}
        onEditSeller={()=>seller&&setEditingParty(clone(seller))}
        onEditBuyer={()=>buyer&&setEditingParty(clone(buyer))}
        onEditVehicle={()=>vehicle&&setEditingVehicle(clone(vehicle))}
        onPersist={async (data) => {
          const record = {
            ...editingDeal,
            number: data.deal.contract_number,
            data,
            updated_at: now(),
          };
          await putRecord("deals", record);
          setEditingDeal(record);
          await reload();
        }}
      />
      {editingParty&&<PartyModal value={editingParty} onClose={()=>setEditingParty(null)} onSave={async party=>{await putRecord('counterparties',{...party,updated_at:now()});const updated={...editingDeal,data:{...editingDeal.data,seller:party.id===editingDeal.seller_id?fromParty(party):editingDeal.data.seller,buyer:party.id===editingDeal.buyer_id?toBuyer(party):editingDeal.data.buyer},updated_at:now()};await putRecord('deals',updated);setEditingDeal(updated);setEditingParty(null);await reload()}}/>}
      {editingVehicle&&<VehicleModal value={editingVehicle} parties={counterparties} onClose={()=>setEditingVehicle(null)} onSave={async car=>{const saved={...car,data:{...car.data,vin:car.vin,make_model:car.make_model,year:car.year,color:car.color,registration_plate:car.registration_plate,pts:car.pts,sts:car.sts},updated_at:now()};await putRecord('vehicles',saved);const updated={...editingDeal,data:{...editingDeal.data,vehicle:clone(saved.data)},updated_at:now()};await putRecord('deals',updated);setEditingDeal(updated);setEditingVehicle(null);await reload()}}/>}
      </>
    );
  }
  return (
    <div className="workspace-app">
      <header className="catalog-header">
        <div className="catalog-brand">
          <img src="./brand/logo.png" />
          <div>
            <b>ТИТАН АВТО</b>
            <span>Учёт и документы</span>
          </div>
        </div>
        <nav>
          <button
            className={tab === "deals" ? "active" : ""}
            onClick={() => setTab("deals")}
          >
            Сделки <i>{deals.length}</i>
          </button>
          <button
            className={tab === "counterparties" ? "active" : ""}
            onClick={() => setTab("counterparties")}
          >
            Контрагенты <i>{counterparties.length}</i>
          </button>
          <button
            className={tab === "stock" ? "active" : ""}
            onClick={() => setTab("stock")}
          >
            Склад <i>{vehicles.length}</i>
          </button>
        </nav>
      </header>
      <main className="catalog-main">
        <div className="catalog-toolbar">
          <div>
            <h1>
              {tab === "deals"
                ? "Сделки"
                : tab === "counterparties"
                  ? "Контрагенты"
                  : "Склад автомобилей"}
            </h1>
            <p>
              {tab === "deals"
                ? "Участники, автомобили и комплекты документов"
                : tab === "counterparties"
                  ? "Физические лица и организации"
                  : "Карточки автомобилей и состояние склада"}
            </p>
          </div>
          <div className="toolbar-actions">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск…"
            />
            <button
              className="catalog-import"
              onClick={() => importRef.current?.click()}
            >
              ↑ Загрузить JSON
            </button>
            <input
              ref={importRef}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await importJson(file);
                } catch (error) {
                  alert(
                    error instanceof Error
                      ? error.message
                      : "Не удалось загрузить JSON",
                  );
                } finally {
                  e.target.value = "";
                }
              }}
            />
            <button
              className="catalog-add"
              onClick={() =>
                tab === "deals"
                  ? setCreatingDeal(true)
                  : tab === "counterparties"
                    ? setEditingParty(newCounterparty())
                    : setEditingVehicle(newVehicle())
              }
            >
              ＋{" "}
              {tab === "deals"
                ? "Новая сделка"
                : tab === "counterparties"
                  ? "Контрагент"
                  : "Автомобиль"}
            </button>
          </div>
        </div>
        {tab === "deals" && (
          <DataTable
            headers={[
              "Номер",
              "Тип",
              "Участники",
              "Автомобиль",
              "Статус",
              "Изменено",
            ]}
            empty="Сделок пока нет"
          >
            {filteredDeals.map((d) => (
              <tr key={d.id} onClick={() => setEditingDeal(d)}>
                <td>
                  <b>{d.number || "Без номера"}</b>
                </td>
                <td>{dealTypes[d.type]}</td>
                <td>
                  {d.data.seller.full_name}
                  {d.data.buyer.full_name && <> → {d.data.buyer.full_name}</>}
                </td>
                <td>
                  {d.data.vehicle.make_model || "Не выбран"}
                  <small>{d.data.vehicle.vin}</small>
                </td>
                <td>
                  <Badge
                    text={
                      d.status === "draft"
                        ? "Черновик"
                        : d.status === "completed"
                          ? "Проведена"
                          : "Отменена"
                    }
                    tone={d.status}
                  />
                </td>
                <td>{new Date(d.updated_at).toLocaleDateString("ru-RU")}</td>
              </tr>
            ))}
          </DataTable>
        )}
        {tab === "counterparties" && (
          <DataTable
            headers={["Контрагент", "Тип", "ИНН / паспорт", "Телефон", "Адрес"]}
            empty="Контрагентов пока нет"
          >
            {filteredParties.map((p) => (
              <tr key={p.id} onClick={() => setEditingParty(clone(p))}>
                <td>
                  <b>{p.name}</b>
                  {p.is_own_company && <small>Наша организация</small>}
                </td>
                <td>{p.kind === "organization" ? "Организация" : "Физлицо"}</td>
                <td>{p.inn || `${p.passport_series} ${p.passport_number}`}</td>
                <td>{p.phone}</td>
                <td>{p.address}</td>
              </tr>
            ))}
          </DataTable>
        )}
        {tab === "stock" && (
          <>
            <div className="stock-switch">
              <button
                className={stockView === "active" ? "active" : ""}
                onClick={() => setStockView("active")}
              >
                Текущий склад
              </button>
              <button
                className={stockView === "sold" ? "active" : ""}
                onClick={() => setStockView("sold")}
              >
                Архив проданных
              </button>
            </div>
            <DataTable
              headers={[
                "Автомобиль",
                "VIN",
                "Учёт",
                "Госномер",
                "Статус",
                "Владелец",
              ]}
              empty="В этом разделе автомобилей пока нет"
            >
              {filteredVehicles.map((v) => (
                <tr key={v.id} onClick={() => setEditingVehicle(clone(v))}>
                  <td>
                    <b>{v.make_model || "Без названия"}</b>
                    <small>
                      {v.year} · {v.color}
                    </small>
                  </td>
                  <td>{v.vin}</td>
                  <td>{acquisitionTypes[v.acquisition_type || "other"]}</td>
                  <td>{v.registration_plate}</td>
                  <td>
                    <Badge text={statuses[v.status]} tone={v.status} />
                  </td>
                  <td>
                    {counterparties.find((x) => x.id === v.owner_id)?.name ||
                      "Не указан"}
                  </td>
                </tr>
              ))}
            </DataTable>
          </>
        )}
      </main>
      {creatingDeal && (
        <DealModal
          parties={counterparties}
          vehicles={vehicles}
          onAddParty={() => setEditingParty(newCounterparty())}
          onAddVehicle={() => setEditingVehicle(newVehicle())}
          onClose={() => setCreatingDeal(false)}
          onCreate={async (input) => {
            const record = makeDeal(
              input.type,
              input.seller,
              input.buyer,
              input.vehicle,
              counterparties,
              vehicles,
              input.template,
            );
            await putRecord("deals", record);
            setCreatingDeal(false);
            await reload();
            setEditingDeal(record);
          }}
        />
      )}
      {editingParty && (
        <PartyModal
          value={editingParty}
          onClose={() => setEditingParty(null)}
          onSave={async (p) => {
            await putRecord("counterparties", { ...p, updated_at: now() });
            setEditingParty(null);
            await reload();
          }}
        />
      )}
      {editingVehicle && (
        <VehicleModal
          value={editingVehicle}
          parties={counterparties}
          onClose={() => setEditingVehicle(null)}
          onSave={async (v) => {
            await putRecord("vehicles", {
              ...v,
              data: {
                ...v.data,
                vin: v.vin,
                make_model: v.make_model,
                year: v.year,
                color: v.color,
                registration_plate: v.registration_plate,
                pts: v.pts,
                sts: v.sts,
              },
              updated_at: now(),
            });
            setEditingVehicle(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function DataTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: React.ReactNode;
  empty: string;
}) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="data-card">
      <table>
        <thead>
          <tr>
            {headers.map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {has ? (
            children
          ) : (
            <tr>
              <td colSpan={headers.length} className="empty-row">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function Badge({ text, tone }: { text: string; tone: string }) {
  return <span className={`status-badge ${tone}`}>{text}</span>;
}
function Modal({
  title,
  onClose,
  children,
  save,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  save: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="catalog-modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={onClose}>×</button>
        </div>
        {children}
        <div className="modal-actions">
          <button onClick={onClose}>Отмена</button>
          <button className="catalog-add" onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
const F = ({
  label,
  value,
  set,
  type = "text",
}: {
  label: string;
  value: string;
  set: (x: string) => void;
  type?: string;
}) => (
  <label className="catalog-field">
    <span>{label}</span>
    <input type={type} value={value} onChange={(e) => set(e.target.value)} />
  </label>
);
function AttachmentPicker({label,files,onChange}:{label:string;files:File[];onChange:(files:File[])=>void}){
  return <div className="attachment-picker"><label><span>＋</span><div><b>{label}</b><small>Изображения и PDF сохраняются в карточке и автоматически входят в пакет сделки.</small></div><em>Добавить файлы</em><input type="file" multiple accept="image/*,.pdf" onChange={e=>{const added=[...(e.target.files||[])];onChange([...files,...added]);e.target.value='' }}/></label>{files.length>0&&<div className="attachment-list">{files.map((file,index)=><span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={()=>onChange(files.filter((_,i)=>i!==index))}>×</button></span>)}</div>}</div>
}
function PartyModal({
  value,
  onClose,
  onSave,
}: {
  value: Counterparty;
  onClose: () => void;
  onSave: (x: Counterparty) => void;
}) {
  const [p, setP] = useState({ ...newCounterparty(), ...value }),
    set = (k: keyof Counterparty, v: string) => setP((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      title={p.is_own_company ? "Карточка организации" : "Карточка контрагента"}
      onClose={onClose}
      save={() => p.name && onSave(p)}
    >
      <AttachmentPicker
        label="Паспорт и документы контрагента"
        files={p.attachments || []}
        onChange={(files) => setP((x) => ({ ...x, attachments: files }))}
      />
      <div className="catalog-grid">
        <label className="catalog-field">
          <span>Тип</span>
          <select
            value={p.kind}
            onChange={(e) =>
              setP((x) => ({
                ...x,
                kind: e.target.value as Counterparty["kind"],
              }))
            }
          >
            <option value="person">Физическое лицо</option>
            <option value="organization">Организация</option>
          </select>
        </label>
        <F
          label="Наименование / ФИО"
          value={p.name}
          set={(v) => set("name", v)}
        />
        <F label="ИНН" value={p.inn} set={(v) => set("inn", v)} />
        {p.kind === "organization" ? (
          <>
            <F label="КПП" value={p.kpp} set={(v) => set("kpp", v)} />
            <F label="ОГРН" value={p.ogrn} set={(v) => set("ogrn", v)} />
            <F
              label="Руководитель"
              value={p.director}
              set={(v) => set("director", v)}
            />
            <F
              label="Банк"
              value={p.bank_name}
              set={(v) => set("bank_name", v)}
            />
            <F
              label="Расчётный счёт"
              value={p.bank_account}
              set={(v) => set("bank_account", v)}
            />
            <F
              label="Корреспондентский счёт"
              value={p.correspondent_account}
              set={(v) => set("correspondent_account", v)}
            />
            <F label="БИК" value={p.bik} set={(v) => set("bik", v)} />
          </>
        ) : (
          <>
            <F
              label="Дата рождения"
              type="date"
              value={p.birth_date}
              set={(v) => set("birth_date", v)}
            />
            <F
              label="Серия паспорта"
              value={p.passport_series}
              set={(v) => set("passport_series", v)}
            />
            <F
              label="Номер паспорта"
              value={p.passport_number}
              set={(v) => set("passport_number", v)}
            />
            <F
              label="Дата выдачи"
              type="date"
              value={p.passport_issue_date}
              set={(v) => set("passport_issue_date", v)}
            />
            <F
              label="Код подразделения"
              value={p.division_code}
              set={(v) => set("division_code", v)}
            />
            <F
              label="Кем выдан"
              value={p.passport_issued_by}
              set={(v) => set("passport_issued_by", v)}
            />
          </>
        )}
        <F label="Телефон" value={p.phone} set={(v) => set("phone", v)} />
        <div className="wide">
          <F
            label={
              p.kind === "organization"
                ? "Юридический адрес"
                : "Адрес регистрации"
            }
            value={p.address}
            set={(v) => set("address", v)}
          />
        </div>
      </div>
    </Modal>
  );
}
function VehicleModal({
  value,
  parties,
  onClose,
  onSave,
}: {
  value: StockVehicle;
  parties: Counterparty[];
  onClose: () => void;
  onSave: (x: StockVehicle) => void;
}) {
  const empty = newVehicle(),
    [v, setV] = useState({
      ...empty,
      ...value,
      data: { ...empty.data, ...value.data },
    }),
    set = (k: keyof StockVehicle, x: string) => setV((p) => ({ ...p, [k]: x })),
    setData = (k: keyof DealData["vehicle"], x: string) =>
      setV((p) => ({ ...p, data: { ...p.data, [k]: x } }));
  return (
    <Modal title="Карточка автомобиля" onClose={onClose} save={() => onSave(v)}>
      <AttachmentPicker
        label="ПТС, СТС, ЭПТС и фотографии"
        files={v.attachments || []}
        onChange={(files) => setV((x) => ({ ...x, attachments: files }))}
      />
      <div className="catalog-grid">
        <F
          label="Марка и модель"
          value={v.make_model}
          set={(x) => set("make_model", x)}
        />
        <F label="VIN" value={v.vin} set={(x) => set("vin", x.toUpperCase())} />
        <F label="Год" value={v.year} set={(x) => set("year", x)} />
        <F label="Цвет" value={v.color} set={(x) => set("color", x)} />
        <F
          label="Госномер"
          value={v.registration_plate}
          set={(x) => set("registration_plate", x.toUpperCase())}
        />
        <F
          label="Категория ТС"
          value={v.data.category}
          set={(x) => setData("category", x)}
        />
        <F label="Тип ТС" value={v.data.type} set={(x) => setData("type", x)} />
        <F
          label="Двигатель"
          value={v.data.engine}
          set={(x) => setData("engine", x)}
        />
        <F
          label="Шасси / рама"
          value={v.data.chassis}
          set={(x) => setData("chassis", x)}
        />
        <F
          label="Номер кузова"
          value={v.data.body_number}
          set={(x) => setData("body_number", x)}
        />
        <F label="ПТС" value={v.pts} set={(x) => set("pts", x)} />
        <F
          label="ПТС выдан"
          value={v.data.pts_issued}
          set={(x) => setData("pts_issued", x)}
        />
        <F label="СТС" value={v.sts} set={(x) => set("sts", x)} />
        <F
          label="СТС выдан"
          value={v.data.sts_issued}
          set={(x) => setData("sts_issued", x)}
        />
        <F
          label="Особые отметки"
          value={v.data.special_notes}
          set={(x) => setData("special_notes", x)}
        />
        <label className="catalog-field">
          <span>Источник автомобиля</span>
          <select
            value={v.acquisition_type}
            onChange={(e) =>
              setV((x) => ({
                ...x,
                acquisition_type: e.target
                  .value as StockVehicle["acquisition_type"],
              }))
            }
          >
            {Object.entries(acquisitionTypes).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="catalog-field">
          <span>Статус</span>
          <select
            value={v.status}
            onChange={(e) =>
              setV((x) => ({
                ...x,
                status: e.target.value as StockVehicle["status"],
              }))
            }
          >
            {Object.entries(statuses).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="catalog-field wide">
          <span>Владелец</span>
          <select
            value={v.owner_id}
            onChange={(e) => set("owner_id", e.target.value)}
          >
            <option value="">Не указан</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
}
function DealModal({
  parties,
  vehicles,
  onAddParty,
  onAddVehicle,
  onClose,
  onCreate,
}: {
  parties: Counterparty[];
  vehicles: StockVehicle[];
  onAddParty: () => void;
  onAddVehicle: () => void;
  onClose: () => void;
  onCreate: (x: {
    type: DealRecord["type"];
    seller: string;
    buyer: string;
    vehicle: string;
    template?: File;
  }) => void;
}) {
  const [type, setType] = useState<DealRecord["type"]>("commission"),
    [seller, setSeller] = useState(""),
    [buyer, setBuyer] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [template,setTemplate]=useState<File|undefined>(),
    choose = (value: string, set: (x: string) => void, add: () => void) =>
      value === "__new__" ? add() : set(value);
  return (
    <Modal
      title="Новая сделка"
      onClose={onClose}
      save={() =>
        seller && vehicle && (!(type === "company_purchase" || type === "company_sale") || template) && onCreate({ type, seller, buyer, vehicle, template })
      }
    >
      <div className="catalog-grid">
        <label className="catalog-field wide">
          <span>Тип сделки</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DealRecord["type"])}
          >
            {Object.entries(dealTypes).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="catalog-field">
          <span>Продавец / доверитель</span>
          <select
            value={seller}
            onChange={(e) => choose(e.target.value, setSeller, onAddParty)}
          >
            <option value="">Выберите</option>
            <option value="__new__">＋ Добавить нового контрагента</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="catalog-field">
          <span>Покупатель</span>
          <select
            value={buyer}
            onChange={(e) => choose(e.target.value, setBuyer, onAddParty)}
          >
            <option value="">Не выбран</option>
            <option value="__new__">＋ Добавить нового контрагента</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="catalog-field wide">
          <span>Автомобиль</span>
          <select
            value={vehicle}
            onChange={(e) => choose(e.target.value, setVehicle, onAddVehicle)}
          >
            <option value="">Выберите автомобиль</option>
            <option value="__new__">＋ Добавить новый автомобиль</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make_model} · {v.vin}
              </option>
            ))}
          </select>
        </label>
        {(type === "company_purchase" || type === "company_sale")&&<label className="catalog-field wide"><span>Шаблон DOCX для этой сделки</span><input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e=>setTemplate(e.target.files?.[0])}/><small>{template?`Выбран: ${template.name}`:'Выберите или добавьте официальный DOCX-шаблон. Без него сделка не будет создана.'}</small></label>}
      </div>
    </Modal>
  );
}

function makeDeal(
  type: DealRecord["type"],
  sellerId: string,
  buyerId: string,
  vehicleId: string,
  parties: Counterparty[],
  vehicles: StockVehicle[],
  template?:File,
): DealRecord {
  const data: DealData = clone(EMPTY_DEAL),
    seller = parties.find((x) => x.id === sellerId),
    buyer = parties.find((x) => x.id === buyerId),
    vehicle = vehicles.find((x) => x.id === vehicleId),
    created = now();
  data.mode = type === "private_sale" ? "private" : "titan";
  if(template)data.selectedDocuments=['custom']
  data.seller = fromParty(seller);
  data.buyer = toBuyer(buyer);
  if (vehicle) data.vehicle = clone(vehicle.data);
  data.deal.contract_number = `${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  return {
    id: crypto.randomUUID(),
    number: data.deal.contract_number,
    type,
    status: "draft",
    seller_id: sellerId,
    buyer_id: buyerId,
    vehicle_id: vehicleId,
    data,
    created_at: created,
    updated_at: created,
    template_name:template?.name,
    template_file:template,
  };
}

