// Spreadsheet-bound script supplied for Waitlist, Contact, and Talent Network.
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.formType === 'Talent Network' && data.resumeBase64) {
      var decodedData = Utilities.base64Decode(data.resumeBase64.split(',')[1]);
      var blob = Utilities.newBlob(decodedData, data.resumeMimeType, data.resumeName);
      var file = DriveApp.createFile(blob);
      appendTextRow(sheet, [
        data.timestamp, data.formType, data.name, data.email, file.getUrl()
      ]);
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (data.formType === 'Waitlist') {
      appendTextRow(sheet, [
        data.timestamp || new Date().toLocaleString(), data.formType,
        data.name || '', data.email || '', data.company_name || data.topic || '',
        data.phone_number || '', data.requirements || '', data.referral_source || ''
      ]);
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    appendTextRow(sheet, [
      data.timestamp || new Date().toLocaleString(),
      data.formType || 'Unknown',
      data.name || '',
      data.email || '',
      data.topic || '',
      data.message || ''
    ]);
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function authorizeDrive() {
  DriveApp.getRootFolder();
}

// Write literal text so phone numbers, leading zeroes and formula-like input
// remain the submitted values instead of being evaluated by Google Sheets.
function appendTextRow(sheet, values) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var nextRow = sheet.getLastRow() + 1;
    var maxRows = sheet.getMaxRows();
    if (nextRow > maxRows) sheet.insertRowsAfter(maxRows, nextRow - maxRows);
    var cells = values.map(function(value) {
      return SpreadsheetApp.newRichTextValue()
        .setText(value == null ? '' : String(value)).build();
    });
    sheet.getRange(nextRow, 1, 1, cells.length)
      .setNumberFormat('@').setRichTextValues([cells]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}
