'use strict';
/* Страницы для поисковиков: у каждого адреса (/catalog, /product/…, /page/…) свой заголовок, описание,
   канонический адрес и разметка Schema.org, а внутри #app — текст страницы со ссылками.
   Яндекс видит это сразу, без выполнения скриптов; покупатель через долю секунды видит обычный магазин,
   который перерисовывает #app. */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rub = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,.;:—–-]+[^\s]*$/, '') + '…'; };
// Текст страницы из админки (markdown) → чистый текст или простой HTML
const plain = (md) => String(md || '').replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, '').replace(/\*\*?|__/g, '').replace(/^#+\s*/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
function mdHtml(md) {
  const out = []; let list = null, ol = null;
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '$1');
  const flush = () => { if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; } if (ol) { out.push('<ol>' + ol.join('') + '</ol>'); ol = null; } };
  String(md || '').split('\n').forEach((line) => {
    const t = line.trim();
    if (/^!\[/.test(t)) return;
    if (/^- /.test(t)) { if (ol) flush(); (list = list || []).push('<li>' + inline(t.slice(2)) + '</li>'); return; }
    if (/^\d+[.)]\s+/.test(t)) { if (list) flush(); (ol = ol || []).push('<li>' + inline(t.replace(/^\d+[.)]\s+/, '')) + '</li>'); return; }
    flush();
    if (!t) return;
    const h = /^(#{2,3})\s+(.+)$/.exec(t);
    out.push(h ? `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>` : '<p>' + inline(t) + '</p>');
  });
  flush();
  return out.join('');
}

