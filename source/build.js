const fs = require('fs');
const p = f => fs.readFileSync(__dirname + '/src/' + f, 'utf8');
const app = p('app.js') + p('app2.js') + p('app3.js') + p('app4.js');
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>매뜨몬스터</title>
<style>
${p('style.css')}</style>
</head>
<body>
${p('body.html')}
<script id="mm-core">
${p('core.js')}</script>
<script id="mm-app">
${app}</script>
</body>
</html>
`;
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/index.html', html);
fs.writeFileSync(__dirname + '/dist/Code.gs', `/**
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
`);
console.log('built', html.length, 'bytes');
