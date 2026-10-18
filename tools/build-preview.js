// Собирает однофайловое превью магазина (демо-режим, данные в браузере): dist/albakov-preview.html
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
let js = ['js/pricing.js', 'js/mail.js', 'js/seed.js', 'js/art.js', 'js/store.js', 'js/app.js', 'js/admin.js'].map(read).join('\n;\n');
if (/<\/script/i.test(js)) throw new Error('</script> inside JS');
// Логотипы из public/img встраиваем прямо в страницу, чтобы превью было одним файлом
for (const f of ['logo-mark.png', 'logo-wordmark.png', 'slide-new.jpg', 'slide-sale.jpg', 'slide-welcome.jpg']) {
  const mime = f.endsWith('.png') ? 'image/png' : 'image/jpeg';
  js = js.split("'img/" + f + "'").join("'data:" + mime + ";base64," + fs.readFileSync(path.join(pub, 'img', f)).toString('base64') + "'");
}
const html = `<title>ALBAKOV</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Noto+Serif+Display:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap">
<style>
${read('css/app.css')}
</style>
<div id="app"><div class="loader">ALBAKOV</div></div>
<script>
window.ALBAKOV_DEMO = true;
${js}
</script>
`;
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'albakov-preview.html'), html);
console.log('dist/albakov-preview.html', (html.length / 1024).toFixed(0) + ' КБ');
