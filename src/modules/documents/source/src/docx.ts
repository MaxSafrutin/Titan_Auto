import JSZip from "jszip";
import { DOCUMENTS } from "./data";
import type { DealData, ScanAttachment } from "./types";
import { download } from "./storage";
import { renderAsync } from "docx-preview";
import { renderPdfImages } from "./pdf-render";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const months = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
function protectedTemplate(file:string){
  const dataUrl=window.__TITAN_DOCUMENT_TEMPLATES__?.[file];
  if(!dataUrl)throw new Error(`Защищённый шаблон не найден: ${file}`);
  const base64=dataUrl.split(',')[1]||'',bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
  return bytes.buffer;
}
function directorShort(name:string){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  return [parts[0]||'',parts.slice(1,3).map(part=>`${part[0]}.`).join('')].filter(Boolean).join(' ');
}
const dateParts = (iso: string) => {
  const [y, m, d] = (iso || "--").split("-");
  return { day: d || "", month: months[Number(m) - 1] || "", year: y || "" };
};

function replaceAcross(nodes: Element[], token: string, value: string) {
  let joined = nodes.map((n) => n.textContent || "").join(""),
    from = 0;
  while (true) {
    const at = joined.indexOf(token, from);
    if (at < 0) break;
    let pos = 0,
      first = -1,
      last = -1,
      startOffset = 0,
      endOffset = 0;
    nodes.forEach((n, i) => {
      const len = (n.textContent || "").length;
      if (first < 0 && pos + len > at) {
        first = i;
        startOffset = at - pos;
      }
      if (pos < at + token.length && pos + len >= at + token.length) {
        last = i;
        endOffset = at + token.length - pos;
      }
      pos += len;
    });
    if (first < 0 || last < 0) break;
    const before = (nodes[first].textContent || "").slice(0, startOffset),
      after = (nodes[last].textContent || "").slice(endOffset);
    nodes[first].textContent = before + value + (first === last ? after : "");
    if (value) {
      const run = nodes[first].parentElement;
      if (run) {
        let props = [...run.children].find((x) => x.localName === "rPr");
        if (!props) {
          props = run.ownerDocument.createElementNS(W, "w:rPr");
          run.insertBefore(props, run.firstChild);
        }
        for (const old of [...props.children].filter(
          (x) => x.localName === "color" || x.localName === "b",
        ))
          props.removeChild(old);
        const color = run.ownerDocument.createElementNS(W, "w:color");
        color.setAttributeNS(W, "w:val", "000000");
        const bold = run.ownerDocument.createElementNS(W, "w:b");
        bold.setAttributeNS(W, "w:val", "1");
        props.append(color, bold);
      }
    }
    for (let i = first + 1; i < last; i++) nodes[i].textContent = "";
    if (last > first) nodes[last].textContent = after;
    joined = nodes.map((n) => n.textContent || "").join("");
    from = at + value.length;
  }
}

function genericValues(id: string, text: string, d: DealData) {
  const c = dateParts(d.deal.contract_date),
    doc = dateParts(d.documentDates[id] || d.deal.contract_date),
    eff = dateParts(d.termination.effective_date);
  if (text.includes("Дополнительное соглашениек"))
    return [d.deal.contract_number, c.day, c.month];
  if (text.includes("Общество с ограниченной ответственностью"))
    return id === "06"
      ? [d.seller.full_name, d.seller.birth_date]
      : [
          d.seller.full_name,
          d.seller.birth_date,
          d.deal.contract_number,
          c.day,
          c.month,
        ];
  if (text.includes("неотъемлемой частью"))
    return [d.deal.contract_number, c.day, c.month];
  if (text.startsWith("Изменить п."))
    return [d.terms.change_clause_number, d.terms.change_clause_text];
  if (text.startsWith("Исключить п.")) return [d.terms.exclude_clause_number];
  if (text.startsWith("Дополнить Договор"))
    return [d.terms.add_clause_number, d.terms.add_clause_text];
  if (id === "05") {
    if (text.startsWith("о расторжении"))
      return [d.deal.contract_number, c.month];
    if (text.startsWith("Между "))
      return [d.seller.full_name, d.deal.contract_number, c.month];
    if (text.startsWith("Руководствуясь"))
      return [d.deal.contract_number, c.month];
    if (text.startsWith("Соглашение о расторжении"))
      return [d.deal.contract_number, c.month];
    if (text.includes("/")) return ["", directorShort(window.__TITAN_COMPANY__?.director||"")];
  }
  if (id === "06") {
    if (text.startsWith("Договора поручения"))
      return [d.deal.contract_number, c.month];
    if (text.startsWith("1. Стороны"))
      return [d.deal.contract_number, "", c.month, c.year.slice(-2)];
    if (text.startsWith("2. Последним"))
      return [d.deal.contract_number, c.month, eff.month, eff.year.slice(-2)];
  }
  return [];
}

