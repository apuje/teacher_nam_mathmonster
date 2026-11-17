/**
 * 매뜨몬스터 - Google Apps Script 웹 앱
 * index.html 파일을 웹 페이지로 보여 줍니다.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('매뜨몬스터')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}
