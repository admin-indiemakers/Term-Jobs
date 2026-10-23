// Spreadsheet-bound script supplied for Waitlist, Contact, and Talent Network.
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.formType === 'Talent Network' && data.resumeBase64) {
      var decodedData = Utilities.base64Decode(data.resumeBase64.split(',')[1]);
      var blob = Utilities.newBlob(decodedData, data.resumeMimeType, data.resumeName);
      var file = DriveApp.createFile(blob);
      sheet.appendRow([
        data.timestamp, data.formType, data.name, data.email, file.getUrl()
      ]);
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (data.formType === 'Waitlist') {
      sheet.appendRow([
        data.timestamp || new Date().toLocaleString(), data.formType,
        data.name || '', data.email || '', data.company_name || data.topic || '',
        data.phone_number || '', data.requirements || '', data.referral_source || ''
      ]);
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    sheet.appendRow([
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