function transformXml(xmlText: string, id: string, d: DealData) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  const paras = [...xml.getElementsByTagNameNS(W, "p")];
  for (const p of paras) {
    let nodes = [...p.getElementsByTagNameNS(W, "t")],
      text = nodes.map((n) => n.textContent || "").join("");
    if (
      id === "04" &&
      ((text.startsWith("Изменить п.") &&
        !d.terms.change_clause_number &&
        !d.terms.change_clause_text) ||
        (text.startsWith("Исключить п.") && !d.terms.exclude_clause_number) ||
        (text.startsWith("Дополнить Договор") &&
          !d.terms.add_clause_number &&
          !d.terms.add_clause_text))
    ) {
      p.parentNode?.removeChild(p);
      continue;
    }
    const doc = dateParts(d.documentDates[id] || d.deal.contract_date),
      contract = dateParts(d.deal.contract_date);
    const named: Record<string, string> = {
      "[НОМЕР ДОГОВОРА]": d.deal.contract_number,
      "[ГОРОД]": d.deal.city,
      "[ДЕНЬ]": doc.day,
      "[МЕСЯЦ]": doc.month,
      "[Фамилия Имя Отчество]": d.seller.full_name,
      "[ИНН]": d.seller.inn,
      "[СЕРИЯ И НОМЕР ПАСПОРТА]":
        `${d.seller.passport_series} ${d.seller.passport_number}`.trim(),
      "[КЕМ ВЫДАН ПАСПОРТ]": d.seller.passport_issued_by,
      "[ДАТА ВЫДАЧИ]": d.seller.passport_issue_date,
      "[КОД ПОДРАЗДЕЛЕНИЯ]": d.seller.division_code,
      "[АДРЕС РЕГИСТРАЦИИ]": d.seller.registration_address,
      "[ТЕЛЕФОН]": d.seller.phone,
      "[ИДЕНТИФИКАЦИОННЫЙ НОМЕР (VIN)]": d.vehicle.vin,
      "[НАИМЕНОВАНИЕ (ТИП ТС)]": d.vehicle.type,
      "[МАРКА, МОДЕЛЬ ТС]": d.vehicle.make_model,
      "[ГОД ИЗГОТОВЛЕНИЯ ТС]": d.vehicle.year,
      "[МОДЕЛЬ И НОМЕР ДВИГАТЕЛЯ]": d.vehicle.engine,
      "[ШАССИ (РАМА) №]": d.vehicle.chassis,
      "[КУЗОВ (КАБИНА, ПРИЦЕП) №]": d.vehicle.body_number,
      "[ЦВЕТ КУЗОВА (КАБИНЫ, ПРИЦЕПА)]": d.vehicle.color,
      "[ПАСПОРТ ТРАНСПОРТНОГО СРЕДСТВА (ДАЛЕЕ – ПТС)]": d.vehicle.pts,
      "[СВИДЕТЕЛЬСТВО О РЕГИСТРАЦИИ]": d.vehicle.sts,
      "[РЕГИСТРАЦИОННЫЙ ЗНАК]": d.vehicle.registration_plate,
      "[ОСОБЫЕ ОТМЕТКИ]": d.vehicle.special_notes,
      "[ПОДПИСЬ]": "",
      "[РАСШИФРОВКА ПОДПИСИ]": d.seller.full_name,
      "[ЦЕНА РЕАЛИЗАЦИИ]": d.terms.price,
      "[ЦЕНА РЕАЛИЗАЦИИ ПРОПИСЬЮ]": moneyWords(d.terms.price),
      "[ВОЗНАГРАЖДЕНИЕ]": d.terms.commission,
      "[ВОЗНАГРАЖДЕНИЕ ПРОПИСЬЮ]": moneyWords(d.terms.commission),
    };
    Object.entries(named).forEach(([token, value]) =>
      replaceAcross(nodes, token, value),
    );
    text = nodes.map((n) => n.textContent || "").join("");
    const values = genericValues(id, text, d);
    values.forEach((value) => replaceAcross(nodes, "[ВВЕСТИ ДАННЫЕ]", value));
    if ((id === "05" || id === "06") && text.includes("«__»"))
      replaceAcross(nodes, "__", contract.day);
    const year =
      text.includes("Договор") && !text.match(/^«\[/)
        ? contract.year
        : doc.year;
    replaceAcross(nodes, "[ГОД]", year);
  }
  return new XMLSerializer().serializeToString(xml);
}

