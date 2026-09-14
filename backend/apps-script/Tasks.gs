function taskList(filters) {
  return sortNewest(listRecordsLite('TASKS').filter(function(x){return (!(filters||{}).vehicle_id||String(x.vehicle_id)===String(filters.vehicle_id))&&(!(filters||{}).lead_id||String(x.lead_id)===String(filters.lead_id));}));
}
function taskCreate(payload,session){requireFields(payload,['title']);var t=nowIso();var data=cleanObject(payload);data.task_id=nextId('TASK','TASK');data.created_at=t;data.updated_at=t;data.status=data.status||'open';data.assignee=data.assignee||session.user;appendRecord('TASKS',data);auditChanges(session,'TASK',data.task_id,'CREATE',{},data);return data;}
function taskUpdate(id,changes,session){var before=findRecord('TASKS','task_id',id);if(!before)throw apiError('TASK_NOT_FOUND','Задача не найдена.');var data=cleanObject(changes);delete data.task_id;delete data.created_at;data.updated_at=nowIso();var after=updateRecord('TASKS','task_id',id,data);auditChanges(session,'TASK',id,'UPDATE',before,after);return after;}
