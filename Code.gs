const monitoringSpreadsheetId = "1iBh7bVtxBykPTX7SduUhkjVH3UmKYcLl9mD27MmDiwo";
const encryptedSpreadsheetId = "1Uij5GC-HJB4wd8xMAgtxUe6QBSEkt_vsjCtuRHhok3M";
const startHallpassFormId = "1FAIpQLSdbm5Yv6uqOvnqQ2lhyerIyFeTXGROZZ_uE7_vk885UqZ5pUA";
const endHallpassFormId = "1FAIpQLSer2ZxezicVRZ8fe4JkjxJGlj4DapTcZZhMdu8RZezInqBM1g";

// pass[0]: form response id
// pass[1]: start time
// pass[2]: email
// pass[3]: destination
// pass[4]: status
// pass[5]: message

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
    const monitoringSheet = SpreadsheetApp.openById(monitoringSpreadsheetId).getSheets()[0];
    const pass = getPassFromId(e.parameter.passId, monitoringSheet);
    if (pass !== undefined) {
      activatePass(pass);
    }
  }
  if (e.parameter.action === 'clearStalePasses') {
    const monitoringSheet = SpreadsheetApp.openById(monitoringSpreadsheetId).getSheets()[0];
    const encryptedSheet = SpreadsheetApp.openById(encryptedSpreadsheetId).getSheets()[0];
    clearMyRequestedPasses(encryptedSheet, toHexString(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)));
    clearMyRequestedPasses(monitoringSheet, email);
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
  const oneMinute = 60000;
  const delta = 1*oneMinute;
  function getDatetime([hours, mins]) {
    const datetime = new Date();
    datetime.setHours(hours, mins);
    return datetime;
  }
  const periodStartTimes = [[8,40],[9,21],[10,2],[10,43],[11,24],[11,55],[12,26],[12,57],[13,38],[14,19],[15,18],[15,22],[15,26],[15,30]].map(getDatetime);
  const periodEndTimes = [[9,20],[10,1],[10,42],[11,23],[11,54],[12,25],[12,56],[13,37],[14,18],[14,59],[15,20],[15,24],[15,28],[15,32]].map(getDatetime);
  if (
    any(periodStartTimes.map(function(periodStartTime){
      return (periodStartTime - passStartTime) > 0 && (periodStartTime - passStartTime) < oneMinute; // The pass start time is within one minute of the period start time.
    })) ||
    any(periodStartTimes.map(function(periodStartTime){
      return (passStartTime - periodStartTime) > 0 && (passStartTime - periodStartTime) < delta;
    })) ||
    any(periodEndTimes.map(function(periodEndTime){
      return (periodEndTime - passStartTime) > 0 && (periodEndTime - passStartTime) < delta;
    }))) {
      pass[5] = "You may not start a pass during the first or last 10 minutes of a class period.";
      return false;
  }
  return true
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
function getMyPassesFromToday(sheet, email) {
  const data = sheet.getDataRange().getValues();
  const nRows = data.length;
  const passes = [];
  // Get today's most recent active pass for this user
  for (var i = 1; i < nRows; i++) {
      var pass = data[i];
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
function updatePassOnSheet(pass, sheet) {
  const rowIndex = getRowIndexFromId(pass[0], sheet)
  sheet.getRange(rowIndex+1, 1, 1, pass.length).setValues([pass]);
}
function updatePass(pass) {
  const monitoringSheet = SpreadsheetApp.openById(monitoringSpreadsheetId).getSheets()[0];
  const encryptedSheet = SpreadsheetApp.openById(encryptedSpreadsheetId).getSheets()[0];
  updatePassOnSheet(pass, monitoringSheet);
  const encryptedPass = encryptPass(pass);
  updatePassOnSheet(encryptedPass, encryptedSheet);
}
function getPassFromId(id, sheet) {
  console.error(id);
  const rowIndex = getRowIndexFromId(id, sheet);
  const width = sheet.getDataRange().getWidth();
  if (rowIndex !== undefined) {
    return sheet.getRange(rowIndex+1, 1, 1, width).getValues()[0];
  }
}
function endPass(pass) {
  const now = Date.now();
  const start = new Date(pass[1]).getTime();
  const durationString = getDurationString(start, now);
  pass[4] = 'inactive';
  updatePass(pass);
}
function onEndHallpassFormSubmit(event) {
  const response = event.response;
  const monitoringSheet = SpreadsheetApp.openById(monitoringSpreadsheetId).getSheets()[0];
  const myActivePassesFromToday = getMyPassesFromToday(monitoringSheet, response.getRespondentEmail()).filter(function(pass) { return (pass[4] === "active"); });
  const myMostRecentActivePass = getMostRecentPass(myActivePassesFromToday);
  if(myMostRecentActivePass !== undefined) {
    endPass(myMostRecentActivePass);
  }
}
function appendPassToSheet(sheet, pass) {
  const height = sheet.getDataRange().getHeight();
  sheet.getRange(height+1, 1, 1, pass.length).setValues([pass]);
}
function encryptPass(pass) {
  const encryptedPass = [...pass]
  encryptedPass[2] = toHexString(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pass[2]));
  return encryptedPass;
}
function createPass(response, status) {
  const formItemResponses = response.getItemResponses();
  const passStartTime = new Date(response.getTimestamp());
  const pass = [response.getId(), Utilities.formatDate(passStartTime, 'America/Chicago', 'MM/dd/yyyy HH:mm:ss'), response.getRespondentEmail(), formItemResponses[0].getResponse(), status, ''];
  return pass;
}
function onStartHallpassFormSubmit(event) {
  const response = event.response;
  const monitoringSheet = SpreadsheetApp.openById(monitoringSpreadsheetId).getSheets()[0];
  const encryptedSheet = SpreadsheetApp.openById(encryptedSpreadsheetId).getSheets()[0];
  const email = response.getRespondentEmail();
  clearMyRequestedPasses(encryptedSheet, toHexString(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)));
  clearMyRequestedPasses(monitoringSheet, email);
  var pass, encryptedPass;
  pass = createPass(response, 'requested');
  if (passAllowed(pass)) {
    pass[4] = "approved";
  } else {
    pass[4] = "denied";
  }
  encryptedPass = encryptPass(pass);
  appendPassToSheet(monitoringSheet, pass);
  appendPassToSheet(encryptedSheet, encryptedPass);
}
function clearMyRequestedPasses(sheet, email) {
  const myPassesFromToday = getMyPassesFromToday(sheet, email);
  const myRequestedPassesFromToday = myPassesFromToday.filter(function(pass) { return(pass[4] === "approved" || pass[4] === "denied");})
  myRequestedPassesFromToday.forEach(function(pass) {
    pass[4] = "defunct";
    updatePassOnSheet(pass, sheet);
  });
}
function activatePass(pass) {
  pass[4] = "active";
  updatePass(pass);
}
/*
function acknowledgePassStatus(pass) {
  const monitoringSheet = SpreadsheetApp.openById(monitoringSpreadsheetId).getSheets()[0];
  const encryptedSheet = SpreadsheetApp.openById(encryptedSpreadsheetId).getSheets()[0];
  if (pass[4] === "denied") {
    pass[4] === "defunct";
  } else if (pass[4] === "approved") {
    pass[4] === "unactivated";
  }
  [monitoringSheet, encryptedSheet].forEach(function(sheet) { updatePass(pass, sheet); });
}
*/