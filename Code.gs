const monitoringSpreadsheetId = "1iBh7bVtxBykPTX7SduUhkjVH3UmKYcLl9mD27MmDiwo";
const encryptedSpreadsheetId = "1Uij5GC-HJB4wd8xMAgtxUe6QBSEkt_vsjCtuRHhok3M";
const startHallpassFormId = "1UWpVPJMuxI59gPyVsyzk705nS3Cx1TybNy1za2ZJBCk";
const endHallpassFormId = "1F0ON83xXhjq6r7CHFjfv8W_QO4uW0cuJVw60JD7_vh4";

// pass[0]: form response id
// pass[1]: start time
// pass[2]: email
// pass[3]: destination
// pass[4]: status

// formItemResponses[0]: destination

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .getContent();
}
function doGet(e) {
  const profile = Session.getActiveUser();
  const t = HtmlService.createTemplateFromFile('Index')
  t.email = profile.getEmail(); // This is null if the 'email' scope is not present.
  t.encryptedSpreadsheetId = encryptedSpreadsheetId;
  t.startHallpassFormId = startHallpassFormId;
  t.endHallpassFormId = endHallpassFormId;
  t.hallpassAppUrl = ScriptApp.getService().getUrl();
  const output = t.evaluate();
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}
function doPost(e) {
  const profile = Session.getActiveUser();
  const t = HtmlService.createTemplateFromFile('Index')
  const email = profile.getEmail(); // This is null if the 'email' scope is not present.
  if (e.parameter.action === 'activate') {
    const pass = getPassFromId(e.parameter.passId);
    activatePass(pass);
  }
  t.email = email;
  t.encryptedSpreadsheetId = encryptedSpreadsheetId;
  t.hallpassAppUrl = ScriptApp.getService().getUrl();
  const output = t.evaluate();
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

function toHexString(signature) {
  return signature
    .map(function(byte) {
        // Convert from 2's compliment
        var v = (byte < 0) ? 256 + byte : byte;

        // Convert byte to hexadecimal
        return ("0" + v.toString(16)).slice(-2);
    })
    .join("");
}
function any(bools) {
    return bools.reduce((acc, bool) => acc || bool, false);
}
function isToday(someDate) {
  const today = new Date();
  return someDate.getDate() == today.getDate() &&
    someDate.getMonth() == today.getMonth() &&
    someDate.getFullYear() == today.getFullYear();
}
function padWholeNumber(num, size) {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
}
function passAllowed(pass) {
  const passStartTime = new Date(pass[1]);
  const delta = 600000;
  function getDatetime([hours, mins]) {
    const datetime = new Date();
    datetime.setHours(hours, mins);
    return datetime;
  }
  const periodStartTimes = [[8,40],[9,21],[10,2],[10,43],[11,24],[11,55],[12,26],[12,57],[1,38],[2,19]].map(getDatetime);
  const periodEndTimes = [[9,20],[10,1],[10,42],[11,23],[11,54],[12,25],[12,56],[1,37],[2,18],[2,59]].map(getDatetime);
  return !(
    any(periodStartTimes.map(function(periodStartTime){
      return (passStartTime - periodStartTime) > 0 && (passStartTime - periodStartTime) < delta;
    })) ||
    any(periodEndTimes.map(function(periodEndTime){
      return (periodEndTime - passStartTime) > 0 && (periodEndTime - passStartTime) < delta;
    }))
  );
}
function getMostRecentActivePassRowNumber(data, email) {
  var mostRecentRow;
  var mostRecentRowNumber;
  var nRows = data.length;
  for (var r = 1; r < nRows; r++) {
    var row = data[r];
    if (row[1] === toHexString(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)) && isToday(new Date(row[0])) && row[3] === "active" && (row[0] > mostRecentRow?.[0] || mostRecentRow === undefined)) {
      mostRecentRow = row;
      mostRecentRowNumber = r+1;
    }
  }
  return mostRecentRowNumber;
}
function getMyPassesFromToday(sheet, email, encrypted = false) {
  const data = sheet.getDataRange().getValues();
  const nRows = data.length;
  const passes = [];
  if (encrypted) {
    email === sha256(email);
  }
  // Get today's most recent active pass for this user
  for (var i = 1; i < nRows; i++) {
      var pass = data[i];
      pass.push(i);
      if (pass[2] === email && isToday(new Date(pass[1]))) {
        passes.push(pass);
      }
  }
  return passes;
}
function getMostRecentPass(passes) {
  console.log(passes);
  var mostRecentPass;
  for (var pass of passes) {
    console.log(pass);
    if (pass[1] > mostRecentPass?.[1] || mostRecentPass === undefined) {
      mostRecentPass = pass;
    }
  }
  console.log(mostRecentPass);
  return mostRecentPass;
}
function getDurationString(start, end) {
  const seconds = Math.floor((end - start)/1000);
  const min = Math.floor(seconds/60);
  const hour = Math.floor(min/60);
  const durationString = `${hour}:${padWholeNumber(min - hour*60,2)}:${padWholeNumber(seconds - min*60,2)}`;
  return durationString;
}
function getRowIndexFromId(id, sheet) {
  const height = sheet.getDataRange().getHeight();
  const ids = sheet.getRange(1, 1, height).getValues();
  var index;
  ids.forEach(function(row, i) { if (row[0] === id) { index = i; } });
  return index;
}
function updatePass(newPass, sheet) {
  const rowIndex = getRowIndexFromId(newPass[0], sheet)
  sheet.getRange(rowIndex+1, 1, 1, newPass.length).setValues([newPass]);
}
function getPassFromId(id, sheet) {
  const rowIndex = getRowIndexFromId(id, sheet)
  const width = sheet.getDataRange().getHeight();
  return sheet.getRange(rowIndex+1, 1, 1, width).getValues()[0];
}
function endPass(pass, sheets) {
  const newPass = [...pass];
  const now = Date.now();
  const start = new Date(myMostRecentPass[0]).getTime();
  const durationString = getDurationString(start, now);
  newPass[3] = 'inactive';
  sheets.forEach(function(sheet) { updatePass(newPass, sheet); });
}
function onEndFormSubmit(response) {
  const encryptedSheet = SpreadsheetApp.openById(encryptedSpreadsheetId).getSheets()[0];
  const myPassesFromToday = getMyPassesFromToday(encryptedSheet, response.getRespondentEmail(), true);
  const myMostRecentPass = getMostRecentPass(myPassesFromToday);
  //const myMostRecentPassRowIndex = myMostRecentPass.slice(-1)[0];
  //encryptedSheet.getRange(myMostRecentPassRowIndex+1, 4, 1, 1).setValues([["inactive"]]);
  endPass(myMostRecentPass, [encryptedSheet, monitoringSheet]);
}
function appendPassToSheet(sheet, pass) {
  const height = sheet.getDataRange().getHeight();
  sheet.getRange(height+1, 1, 1, 4).setValues([pass]);
}
function encryptPass(pass) {
  const encryptedPass = [...pass]
  encryptedPass[1] = toHexString(Utilities.computeDigest(pass[1]));
  return encryptedPass;
}
function createPass(response, status) {
  const formItemResponses = response.getItemResponses();
  const pass = [response.getId(), Utilities.formatDate(passStartTime, 'America/Chicago', 'MM/dd/yyyy HH:mm:ss'), response.getRespondentEmail(), formItemResponses[formItemResponsesIndex.get('destination')].getResponse(), status];
  return pass;
}
function onStartHallpassFormSubmit(event) {
  var response = event.response;
  var passStartTime = new Date(response.getTimestamp());
  const monitoringSheet = SpreadsheetApp.openById(monitoringSpreadsheetId).getSheets()[0];
  const encryptedSheet = SpreadsheetApp.openById(encryptedSpreadsheetId).getSheets()[0];
  var pass, encryptedPass;
  if (passAllowed(pass)) {
    pass = createPass(response, 'approved');
  } else {
    pass = createPass(response, 'denied');
  }
  encryptedPass = encryptPass(pass);
  appendPassToSheet(monitoringSheet, pass);
  appendPassToSheet(encryptedSheet, encryptedPass);
}
function activateHallpass(pass) {
  pass[4] = "active";
  const monitoringSheet = SpreadsheetApp.openById(monitoringSpreadsheetId).getSheets()[0];
  const encryptedSheet = SpreadsheetApp.openById(encryptedSpreadsheetId).getSheets()[0];
  [monitoringSheet, encryptedSheet].forEach(function(sheet) { updatePass(pass, sheet); });
}