function moneyWords(value: string) {
  const n = Math.max(0, Math.trunc(Number(value) || 0));
  if (!n) return "";
  const ones = [
    [
      "",
      "один",
      "два",
      "три",
      "четыре",
      "пять",
      "шесть",
      "семь",
      "восемь",
      "девять",
    ],
    [
      "",
      "одна",
      "две",
      "три",
      "четыре",
      "пять",
      "шесть",
      "семь",
      "восемь",
      "девять",
    ],
  ];
  const teens = [
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
  ];
  const tens = [
    "",
    "",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
  ];
  const hundreds = [
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
  ];
  const groups = [
    ["", "", "", 0],
    ["тысяча", "тысячи", "тысяч", 1],
    ["миллион", "миллиона", "миллионов", 0],
    ["миллиард", "миллиарда", "миллиардов", 0],
  ] as const;
  const out: string[] = [];
  let rest = n,
    level = 0;
  while (rest && level < groups.length) {
    const part = rest % 1000;
    if (part) {
      const words: string[] = [];
      words.push(hundreds[Math.floor(part / 100)]);
      const last2 = part % 100;
      if (last2 >= 10 && last2 < 20) words.push(teens[last2 - 10]);
      else {
        words.push(tens[Math.floor(last2 / 10)]);
        words.push(ones[groups[level][3]][last2 % 10]);
      }
      if (level) {
        const last = part % 10,
          lastTwo = part % 100;
        const form =
          lastTwo >= 11 && lastTwo <= 19
            ? 2
            : last === 1
              ? 0
              : last >= 2 && last <= 4
                ? 1
                : 2;
        words.push(groups[level][form]);
      }
      out.unshift(...words.filter(Boolean));
    }
    rest = Math.floor(rest / 1000);
    level++;
  }
  return out.join(" ");
}

export function validateDeal(d: DealData) {
  const errors: string[] = [];
  if (d.mode === "titan" && !d.deal.contract_number)
    errors.push("номер договора");
  if (!d.seller.full_name) errors.push("ФИО продавца");
  if (!d.seller.passport_series || !d.seller.passport_number)
    errors.push("паспорт продавца");
  if (
    d.mode === "private" &&
    (!d.buyer.full_name || !d.buyer.passport_series || !d.buyer.passport_number)
  )
    errors.push("данные покупателя");
  if (!d.vehicle.vin || d.vehicle.vin.length !== 17)
    errors.push("VIN из 17 символов");
  if (!d.vehicle.pts && !d.vehicle.sts) errors.push("ПТС или СТС");
  if (!d.terms.price) errors.push("цена автомобиля");
  if (
    d.mode === "titan" &&
    d.selectedDocuments.includes("01") &&
    !d.terms.commission
  )
    errors.push("вознаграждение");
  return errors;
}

