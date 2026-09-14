export type ParticipationMode = 'titan' | 'private'

export interface DealData {
  mode: ParticipationMode
  selectedDocuments: string[]
  deal: { contract_number: string; city: string; contract_date: string }
  seller: { full_name: string; birth_date: string; inn: string; passport_series: string; passport_number: string; passport_issue_date: string; passport_issued_by: string; division_code: string; registration_address: string; phone: string }
  buyer: { full_name: string; birth_date: string; passport_series: string; passport_number: string; passport_issued_by: string; registration_address: string; phone: string }
  vehicle: { vin: string; category: string; type: string; make_model: string; year: string; engine: string; chassis: string; body_number: string; color: string; pts: string; pts_issued: string; sts: string; sts_issued: string; registration_plate: string; special_notes: string }
  terms: { price: string; commission: string; change_clause_number: string; change_clause_text: string; exclude_clause_number: string; add_clause_number: string; add_clause_text: string }
  documentDates: Record<string, string>
  termination: { effective_date: string }
}

export interface ScanAttachment { id: string; file: File; kind: 'passport' | 'vehicle' | 'other' }

export interface Counterparty {
  id: string
  kind: 'person' | 'organization'
  name: string
  inn: string
  birth_date: string
  passport_series: string
  passport_number: string
  passport_issue_date: string
  passport_issued_by: string
  division_code: string
  address: string
  phone: string
  kpp: string
  ogrn: string
  director: string
  bank_name: string
  bank_account: string
  correspondent_account: string
  bik: string
  is_own_company?: boolean
  attachments?: File[]
  created_at: string
  updated_at: string
}

export interface StockVehicle {
  id: string
  vin: string
  make_model: string
  year: string
  color: string
  registration_plate: string
  pts: string
  sts: string
  status: 'in_stock' | 'consignment' | 'reserved' | 'sold' | 'archived'
  owner_id: string
  acquisition_type: 'purchase' | 'commission' | 'other'
  data: DealData['vehicle']
  attachments?: File[]
  created_at: string
  updated_at: string
}

export interface DealRecord {
  id: string
  number: string
  type: 'commission' | 'private_sale' | 'company_purchase' | 'company_sale' | 'termination'
  status: 'draft' | 'completed' | 'cancelled'
  seller_id: string
  buyer_id: string
  vehicle_id: string
  data: DealData
  created_at: string
  updated_at: string
  template_name?: string
  template_file?: File
}
