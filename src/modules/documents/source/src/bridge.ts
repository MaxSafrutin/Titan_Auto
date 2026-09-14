import type { Counterparty, DealRecord, StockVehicle } from './types'
type CatalogPayload={company?:Counterparty;counterparties:Counterparty[];vehicles:StockVehicle[];deals:DealRecord[];templates:Record<string,string>}
let resolveReady:(value:CatalogPayload)=>void
export const bridgeReady=new Promise<CatalogPayload>(resolve=>{resolveReady=resolve})
const pending=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>()
addEventListener('message',event=>{
  if(event.origin!==location.origin)return
  if(event.data?.type==='TITAN_DOCUMENTS_LOAD')resolveReady(event.data.payload as CatalogPayload)
  if(event.data?.type==='TITAN_DOCUMENTS_SAVE_RESULT'){
    const item=pending.get(event.data.request_id);if(!item)return;pending.delete(event.data.request_id)
    if(event.data.error)item.reject(new Error(event.data.error));else item.resolve(event.data.value)
  }
})
export function saveThroughBridge<T>(store:string,value:T){
  if(window.parent===window)return Promise.resolve(value)
  const request_id=crypto.randomUUID()
  return new Promise<T>((resolve,reject)=>{pending.set(request_id,{resolve:resolve as (value:unknown)=>void,reject});window.parent.postMessage({type:'TITAN_DOCUMENTS_SAVE',request_id,store,value},location.origin)})
}
declare global { interface Window { __TITAN_DOCUMENT_TEMPLATES__?:Record<string,string>;__TITAN_COMPANY__?:Counterparty } }
if(window.parent===window)setTimeout(()=>resolveReady({counterparties:[],vehicles:[],deals:[],templates:{}}),0)