export async function createPackage(
  d: DealData,
  scans: ScanAttachment[],
  customTemplate?: File,
  save = true,
) {
  if (d.mode === "private") return createPrivatePackage(d, scans, save);
  const output = new JSZip(),
    copies = ["01_Покупателю", "02_Продавцу", "03_ТИТАН_АВТО"];
  for (const id of d.selectedDocuments) {
    const meta =
      id === "custom" && customTemplate
        ? { id: "custom", name: customTemplate.name, file: customTemplate.name }
        : DOCUMENTS.find((x) => x.id === id)!;
    let source: ArrayBuffer;
    if (id === "custom" && customTemplate)
      source = await customTemplate.arrayBuffer();
    else {
      source = protectedTemplate(meta.file);
    }
    const zip = await JSZip.loadAsync(source);
    for (const name of Object.keys(zip.files).filter((n) =>
      /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
    )) {
      const text = await zip.file(name)!.async("text");
      zip.file(name, transformXml(text, id, d));
    }
    const result = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });
    for (const copy of copies) output.file(`${copy}/${meta.file}`, result);
  }
  for (const copy of copies)
    for (const scan of scans)
      output.file(`${copy}/Сканы/${scan.kind}_${scan.file.name}`, scan.file);
  output.file(
    "Данные_сделки.json",
    JSON.stringify({ version: 1, data: d }, null, 2),
  );
  const blob = await output.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  if (save) await download(blob, packageName(d));
  return blob;
}

async function createPrivatePackage(
  d: DealData,
  scans: ScanAttachment[],
  save = true,
) {
  const file = "07_ДКП_между_физическими_лицами.docx";
  const zip = await JSZip.loadAsync(protectedTemplate(file)),
    date = dateParts(d.documentDates["07"] || d.deal.contract_date);
  const tokenValues: Record<string, string> = {
    "[ГОРОД]": d.deal.city,
    "[ДЕНЬ]": date.day,
    "[МЕСЯЦ]": date.month,
    "[ГОД 2 ЦИФРЫ]": date.year.slice(-2),
    "[ПРОДАВЕЦ ФИО]": d.seller.full_name,
    "[ПРОДАВЕЦ ДАТА РОЖДЕНИЯ]": d.seller.birth_date,
    "[ПРОДАВЕЦ АДРЕС]": d.seller.registration_address,
    "[ПРОДАВЕЦ СЕРИЯ ПАСПОРТА]": d.seller.passport_series,
    "[ПРОДАВЕЦ НОМЕР ПАСПОРТА]": d.seller.passport_number,
    "[ПРОДАВЕЦ ПАСПОРТ ВЫДАН]": d.seller.passport_issued_by,
    "[ПОКУПАТЕЛЬ ФИО]": d.buyer.full_name,
    "[ПОКУПАТЕЛЬ ДАТА РОЖДЕНИЯ]": d.buyer.birth_date,
    "[ПОКУПАТЕЛЬ АДРЕС]": d.buyer.registration_address,
    "[ПОКУПАТЕЛЬ СЕРИЯ ПАСПОРТА]": d.buyer.passport_series,
    "[ПОКУПАТЕЛЬ НОМЕР ПАСПОРТА]": d.buyer.passport_number,
    "[ПОКУПАТЕЛЬ ПАСПОРТ ВЫДАН]": d.buyer.passport_issued_by,
    "[МАРКА МОДЕЛЬ]": d.vehicle.make_model,
    "[КАТЕГОРИЯ ТС]": d.vehicle.category,
    "[ТИП ТС]": d.vehicle.type,
    "[РЕГИСТРАЦИОННЫЙ ЗНАК]": d.vehicle.registration_plate,
    "[VIN]": d.vehicle.vin,
    "[ГОД ВЫПУСКА]": d.vehicle.year,
    "[ДВИГАТЕЛЬ]": d.vehicle.engine,
    "[ШАССИ]": d.vehicle.chassis,
    "[КУЗОВ]": d.vehicle.body_number,
    "[ЦВЕТ]": d.vehicle.color,
    "[ПТС СЕРИЯ]": d.vehicle.pts.split(/\s+/)[0] || "",
    "[ПТС НОМЕР]": d.vehicle.pts.split(/\s+/).slice(1).join(" "),
    "[ПТС ВЫДАН]": d.vehicle.pts_issued,
    "[СТС СЕРИЯ]": d.vehicle.sts.split(/\s+/)[0] || "",
    "[СТС НОМЕР]": d.vehicle.sts.split(/\s+/).slice(1).join(" "),
    "[СТС ВЫДАН]": d.vehicle.sts_issued,
    "[ЦЕНА]": d.terms.price,
    "[ЦЕНА ПРОПИСЬЮ]": moneyWords(d.terms.price),
    "[ПРОДАВЕЦ ПОДПИСЬ ФИО]": d.seller.full_name,
    "[ПОКУПАТЕЛЬ ПОДПИСЬ ФИО]": d.buyer.full_name,
    "[ПРОДАВЕЦ ТЕЛЕФОН]": d.seller.phone,
    "[ПОКУПАТЕЛЬ ТЕЛЕФОН]": d.buyer.phone,
  };
  for (const name of Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
  )) {
    const xml = new DOMParser().parseFromString(
        await zip.file(name)!.async("text"),
        "application/xml",
      ),
      nodes = [...xml.getElementsByTagNameNS(W, "t")];
    for (const [token, value] of Object.entries(tokenValues))
      replaceAcross(nodes, token, value);
    zip.file(name, new XMLSerializer().serializeToString(xml));
  }
  const result = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    }),
    output = new JSZip(),
    copies = ["01_Покупателю", "02_Продавцу", "03_Для_ГИБДД"];
  for (const copy of copies) {
    output.file(`${copy}/ДКП_между_физическими_лицами.docx`, result);
    for (const scan of scans)
      output.file(`${copy}/Сканы/${scan.kind}_${scan.file.name}`, scan.file);
  }
  output.file(
    "Данные_сделки.json",
    JSON.stringify({ version: 1, data: d }, null, 2),
  );
  const blob = await output.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  if (save) await download(blob, packageName(d));
  return blob;
}

