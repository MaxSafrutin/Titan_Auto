import type { Counterparty, DealRecord, StockVehicle } from './types'
import { bridgeReady, saveThroughBridge } from './bridge'

const DB='titan-auto-documents',VERSION=2
type StoreName='counterparties'|'vehicles'|'deals'

const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(DB,VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const name of ['drafts','counterparties','vehicles','deals'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,name==='drafts'?undefined:{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
const txDone=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})

export async function listRecords<T>(store:StoreName){const db=await open();const rows=await new Promise<T[]>((resolve,reject)=>{const req=db.transaction(store).objectStore(store).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});db.close();return rows}
async function putLocal<T>(store:StoreName,value:T){const db=await open();const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);await txDone(tx);db.close()}
export async function putRecord<T>(store:StoreName,value:T){const saved=await saveThroughBridge(store,value);await putLocal(store,saved);return saved}
async function replaceStore<T>(store:StoreName,values:T[]){const db=await open();const tx=db.transaction(store,'readwrite'),bucket=tx.objectStore(store);bucket.clear();values.forEach(value=>bucket.put(value));await txDone(tx);db.close()}

export const newCounterparty=():Counterparty=>{const now=new Date().toISOString();return{id:crypto.randomUUID(),kind:'person',name:'',inn:'',kpp:'',ogrn:'',director:'',bank_name:'',bank_account:'',correspondent_account:'',bik:'',birth_date:'',passport_series:'',passport_number:'',passport_issue_date:'',passport_issued_by:'',division_code:'',address:'',phone:'',created_at:now,updated_at:now}}
export const newVehicle=():StockVehicle=>{const now=new Date().toISOString();return{id:crypto.randomUUID(),vin:'',make_model:'',year:'',color:'',registration_plate:'',pts:'',sts:'',status:'in_stock',owner_id:'',acquisition_type:'other',data:{vin:'',category:'',type:'',make_model:'',year:'',engine:'',chassis:'',body_number:'',color:'',pts:'',pts_issued:'',sts:'',sts_issued:'',registration_plate:'',special_notes:''},created_at:now,updated_at:now}}

let initialized=false
export async function loadCatalog(){if(!initialized){const payload=await bridgeReady;window.__TITAN_DOCUMENT_TEMPLATES__=payload.templates||{};window.__TITAN_COMPANY__=payload.company;await Promise.all([replaceStore('counterparties',payload.counterparties||[]),replaceStore('vehicles',payload.vehicles||[]),replaceStore('deals',payload.deals||[])]);initialized=true}const [counterparties,vehicles,deals]=await Promise.all([listRecords<Counterparty>('counterparties'),listRecords<StockVehicle>('vehicles'),listRecords<DealRecord>('deals')]);return{counterparties,vehicles,deals}}
