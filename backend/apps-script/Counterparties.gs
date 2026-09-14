function counterpartyList(filters) {
  var q=String((filters||{}).q||'');
  return sortNewest(listRecords('COUNTERPARTIES').map(counterpartyHydrate).filter(function(x){return !q||containsQuery(x,q,['counterparty_id','name','inn','phone','passport_number']);}));
}
function counterpartyHydrate(row){var extra=jsonParse(row.payload_json,{});var data=cleanObject(Object.assign({},extra,row));data.id=data.counterparty_id;return data;}
function counterpartyCreate(payload,session){
  requireFields(payload,['name']);var timestamp=nowIso(),data=cleanObject(payload);data.counterparty_id=nextId('COUNTERPARTY','CP');data.created_at=timestamp;data.updated_at=timestamp;data.payload_json=JSON.stringify(cleanObject(payload));appendRecord('COUNTERPARTIES',data);auditChanges(session,'COUNTERPARTY',data.counterparty_id,'CREATE',{},data);return counterpartyHydrate(data);
}
function counterpartyUpdate(id,changes,session){
  var before=findRecord('COUNTERPARTIES','counterparty_id',id);if(!before)throw apiError('COUNTERPARTY_NOT_FOUND','Контрагент не найден.');var data=cleanObject(changes);delete data.id;delete data.counterparty_id;delete data.created_at;data.updated_at=nowIso();data.payload_json=JSON.stringify(Object.assign({},jsonParse(before.payload_json,{}),data));var after=updateRecord('COUNTERPARTIES','counterparty_id',id,data);auditChanges(session,'COUNTERPARTY',id,'UPDATE',before,after);return counterpartyHydrate(after);
}
