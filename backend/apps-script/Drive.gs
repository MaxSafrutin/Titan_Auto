var VEHICLE_FOLDERS = ['photos','documents','price-tags','stories','reports'];

function getRootFolder() {
  var id=PropertiesService.getScriptProperties().getProperty('ROOT_DRIVE_FOLDER_ID');
  if(!id)throw apiError('SETUP_REQUIRED','Не задан ROOT_DRIVE_FOLDER_ID.');
  return DriveApp.getFolderById(id);
}
function getOrCreateFolder(parent,name){var found=parent.getFoldersByName(name);return found.hasNext()?found.next():parent.createFolder(name);}
function ensureVehicleFolders(vehicleId){var vehicles=getOrCreateFolder(getRootFolder(),'VEHICLES');var root=getOrCreateFolder(vehicles,vehicleId);var folders={root:root.getId()};VEHICLE_FOLDERS.forEach(function(name){folders[name]=getOrCreateFolder(root,name).getId();});return folders;}
function ensureSystemFolders(){
  var root=getRootFolder();
  var templates=getOrCreateFolder(root,'TEMPLATES');
  return {
    vehicles:getOrCreateFolder(root,'VEHICLES').getId(),
    backups:getOrCreateFolder(root,'BACKUPS').getId(),
    exports:getOrCreateFolder(root,'EXPORTS').getId(),
    templates:templates.getId(),
    contract_templates:getOrCreateFolder(templates,'CONTRACTS').getId(),
    price_tag_templates:getOrCreateFolder(templates,'PRICE-TAGS').getId(),
    story_templates:getOrCreateFolder(templates,'STORIES').getId()
  };
}
function createBackup(){var folder=getOrCreateFolder(getRootFolder(),'BACKUPS');var source=DriveApp.getFileById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));var stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd_HH-mm');var copy=source.makeCopy('Titan Auto Data backup '+stamp,folder);return {file_id:copy.getId(),name:copy.getName(),url:copy.getUrl()};}
