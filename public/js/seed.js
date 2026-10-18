/* Стартовое наполнение магазина. Всё редактируется в админ-панели (#/admin). */
(function (root) {
  var SEED = {
    version: 14,
    settings: {
      storeName: 'ALBAKOV',
      brand: {
        mark: { src: 'img/logo-mark.png', w: 273, h: 240 },
        word: { src: 'img/logo-wordmark.png', w: 960, h: 91 },
        desktop: 'word',
        mobile: 'word',
        scale: 100,
        footerMark: true
      },
      tagline: 'Одежда спокойной роскоши',
      announcement: 'Бесплатная доставка по России от 15 000 ₽ · Примерка перед оплатой',
      contacts: {
        phone: '+7 (495) 000-00-00',
        email: 'hello@albakov.ru',
        address: 'Москва, ул. Петровка, 21',
        hours: 'Ежедневно 10:00–22:00'
      },
      socials: [
        { id: 's1', name: 'Telegram', url: 'https://t.me/' },
        { id: 's2', name: 'ВКонтакте', url: 'https://vk.com/' },
        { id: 's3', name: 'Instagram', url: 'https://instagram.com/' }
      ],
      nav: [
        { id: 'n1', label: 'Новинки', link: '#/catalog?tag=new' },
        { id: 'n2', label: 'Каталог', link: '#/catalog' },
        { id: 'n3', label: 'Акции', link: '#/sale' },
        { id: 'n4', label: 'Размеры', link: '#/sizes' },
        { id: 'n5', label: 'О бренде', link: '#/page/about' }
      ],
      slider: {
        enabled: true,
        autoplay: true,
        interval: 7,
        slides: [
          { id: 'sl1', active: true, layout: 'split', eyebrow: 'Коллекция осень — зима 2026', title: 'Тишина\nв деталях', text: 'Шерсть, кашемир и плотный хлопок. Вещи, которые носят годами и не объясняют.', image: 'img/slide-new.jpg', badge: '', code: '', promotionId: '', btn1: { label: 'Смотреть новинки', link: '#/catalog?tag=new' }, btn2: { label: 'Весь каталог', link: '#/catalog' }, gender: '', startsAt: '', endsAt: '' },
          { id: 'sl2', active: true, layout: 'full', eyebrow: 'Акция', title: 'Неделя\n*трикотажа*', text: 'Кашемир и меринос со скидкой. Мягкие вещи на всю зиму.', image: 'img/slide-sale.jpg', badge: '', code: '', promotionId: 'a1', btn1: { label: 'Выбрать трикотаж', link: '#/catalog?cat=knitwear' }, btn2: { label: 'Все акции', link: '#/sale' }, gender: '', startsAt: '', endsAt: '' },
          { id: 'sl3', active: true, layout: 'split', eyebrow: 'Для новых покупателей', title: '−10%\nна *первый заказ*', text: 'Зарегистрируйтесь и введите промокод при оформлении. Скидка действует на товары без акций.', image: 'img/slide-welcome.jpg', badge: '', code: 'WELCOME10', promotionId: '', btn1: { label: 'Зарегистрироваться', link: '#/account?tab=register' }, btn2: { label: '', link: '' }, gender: '', startsAt: '', endsAt: '' }
        ]
      },
      genders: {
        women: { open: true, title: 'Женская коллекция\n*скоро* появится', text: 'Мы готовим женскую коллекцию и скоро её покажем. А пока загляните в другой раздел.' },
        men: { open: true, title: 'Мужская коллекция\n*скоро* появится', text: 'Мы готовим мужскую коллекцию и скоро её покажем. А пока загляните в другой раздел.' }
      },
      gateway: {
        enabled: true,
        eyebrow: 'Выберите раздел',
        women: { title: 'Женщинам', text: 'Пальто, трикотаж, платья', image: '' },
        men: { title: 'Мужчинам', text: 'Пальто, свитеры, рубашки', image: '' }
      },
      home: {
        heroEyebrow: 'Коллекция осень — зима 2026',
        heroTitle: 'Тишина\nв деталях',
        heroText: 'Шерсть, кашемир и плотный хлопок. Вещи, которые носят годами и не объясняют.',
        heroCta: 'Смотреть коллекцию',
        heroLink: '#/catalog',
        heroImage: '',
        heroArt: { kind: 'coat', tone: '#3d3d40' },
        showCategories: true,
        showNew: true,
        showSale: true,
        showEditorial: true,
        showBenefits: true,
        showBonus: true,
        bonusEyebrow: 'Бонусная программа',
        bonusTitle: 'Возвращаем *{n}%*\nбонусами',
        bonusText: 'С каждой покупки начисляем бонусы на ваш счёт в личном кабинете. 1 бонус = 1 ₽ — ими можно оплатить следующий заказ хоть целиком.',
        editorialEyebrow: 'Ателье',
        editorialTitle: 'Сшито, чтобы остаться',
        editorialText: 'Мы отшиваем малые тиражи на производствах в Москве и Иваново. Каждая модель проходит три примерки, прежде чем попасть в магазин. Поэтому вещей немного, и каждая на своём месте.',
        editorialImage: '',
        editorialArt: { kind: 'knit', tone: '#3a3a3d' },
        benefits: [
          { id: 'b1', title: 'Доставка 1–3 дня', text: 'Курьером по Москве и СДЭК по всей России' },
          { id: 'b2', title: 'Примерка', text: 'Оплачиваете только то, что подошло' },
          { id: 'b3', title: 'Возврат 14 дней', text: 'Без объяснения причин, если сохранён вид' }
        ]
      },
      delivery: {
        methods: [
          { id: 'd1', name: 'Курьер по Москве', price: 500, freeFrom: 15000, desc: '1–2 дня, с примеркой', needsAddress: true },
          { id: 'd2', name: 'СДЭК, пункт выдачи', price: 450, freeFrom: 15000, desc: '2–6 дней по России', needsAddress: true },
          { id: 'd3', name: 'Самовывоз из шоурума', price: 0, freeFrom: 0, desc: 'Москва, ул. Петровка, 21', needsAddress: false }
        ]
      },
      payment: {
        provider: 'demo',
        online: true,
        cod: true,
        onlineLabel: 'Картой или СБП онлайн',
        codLabel: 'При получении',
        yookassa: { shopId: '', taxSystem: 2, vatCode: 1, sendReceipt: true }
      },
      footerNote: 'Цены указаны в рублях.',
      badges: {
        new: { text: 'Новинка', color: '#2b50ff' },
        sale: { text: 'Скидка {n}%', color: '#e5372b' },
        hit: { text: 'Хит продаж', color: '#ffc400' }
      },
      // Бонусная программа: 1 бонус = 1 ₽. creditOn: 'paid' — после оплаты, 'done' — когда заказ выполнен
      bonus: { enabled: true, percent: 5, creditOn: 'paid' },
      legal: 'ИП Иванов И. И., ИНН 000000000000, ОГРНИП 000000000000000'
    },

    categories: [
      { id: 'c1', name: 'Верхняя одежда', slug: 'outerwear', image: '', art: { kind: 'coat', tone: '#38383b' }, order: 1 },
      { id: 'c2', name: 'Трикотаж', slug: 'knitwear', image: '', art: { kind: 'knit', tone: '#58585c' }, order: 2 },
      { id: 'c3', name: 'Рубашки и футболки', slug: 'shirts', image: '', art: { kind: 'shirt', tone: '#6a6a6e' }, order: 3 },
      { id: 'c4', name: 'Брюки', slug: 'trousers', image: '', art: { kind: 'trousers', tone: '#2c2c2f' }, order: 4 },
      { id: 'c5', name: 'Платья', slug: 'dresses', image: '', art: { kind: 'dress', tone: '#444448' }, order: 5 },
      { id: 'c6', name: 'Аксессуары', slug: 'accessories', image: '', art: { kind: 'bag', tone: '#1f1f21' }, order: 6 }
    ],

    sizeCharts: [
      {
        id: 'sc1', name: 'Женская одежда',
        columns: ['Размер', 'RU', 'Обхват груди, см', 'Обхват талии, см', 'Обхват бёдер, см'],
        rows: [
          ['XS', '40–42', '80–84', '62–66', '88–92'],
          ['S', '42–44', '84–88', '66–70', '92–96'],
          ['M', '44–46', '88–92', '70–74', '96–100'],
          ['L', '46–48', '92–96', '74–78', '100–104'],
          ['XL', '48–50', '96–100', '78–82', '104–108']
        ],
        note: 'Если ваши мерки между размерами, для свободной посадки выбирайте больший.'
      },
      {
        id: 'sc2', name: 'Мужская одежда',
        columns: ['Размер', 'RU', 'Обхват груди, см', 'Обхват талии, см', 'Рост, см'],
        rows: [
          ['S', '46', '90–94', '78–82', '170–176'],
          ['M', '48', '94–98', '82–86', '176–182'],
          ['L', '50', '98–102', '86–90', '182–188'],
          ['XL', '52', '102–106', '90–94', '182–188'],
          ['XXL', '54', '106–110', '94–98', '188–194']
        ],
        note: 'Обхват груди измеряйте по самым выступающим точкам, лента проходит под мышками.'
      },
      {
        id: 'sc3', name: 'Брюки (талия)',
        columns: ['Размер', 'Обхват талии, см', 'Обхват бёдер, см', 'Длина по внутр. шву, см'],
        rows: [
          ['44', '68–72', '92–96', '80'],
          ['46', '72–76', '96–100', '81'],
          ['48', '76–80', '100–104', '82'],
          ['50', '80–84', '104–108', '83'],
          ['52', '84–88', '108–112', '84']
        ],
        note: ''
      }
    ],

    products: [
      {
        "id": "p1",
        "slug": "palto-oversize-iz-shersti",
        "name": "Пальто оверсайз из шерсти",
        "categoryId": "c1",
        "gender": "women",
        "price": 38900,
        "compareAt": 0,
        "tags": [
          "new"
        ],
        "colors": [
          {
            "id": "col1",
            "name": "Графит",
            "hex": "#3a3734",
            "images": [],
            "art": {
              "kind": "coat",
              "tone": "#3a3734"
            },
            "sizes": [
              {
                "size": "XS",
                "stock": 2
              },
              {
                "size": "S",
                "stock": 4
              },
              {
                "size": "M",
                "stock": 3
              },
              {
                "size": "L",
                "stock": 0
              },
              {
                "size": "XL",
                "stock": 1
              }
            ]
          },
          {
            "id": "col2",
            "name": "Верблюжий",
            "hex": "#9a7a55",
            "images": [],
            "art": {
              "kind": "coat",
              "tone": "#9a7a55"
            },
            "sizes": [
              {
                "size": "XS",
                "stock": 1
              },
              {
                "size": "S",
                "stock": 3
              },
              {
                "size": "M",
                "stock": 3
              },
              {
                "size": "L",
                "stock": 2
              },
              {
                "size": "XL",
                "stock": 0
              }
            ]
          }
        ],
        "description": "Пальто прямого силуэта со спущенной линией плеча. Двубортная застёжка, глубокие карманы в боковых швах, шлица на спинке. Длина ниже колена.",
        "composition": "80% шерсть, 20% полиамид. Подкладка: 100% вискоза.",
        "care": "Только сухая чистка. Хранить на широких плечиках в чехле.",
        "sizeChartId": "sc1",
        "active": true,
        "createdAt": "2026-10-01"
      },
      {
        "id": "p2",
        "slug": "trench-hlopkovyj",
        "name": "Тренч из плотного хлопка",
        "categoryId": "c1",
        "gender": "unisex",
        "price": 29900,
        "compareAt": 34900,
        "tags": [],
        "colors": [
          {
            "id": "col1",
            "name": "Табак",
            "hex": "#6b543c",
            "images": [],
            "art": {
              "kind": "coat",
              "tone": "#5a4a3a"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 3
              },
              {
                "size": "M",
                "stock": 5
              },
              {
                "size": "L",
                "stock": 2
              },
              {
                "size": "XL",
                "stock": 2
              }
            ]
          }
        ],
        "description": "Классический тренч с погонами, поясом и кокеткой на спинке. Водоотталкивающая пропитка.",
        "composition": "100% хлопок габардин.",
        "care": "Деликатная стирка при 30 °C или сухая чистка.",
        "sizeChartId": "sc1",
        "active": true,
        "createdAt": "2026-08-20"
      },
      {
        "id": "p3",
        "slug": "dzhemper-kashemir",
        "name": "Джемпер из кашемира",
        "categoryId": "c2",
        "gender": "women",
        "price": 21500,
        "compareAt": 0,
        "tags": [
          "new"
        ],
        "colors": [
          {
            "id": "col1",
            "name": "Молочный",
            "hex": "#e6dfd2",
            "images": [],
            "art": {
              "kind": "knit",
              "tone": "#8a8378"
            },
            "sizes": [
              {
                "size": "XS",
                "stock": 3
              },
              {
                "size": "S",
                "stock": 6
              },
              {
                "size": "M",
                "stock": 6
              },
              {
                "size": "L",
                "stock": 2
              }
            ]
          },
          {
            "id": "col2",
            "name": "Графит",
            "hex": "#3d3b39",
            "images": [],
            "art": {
              "kind": "knit",
              "tone": "#3d3b39"
            },
            "sizes": [
              {
                "size": "XS",
                "stock": 2
              },
              {
                "size": "S",
                "stock": 4
              },
              {
                "size": "M",
                "stock": 4
              },
              {
                "size": "L",
                "stock": 1
              }
            ]
          },
          {
            "id": "col3",
            "name": "Карамель",
            "hex": "#a27650",
            "images": [],
            "art": {
              "kind": "knit",
              "tone": "#a27650"
            },
            "sizes": [
              {
                "size": "XS",
                "stock": 0
              },
              {
                "size": "S",
                "stock": 2
              },
              {
                "size": "M",
                "stock": 3
              },
              {
                "size": "L",
                "stock": 2
              }
            ]
          }
        ],
        "description": "Мягкий джемпер свободного кроя с круглым вырезом. Плотная резинка по низу и манжетам.",
        "composition": "100% кашемир.",
        "care": "Ручная стирка в холодной воде, сушить горизонтально.",
        "sizeChartId": "sc1",
        "active": true,
        "createdAt": "2026-10-05"
      },
      {
        "id": "p4",
        "slug": "kardigan-merinos",
        "name": "Кардиган из мериноса",
        "categoryId": "c2",
        "gender": "women",
        "price": 16900,
        "compareAt": 0,
        "tags": ["hit"],
        "colors": [
          {
            "id": "col1",
            "name": "Антрацит",
            "hex": "#3f3e3c",
            "images": [],
            "art": {
              "kind": "knit",
              "tone": "#3f3e3c"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 4
              },
              {
                "size": "M",
                "stock": 4
              },
              {
                "size": "L",
                "stock": 3
              }
            ]
          }
        ],
        "description": "Удлинённый кардиган на пуговицах из рога. Подходит для многослойных образов.",
        "composition": "100% шерсть мериноса.",
        "care": "Ручная стирка при 30 °C.",
        "sizeChartId": "sc1",
        "active": true,
        "createdAt": "2026-09-12"
      },
      {
        "id": "p5",
        "slug": "rubashka-poplin",
        "name": "Рубашка из поплина",
        "categoryId": "c3",
        "gender": "men",
        "price": 9900,
        "compareAt": 0,
        "tags": [],
        "colors": [
          {
            "id": "col1",
            "name": "Белый",
            "hex": "#ece9e3",
            "images": [],
            "art": {
              "kind": "shirt",
              "tone": "#b8b2a7"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 8
              },
              {
                "size": "M",
                "stock": 8
              },
              {
                "size": "L",
                "stock": 5
              },
              {
                "size": "XL",
                "stock": 3
              }
            ]
          }
        ],
        "description": "Рубашка свободного кроя с потайной планкой и удлинённой спинкой.",
        "composition": "100% хлопок.",
        "care": "Стирка при 40 °C, гладить с изнанки.",
        "sizeChartId": "sc2",
        "active": true,
        "createdAt": "2026-07-30"
      },
      {
        "id": "p6",
        "slug": "futbolka-plotnaya",
        "name": "Футболка плотная",
        "categoryId": "c3",
        "gender": "men",
        "price": 5900,
        "compareAt": 0,
        "tags": [
          "new"
        ],
        "colors": [
          {
            "id": "col1",
            "name": "Чёрный",
            "hex": "#1d1c1b",
            "images": [],
            "art": {
              "kind": "tee",
              "tone": "#2c2b2a"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 10
              },
              {
                "size": "M",
                "stock": 12
              },
              {
                "size": "L",
                "stock": 9
              },
              {
                "size": "XL",
                "stock": 6
              },
              {
                "size": "XXL",
                "stock": 3
              }
            ]
          },
          {
            "id": "col2",
            "name": "Белый",
            "hex": "#ece9e3",
            "images": [],
            "art": {
              "kind": "tee",
              "tone": "#ece9e3"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 8
              },
              {
                "size": "M",
                "stock": 10
              },
              {
                "size": "L",
                "stock": 6
              },
              {
                "size": "XL",
                "stock": 4
              },
              {
                "size": "XXL",
                "stock": 2
              }
            ]
          },
          {
            "id": "col3",
            "name": "Хаки",
            "hex": "#5b5a45",
            "images": [],
            "art": {
              "kind": "tee",
              "tone": "#5b5a45"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 3
              },
              {
                "size": "M",
                "stock": 5
              },
              {
                "size": "L",
                "stock": 4
              },
              {
                "size": "XL",
                "stock": 2
              },
              {
                "size": "XXL",
                "stock": 0
              }
            ]
          }
        ],
        "description": "Футболка из плотного хлопка 240 г/м², держит форму после стирок.",
        "composition": "100% хлопок.",
        "care": "Стирка при 30 °C, наизнанку.",
        "sizeChartId": "sc2",
        "active": true,
        "createdAt": "2026-10-08"
      },
      {
        "id": "p7",
        "slug": "bryuki-so-strelkami",
        "name": "Брюки со стрелками",
        "categoryId": "c4",
        "gender": "men",
        "price": 14900,
        "compareAt": 0,
        "tags": ["hit"],
        "colors": [
          {
            "id": "col1",
            "name": "Тёмно-серый",
            "hex": "#3a3a3c",
            "images": [],
            "art": {
              "kind": "trousers",
              "tone": "#3a3a3c"
            },
            "sizes": [
              {
                "size": "44",
                "stock": 2
              },
              {
                "size": "46",
                "stock": 4
              },
              {
                "size": "48",
                "stock": 4
              },
              {
                "size": "50",
                "stock": 2
              },
              {
                "size": "52",
                "stock": 1
              }
            ]
          },
          {
            "id": "col2",
            "name": "Тёмно-синий",
            "hex": "#2a3140",
            "images": [],
            "art": {
              "kind": "trousers",
              "tone": "#2a3140"
            },
            "sizes": [
              {
                "size": "44",
                "stock": 1
              },
              {
                "size": "46",
                "stock": 3
              },
              {
                "size": "48",
                "stock": 3
              },
              {
                "size": "50",
                "stock": 2
              },
              {
                "size": "52",
                "stock": 0
              }
            ]
          }
        ],
        "description": "Прямые брюки из костюмной шерсти со стрелками и защипами на поясе.",
        "composition": "98% шерсть, 2% эластан.",
        "care": "Сухая чистка.",
        "sizeChartId": "sc3",
        "active": true,
        "createdAt": "2026-09-01"
      },
      {
        "id": "p8",
        "slug": "bryuki-shirokie",
        "name": "Широкие брюки из шерсти",
        "categoryId": "c4",
        "gender": "women",
        "price": 16500,
        "compareAt": 0,
        "tags": [],
        "colors": [
          {
            "id": "col1",
            "name": "Карамель",
            "hex": "#a27650",
            "images": [],
            "art": {
              "kind": "trousers",
              "tone": "#6b5440"
            },
            "sizes": [
              {
                "size": "44",
                "stock": 3
              },
              {
                "size": "46",
                "stock": 3
              },
              {
                "size": "48",
                "stock": 2
              }
            ]
          }
        ],
        "description": "Широкие брюки с высокой посадкой и отворотами.",
        "composition": "70% шерсть, 30% полиэстер.",
        "care": "Сухая чистка.",
        "sizeChartId": "sc3",
        "active": true,
        "createdAt": "2026-08-10"
      },
      {
        "id": "p9",
        "slug": "plate-sherst-midi",
        "name": "Платье миди из шерсти",
        "categoryId": "c5",
        "gender": "women",
        "price": 24900,
        "compareAt": 0,
        "tags": [
          "new"
        ],
        "colors": [
          {
            "id": "col1",
            "name": "Шоколад",
            "hex": "#4a3428",
            "images": [],
            "art": {
              "kind": "dress",
              "tone": "#4a3428"
            },
            "sizes": [
              {
                "size": "XS",
                "stock": 2
              },
              {
                "size": "S",
                "stock": 3
              },
              {
                "size": "M",
                "stock": 2
              },
              {
                "size": "L",
                "stock": 1
              }
            ]
          },
          {
            "id": "col2",
            "name": "Чёрный",
            "hex": "#1f1d1c",
            "images": [],
            "art": {
              "kind": "dress",
              "tone": "#1f1d1c"
            },
            "sizes": [
              {
                "size": "XS",
                "stock": 1
              },
              {
                "size": "S",
                "stock": 2
              },
              {
                "size": "M",
                "stock": 2
              },
              {
                "size": "L",
                "stock": 1
              }
            ]
          }
        ],
        "description": "Платье миди приталенного силуэта с застёжкой-молнией на спинке.",
        "composition": "95% шерсть, 5% эластан. Подкладка: 100% купро.",
        "care": "Сухая чистка.",
        "sizeChartId": "sc1",
        "active": true,
        "createdAt": "2026-10-03"
      },
      {
        "id": "p10",
        "slug": "sumka-tout-kozha",
        "name": "Сумка-тоут из кожи",
        "categoryId": "c6",
        "gender": "unisex",
        "price": 32000,
        "compareAt": 0,
        "tags": [],
        "colors": [
          {
            "id": "col1",
            "name": "Коньяк",
            "hex": "#7a4e2e",
            "images": [],
            "art": {
              "kind": "bag",
              "tone": "#6e4a30"
            },
            "sizes": [
              {
                "size": "Единый",
                "stock": 5
              }
            ]
          }
        ],
        "description": "Вместительная сумка из итальянской кожи растительного дубления. Внутренний карман на молнии.",
        "composition": "100% натуральная кожа.",
        "care": "Протирать сухой мягкой тканью, использовать крем для кожи.",
        "sizeChartId": "",
        "active": true,
        "createdAt": "2026-06-15"
      },
      {
        "id": "p11",
        "slug": "palto-muzhskoe-shersti",
        "name": "Пальто мужское из шерсти",
        "categoryId": "c1",
        "gender": "men",
        "price": 42900,
        "compareAt": 0,
        "tags": [
          "new"
        ],
        "colors": [
          {
            "id": "col1",
            "name": "Антрацит",
            "hex": "#323130",
            "images": [],
            "art": {
              "kind": "coat",
              "tone": "#323130"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 2
              },
              {
                "size": "M",
                "stock": 3
              },
              {
                "size": "L",
                "stock": 3
              },
              {
                "size": "XL",
                "stock": 2
              },
              {
                "size": "XXL",
                "stock": 1
              }
            ]
          },
          {
            "id": "col2",
            "name": "Кэмел",
            "hex": "#8a6a48",
            "images": [],
            "art": {
              "kind": "coat",
              "tone": "#8a6a48"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 1
              },
              {
                "size": "M",
                "stock": 2
              },
              {
                "size": "L",
                "stock": 2
              },
              {
                "size": "XL",
                "stock": 1
              },
              {
                "size": "XXL",
                "stock": 0
              }
            ]
          }
        ],
        "description": "Однобортное пальто прямого кроя длиной до середины бедра. Потайная застёжка, два кармана с клапанами, внутренний карман для телефона.",
        "composition": "90% шерсть, 10% кашемир. Подкладка: 100% вискоза.",
        "care": "Только сухая чистка.",
        "sizeChartId": "sc2",
        "active": true,
        "createdAt": "2026-10-06"
      },
      {
        "id": "p12",
        "slug": "sviter-muzhskoj-merinos",
        "name": "Свитер мужской из мериноса",
        "categoryId": "c2",
        "gender": "men",
        "price": 15900,
        "compareAt": 0,
        "tags": [],
        "colors": [
          {
            "id": "col1",
            "name": "Графит",
            "hex": "#3a3734",
            "images": [],
            "art": {
              "kind": "knit",
              "tone": "#3a3734"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 3
              },
              {
                "size": "M",
                "stock": 5
              },
              {
                "size": "L",
                "stock": 4
              },
              {
                "size": "XL",
                "stock": 2
              },
              {
                "size": "XXL",
                "stock": 1
              }
            ]
          },
          {
            "id": "col2",
            "name": "Молочный",
            "hex": "#e6dfd2",
            "images": [],
            "art": {
              "kind": "knit",
              "tone": "#d9d1c3"
            },
            "sizes": [
              {
                "size": "S",
                "stock": 2
              },
              {
                "size": "M",
                "stock": 3
              },
              {
                "size": "L",
                "stock": 3
              },
              {
                "size": "XL",
                "stock": 1
              },
              {
                "size": "XXL",
                "stock": 0
              }
            ]
          }
        ],
        "description": "Свитер свободной посадки с высоким воротом. Плотная вязка, держит форму.",
        "composition": "100% шерсть мериноса.",
        "care": "Ручная стирка при 30 °C, сушить горизонтально.",
        "sizeChartId": "sc2",
        "active": true,
        "createdAt": "2026-09-20"
      }
    ],

    promotions: [
      {
        id: 'a1', title: 'Неделя трикотажа', description: 'Скидка 15% на весь трикотаж до конца месяца.',
        type: 'percent', value: 15, scope: 'categories', categoryIds: ['c2'], productIds: [],
        startsAt: '2026-10-01', endsAt: '2026-10-31', active: true
      }
    ],

    promocodes: [
      { id: 'pc1', code: 'WELCOME10', type: 'percent', value: 10, minTotal: 0, startsAt: '', endsAt: '', limit: 0, used: 0, onePerCustomer: true, onlyRegistered: true, firstOrderOnly: true, excludeSale: true, active: true, note: 'Скидка на первый заказ' },
      { id: 'pc2', code: 'AUTUMN3000', type: 'fixed', value: 3000, minTotal: 25000, startsAt: '2026-10-01', endsAt: '2026-11-30', limit: 200, used: 0, onePerCustomer: false, onlyRegistered: false, excludeSale: false, active: true, note: 'Осенняя рассылка' },
      { id: 'pc3', code: 'FREESHIP', type: 'shipping', value: 0, minTotal: 5000, startsAt: '', endsAt: '', limit: 0, used: 0, onePerCustomer: false, onlyRegistered: false, excludeSale: false, active: true, note: 'Бесплатная доставка' }
    ],

    pages: [
      { id: 'pg1', slug: 'about', title: 'О бренде', inFooter: true, group: 'brand',
        body: 'ALBAKOV — московский бренд одежды в спокойной гамме.\n\nМы делаем небольшие коллекции из натуральных тканей и отшиваем их малыми тиражами. Нам важно, чтобы вещь служила долго, сочеталась с остальным гардеробом и не требовала объяснений.\n\n## Шоурум\n\nМосква, ул. Петровка, 21. Ежедневно с 10:00 до 22:00. Приходите на примерку, кофе за нами.' },
      { id: 'pg2', slug: 'delivery', title: 'Доставка и оплата', inFooter: true, group: 'help',
        body: '## Доставка\n\n- Курьер по Москве — 1–2 дня, 500 ₽, с примеркой.\n- СДЭК по России — 2–6 дней, 450 ₽.\n- Самовывоз из шоурума — бесплатно.\n\nПри заказе от 15 000 ₽ доставка бесплатная.\n\n## Оплата\n\nБанковской картой или через СБП на сайте, а также при получении. Чек приходит на электронную почту.' },
      { id: 'pg3', slug: 'returns', title: 'Обмен и возврат', inFooter: true, group: 'help',
        body: 'Вернуть или обменять товар можно в течение 14 дней с момента получения, если сохранены товарный вид, бирки и упаковка.\n\nНапишите нам на почту или в Telegram — пришлём инструкцию и оформим курьера.\n\nДеньги возвращаются на карту в течение 10 рабочих дней.' },
      { id: 'pg4', slug: 'care', title: 'Уход за вещами', inFooter: true, group: 'help',
        body: 'Шерсть и кашемир не любят частых стирок: проветривайте вещи и чистите щёткой.\n\nТрикотаж сушите горизонтально, чтобы он не растягивался.' },
      { id: 'pg5', slug: 'privacy', title: 'Политика конфиденциальности', inFooter: true, group: 'legal',
        body: 'Мы обрабатываем персональные данные (имя, фамилию, телефон, электронную почту, адрес доставки) только для исполнения заказов и связи с покупателем в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».\n\nДанные не передаются третьим лицам, кроме служб доставки и платёжного сервиса в объёме, необходимом для выполнения заказа.\n\nЧтобы удалить данные, напишите нам на электронную почту.' },
      { id: 'pg6', slug: 'offer', title: 'Публичная оферта', inFooter: true, group: 'legal',
        body: 'Замените этот текст договором публичной оферты вашего магазина. В нём указываются продавец, порядок оформления и оплаты заказа, доставка, возврат и ответственность сторон.' }
    ],

    orders: [],
    users: []
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SEED;
  else root.SEED = SEED;
})(this);