function create(opts) {
  const { getDb, Pricing, siteUrl, features } = opts;
  const abs = (u) => /^https?:/.test(u) ? u : siteUrl() + '/' + String(u || '').replace(/^\//, '');

  function visible(db) {
    const g = (db.settings && db.settings.genders) || {};
    return (db.products || []).filter((p) => p.active !== false && !(p.gender && p.gender !== 'unisex' && g[p.gender] && g[p.gender].open === false));
  }
  const colorsOf = (p) => Pricing.colorsOf(p);
  const stock = (p) => colorsOf(p).reduce((s, c) => s + (c.sizes || []).reduce((a, x) => a + (Number(x.stock) || 0), 0), 0);
  const imgs = (p) => colorsOf(p).flatMap((c) => c.images || []).filter((u) => u && !/^data:/.test(u)).slice(0, 6).map(abs);
  const catOf = (db, p) => (db.categories || []).find((c) => c.id === p.categoryId);
  const priceOf = (db, p) => Pricing.productPrice(p, db.promotions);

  function service() {
    const f = features();
    return ['доставка СДЭК по всей России', f.tryOn ? 'примерка в пункте выдачи' : '', f.cod ? 'оплата при получении' : '', 'возврат 14 дней'].filter(Boolean);
  }
  const serviceLine = () => { const s = service(); return s[0].charAt(0).toUpperCase() + s[0].slice(1) + (s.length > 1 ? ', ' + s.slice(1).join(', ') : '') + '.'; };

  const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x[0], item: abs(x[1]) })) });
  const crumbsHtml = (items) => '<nav class="crumbs">' + items.map((x, i) => i === items.length - 1 ? `<span>${esc(x[0])}</span>` : `<a href="${esc(x[1])}">${esc(x[0])}</a><span>/</span>`).join('') + '</nav>';
  function productCard(db, p) {
    const pr = priceOf(db, p), im = imgs(p)[0];
    return `<li><a href="/product/${esc(p.slug)}">${im ? `<img src="${esc(im)}" alt="${esc(p.name)}" width="300" height="400" loading="lazy">` : ''}<b>${esc(p.name)}</b> <span>${rub(pr.price)}</span></a></li>`;
  }
  function nav(db) {
    const cats = (db.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const pages = (db.pages || []).filter((x) => x.inFooter !== false);
    return '<nav class="pre-nav"><a href="/">' + esc(db.settings.storeName || 'ALBAKOV') + '</a> <a href="/catalog">Каталог</a> ' +
      cats.map((c) => `<a href="/catalog?cat=${esc(c.slug)}">${esc(c.name)}</a>`).join(' ') + ' ' +
      pages.map((x) => `<a href="/page/${esc(x.slug)}">${esc(x.title)}</a>`).join(' ') + '</nav>';
  }
  const wrap = (db, inner) => nav(db) + '<main class="wrap pre">' + inner + '</main>';

  // Возвращает { status, title, description, canonical, robots, image, jsonld: [], body }
  function render(pathname, query) {
    const db = getDb(), st = db.settings || {}, store = st.storeName || 'ALBAKOV';
    const parts = String(pathname || '/').split('/').filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    const list = visible(db);
    const org = { '@context': 'https://schema.org', '@type': 'OnlineStore', name: store, url: abs('/'), logo: abs('img/icon-512.png'), email: (st.contacts || {}).email || undefined, areaServed: 'RU' };
    const base = { status: 200, robots: 'index, follow', image: abs('img/icon-512.png'), jsonld: [] };
    const name = parts[0] || '';

    if (!name) {
      const cats = (db.categories || []).filter((c) => list.some((p) => p.categoryId === c.id));
      return Object.assign(base, {
        title: `${store} — интернет-магазин одежды из Санкт-Петербурга`,
        description: clip(`Одежда ${store} из премиальных материалов: шьём на фабриках в России. ${serviceLine()}`, 200),
        canonical: abs('/'),
        jsonld: [org, { '@context': 'https://schema.org', '@type': 'WebSite', name: store, url: abs('/') }],
        body: wrap(db, `<h1>${esc(store)} — ${esc(st.tagline || 'интернет-магазин одежды')}</h1><p>${esc(serviceLine())}</p>` +
          (cats.length ? '<h2>Категории</h2><ul>' + cats.map((c) => `<li><a href="/catalog?cat=${esc(c.slug)}">${esc(c.name)}</a></li>`).join('') + '</ul>' : '') +
          (list.length ? '<h2>Новинки</h2><ul class="pre-grid">' + list.slice(0, 12).map((p) => productCard(db, p)).join('') + '</ul>' : ''))
      });
    }
    if (name === 'catalog') {
      const cat = query.cat && (db.categories || []).find((c) => c.slug === query.cat);
      if (query.cat && !cat) return notFound(db, store);
      const items = cat ? list.filter((p) => p.categoryId === cat.id) : list;
      const n = items.length, nm = cat ? cat.name : 'Каталог одежды';
      const min = items.length ? Math.min(...items.map((p) => priceOf(db, p).price)) : 0;
      const canon = cat ? '/catalog?cat=' + encodeURIComponent(cat.slug) : '/catalog';
      const bc = [['Главная', '/'], ['Каталог', '/catalog']].concat(cat ? [[cat.name, canon]] : []);
      // фильтры, сортировка и поиск — те же страницы: в индекс не берём, ссылки учитываем
      const extra = Object.keys(query).some((k) => k !== 'cat');
      return Object.assign(base, {
        title: cat ? `${cat.name} — купить в интернет-магазине ${store}` : `Каталог одежды — интернет-магазин ${store}`,
        description: clip(`${nm} ${store}${n ? ': ' + n + ' ' + plural(n, 'модель', 'модели', 'моделей') + (min ? ' от ' + rub(min) : '') : ''}. Шьём на фабриках в России. ${serviceLine()}`, 200),
        canonical: abs(canon), robots: extra ? 'noindex, follow' : 'index, follow',
        jsonld: [crumbs(bc), { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs('/product/' + p.slug), name: p.name })) }],
        body: wrap(db, crumbsHtml(bc) + `<h1>${esc(nm)}</h1><ul class="pre-grid">` + items.map((p) => productCard(db, p)).join('') + '</ul>')
      });
    }
    if (name === 'product') {
      const p = list.find((x) => x.slug === parts[1] || x.id === parts[1]);
      if (!p) return notFound(db, store);
      const cat = catOf(db, p), pr = priceOf(db, p), images = imgs(p), inStock = stock(p) > 0;
      const colors = colorsOf(p).map((c) => c.name).filter(Boolean);
      const sizes = [...new Set(colorsOf(p).flatMap((c) => (c.sizes || []).filter((s) => Number(s.stock) > 0).map((s) => s.size)))];
      const url = '/product/' + p.slug;
      const bc = [['Главная', '/'], ['Каталог', '/catalog']].concat(cat ? [[cat.name, '/catalog?cat=' + encodeURIComponent(cat.slug)]] : []).concat([[p.name, url]]);
      const desc = [`${p.name}, ${rub(pr.price)}.`, inStock ? (sizes.length ? 'Размеры в наличии: ' + sizes.join(', ') + '.' : 'В наличии.') : 'Нет в наличии.', p.composition ? 'Состав: ' + p.composition.split(/[.\n]/)[0] + '.' : '', serviceLine()].filter(Boolean).join(' ');
      return Object.assign(base, {
        title: `${p.name} — купить за ${rub(pr.price)} в интернет-магазине ${store}`,
        description: clip(desc, 220),
        canonical: abs(url), image: images[0] || base.image,
        jsonld: [crumbs(bc), {
          '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.id, url: abs(url),
          description: clip(p.description || desc, 900), image: images.length ? images : undefined,
          brand: { '@type': 'Brand', name: store }, category: cat ? cat.name : undefined, color: colors.join(', ') || undefined, material: p.composition || undefined,
          offers: { '@type': 'Offer', url: abs(url), priceCurrency: 'RUB', price: String(pr.price), availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: store } }
        }],
        body: wrap(db, crumbsHtml(bc) + `<article><h1>${esc(p.name)}</h1>` + (images[0] ? `<img src="${esc(images[0])}" alt="${esc(p.name)}" width="600" height="800">` : '') +
          `<p><b>${rub(pr.price)}</b>${pr.oldPrice ? ` <s>${rub(pr.oldPrice)}</s>` : ''} · ${inStock ? 'в наличии' : 'нет в наличии'}</p>` +
          (colors.length ? `<p>Цвета: ${esc(colors.join(', '))}</p>` : '') + (sizes.length ? `<p>Размеры: ${esc(sizes.join(', '))}</p>` : '') +
          (p.description ? `<h2>Описание</h2><p>${esc(p.description)}</p>` : '') + (p.composition ? `<h2>Состав</h2><p>${esc(p.composition)}</p>` : '') +
          (p.care ? `<h2>Уход</h2><p>${esc(p.care)}</p>` : '') + `<p>${esc(serviceLine())}</p></article>`)
      });
    }
    if (name === 'page') {
      const pg = (db.pages || []).find((x) => x.slug === parts[1]);
      if (!pg) return notFound(db, store);
      const txt = plain(String(pg.body || '').split('\n').filter((l) => !/^\s*\*\*.+\*\*\s*$/.test(l)).join('\n')).split('\n').map((x) => x.replace(/^[-\d.)\s]+/, '').trim()).filter((x) => x.length > 30)[0] || pg.title;
      const url = '/page/' + pg.slug, legal = pg.group === 'legal';
      const bc = [['Главная', '/'], [pg.title, url]];
      return Object.assign(base, {
        title: pg.slug === 'about' ? `О бренде ${store} — одежда из Санкт-Петербурга` : `${pg.title} — ${store}`,
        description: clip(txt, 200), canonical: abs(url),
        jsonld: legal ? [] : [crumbs(bc)],
        body: wrap(db, crumbsHtml(bc) + `<article><h1>${esc(pg.title)}</h1>${mdHtml(pg.body)}</article>`)
      });
    }
    if (name === 'sale') {
      return Object.assign(base, { title: `Акции и скидки — ${store}`, description: clip(`Товары ${store} со скидкой. ${serviceLine()}`, 200), canonical: abs('/sale'), body: wrap(db, '<h1>Акции</h1>') });
    }
    if (name === 'sizes') {
      return Object.assign(base, { title: `Таблица размеров — ${store}`, description: `Как подобрать размер одежды ${store}: таблицы размеров и советы по замерам.`, canonical: abs('/sizes'), body: wrap(db, '<h1>Таблица размеров</h1>') });
    }
    if (['cart', 'checkout', 'account', 'order'].includes(name)) {
      return Object.assign(base, { title: store, description: '', canonical: abs('/' + name), robots: 'noindex, nofollow', body: '' });
    }
    // Остальное — панель управления (её адрес секретный) или несуществующая страница: в поиск не пускаем
    return Object.assign(notFound(db, store), { status: 200, body: '' });
  }
  function notFound(db, store) {
    return { status: 404, title: `Страница не найдена — ${store}`, description: '', canonical: '', robots: 'noindex, follow', image: abs('img/icon-512.png'), jsonld: [], body: wrap(db, '<h1>Страница не найдена</h1><p><a href="/">На главную</a> · <a href="/catalog">В каталог</a></p>') };
  }
  function plural(n, a, b, c) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }

  // Вставка в index.html: всё между <!--seo--> и <!--/seo--> заменяется, #app получает текст страницы
  function inject(html, r) {
    const head = [
      `<title>${esc(r.title)}</title>`,
      r.description ? `<meta name="description" content="${esc(r.description)}">` : '',
      `<meta name="robots" content="${r.robots}">`,
      r.canonical ? `<link rel="canonical" href="${esc(r.canonical)}">` : '',
      '<meta property="og:type" content="website">',
      `<meta property="og:site_name" content="${esc((getDb().settings || {}).storeName || 'ALBAKOV')}">`,
      `<meta property="og:title" content="${esc(r.title)}">`,
      r.description ? `<meta property="og:description" content="${esc(r.description)}">` : '',
      r.canonical ? `<meta property="og:url" content="${esc(r.canonical)}">` : '',
      `<meta property="og:image" content="${esc(r.image)}">`,
      '<meta property="og:locale" content="ru_RU">'
    ].concat(r.jsonld.map((j) => '<script type="application/ld+json">' + JSON.stringify(j).replace(/</g, '\\u003c') + '</script>')).filter(Boolean).join('\n');
    return html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, '<!--seo-->\n' + head + '\n<!--/seo-->').replace('<div id="app"></div>', '<div id="app">' + (r.body || '') + '</div>');
  }

  /* ---------- Карта сайта ---------- */
  function sitemap() {
    const db = getDb(), list = visible(db), today = new Date().toISOString().slice(0, 10);
    const urls = [['/', 'daily', '1.0', today], ['/catalog', 'daily', '0.9', today]]
      .concat((db.categories || []).filter((c) => list.some((p) => p.categoryId === c.id)).map((c) => ['/catalog?cat=' + encodeURIComponent(c.slug), 'daily', '0.8', today]))
      .concat(list.map((p) => ['/product/' + p.slug, 'weekly', '0.8', String(p.updatedAt || p.createdAt || today).slice(0, 10)]))
      .concat((db.pages || []).map((pg) => ['/page/' + pg.slug, 'monthly', pg.group === 'legal' ? '0.2' : '0.5', today]))
      .concat([['/sizes', 'monthly', '0.4', today]]);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map((u) => `<url><loc>${esc(abs(u[0]))}</loc><lastmod>${esc(u[3])}</lastmod><changefreq>${u[1]}</changefreq><priority>${u[2]}</priority></url>`).join('\n') + '\n</urlset>\n';
  }

  /* ---------- Фид товаров для Яндекса (YML): Яндекс Товары, Директ, ВКонтакте ---------- */
  function yml() {
    const db = getDb(), st = db.settings || {}, store = st.storeName || 'ALBAKOV', list = visible(db);
    const now = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
    const cats = (db.categories || []).map((c, i) => `<category id="${i + 1}">${esc(c.name)}</category>`);
    const catNum = (id) => { const i = (db.categories || []).findIndex((c) => c.id === id); return i + 1; };
    const offers = [];
    list.forEach((p, pi) => {
      const pr = priceOf(db, p), cat = catNum(p.categoryId);
      colorsOf(p).forEach((c, ci) => {
        (c.sizes || []).forEach((s, si) => {
          // id предложения в YML — до 20 латинских букв и цифр: товар · цвет · размер
          const id = 'a' + (pi + 1) + 'c' + (ci + 1) + 's' + (si + 1);
          const pics = (c.images || []).filter((u) => u && !/^data:/.test(u)).slice(0, 10).map(abs);
          offers.push(`<offer id="${esc(id)}" available="${Number(s.stock) > 0 ? 'true' : 'false'}" group_id="${pi + 1}">` +
            `<url>${esc(abs('/product/' + p.slug + '?color=' + encodeURIComponent(c.id)))}</url>` +
            `<price>${pr.price}</price>` + (pr.oldPrice ? `<oldprice>${pr.oldPrice}</oldprice>` : '') + '<currencyId>RUR</currencyId>' +
            (cat ? `<categoryId>${cat}</categoryId>` : '') + pics.map((u) => `<picture>${esc(u)}</picture>`).join('') +
            `<name>${esc(p.name + (c.name ? ', ' + c.name : '') + ', размер ' + s.size)}</name><vendor>${esc(store)}</vendor>` +
            (p.description ? `<description>${esc(clip(p.description, 3000))}</description>` : '') +
            `<param name="Цвет">${esc(c.name || '')}</param><param name="Размер" unit="INT">${esc(s.size)}</param>` +
            (p.composition ? `<param name="Состав">${esc(p.composition)}</param>` : '') + '</offer>');
        });
      });
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<yml_catalog date="${now}"><shop><name>${esc(store)}</name><company>${esc(String(st.legal || store).split(/[,\n]/)[0])}</company><url>${esc(abs('/'))}</url>` +
      `<currencies><currency id="RUR" rate="1"/></currencies><categories>${cats.join('')}</categories><offers>${offers.join('')}</offers></shop></yml_catalog>\n`;
  }

  return { render, inject, sitemap, yml };
}

module.exports = { create };
