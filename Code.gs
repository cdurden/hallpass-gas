function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .getContent();
}
function doGet(e) {
  var profile = Session.getActiveUser();
  var t = HtmlService.createTemplateFromFile('Index')
  t.email = profile.getEmail(); // This is null if the 'email' scope is not present.
  t.startHallpassForm = include('Start');
  t.hallpassAppUrl = ScriptApp.getService().getUrl();
  var output = t.evaluate();
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}