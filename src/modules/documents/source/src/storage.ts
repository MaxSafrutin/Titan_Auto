import type { DealData } from './types'
import { EMPTY_DEAL } from './data'

const DB='titan-auto-documents', STORE='drafts', KEY='current'
const openDb=()=>new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(DB,2);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
export async function saveDraft(data: DealData){const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(data,KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()}
export async function loadDraft(){const db=await openDb();const value=await new Promise<DealData|undefined>((resolve,reject)=>{const req=db.transaction(STORE).objectStore(STORE).get(KEY);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});db.close();return value}
const dealJson=(data:DealData)=>JSON.stringify({format:'titan-auto-deal',version:1,saved_at:new Date().toISOString(),data},null,2)
const dealName=(data:DealData)=>`Сделка_${data.deal.contract_number||data.vehicle.vin||'черновик'}.titan-deal.json`
export function exportDeal(data: DealData){download(new Blob([dealJson(data)],{type:'application/json'}),dealName(data))}
export async function saveDealFile(data:DealData){
  const picker=(window as Window & {showSaveFilePicker?: (options:unknown)=>Promise<{createWritable:()=>Promise<{write:(data:string)=>Promise<void>;close:()=>Promise<void>}>}>}).showSaveFilePicker
  if(!picker){exportDeal(data);return 'Файл сохранён через загрузки браузера'}
  const handle=await picker({suggestedName:dealName(data),types:[{description:'Файл сделки ТИТАН АВТО',accept:{'application/json':['.json']}}]})
  const writable=await handle.createWritable();await writable.write(dealJson(data));await writable.close();return 'Файл сделки сохранён'
}
export async function importDeal(file: File){
  const parsed=JSON.parse(await file.text());if(parsed?.format!=='titan-auto-deal'||parsed?.version!==1)throw new Error('Неподдерживаемый файл сделки')
  const old=parsed.data as Partial<DealData>,base=structuredClone(EMPTY_DEAL)
  return {...base,...old,deal:{...base.deal,...old.deal},seller:{...base.seller,...old.seller},buyer:{...base.buyer,...old.buyer},vehicle:{...base.vehicle,...old.vehicle},terms:{...base.terms,...old.terms},termination:{...base.termination,...old.termination},documentDates:{...base.documentDates,...old.documentDates}} as DealData
}
export async function download(blob: Blob,name:string){const picker=(window as any).showSaveFilePicker;if(picker){try{const ext=name.toLowerCase().endsWith('.zip')?'.zip':'.json',mime=ext==='.zip'?'application/zip':'application/json',handle=await picker({id:ext==='.zip'?'titan-auto-print-packages':'titan-auto-json',suggestedName:name,types:[{description:ext==='.zip'?'Пакет документов ТИТАН АВТО':'JSON ТИТАН АВТО',accept:{[mime]:[ext]}}]});const writable=await handle.createWritable();await writable.write(blob);await writable.close();return}catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;throw error}}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
