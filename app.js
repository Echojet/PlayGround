/* ============================================================
   Tündük — home services in Bishkek
   A front-end product demo. No backend, all data stays local.
   ============================================================ */
(() => {
  'use strict';

  /* ---------- tiny helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = n => String(n).padStart(2, '0');
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const KEY = {
    profile: 'tunduk.profile.v1',
    bookings: 'tunduk.bookings.v1',
    prefs: 'tunduk.prefs.v1',
    draft: 'tunduk.draft.v1',
    seeded: 'tunduk.seeded.v1'
  };

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* private mode */ }
    }
  };

  const prefs = store.get(KEY.prefs, {});
  const state = {
    lang: ['ru', 'kg', 'en'].includes(prefs.lang) ? prefs.lang : 'ru',
    route: 'home',
    query: '',
    filter: 'all',
    tab: 'active',
    profile: null,
    bookings: [],
    booking: null,
    bookingStep: 1,
    success: null,
    successPro: null,
    lastFocus: null,
    ratingDraft: 0
  };

  const locales = { ru: 'ru-RU', kg: 'ky-KG', en: 'en-GB' };
  const dateLocale = () => locales[state.lang] || 'ru-RU';
  const L = value => (value && typeof value === 'object' ? (value[state.lang] ?? value.ru) : value);

  const localISO = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseISO = iso => {
    const [year, month, day] = String(iso).split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  };
  const today = () => parseISO(localISO());

  function money(amount) {
    const value = Math.round(Number(amount) || 0);
    if (state.lang === 'en') return `KGS ${value.toLocaleString('en-US')}`;
    return `${value.toLocaleString('ru-RU').replace(/\u00A0/g, ' ')} сом`;
  }
  function moneyShort(amount) {
    const value = Math.round(Number(amount) || 0);
    return state.lang === 'en' ? `KGS ${value.toLocaleString('en-US')}` : `${value.toLocaleString('ru-RU').replace(/\u00A0/g, ' ')} с.`;
  }
  function formatDate(iso, options = { day: 'numeric', month: 'long' }) {
    try {
      return new Intl.DateTimeFormat(dateLocale(), options).format(parseISO(iso));
    } catch {
      return formatDateFallback(iso, options);
    }
  }
  function formatDateFallback(iso, options = {}) {
    const d = parseISO(iso);
    const months = {
      ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
      kg: ['январдын', 'февралдын', 'марттын', 'апрелдин', 'майдын', 'июндун', 'июлдун', 'августтун', 'сентябрдын', 'октябрдын', 'ноябрдын', 'декабрдын'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    }[state.lang] || [];
    if (options.month === 'short') return `${d.getDate()} ${months[d.getMonth()]?.slice(0, 3)}`;
    if (options.weekday === 'short') {
      const weekdays = {
        ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
        kg: ['жек', 'дүй', 'шей', 'шар', 'бей', 'жума', 'ишм'],
        en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      }[state.lang] || [];
      return weekdays[d.getDay()];
    }
    return `${d.getDate()} ${months[d.getMonth()] || ''}`;
  }
  function weekdayShort(iso) {
    try { return new Intl.DateTimeFormat(dateLocale(), { weekday: 'short' }).format(parseISO(iso)).replace('.', ''); }
    catch { return formatDateFallback(iso, { weekday: 'short' }); }
  }
  function dateLabel(iso) {
    const isoToday = localISO();
    if (iso === isoToday) return t('today');
    if (iso === localISO(addDays(today(), 1))) return t('tomorrow');
    return formatDate(iso, { day: 'numeric', month: 'long' });
  }
  function bookingWhen(booking) {
    return `${dateLabel(booking.date)}, ${booking.slot}`;
  }
  function nameInitials(name) {
    return String(name || '')
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(part => part[0]?.toUpperCase() || '').join('');
  }
  function uid(prefix = 'TD') {
    return `${prefix}-${Math.floor(10000 + Math.random() * 89999)}`;
  }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  /* ---------- icons ---------- */
  const ICONS = {
    broom: '<path d="M14.4 4.2L8.9 12"/><path d="M5.5 12.8l6.8 3.8-2.9 4.2-6.1-4.6z"/><path d="M7.7 14.1l2.5 3.2M10.4 15.5l2.5 3"/>',
    sparkles: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.6 14l.7 2.1 2.2.7-2.2.7-.7 2.1-.7-2.1-2.2-.7 2.2-.7z"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 00-5.3 5.3l-5.1 5.1a2 2 0 102.9 2.9l5.1-5.1a4 4 0 005.3-5.3l-2.6 2.6-2.8-2.8z"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    snowflake: '<path d="M12 2v20M3.4 7l17.2 10M20.6 7L3.4 17"/><path d="M9 4.5L12 7l3-2.5M9 19.5L12 17l3 2.5"/>',
    sofa: '<path d="M4.5 12V8a2 2 0 012-2h11a2 2 0 012 2v4"/><path d="M2.5 13.5a2 2 0 114 0V16h11v-2.5a2 2 0 114 0V19h-19z"/><path d="M5 19v2M19 19v2"/>',
    washer: '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><circle cx="12" cy="14" r="4.6"/><path d="M8 6h.01M11 6h.01M15 6h2"/>',
    hammer: '<path d="M14.5 3.5l6 6-2.5 2.5-6-6z"/><path d="M12 6L3.7 14.3a2 2 0 000 2.8l3.2 3.2a2 2 0 002.8 0L18 12"/><path d="M4 20l2-2"/>',
    bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8V5M9 4l1.3 2M15 4l-1.3 2M5 11h2M17 11h2M5 16h2M17 16h2M7 9L5.5 7.2M17 9l1.5-1.8"/>',
    car: '<path d="M5 13l1.7-4.3A2 2 0 018.6 7.4h6.8a2 2 0 011.9 1.3L19 13"/><path d="M3.5 13h17a2 2 0 012 2v3.5h-21V15a2 2 0 012-2z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17" cy="18.5" r="1.6"/><path d="M6 16h1M17 16h1"/>',
    truck: '<path d="M2.5 6.5h10.8v10.8H2.5z"/><path d="M13.3 9.5h3.8l3.4 3.4v4.4h-7.2z"/><circle cx="6.5" cy="18.6" r="1.6"/><circle cx="17.2" cy="18.6" r="1.6"/>',
    pin: '<path d="M12 21.5s7-5.9 7-11.4a7 7 0 10-14 0c0 5.5 7 11.4 7 11.4z"/><circle cx="12" cy="10" r="2.5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    arrowLeft: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
    shield: '<path d="M12 2.5l7 3v6c0 4.5-3 7.7-7 10-4-2.3-7-5.5-7-10v-6z"/><path d="M9 12l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    phone: '<path d="M5 3h4l2 5-2.4 1.5a15.2 15.2 0 006 6L16 13l5 2v4a2 2 0 01-2 2A16.5 16.5 0 013 5a2 2 0 012-2z"/>',
    chat: '<path d="M21 11.5a8.2 8.2 0 01-8.5 8.2 9.4 9.4 0 01-3.5-.7L4 21l1.3-4.2a8.2 8.2 0 1115.7-5.3z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M5 5l14 14M19 5L5 19"/>',
    map: '<path d="M9 3L3 5.5v15L9 18l6 3 6-2.5v-15L15 6z"/><path d="M9 3v15M15 6v15"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/>',
    card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6 15h3"/>',
    cash: '<rect x="2.5" y="6" width="19" height="13" rx="2"/><circle cx="12" cy="12.5" r="3"/><path d="M6 10h.01M18 15h.01"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/><path d="M10 10v7M14 10v7"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    home: '<path d="M3 10.5L12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    bag: '<path d="M6 8h12l1 13H5z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 4"/><path d="M12 17h.01"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    telegram: '<path d="M21 4L3.5 10.7l5.3 1.8L11 19l3-4 4.7 3z"/><path d="M8.8 12.5L18 6.5l-6.5 9"/>',
    apple: '<path d="M16.5 12.4c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.6 2 1-.1 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.9-1 2.6-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.6-1-2.6-3z"/><path d="M14.4 5.9c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.8-.5 2.3-1.2z"/>',
    google: '<path d="M21.3 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.2a4.5 4.5 0 01-2 2.9v2.4h3.2c1.9-1.7 2.9-4.3 2.9-7.2z"/><path d="M12 21.5c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0012 21.5z"/><path d="M6.4 13.5a6 6 0 010-3.8V7.1H3.1a10 10 0 000 9z"/><path d="M12 6.5c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 003.1 7.1l3.3 2.6C7.2 8.3 9.4 6.5 12 6.5z"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 8 5-3 5 3-1.5-8"/>',
    leaf: '<path d="M20 4C10 4 4 9 4 16c0 2 .7 3.3.7 3.3S8 21 12 19c5-2.6 8-8 8-15z"/><path d="M4.5 19.5C7 14 12 10 17 8"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 5.2a3.2 3.2 0 010 6.1M18 14.5a6.5 6.5 0 013.5 5.5"/>',
    wallet: '<path d="M3 7.5A2.5 2.5 0 015.5 5H19v15H5.5A2.5 2.5 0 013 17.5z"/><path d="M3 8h16M15.5 12.5h2"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 6.1M20 5v6h-6"/>',
    logout: '<path d="M9 21H4V3h5M16 8l4 4-4 4M20 12H9"/>',
    star: '<path d="M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.4l6.2-.9z"/>'
  };

  function icon(name, size = 18, cls = '') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }
  function star(size = 13, cls = '') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="${cls}" aria-hidden="true">${ICONS.star}</svg>`;
  }
  function fullStars(count = 5, size = 12) {
    return Array.from({ length: count }, () => star(size)).join('');
  }

  /* ---------- data ---------- */
  const DISTRICTS = [
    { id: 'pervomay', name: { ru: 'Первомайский', kg: 'Первомай', en: 'Pervomay' }, zone: { ru: 'центр · Ала-Тоо', kg: 'борбор · Ала-Тоо', en: 'centre · Ala-Too' }, time: '15–25' },
    { id: 'sverdlov', name: { ru: 'Свердловский', kg: 'Свердлов', en: 'Sverdlov' }, zone: { ru: 'восток · Восток-5', kg: 'чыгыш · Восток-5', en: 'east · Vostok-5' }, time: '20–30' },
    { id: 'oktyabr', name: { ru: 'Октябрьский', kg: 'Октябрь', en: 'Oktyabr' }, zone: { ru: 'юг · Асанбай', kg: 'түштүк · Асанбай', en: 'south · Asanbay' }, time: '15–25' },
    { id: 'lenin', name: { ru: 'Ленинский', kg: 'Ленин', en: 'Lenin' }, zone: { ru: 'запад · Джал', kg: 'батыш · Жал', en: 'west · Jal' }, time: '20–30' }
  ];
  const districtName = id => {
    const district = DISTRICTS.find(item => item.id === id);
    return district ? L(district.name) : '';
  };

  const CATEGORIES = [
    { id: 'cleaning', icon: 'broom', service: 'cleaning' },
    { id: 'beauty', icon: 'sparkles', service: 'beauty' },
    { id: 'plumbing', icon: 'wrench', service: 'plumbing' },
    { id: 'electric', icon: 'bolt', service: 'electric' },
    { id: 'ac', icon: 'snowflake', service: 'ac' },
    { id: 'furniture', icon: 'sofa', service: 'furniture' },
    { id: 'laundry', icon: 'washer', service: 'laundry' },
    { id: 'handyman', icon: 'hammer', service: 'handyman' },
    { id: 'pest', icon: 'bug', service: 'pest' },
    { id: 'carwash', icon: 'car', service: 'carwash' }
  ];

  const SERVICES = [
    {
      id: 'cleaning', group: 'home', icon: 'broom', image: 'assets/img/cleaning.webp', badge: 'hit',
      title: { ru: 'Уборка квартиры', kg: 'Батир тазалоо', en: 'Home cleaning' },
      short: { ru: 'Уборка', kg: 'Тазалоо', en: 'Cleaning' },
      tagline: { ru: 'Регулярная и генеральная уборка', kg: 'Үзгүлтүксүз жана баш-аяк тазалоо', en: 'Regular and deep cleaning' },
      desc: {
        ru: 'Проверенные клинеры приедут со своими средствами и инвентарём. Наведём порядок в квартире, доме или офисе — по чек-листу из 48 пунктов.',
        kg: 'Текшерилген тазалоочулар өз каражаттары жана шаймандары менен келет. Батир, үй же кеңсени 48 пункттан турган текшерүү тизмеси боюнча тазалайбыз.',
        en: 'Vetted cleaners arrive with their own supplies and equipment. We tidy your flat, house or office against a 48-point checklist.'
      },
      from: 1800, rating: 4.9, reviews: 842, duration: { ru: '2–5 часов', kg: '2–5 саат', en: '2–5 hours' },
      includes: [
        { ru: 'Кухня и санузел', kg: 'Ашкана жана ванна', en: 'Kitchen and bathroom' },
        { ru: 'Пыль на всех поверхностях', kg: 'Бардык бетилердеги чаң', en: 'Dust on all surfaces' },
        { ru: 'Влажная уборка полов', kg: 'Полду нымдуу тазалоо', en: 'Wet floor cleaning' },
        { ru: 'Вынос мусора', kg: 'Таштандыны чыгаруу', en: 'Bin removal' }
      ],
      packages: [
        { id: 'base', name: { ru: 'Базовая · 1 комната', kg: 'Базалык · 1 бөлмө', en: 'Basic · 1 room' }, note: { ru: 'Поддерживающая уборка, 2 часа', kg: 'Күнүмдүк тазалоо, 2 саат', en: 'Routine clean, 2 hours' }, price: 1800, duration: { ru: '2 ч', kg: '2 саат', en: '2 h' } },
        { id: 'standard', name: { ru: 'Стандарт · 2 комнаты', kg: 'Стандарт · 2 бөлмө', en: 'Standard · 2 rooms' }, note: { ru: 'Кухня, санузел и комнаты', kg: 'Ашкана, ванна жана бөлмөлөр', en: 'Kitchen, bathroom and rooms' }, price: 2400, duration: { ru: '3 ч', kg: '3 саат', en: '3 h' }, popular: true },
        { id: 'deep', name: { ru: 'Генеральная уборка', kg: 'Баш-аяк тазалоо', en: 'Deep clean' }, note: { ru: 'Глубокая уборка всей квартиры', kg: 'Бүт батирди терең тазалоо', en: 'A thorough clean of the whole home' }, price: 4200, duration: { ru: '5 ч', kg: '5 саат', en: '5 h' } }
      ],
      extras: [
        { id: 'windows', name: { ru: 'Окна, до 3 створок', kg: 'Терезелер, 3 канатчага чейин', en: 'Windows, up to 3 panes' }, price: 600 },
        { id: 'fridge', name: { ru: 'Холодильник внутри', kg: 'Муздаткычтын ичи', en: 'Inside the fridge' }, price: 400 },
        { id: 'balcony', name: { ru: 'Балкон', kg: 'Балкон', en: 'Balcony' }, price: 500 },
        { id: 'ironing', name: { ru: 'Глажка, 1 час', kg: 'Үтүктөө, 1 саат', en: 'Ironing, 1 hour' }, price: 500 }
      ]
    },
    {
      id: 'beauty', group: 'beauty', icon: 'sparkles', image: 'assets/img/beauty.webp', badge: 'hit',
      title: { ru: 'Красота и спа', kg: 'Сулуулук жана спа', en: 'Beauty & spa' },
      short: { ru: 'Красота', kg: 'Сулуулук', en: 'Beauty' },
      tagline: { ru: 'Стрижка, маникюр и массаж дома', kg: 'Үйдө чач кыркуу, маникюр жана массаж', en: 'Hair, nails and massage at home' },
      desc: {
        ru: 'Мастера приедут с профессиональной косметикой и оборудованием. Стерильные инструменты, комфорт и никаких очередей.',
        kg: 'Мастерлер кесиптик косметика жана жабдуулар менен келет. Стерилдүү шаймандар, ыңгайлуулук жана кезек жок.',
        en: 'Beauticians arrive with professional products and equipment. Sterile tools, total comfort and no queues.'
      },
      from: 1200, rating: 4.95, reviews: 516, duration: { ru: '1–2 часа', kg: '1–2 саат', en: '1–2 hours' },
      includes: [
        { ru: 'Стерильные инструменты', kg: 'Стерилдүү шаймандар', en: 'Sterile tools' },
        { ru: 'Профессиональная косметика', kg: 'Кесиптик косметика', en: 'Professional products' },
        { ru: 'Удобное время до 22:00', kg: '22:00гө чейин ыңгайлуу убакыт', en: 'Appointments until 10 pm' },
        { ru: 'Мастер того же пола', kg: 'Ошол эле жыныстагы мастер', en: 'A therapist of the same gender' }
      ],
      packages: [
        { id: 'haircut', name: { ru: 'Стрижка и укладка', kg: 'Чач кыркуу жана укладка', en: 'Cut and blow-dry' }, note: { ru: 'Женская или мужская, 1 час', kg: 'Аял же эркек, 1 саат', en: 'Women’s or men’s, 1 hour' }, price: 1200, duration: { ru: '1 ч', kg: '1 саат', en: '1 h' } },
        { id: 'manicure', name: { ru: 'Маникюр с покрытием', kg: 'Маникюр, гель-лак менен', en: 'Gel manicure' }, note: { ru: 'Гель-лак и дизайн двух ногтей', kg: 'Гель-лак жана эки тырмактын дизайны', en: 'Gel polish and two nail art designs' }, price: 1300, duration: { ru: '1,5 ч', kg: '1,5 саат', en: '1.5 h' }, popular: true },
        { id: 'massage', name: { ru: 'Массаж 60 минут', kg: 'Массаж 60 мүнөт', en: '60-minute massage' }, note: { ru: 'Расслабляющий или спортивный', kg: 'Эс алдыруучу же спорттук', en: 'Relaxing or sports massage' }, price: 1800, duration: { ru: '1 ч', kg: '1 саат', en: '1 h' } }
      ],
      extras: [
        { id: 'pedicure', name: { ru: 'Педикюр', kg: 'Педикюр', en: 'Pedicure' }, price: 900 },
        { id: 'lashes', name: { ru: 'Наращивание ресниц', kg: 'Кирпик узартуу', en: 'Lash extensions' }, price: 1200 },
        { id: 'evening', name: { ru: 'Вечерний выезд после 20:00', kg: '20:00дөн кийин кечки чыгуу', en: 'Evening visit after 8 pm' }, price: 300 }
      ]
    },
    {
      id: 'plumbing', group: 'repair', icon: 'wrench', image: 'assets/img/plumbing.webp', badge: null,
      title: { ru: 'Сантехника', kg: 'Сантехника', en: 'Plumbing' },
      short: { ru: 'Сантехника', kg: 'Сантехника', en: 'Plumbing' },
      tagline: { ru: 'Протечки, смесители, унитазы', kg: 'Агып кетүү, смеситель, унитаз', en: 'Leaks, taps and toilets' },
      desc: {
        ru: 'Мастер приедет с инструментом и базовыми запчастями. Сначала назовёт точную цену, потом начнёт работу.',
        kg: 'Мастер шайман жана негизги тетиктер менен келет. Адегенде так бааны айтат, анан ишке киришет.',
        en: 'The plumber arrives with tools and common parts. You get an exact price before any work begins.'
      },
      from: 700, rating: 4.88, reviews: 634, duration: { ru: '30 мин – 2 часа', kg: '30 мүн – 2 саат', en: '30 min – 2 hours' },
      includes: [
        { ru: 'Диагностика при выезде', kg: 'Келгенде диагностика', en: 'On-site diagnosis' },
        { ru: 'Свой инструмент', kg: 'Өз шайманы', en: 'Own tools' },
        { ru: 'Гарантия 30 дней', kg: '30 күн кепилдик', en: '30-day guarantee' },
        { ru: 'Уборка после работы', kg: 'Иштен кийин тазалоо', en: 'Clean-up afterwards' }
      ],
      packages: [
        { id: 'diagnostics', name: { ru: 'Диагностика', kg: 'Диагностика', en: 'Diagnostics' }, note: { ru: 'Осмотр и точная смета', kg: 'Карап чыгуу жана так смета', en: 'Inspection and a fixed quote' }, price: 700, duration: { ru: '30 мин', kg: '30 мүн', en: '30 min' } },
        { id: 'mixer', name: { ru: 'Замена смесителя', kg: 'Смесителди алмаштыруу', en: 'Replace a tap' }, note: { ru: 'Демонтаж, монтаж, проверка', kg: 'Демонтаж, монтаж, текшерүү', en: 'Removal, fitting and testing' }, price: 1200, duration: { ru: '1 ч', kg: '1 саат', en: '1 h' }, popular: true },
        { id: 'toilet', name: { ru: 'Установка унитаза', kg: 'Унитаз орнотуу', en: 'Install a toilet' }, note: { ru: 'Без стоимости самого унитаза', kg: 'Унитаздын баасысыз', en: 'Toilet itself not included' }, price: 1800, duration: { ru: '2 ч', kg: '2 саат', en: '2 h' } }
      ],
      extras: [
        { id: 'urgent', name: { ru: 'Срочный выезд', kg: 'Шашылыш чыгуу', en: 'Priority visit' }, price: 500 },
        { id: 'night', name: { ru: 'Ночной выезд после 22:00', kg: '22:00дөн кийин түнкү чыгуу', en: 'Night visit after 10 pm' }, price: 800 },
        { id: 'removal', name: { ru: 'Вывоз старой техники', kg: 'Эски техниканы чыгаруу', en: 'Old fixture removal' }, price: 400 }
      ]
    },
    {
      id: 'electric', group: 'repair', icon: 'bolt', image: 'assets/img/electric.webp', badge: null,
      title: { ru: 'Электрика', kg: 'Электр', en: 'Electrical' },
      short: { ru: 'Электрика', kg: 'Электр', en: 'Electrical' },
      tagline: { ru: 'Розетки, свет, щитки', kg: 'Розетка, жарык, щит', en: 'Sockets, lights and panels' },
      desc: {
        ru: 'Электрики с допуском и опытом в жилых домах. Работаем аккуратно, проверяем нагрузку и оставляем чисто.',
        kg: 'Турак жайларда тажрыйбасы бар электриктер. Так иштейбиз, жүктөмдү текшеребиз жана таза калтырабыз.',
        en: 'Licensed electricians with residential experience. We work neatly, check the load and leave no mess.'
      },
      from: 600, rating: 4.92, reviews: 421, duration: { ru: '30 мин – 3 часа', kg: '30 мүн – 3 саат', en: '30 min – 3 hours' },
      includes: [
        { ru: 'Проверка проводки', kg: 'Зымдарды текшерүү', en: 'Wiring check' },
        { ru: 'Сертифицированные материалы', kg: 'Сертификатталган материалдар', en: 'Certified materials' },
        { ru: 'Безопасный монтаж', kg: 'Коопсуз монтаж', en: 'Safe installation' },
        { ru: 'Гарантия 30 дней', kg: '30 күн кепилдик', en: '30-day guarantee' }
      ],
      packages: [
        { id: 'diagnostics', name: { ru: 'Диагностика', kg: 'Диагностика', en: 'Diagnostics' }, note: { ru: 'Поиск неисправности', kg: 'Бузуктукту издөө', en: 'Fault finding' }, price: 600, duration: { ru: '30 мин', kg: '30 мүн', en: '30 min' } },
        { id: 'socket', name: { ru: 'Розетка или выключатель', kg: 'Розетка же өчүргүч', en: 'Socket or switch' }, note: { ru: 'Замена или установка', kg: 'Алмаштыруу же орнотуу', en: 'Replacement or installation' }, price: 900, duration: { ru: '1 ч', kg: '1 саат', en: '1 h' }, popular: true },
        { id: 'panel', name: { ru: 'Электрощиток', kg: 'Электр щити', en: 'Consumer unit' }, note: { ru: 'Сборка и маркировка', kg: 'Жыйноо жана белгилөө', en: 'Assembly and labelling' }, price: 2000, duration: { ru: '3 ч', kg: '3 саат', en: '3 h' } }
      ],
      extras: [
        { id: 'chandelier', name: { ru: 'Повесить люстру', kg: 'Люстраны илишүү', en: 'Hang a chandelier' }, price: 500 },
        { id: 'cable', name: { ru: 'Кабель, за метр', kg: 'Кабель, метр үчүн', en: 'Cable, per metre' }, price: 150 },
        { id: 'urgent', name: { ru: 'Срочный выезд', kg: 'Шашылыш чыгуу', en: 'Priority visit' }, price: 400 }
      ]
    },
    {
      id: 'ac', group: 'repair', icon: 'snowflake', image: 'assets/img/home.webp', badge: null,
      title: { ru: 'Кондиционеры', kg: 'Кондиционерлер', en: 'Air conditioning' },
      short: { ru: 'Кондиционеры', kg: 'Кондиционер', en: 'Air con' },
      tagline: { ru: 'Чистка, заправка, установка', kg: 'Тазалоо, фреон куюу, орнотуу', en: 'Cleaning, refill and install' },
      desc: {
        ru: 'Сервис кондиционеров любых брендов. Чистим дренаж и фильтры, проверяем давление фреона, работаем без грязи.',
        kg: 'Ар кандай бренддеги кондиционерлерди тейлейбиз. Дренажды жана фильтрлерди тазалайбыз, фреондун басымын текшеребиз.',
        en: 'Service for every major air-con brand. We clean filters and drains, check refrigerant pressure and protect your walls.'
      },
      from: 1800, rating: 4.9, reviews: 388, duration: { ru: '1–4 часа', kg: '1–4 саат', en: '1–4 hours' },
      includes: [
        { ru: 'Диагностика системы', kg: 'Системаны диагностикалоо', en: 'System diagnostics' },
        { ru: 'Защита мебели и стен', kg: 'Эмерек жана дубалдарды коргоо', en: 'Furniture and wall protection' },
        { ru: 'Чистка дренажа', kg: 'Дренажды тазалоо', en: 'Drain cleaning' },
        { ru: 'Гарантия на работы', kg: 'Ишке кепилдик', en: 'Workmanship guarantee' }
      ],
      packages: [
        { id: 'clean', name: { ru: 'Чистка кондиционера', kg: 'Кондиционерди тазалоо', en: 'Air-con clean' }, note: { ru: 'Внутренний блок, фильтры, дренаж', kg: 'Ички блок, фильтрлер, дренаж', en: 'Indoor unit, filters and drain' }, price: 1800, duration: { ru: '2 ч', kg: '2 саат', en: '2 h' }, popular: true },
        { id: 'refill', name: { ru: 'Заправка фреоном', kg: 'Фреон куюу', en: 'Refrigerant refill' }, note: { ru: 'R410A или R32', kg: 'R410A же R32', en: 'R410A or R32' }, price: 3500, duration: { ru: '2 ч', kg: '2 саат', en: '2 h' } },
        { id: 'install', name: { ru: 'Установка блока', kg: 'Блок орнотуу', en: 'Unit installation' }, note: { ru: 'Новый внутренний блок', kg: 'Жаңы ички блок', en: 'New indoor unit' }, price: 4500, duration: { ru: '4 ч', kg: '4 саат', en: '4 h' } }
      ],
      extras: [
        { id: 'antibacterial', name: { ru: 'Антибактериальная обработка', kg: 'Антибактериалдык иштетүү', en: 'Antibacterial treatment' }, price: 400 },
        { id: 'drain', name: { ru: 'Промывка дренажа', kg: 'Дренажды жуу', en: 'Drain flush' }, price: 300 },
        { id: 'second', name: { ru: 'Второй блок', kg: 'Экинчи блок', en: 'Second unit' }, price: 1500 }
      ]
    },
    {
      id: 'furniture', group: 'home', icon: 'sofa', image: 'assets/img/furniture.webp', badge: null,
      title: { ru: 'Химчистка мебели', kg: 'Эмеректерди химиялык тазалоо', en: 'Upholstery cleaning' },
      short: { ru: 'Химчистка', kg: 'Химтазалоо', en: 'Upholstery' },
      tagline: { ru: 'Диваны, ковры и матрасы', kg: 'Диван, килем жана матрас', en: 'Sofas, rugs and mattresses' },
      desc: {
        ru: 'Выводим пятна и запахи профессиональной экстракторной техникой. Средства безопасны для детей и животных.',
        kg: 'Тактарды жана жыттарды кесиптик экстрактор техникасы менен кетиребиз. Каражаттар балдар жана жаныбарлар үчүн коопсуз.',
        en: 'Stains and odours lifted with professional extraction equipment. Products safe for children and pets.'
      },
      from: 1500, rating: 4.87, reviews: 297, duration: { ru: '1–3 часа', kg: '1–3 саат', en: '1–3 hours' },
      includes: [
        { ru: 'Пробная чистка', kg: 'Сынама тазалоо', en: 'Patch test' },
        { ru: 'Экстракторная техника', kg: 'Экстрактор техникасы', en: 'Extraction equipment' },
        { ru: 'Безопасные средства', kg: 'Коопсуз каражаттар', en: 'Safe products' },
        { ru: 'Сохнет 3–5 часов', kg: '3–5 саатта кургайт', en: 'Dries in 3–5 hours' }
      ],
      packages: [
        { id: 'sofa2', name: { ru: 'Диван до 2 мест', kg: 'Диван, 2 орунга чейин', en: 'Sofa, up to 2 seats' }, note: { ru: 'Обивка, подушки, каркас', kg: 'Каптоо, жаздыктар, каркас', en: 'Fabric, cushions and frame' }, price: 1500, duration: { ru: '1,5 ч', kg: '1,5 саат', en: '1.5 h' }, popular: true },
        { id: 'sofa3', name: { ru: 'Диван 3 места', kg: 'Диван, 3 орун', en: '3-seat sofa' }, note: { ru: 'Глубокая чистка обивки', kg: 'Каптоону терең тазалоо', en: 'Deep fabric clean' }, price: 2200, duration: { ru: '2 ч', kg: '2 саат', en: '2 h' } },
        { id: 'carpet', name: { ru: 'Ковёр, за 1 м²', kg: 'Килем, 1 м² үчүн', en: 'Rug, per m²' }, note: { ru: 'Цена за квадратный метр', kg: 'Чарчы метр үчүн баа', en: 'Price per square metre' }, price: 600, duration: { ru: '1 ч', kg: '1 саат', en: '1 h' } }
      ],
      extras: [
        { id: 'stain', name: { ru: 'Удаление сложного пятна', kg: 'Татаал такты кетирүү', en: 'Stubborn stain treatment' }, price: 300 },
        { id: 'protect', name: { ru: 'Защита от влаги', kg: 'Нымдан коргоо', en: 'Fabric protection' }, price: 400 },
        { id: 'outside', name: { ru: 'Выезд за город', kg: 'Шаардан тышкары чыгуу', en: 'Trip outside the city' }, price: 500 }
      ]
    },
    {
      id: 'laundry', group: 'home', icon: 'washer', image: 'assets/img/laundry.webp', badge: null,
      title: { ru: 'Стирка и химчистка', kg: 'Кир жуу жана химиялык тазалоо', en: 'Laundry & dry cleaning' },
      short: { ru: 'Стирка', kg: 'Кир жуу', en: 'Laundry' },
      tagline: { ru: 'Заберём, почистим и вернём', kg: 'Алып кетебиз, тазалап кайтарабыз', en: 'We pick up, clean and deliver' },
      desc: {
        ru: 'Курьер заберёт вещи и вернёт через 24 часа. Бережная стирка, химчистка и глажка — в одном заказе.',
        kg: 'Курьер буюмдарды алып, 24 сааттан кийин кайтарат. Боорукер жуу, химчистка жана үтүктөө — бир заказда.',
        en: 'A courier collects your items and returns them within 24 hours. Washing, dry cleaning and ironing in one order.'
      },
      from: 600, rating: 4.86, reviews: 345, duration: { ru: '24–48 часов', kg: '24–48 саат', en: '24–48 hours' },
      includes: [
        { ru: 'Забор и доставка', kg: 'Алып кетүү жана жеткирүү', en: 'Pick-up and delivery' },
        { ru: 'Сортировка по тканям', kg: 'Ткандар боюнча сорттоо', en: 'Sorted by fabric' },
        { ru: 'Эко-средства', kg: 'Эко каражаттар', en: 'Eco-friendly products' },
        { ru: 'Возврат за 24 часа', kg: '24 саат ичинде кайтаруу', en: 'Back within 24 hours' }
      ],
      packages: [
        { id: 'wash5', name: { ru: 'Стирка до 5 кг', kg: '5 кгга чейин жуу', en: 'Wash up to 5 kg' }, note: { ru: 'Сортировка и сушка', kg: 'Сорттоо жана кургатуу', en: 'Sorted and tumble dried' }, price: 600, duration: { ru: '24 ч', kg: '24 саат', en: '24 h' }, popular: true },
        { id: 'coat', name: { ru: 'Химчистка пальто', kg: 'Пальто химчисткасы', en: 'Coat dry clean' }, note: { ru: 'Любая ткань, кроме кожи', kg: 'Териден башка ар кандай кездеме', en: 'Any fabric except leather' }, price: 1200, duration: { ru: '48 ч', kg: '48 саат', en: '48 h' } },
        { id: 'bedding', name: { ru: 'Постельное бельё', kg: 'Төшөк кийимдери', en: 'Bed linen' }, note: { ru: 'Комплект, стирка и глажка', kg: 'Комплект, жуу жана үтүктөө', en: 'Set, washed and pressed' }, price: 800, duration: { ru: '24 ч', kg: '24 саат', en: '24 h' } }
      ],
      extras: [
        { id: 'express', name: { ru: 'Экспресс за 3 часа', kg: '3 сааттык экспресс', en: '3-hour express' }, price: 400 },
        { id: 'ironing', name: { ru: 'Глажка', kg: 'Үтүктөө', en: 'Ironing' }, price: 300 },
        { id: 'delivery', name: { ru: 'Доставка до двери', kg: 'Эшикке чейин жеткирүү', en: 'Door delivery' }, price: 200 }
      ]
    },
    {
      id: 'handyman', group: 'repair', icon: 'hammer', image: 'assets/img/tools.webp', badge: null,
      title: { ru: 'Ремонт и сборка', kg: 'Оңдоо жана куроо', en: 'Handyman & assembly' },
      short: { ru: 'Ремонт', kg: 'Оңдоо', en: 'Handyman' },
      tagline: { ru: 'Полки, шкафы, мелкий ремонт', kg: 'Полка, шкаф, майда оңдоо', en: 'Shelves, wardrobes, small fixes' },
      desc: {
        ru: 'Один мастер для списка дел: повесить полку, собрать шкаф, заменить фурнитуру. Приедет со своим инструментом.',
        kg: 'Иш тизмеси үчүн бир мастер: полка илишүү, шкаф жыйноо, фурнитура алмаштыруу. Өз шайманы менен келет.',
        en: 'One handyman for your to-do list: hang a shelf, build a wardrobe, replace hardware. He brings his own tools.'
      },
      from: 800, rating: 4.91, reviews: 512, duration: { ru: '1–3 часа', kg: '1–3 саат', en: '1–3 hours' },
      includes: [
        { ru: 'Свой инструмент', kg: 'Өз шайманы', en: 'Own tools' },
        { ru: 'Сборка по инструкции', kg: 'Нускама боюнча жыйноо', en: 'Assembly to instructions' },
        { ru: 'Мелкий ремонт', kg: 'Майда оңдоо', en: 'Small repairs' },
        { ru: 'Вынос упаковки', kg: 'Таңгакты чыгаруу', en: 'Packaging removal' }
      ],
      packages: [
        { id: 'hour', name: { ru: 'Мастер на час', kg: 'Мастер бир саатка', en: 'Handyman, one hour' }, note: { ru: 'Список небольших задач', kg: 'Майда тапшырмалардын тизмеси', en: 'A list of small tasks' }, price: 800, duration: { ru: '1 ч', kg: '1 саат', en: '1 h' }, popular: true },
        { id: 'wardrobe', name: { ru: 'Сборка шкафа', kg: 'Шкаф жыйноо', en: 'Wardrobe assembly' }, note: { ru: 'Корпус, двери, фурнитура', kg: 'Корпус, эшиктер, фурнитура', en: 'Frame, doors and hardware' }, price: 1800, duration: { ru: '3 ч', kg: '3 саат', en: '3 h' } },
        { id: 'shelf', name: { ru: 'Повесить полку', kg: 'Полка илишүү', en: 'Hang a shelf' }, note: { ru: 'До 2 метров, со сверлением', kg: '2 метрге чейин, тешүү менен', en: 'Up to 2 metres, wall drilling' }, price: 700, duration: { ru: '1 ч', kg: '1 саат', en: '1 h' } }
      ],
      extras: [
        { id: 'second', name: { ru: 'Второй мастер', kg: 'Экинчи мастер', en: 'Second handyman' }, price: 800 },
        { id: 'concrete', name: { ru: 'Монтаж в бетон', kg: 'Бетонго монтаж', en: 'Concrete mounting' }, price: 300 },
        { id: 'disposal', name: { ru: 'Вывоз старой мебели', kg: 'Эски эмеректи чыгаруу', en: 'Old furniture removal' }, price: 500 }
      ]
    },
    {
      id: 'pest', group: 'home', icon: 'bug', image: 'assets/img/pest.webp', badge: null,
      title: { ru: 'Дезинсекция', kg: 'Дезинсекция', en: 'Pest control' },
      short: { ru: 'Дезинсекция', kg: 'Дезинсекция', en: 'Pest control' },
      tagline: { ru: 'Клопы, тараканы, муравьи', kg: 'Кандала, таракан, кумурска', en: 'Bedbugs, roaches, ants' },
      desc: {
        ru: 'Обрабатываем квартиру безопасными средствами без запаха. Мастер подскажет, как подготовить дом и когда проветривать.',
        kg: 'Батирди жыты жок коопсуз каражаттар менен иштетебиз. Мастер үйдү кантип даярдоону жана качан желдетүүнү айтат.',
        en: 'We treat your home with safe, low-odour products. Your technician explains how to prepare and when to ventilate.'
      },
      from: 2200, rating: 4.84, reviews: 186, duration: { ru: '1–2 часа', kg: '1–2 саат', en: '1–2 hours' },
      includes: [
        { ru: 'Осмотр и план обработки', kg: 'Карап чыгуу жана план', en: 'Inspection and treatment plan' },
        { ru: 'Средства без запаха', kg: 'Жыты жок каражаттар', en: 'Low-odour products' },
        { ru: 'Труднодоступные места', kg: 'Жетүү кыйын жерлер', en: 'Hard-to-reach areas' },
        { ru: 'Гарантия до 12 месяцев', kg: '12 айга чейин кепилдик', en: 'Guarantee up to 12 months' }
      ],
      packages: [
        { id: 'flat', name: { ru: 'Квартира до 80 м²', kg: '80 м²ге чейин батир', en: 'Flat up to 80 m²' }, note: { ru: 'Комплексная обработка', kg: 'Комплекстик иштетүү', en: 'Full treatment' }, price: 2200, duration: { ru: '1,5 ч', kg: '1,5 саат', en: '1.5 h' }, popular: true },
        { id: 'house', name: { ru: 'Дом до 150 м²', kg: '150 м²ге чейин үй', en: 'House up to 150 m²' }, note: { ru: 'Включая подвал и двор', kg: 'Подвал жана короо менен', en: 'Including basement and yard' }, price: 3800, duration: { ru: '2 ч', kg: '2 саат', en: '2 h' } },
        { id: 'prevention', name: { ru: 'Профилактика', kg: 'Профилактика', en: 'Prevention visit' }, note: { ru: 'Барьерная обработка', kg: 'Барьердик иштетүү', en: 'Barrier treatment' }, price: 1500, duration: { ru: '1 ч', kg: '1 саат', en: '1 h' } }
      ],
      extras: [
        { id: 'repeat', name: { ru: 'Повторный визит', kg: 'Кайталап келүү', en: 'Follow-up visit' }, price: 1100 },
        { id: 'odourless', name: { ru: 'Полностью без запаха', kg: 'Толугу менен жытсыз', en: 'Completely odourless' }, price: 400 },
        { id: 'outside', name: { ru: 'Выезд за город', kg: 'Шаардан тышкары чыгуу', en: 'Trip outside the city' }, price: 500 }
      ]
    },
    {
      id: 'carwash', group: 'auto', icon: 'car', image: 'assets/img/carwash.webp', badge: 'new',
      title: { ru: 'Автомойка у дома', kg: 'Үйдө унаа жуу', en: 'Car wash at home' },
      short: { ru: 'Автомойка', kg: 'Унаа жуу', en: 'Car wash' },
      tagline: { ru: 'Приедем к дому или офису', kg: 'Үйгө же кеңсеге келебиз', en: 'We come to your home or office' },
      desc: {
        ru: 'Мойка без воды и очередей. Приезжаем со своим оборудованием, моем кузов, салон и диски прямо у подъезда.',
        kg: 'Суусуз жана кезексиз жуу. Өз жабдуубуз менен келип, кузовду, салонду жана дисктерди подъезддин жанында жууйбуз.',
        en: 'A waterless wash with no queues. We arrive with our kit and clean the body, interior and wheels at your door.'
      },
      from: 1000, rating: 4.89, reviews: 268, duration: { ru: '45 мин – 2,5 часа', kg: '45 мүн – 2,5 саат', en: '45 min – 2.5 hours' },
      includes: [
        { ru: 'Вода и оборудование', kg: 'Суу жана жабдуу', en: 'Water and equipment' },
        { ru: 'Бережная мойка', kg: 'Боорукер жуу', en: 'Gentle wash' },
        { ru: 'Уборка салона', kg: 'Салонду тазалоо', en: 'Interior clean' },
        { ru: 'Работаем 8:00–22:00', kg: '8:00–22:00 иштейбиз', en: 'Open 8 am – 10 pm' }
      ],
      packages: [
        { id: 'body', name: { ru: 'Мойка кузова', kg: 'Кузов жуу', en: 'Body wash' }, note: { ru: 'Кузов, стёкла, диски', kg: 'Кузов, айнектер, дисктер', en: 'Body, glass and wheels' }, price: 1000, duration: { ru: '45 мин', kg: '45 мүн', en: '45 min' }, popular: true },
        { id: 'complex', name: { ru: 'Кузов + салон', kg: 'Кузов + салон', en: 'Body + interior' }, note: { ru: 'Пылесос и влажная уборка', kg: 'Чаң соргуч жана нымдуу тазалоо', en: 'Vacuum and wipe-down' }, price: 1800, duration: { ru: '1,5 ч', kg: '1,5 саат', en: '1.5 h' } },
        { id: 'interior', name: { ru: 'Химчистка салона', kg: 'Салонду химтазалоо', en: 'Interior detailing' }, note: { ru: 'Сиденья, коврики, потолок', kg: 'Орундуктар, килемчелер, потолок', en: 'Seats, mats and headliner' }, price: 3500, duration: { ru: '2,5 ч', kg: '2,5 саат', en: '2.5 h' } }
      ],
      extras: [
        { id: 'wax', name: { ru: 'Воск для кузова', kg: 'Кузов үчүн мом', en: 'Body wax' }, price: 400 },
        { id: 'trunk', name: { ru: 'Багажник', kg: 'Багажник', en: 'Boot' }, price: 300 },
        { id: 'wheels', name: { ru: 'Глубокая чистка дисков', kg: 'Дисктерди терең тазалоо', en: 'Deep wheel clean' }, price: 200 }
      ]
    }
  ];

  const serviceById = id => SERVICES.find(service => service.id === id);
  const packageById = (service, id) => service?.packages.find(pkg => pkg.id === id) || service?.packages[0];
  const categoryTitle = cat => {
    const service = serviceById(cat.service);
    return service ? L(service.short) : '';
  };

  const PROS = [
    { id: 'aibek', name: 'Айбек Ж.', role: { ru: 'Сантехник', kg: 'Сантехник', en: 'Plumber' }, rating: 4.98, jobs: 1264, langs: ['RU', 'KG'], tone: 'terra', initials: 'АЖ' },
    { id: 'gulnara', name: 'Гүлнара С.', role: { ru: 'Клининг-мастер', kg: 'Тазалоо мастери', en: 'Cleaning specialist' }, rating: 4.96, jobs: 982, langs: ['RU', 'KG'], tone: 'sage', initials: 'ГС' },
    { id: 'ermek', name: 'Эрмек Т.', role: { ru: 'Электрик', kg: 'Электрик', en: 'Electrician' }, rating: 4.94, jobs: 745, langs: ['RU', 'KG', 'EN'], tone: 'gold', initials: 'ЭТ' }
  ];

  const REVIEWS = [
    {
      name: 'Айжан К.', initials: 'АК', district: { ru: 'Октябрьский', kg: 'Октябрь', en: 'Oktyabr' }, service: { ru: 'Генеральная уборка', kg: 'Баш-аяк тазалоо', en: 'Deep clean' }, ago: { ru: '2 дня назад', kg: '2 күн мурун', en: '2 days ago' },
      text: {
        ru: 'Заказала генеральную уборку перед переездом. Приехали вовремя, работали вдвоём и не пропустили ни одной мелочи. Окна и кухня блестят — как в рекламе.',
        kg: 'Көчүү алдында баш-аяк тазалоого заказ бердим. Убагында келип, экөөлөп иштешти жана эч бир майда нерсени калтырышкан жок. Терезелер жана ашкана жалтырап турат.',
        en: 'I booked a deep clean before moving. They arrived on time, worked as a pair and missed nothing. The windows and kitchen are genuinely sparkling.'
      }
    },
    {
      name: 'Данияр А.', initials: 'ДА', district: { ru: 'Свердловский', kg: 'Свердлов', en: 'Sverdlov' }, service: { ru: 'Сантехника', kg: 'Сантехника', en: 'Plumbing' }, ago: { ru: 'неделю назад', kg: 'бир жума мурун', en: 'a week ago' },
      text: {
        ru: 'Потёк смеситель вечером. Мастер приехал через 40 минут, назвал цену сразу и поменял всё за час. Никаких «доплатите за деталь» задним числом.',
        kg: 'Кечинде смеситель агып кетти. Мастер 40 мүнөттө келип, бааны дароо айтты жана бир саатта алмаштырды. Кийин «тетик үчүн кошумча төлөңүз» деген жок.',
        en: 'My tap started leaking in the evening. The plumber arrived in 40 minutes, quoted up front and fixed it within the hour. No surprise charges.'
      }
    },
    {
      name: 'Мээрим Т.', initials: 'МТ', district: { ru: 'Ленинский', kg: 'Ленин', en: 'Lenin' }, service: { ru: 'Маникюр дома', kg: 'Үйдө маникюр', en: 'At-home manicure' }, ago: { ru: '3 дня назад', kg: '3 күн мурун', en: '3 days ago' },
      text: {
        ru: 'Маникюр дома с двумя детьми — спасение. Мастер приехала со всем своим, стерильность при мне, покрытие держится уже третью неделю.',
        kg: 'Эки бала менен үйдө маникюр — куткаруу. Мастер баарын өзү менен алып келди, стерилдүүлүктү көзүм менен көрдүм, гель-лак үчүнчү жумага чейин турат.',
        en: 'A manicure at home with two kids is a lifesaver. The technician brought everything, sterilised tools in front of me, and the gel has lasted three weeks.'
      }
    }
  ];

  const FAQ = [
    {
      q: { ru: 'Как быстро приедет мастер?', kg: 'Мастер канчалык тез келет?', en: 'How soon can a pro arrive?' },
      a: { ru: 'В большинстве районов Бишкека — в течение 2 часов, если выбрать ближайший свободный слот. При записи на сегодня вы увидите только реально доступное время.', kg: 'Бишкектин көп райондорунда — эң жакын бош убакыт тандалса, 2 сааттын ичинде. Бүгүнгө жазылганда реалдуу бош убакыттар гана көрүнөт.', en: 'Within 2 hours in most Bishkek districts when you pick the nearest available slot. Same-day booking only shows genuinely open times.' }
    },
    {
      q: { ru: 'Цена фиксированная?', kg: 'Баа туруктуубу?', en: 'Is the price fixed?' },
      a: { ru: 'Да. Стоимость пакета и дополнений видна до подтверждения. Если мастер обнаружит дополнительную работу, он согласует её с вами до начала.', kg: 'Ооба. Пакеттин жана кошумчалардын баасы ырастоодон мурун көрүнөт. Кошумча иш чыкса, мастер баштаардан мурун сиз менен макулдашат.', en: 'Yes. Package and add-on prices are shown before you confirm. If extra work is needed, the pro agrees it with you first.' }
    },
    {
      q: { ru: 'Как можно оплатить?', kg: 'Кантип төлөсө болот?', en: 'How can I pay?' },
      a: { ru: 'MBank, O!Деньги, Элсом, банковская карта или наличные после работы. Предоплата не нужна. Комиссию сервис не берёт.', kg: 'MBank, O!Деньги, Элсом, банк картасы же иштен кийин накталай. Алдын ала төлөм талап кылынбайт. Сервис комиссия албайт.', en: 'MBank, O!Dengi, Elsom, bank card or cash after the job. No prepayment and no service fee.' }
    },
    {
      q: { ru: 'Что, если результат не понравится?', kg: 'Эгер натыйжа жакпаса?', en: 'What if I’m not happy?' },
      a: { ru: 'У вас есть 30 дней гарантии. Напишите в поддержку с фото — вернём мастера и переделаем работу бесплатно или вернём деньги.', kg: 'Сизде 30 күн кепилдик бар. Сүрөт менен колдоого жазыңыз — мастерди кайра жөнөтөбүз жана ишти акысыз кайра жасайбыз же акчаны кайтарабыз.', en: 'Every job comes with a 30-day guarantee. Send support a photo and we’ll return the pro to fix it free, or refund you.' }
    },
    {
      q: { ru: 'Мастера проверены?', kg: 'Мастерлер текшерилгенби?', en: 'Are the pros vetted?' },
      a: { ru: 'Каждый мастер проходит проверку паспорта, медицинский осмотр, тестовый заказ и обучение стандартам. После визита вы можете оценить его отдельно.', kg: 'Ар бир мастер паспорт текшерүүдөн, медициналык кароодон, сынама заказдан жана стандарттар боюнча окуудан өтөт. Визиттен кийин аны өзүнчө баалай аласыз.', en: 'Every pro passes ID checks, a medical screening, a trial job and standards training. You can rate each visit separately.' }
    },
    {
      q: { ru: 'Работаете за городом?', kg: 'Шаардан тышкары иштейсизби?', en: 'Do you cover outside Bishkek?' },
      a: { ru: 'Да, выезжаем в Кант, Маевку, Лебединовку и nearby. За городом добавляется фиксированный выезд 500 сом — он виден в смете.', kg: 'Ооба, Кант, Маевка, Лебединовка жана жакын аймактарга барабыз. Шаардан тышкары 500 сом туруктуу чыгуу кошулат — ал сметада көрүнөт.', en: 'Yes — Kant, Mayevka, Lebedinovka and nearby villages. A fixed 500 KGS trip fee is added and shown in the quote.' }
    }
  ];

  const PAYMENTS = [
    { id: 'mbank', logo: 'mbank', label: 'MBank', note: { ru: 'Оплата по номеру телефона', kg: 'Телефон номери аркылуу төлөм', en: 'Pay by phone number' } },
    { id: 'odengi', logo: 'odengi', label: 'O!Деньги', note: { ru: 'Кошелёк O!', kg: 'O! капчыгы', en: 'O! wallet' } },
    { id: 'elsom', logo: 'elsom', label: 'Элсом', note: { ru: 'Перевод через Элсом', kg: 'Элсом аркылуу которуу', en: 'Elsom transfer' } },
    { id: 'card', logo: 'card', label: { ru: 'Банковская карта', kg: 'Банк картасы', en: 'Bank card' }, note: { ru: 'Visa, Mastercard, Элкарт', kg: 'Visa, Mastercard, Элкарт', en: 'Visa, Mastercard, Elcart' } },
    { id: 'cash', logo: 'cash', label: { ru: 'Наличные', kg: 'Накталай', en: 'Cash' }, note: { ru: 'Мастеру после работы', kg: 'Иштен кийин мастерге', en: 'To the pro after the job' } }
  ];

  const STATUS_STEPS = [
    { id: 'accepted', label: { ru: 'Заказ принят', kg: 'Заказ кабыл алынды', en: 'Order received' } },
    { id: 'assigned', label: { ru: 'Мастер назначен', kg: 'Мастер дайындалды', en: 'Pro assigned' } },
    { id: 'enroute', label: { ru: 'В пути', kg: 'Жолдо', en: 'On the way' } },
    { id: 'arrived', label: { ru: 'На месте', kg: 'Ордунда', en: 'Arrived' } },
    { id: 'completed', label: { ru: 'Завершён', kg: 'Аяктады', en: 'Completed' } }
  ];

  const FILTERS = [
    { id: 'all', label: { ru: 'Все услуги', kg: 'Бардык кызматтар', en: 'All services' } },
    { id: 'home', label: { ru: 'Уборка и быт', kg: 'Тазалоо жана турмуш', en: 'Home & cleaning' } },
    { id: 'beauty', label: { ru: 'Красота', kg: 'Сулуулук', en: 'Beauty' } },
    { id: 'repair', label: { ru: 'Ремонт', kg: 'Оңдоо', en: 'Repairs' } },
    { id: 'auto', label: { ru: 'Авто', kg: 'Унаа', en: 'Auto' } }
  ];
