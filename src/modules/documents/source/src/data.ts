import type { DealData } from './types'

export const DOCUMENTS = [
  { id:'01', name:'Договор поручения', file:'01_Договор_поручения_ТИТАН_АВТО.docx' },
  { id:'02', name:'Допсоглашение — задаток / аванс', file:'02_Допсоглашение_задаток_аванс_обеспечительный_платеж.docx' },
  { id:'03', name:'Допсоглашение — ответственное хранение', file:'03_Допсоглашение_ответственное_хранение_ТС.docx' },
  { id:'04', name:'Допсоглашение — изменение условий', file:'04_Допсоглашение_изменение_условий_договора.docx' },
  { id:'05', name:'Уведомление о расторжении', file:'05_Уведомление_о_расторжении_договора_поручения.docx' },
  { id:'06', name:'Соглашение о расторжении', file:'06_Соглашение_о_расторжении_договора_поручения.docx' },
]

const today = new Date().toISOString().slice(0,10)
export const EMPTY_DEAL: DealData = {
  mode:'titan', selectedDocuments:['01','02','03'],
  deal:{ contract_number:'', city:'Самара', contract_date:today },
  seller:{ full_name:'',birth_date:'',inn:'',passport_series:'',passport_number:'',passport_issue_date:'',passport_issued_by:'',division_code:'',registration_address:'',phone:'' },
  buyer:{ full_name:'',birth_date:'',passport_series:'',passport_number:'',passport_issued_by:'',registration_address:'',phone:'' },
  vehicle:{ vin:'',category:'',type:'',make_model:'',year:'',engine:'',chassis:'',body_number:'',color:'',pts:'',pts_issued:'',sts:'',sts_issued:'',registration_plate:'',special_notes:'' },
  terms:{ price:'',commission:'',change_clause_number:'',change_clause_text:'',exclude_clause_number:'',add_clause_number:'',add_clause_text:'' },
  documentDates:Object.fromEntries(DOCUMENTS.map(d=>[d.id,today])), termination:{effective_date:today}
}
