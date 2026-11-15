'use strict';
/* Уменьшенные копии скриптов и стилей сайта (16.11.2026).
   Запуск перед выпуском: node tools/minify.js
   Копии ложатся в public/.min/ (скрытая папка — напрямую по адресу недоступна). Первая строка копии —
   отпечаток исходника; сервер отдаёт копию только если отпечаток совпадает с текущим исходником,
   иначе — сам исходник. Забыли пересобрать — сайт просто отдаёт обычные файлы.
   Что делается: из скриптов убираются комментарии и отступы (разбор — компилятором TypeScript,
   код не переписывается), из стилей — комментарии и лишние пробелы. Имена и логика не меняются. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUBLIC = path.join(__dirname, '..', 'public'), OUT = path.join(PUBLIC, '.min');
let ts;
try { ts = require('typescript'); } catch (e) {
  try { ts = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'typescript')); }
  catch (e2) { console.error('Нужен пакет typescript (npm i -g typescript)'); process.exit(1); }
}
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');

function minJs(src, name) {
  const out = ts.transpileModule(src, { fileName: name, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleDetection: ts.ModuleDetectionKind.Legacy, removeComments: true, allowJs: true, alwaysStrict: false, ignoreDeprecations: '6.0' } });
  if (out.diagnostics && out.diagnostics.length) throw new Error(name + ': ' + ts.flattenDiagnosticMessageText(out.diagnostics[0].messageText, ' '));
  // строки не склеиваем (перевод строки сохраняет поведение автоподстановки «;»), только убираем отступы и пустые строки
  let text = out.outputText;
  // компилятор не должен добавлять «use strict» — это изменило бы поведение файла
  if (/^"use strict";\n/.test(text) && !/^\s*(['"])use strict\1/.test(src)) text = text.replace(/^"use strict";\n/, '');
  // компилятор печатает «;» после каждой инструкции, поэтому переводы строк не нужны для смысла кода;
  // строки склеиваем пробелом (шаблонных строк с переносами в скриптах сайта нет — проверяется ниже)
  if (/`[^`]*\n[^`]*`/.test(src)) return text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n') + '\n';
  return text.split('\n').map((l) => l.trim()).filter(Boolean).join(' ') + '\n';
}

function minCss(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i];
    if (q) { out += c; if (c === '\\') { out += src[i + 1] || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (/\s/.test(c)) { while (i < src.length && /\s/.test(src[i])) i++; out += ' '; continue; }
    out += c; i++;
  }
  // пробелы вокруг { } ; , > и после : — вне строк и url(…) (они защищены заменой)
  const keep = []; out = out.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)"']*\)/g, (m) => { keep.push(m); return '\u0000' + (keep.length - 1) + '\u0000'; });
  out = out.replace(/ ?([{};,>]) ?/g, '$1').replace(/: /g, ':').replace(/;}/g, '}').trim();
  return out.replace(/\u0000(\d+)\u0000/g, (_, n) => keep[n]) + '\n';
}

function build() {
  const done = [];
  for (const dir of ['js', 'css']) {
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    for (const f of fs.readdirSync(path.join(PUBLIC, dir))) {
      const ext = path.extname(f); if (ext !== '.' + dir) continue;
      const src = fs.readFileSync(path.join(PUBLIC, dir, f), 'utf8');
      const min = dir === 'js' ? minJs(src, f) : minCss(src);
      const head = (dir === 'js' ? '/*' : '/*') + ' src-sha1:' + sha(src) + ' */\n';
      fs.writeFileSync(path.join(OUT, dir, f), head + min);
      done.push([dir + '/' + f, src.length, head.length + min.length]);
    }
  }
  // копии удалённых файлов убираем
  for (const dir of ['js', 'css']) for (const f of fs.readdirSync(path.join(OUT, dir))) if (!fs.existsSync(path.join(PUBLIC, dir, f))) fs.unlinkSync(path.join(OUT, dir, f));
  return done;
}

if (require.main === module) {
  const done = build();
  let a = 0, b = 0; done.forEach(([f, x, y]) => { a += x; b += y; console.log(f.padEnd(20), Math.round(x / 1024) + ' КБ →', Math.round(y / 1024) + ' КБ'); });
  console.log('Всего:', Math.round(a / 1024) + ' КБ →', Math.round(b / 1024) + ' КБ');
}
module.exports = { minJs, minCss, sha };