function packageName(d: DealData) {
  const date = (
      d.deal.contract_date || new Date().toISOString().slice(0, 10)
    ).replaceAll("-", "."),
    safe = (x: string) =>
      x
        .replace(/[<>:"/\\|?*]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    short = (name: string) => {
      const p = name.trim().split(/\s+/);
      return p.length > 1
        ? `${p[0]} ${p
            .slice(1)
            .map((x) => `${x[0] || ""}.`)
            .join(" ")}`
        : p[0] || "Не указан";
    },
    seller = short(d.seller.full_name),
    buyer = d.buyer.full_name ? short(d.buyer.full_name) : "ТА";
  return `${date} ${safe(d.vehicle.make_model || "Автомобиль")} — ${safe(seller)} и ${safe(buyer)}.zip`;
}

export async function printPackage(
  d: DealData,
  scans: ScanAttachment[],
  customTemplate?: File,
) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Браузер заблокировал окно печати");
  popup.document.write(
    '<title>Печать комплекта</title><style>@page{size:A4;margin:0}.doc{break-after:page}.separator{height:297mm;break-after:page}.scan{width:100%;height:297mm;object-fit:contain;break-after:page}body{margin:0;background:white}</style><p id="loading">Подготовка комплекта…</p>',
  );
  const archive = await createPackage(d, scans, customTemplate, false),
    zip = await JSZip.loadAsync(archive),
    names = Object.keys(zip.files)
      .filter((x) => x.toLowerCase().endsWith(".docx"))
      .sort(),
    root = popup.document.body;
  root.innerHTML = "";
  const scanSources:string[]=[]
  for(const scan of scans){if(scan.file.type==='application/pdf')scanSources.push(...await renderPdfImages(scan.file));else if(scan.file.type.startsWith('image/'))scanSources.push(URL.createObjectURL(scan.file))}
  const copies=[...new Set(names.map(name=>name.split('/')[0]))]
  for (const [copyIndex,copy] of copies.entries()) {
    if (copyIndex) {
      const separator = popup.document.createElement("div");
      separator.className = "separator";
      root.append(separator);
    }
    for(const name of names.filter(name=>name.startsWith(`${copy}/`))){const section = popup.document.createElement("section");section.className = "doc";root.append(section);await renderAsync(await zip.file(name)!.async("arraybuffer"),section,undefined,{ inWrapper: false, breakPages: true })}
    for (const source of scanSources) {
      const img = popup.document.createElement("img");
      img.className = "scan";
      img.src = source;
      root.append(img);
    }
  }
  setTimeout(() => {
    popup.focus();
    popup.print();
  }, 700);
}
