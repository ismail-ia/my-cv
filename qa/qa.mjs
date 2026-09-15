import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const AXE = fs.readFileSync(path.join(process.cwd(),'node_modules/axe-core/axe.min.js'),'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:3099/';
const TEST_URL = BASE.endsWith('/') ? (process.env.BASE_URL ? BASE : BASE + 'index.html') : BASE;
const OUT = process.cwd() + '/shots';
fs.mkdirSync(OUT,{recursive:true});
const results = [];
const ok = (n,c,d='') => results.push({n, pass:!!c, d});

const browser = await chromium.launch();

/* ---------- desktop ---------- */
const ctx = await browser.newContext({ viewport:{width:1440,height:1000}, deviceScaleFactor:2 });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => m.type()==='error' && errs.push(m.text()));
p.on('pageerror', e => errs.push('pageerror: '+e.message));
const bad = [];
p.on('response', r => { if (r.status()>=400) bad.push(r.status()+' '+r.url()); });

await p.goto(TEST_URL,{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
console.log('ERRORS DETECTED ON PAGE:', errs);
ok('no console errors', errs.length===0, errs.join(' | '));
ok('no failed requests', bad.length===0, bad.join(' | '));

/* fonts actually loaded (silent fallback check) */
const fonts = await p.evaluate(async () => {
  await document.fonts.ready;
  const has = f => document.fonts.check(f);
  return { grotesk: has('700 48px "Space Grotesk"'), inter: has('400 16px Inter'), mono: has('500 12px "IBM Plex Mono"') };
});
ok('Space Grotesk loaded', fonts.grotesk);
ok('Inter loaded', fonts.inter);
ok('IBM Plex Mono loaded', fonts.mono);

/* video: multiply + playing */
const v = await p.evaluate(() => {
  const el = document.querySelector('#heroVideo');
  if (!el) return { error: 'heroVideo missing', html: document.body.innerHTML.substring(0, 1000) };
  const cs = getComputedStyle(el);
  return { blend: cs.mixBlendMode, loop: el.loop, preload: el.getAttribute('preload'),
           sources: el.querySelectorAll('source').length, w: el.videoWidth,
           dur: Math.round((el.duration||0)*10)/10, poster: !!el.poster };
});
if (v.error) {
  console.log('MISSING HERO VIDEO. HTML DUMP:', v.html);
  throw new Error('heroVideo missing');
}
ok('hero video uses multiply', v.blend==='multiply', JSON.stringify(v));
ok('hero video does not loop', v.loop===false, JSON.stringify(v));
ok('hero video loaded once in view', v.sources>0 && v.w>0, JSON.stringify(v));
ok('hero video is a single short pass', v.dur>0 && v.dur<=3, 'duration '+v.dur+'s');
ok('hero video has a poster', v.poster);
// it must actually finish and rest, not keep running
await p.waitForTimeout(3200);
const vEnd = await p.evaluate(() => {
  const el = document.querySelector('#heroVideo');
  return { ended: el.ended, paused: el.paused, t: Math.round(el.currentTime*10)/10 };
});
ok('hero video plays once and rests', vEnd.ended || vEnd.paused, JSON.stringify(vEnd));

// hero meta sits under the avatar, not in the copy column
const metaPos = await p.evaluate(() => {
  const meta = document.querySelector('.hero__meta');
  const stage = document.querySelector('.hero .stage');
  const copy = document.querySelector('.hero__copy');
  return { belowStage: meta.getBoundingClientRect().top >= stage.getBoundingClientRect().bottom - 2,
           inFig: !!meta.closest('.hero__fig'), inCopy: copy.contains(meta) };
});
ok('availability line sits under the avatar', metaPos.belowStage && metaPos.inFig && !metaPos.inCopy, JSON.stringify(metaPos));

// identity eyebrow stays on one line
const eb = await p.evaluate(() => {
  const e = document.querySelector('.eyebrow--id');
  const cs = getComputedStyle(e);
  return { lines: Math.round(e.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
           text: e.textContent.trim() };
});
ok('hero identity line fits on one line (desktop)', eb.lines<=1, JSON.stringify(eb));

// no em dashes anywhere in the copy
const dashes = await p.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf('\u2014');
  return i<0 ? '' : t.slice(Math.max(0,i-45), i+45);
});
ok('no em dashes in body copy', dashes==='', dashes);

// CV download
const cv = await p.evaluate(() => {
  const a = [...document.querySelectorAll('a[href$=".pdf"]')];
  return { n: a.length, href: a[0]?.getAttribute('href')||'', dl: a.every(x=>x.hasAttribute('download')) };
});
ok('CV download links present with download attr', cv.n>=2 && cv.dl, JSON.stringify(cv));
const cvRes = await p.request.get(new URL(cv.href, BASE).toString());
ok('CV PDF resolves', cvRes.status()===200 && cvRes.headers()['content-type'].includes('pdf'),
   cvRes.status()+' '+cvRes.headers()['content-type']);

// AI systems and AI-assisted delivery are separate sections
const split = await p.evaluate(() => {
  const ai = document.querySelector('#ai'), dl = document.querySelector('#delivery');
  const txt = el => el ? el.innerText : '';
  return {
    both: !!ai && !!dl,
    toolsInAi: /Claude Code|Antigravity/i.test(txt(ai)),
    systemsInDelivery: /\bEve\b|supervisor agent|ShouldBeUnique|QLoRA/i.test(txt(dl)),
    toolsInDelivery: /Claude Code/i.test(txt(dl)),
    systemsInAi: /supervisor agent/i.test(txt(ai))
  };
});
ok('AI systems and delivery are separate sections', split.both, JSON.stringify(split));
ok('AI-assisted coding tools appear only in Delivery', !split.toolsInAi && split.toolsInDelivery, JSON.stringify(split));
ok('production AI systems appear only in AI systems', !split.systemsInDelivery && split.systemsInAi, JSON.stringify(split));

/* brand rules enforced in the built DOM */
const brand = await p.evaluate(() => {
  const out = {};
  // primary buttons must have ink labels, never white
  out.btns = [...document.querySelectorAll('.btn-b--primary')].map(b => {
    const cs = getComputedStyle(b);
    return { bg: cs.backgroundColor, fg: cs.color };
  });
  // every number container that should be mono
  const monoFam = getComputedStyle(document.querySelector('.num')).fontFamily;
  out.monoFam = monoFam;
  out.tabular = getComputedStyle(document.querySelector('.metric__n')).fontVariantNumeric;
  // avatar must never sit inside .on-dark
  out.avatarOnDark = [...document.querySelectorAll('#heroVideo, .stage__media')]
    .some(el => el.closest('.on-dark') !== null);
  out.h1 = document.querySelectorAll('h1').length;
  out.h1text = document.querySelector('h1')?.innerText.replace(/\s+/g,' ').trim();
  // heading order
  const lv = [...document.querySelectorAll('h1,h2,h3,h4')].map(h=>+h.tagName[1]);
  let skip = false; for (let i=1;i<lv.length;i++) if (lv[i]-lv[i-1] > 1) skip = true;
  out.headingSkip = skip;
  return out;
});
ok('exactly one h1', brand.h1===1, 'found '+brand.h1);
ok('h1 is the positioning line', /I make systems hold/i.test(brand.h1text||''), brand.h1text);
ok('no skipped heading levels', !brand.headingSkip);
ok('.num uses IBM Plex Mono', /IBM Plex Mono/.test(brand.monoFam), brand.monoFam);
ok('metrics are tabular-nums', /tabular-nums/.test(brand.tabular), brand.tabular);
ok('avatar never inside .on-dark', brand.avatarOnDark===false);
const whiteBtn = brand.btns.find(b => b.fg==='rgb(255, 255, 255)' || b.fg==='rgb(250, 247, 242)');
ok('no white label on orange button', !whiteBtn, JSON.stringify(brand.btns));

/* The headline's WHITE SPACE must be even, which means its line advances are
   deliberately uneven: "I make" ends on the baseline while "systems" starts at
   x-height, and the y of "systems" runs into the ascenders of "hold.". Equal
   advances measured 31px of white against 4px. JS measures the ink and
   redistributes, keeping total block height at n x line-height. */
const rhythm = await p.evaluate(() => {
  const h1 = document.querySelector('.hero h1');
  const cs = getComputedStyle(h1);
  const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
  const cx = document.createElement('canvas').getContext('2d');
  cx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
  if ('letterSpacing' in cx) cx.letterSpacing = cs.letterSpacing;

  const rects = [];
  const walk = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const cr of rg.getClientRects())
      if (cr.height > 1) rects.push({ top: cr.top, text: n.textContent });
  }
  rects.sort((a, b) => a.top - b.top);
  const lines = [];
  rects.forEach(r => {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.top - r.top) < 4) last.text += r.text;
    else lines.push({ top: r.top, text: r.text });
  });

  const met = lines.map(l => cx.measureText(l.text.trim()));
  const gaps = [], advances = [];
  for (let i = 1; i < lines.length; i++) {
    const adv = lines[i].top - lines[i - 1].top;
    advances.push(+adv.toFixed(2));
    gaps.push(+(adv - met[i - 1].actualBoundingBoxDescent - met[i].actualBoundingBoxAscent).toFixed(2));
  }
  return { count: lines.length, gaps, advances, lh: +lh.toFixed(2),
           totalDrift: +(advances.reduce((a, b) => a + b, 0) - lh * (lines.length - 1)).toFixed(2) };
});
const spread = rhythm.gaps.length > 1 ? Math.max(...rhythm.gaps) - Math.min(...rhythm.gaps) : 0;
ok('headline optical white space is even', spread <= 1.5, JSON.stringify(rhythm));
ok('headline keeps its total block height', Math.abs(rhythm.totalDrift) <= 1.5, JSON.stringify(rhythm));
ok('headline renders as three lines at every width', rhythm.count === 3, JSON.stringify(rhythm));

/* cold-start referents: a first-time reader must never meet a pronoun with
   nothing to point at, and the flagship section must name the company. */
const referents = await p.evaluate(() => {
  const bad = [];
  if (!/GrintaHub/.test(document.querySelector('#approach').innerText))
    bad.push('#approach never names the company it describes');
  document.querySelectorAll('main section').forEach(sec => {
    const first = sec.querySelector('.lead-p, .hero__sub');
    if (!first) return;
    const txt = first.innerText.trim();
    if (/^(That|This|It|Those|These|They)\b/.test(txt))
      bad.push(`${sec.id||'hero'} opens on a bare demonstrative: "${txt.slice(0,42)}"`);
  });
  return bad;
});
ok('no section opens on an unanchored pronoun', referents.length===0, referents.join(' | '));

/* banned vocabulary */
const banned = await p.evaluate(() => {
  const t = document.body.innerText.toLowerCase();
  const words = ['passionate','rockstar','ninja','guru','synergy','best-in-class','world-class','cutting-edge','seamless','revolutionary','responsible for','was involved in','leverage'];
  return words.filter(w => t.includes(w));
});
ok('no banned vocabulary', banned.length===0, banned.join(', '));

/* focus visible on every interactive element */
const focusables = await p.evaluate(() => {
  const els = [...document.querySelectorAll('a[href],button,input,[tabindex]:not([tabindex="-1"])')]
    .filter(e => e.offsetParent !== null || e.classList.contains('skip'));
  return els.length;
});
await p.keyboard.press('Tab');
const firstFocus = await p.evaluate(() => {
  const a = document.activeElement;
  const cs = getComputedStyle(a);
  return { tag:a.tagName, cls:a.className, outline: cs.outlineWidth+' '+cs.outlineStyle };
});
ok('skip link is first in tab order', /skip/.test(firstFocus.cls), JSON.stringify(firstFocus));
ok('focus ring is visible', firstFocus.outline.includes('solid') && !firstFocus.outline.startsWith('0px'), firstFocus.outline);
ok('interactive elements present', focusables>10, String(focusables));

/* headline optically aligns with the eyebrow and body copy beneath it */
const align = await p.evaluate(() => {
  const ink = (el, text) => {
    const cs = getComputedStyle(el);
    const cx = document.createElement('canvas').getContext('2d');
    const size = parseFloat(cs.fontSize);
    cx.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    if ('letterSpacing' in cx) cx.letterSpacing = cs.letterSpacing;
    const m = cx.measureText(text);
    return el.getBoundingClientRect().left - m.actualBoundingBoxLeft;
  };
  const h1  = document.querySelector('.hero h1');
  const sub = document.querySelector('.hero__sub');
  const eb  = document.querySelector('.eyebrow--id');
  return {
    h1Ink:  +ink(h1, 'I make').toFixed(1),
    subInk: +ink(sub, '17 years').toFixed(1),
    ebLeft: +eb.getBoundingClientRect().left.toFixed(1)
  };
});
ok('hero headline optically aligns with body copy',
   Math.abs(align.h1Ink - align.subInk) <= 3, JSON.stringify(align));
ok('hero headline aligns with its eyebrow',
   Math.abs(align.h1Ink - align.ebLeft) <= 3, JSON.stringify(align));

/* every steps list shares one label column, so headings start at the same x */
const stepCols = await p.evaluate(() => {
  const bad = [];
  document.querySelectorAll('.steps').forEach((ol, i) => {
    const xs = [...ol.querySelectorAll('li h3')].map(h => Math.round(h.getBoundingClientRect().left));
    if (new Set(xs).size > 1) bad.push('list' + i + ': ' + xs.join(','));
  });
  return bad;
});
ok('steps headings share one left edge', stepCols.length===0, stepCols.join(' | '));

/* the avatar plate is centred in its column */
const centred = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.stage').forEach((st, i) => {
    const col = st.parentElement;
    const s = st.getBoundingClientRect(), c = col.getBoundingClientRect();
    const dl = s.left - c.left, dr = c.right - s.right;
    if (Math.abs(dl - dr) > 2) out.push(`stage${i} l=${Math.round(dl)} r=${Math.round(dr)}`);
  });
  return out;
});
ok('avatar plates are centred in their column', centred.length===0, centred.join(' | '));

/* the label column must fit its longest key with real breathing room */
const deets = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.deets li')].map(row => {
    const k = row.querySelector('.k'), v = row.querySelector('.v');
    return { k: k.textContent.trim(),
             clipped: k.scrollWidth > k.clientWidth + 1,
             gap: Math.round(v.getBoundingClientRect().left - k.getBoundingClientRect().right) };
  });
  return { clipped: rows.filter(r => r.clipped).map(r => r.k),
           minGap: Math.min(...rows.map(r => r.gap)) };
});
ok('detail labels are not clipped on desktop', deets.clipped.length===0, deets.clipped.join(', '));
ok('detail label column has real breathing room', deets.minGap >= 20, 'min gap ' + deets.minGap + 'px');

/* tag pills must flow as a row, not stretch into a column */
const tags = await p.evaluate(() => {
  const bad = [];
  document.querySelectorAll('.taglist').forEach(ul => {
    const cs = getComputedStyle(ul);
    if (cs.flexDirection !== 'row') bad.push('direction:' + cs.flexDirection);
    const li = ul.querySelector('li');
    if (li && li.getBoundingClientRect().width > ul.getBoundingClientRect().width - 4)
      bad.push('pill stretched to full width');
  });
  return [...new Set(bad)];
});
ok('tag pills flow as a row', tags.length===0, tags.join(' | '));

/* the mark must switch to its inverse variant on dark grounds */
const marks = await p.evaluate(() => {
  const bad = [];
  document.querySelectorAll('img[src*="/logo/mark"]').forEach(img => {
    const dark = !!img.closest('.on-dark');
    const inv = img.getAttribute('src').includes('mark-inverse');
    if (dark !== inv) bad.push((dark ? 'dark ground uses ' : 'light ground uses ') + img.getAttribute('src'));
  });
  return bad;
});
ok('mark uses the inverse variant on dark grounds', marks.length===0, marks.join(' | '));

/* LinkedIn is a button carrying its mark */
const li = await p.evaluate(() => {
  const a = document.querySelector('a[href*="linkedin.com"]');
  return { ghost: a.classList.contains('btn-b--ghost'), svg: !!a.querySelector('svg'),
           h: Math.round(a.getBoundingClientRect().height), text: a.textContent.trim() };
});
ok('LinkedIn is a button with its logo', li.ghost && li.svg && li.h>=44, JSON.stringify(li));

/* the entrance sequence must actually finish - hidden-forever is the failure mode */
await p.waitForTimeout(1400);
const entrance = await p.evaluate(() => {
  const vis = el => { const cs = getComputedStyle(el);
    return { o:+cs.opacity, tf: cs.transform }; };
  const bad = [];
  const check = (sel, label) => {
    document.querySelectorAll(sel).forEach(el => {
      const v = vis(el);
      if (v.o < 0.99 || (v.tf !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(v.tf)))
        bad.push(`${label} o=${v.o} tf=${v.tf}`);
    });
  };
  check('.hero .eyebrow--id','eyebrow');
  check('.hero .t-hero .ln > span','headline-line');
  check('.hero .hero__sub','sub'); check('.hero .hero__cta','cta');
  check('.hero .hero__meta','meta'); check('.hero .hero__fig','fig');
  // the reused classes outside the hero must NOT be caught by the hero's hidden state
  check('#contact .hero__cta','contact-cta');
  check('.nav-b__in','nav');
  return { bad, ready: document.querySelector('.hero').classList.contains('is-ready') };
});
ok('hero entrance completes and nothing stays hidden', entrance.ready && entrance.bad.length===0,
   JSON.stringify(entrance).slice(0,220));

// the masked headline must not clip its own glyphs
const mask = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.t-hero .ln').forEach(ln => {
    const inner = ln.firstElementChild;
    if (inner.getBoundingClientRect().height > ln.getBoundingClientRect().height + 0.5)
      out.push(`${inner.textContent.trim().slice(0,14)} inner=${inner.getBoundingClientRect().height.toFixed(1)} mask=${ln.getBoundingClientRect().height.toFixed(1)}`);
  });
  return out;
});
ok('headline masks do not clip the glyphs', mask.length===0, mask.join(' | '));

// metric accent rules and eyebrow rules draw in and stay
const rules = await p.evaluate(() => {
  const m = [...document.querySelectorAll('.metric')].map(el =>
    getComputedStyle(el, '::before').transform);
  return { metricTransforms: [...new Set(m)] };
});
ok('metric accent rules are drawn', !rules.metricTransforms.some(t => /matrix\(1, 0, 0, 0,/.test(t)),
   JSON.stringify(rules));

/* ---------- axe ---------- */
await p.addScriptTag({ content: AXE });
const axe = await p.evaluate(async () =>
  await axe.run(document, { runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa'] }));
const viol = axe.violations.map(v => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`);
ok('axe: zero WCAG 2.1 AA violations', axe.violations.length===0, viol.join(' | '));

await p.screenshot({ path: OUT+'/desktop-top.png' });
await p.evaluate(() => document.querySelector('#work').scrollIntoView());
await p.waitForTimeout(600);
await p.screenshot({ path: OUT+'/desktop-work.png' });
await p.evaluate(() => document.querySelector('#ai').scrollIntoView());
await p.waitForTimeout(600);
await p.screenshot({ path: OUT+'/desktop-ai.png' });
await p.evaluate(() => document.querySelector('#delivery').scrollIntoView());
await p.waitForTimeout(600);
await p.screenshot({ path: OUT+'/desktop-delivery.png' });

/* ---------- chat ---------- */
await p.evaluate(() => document.querySelector('#ask').scrollIntoView());
await p.waitForTimeout(400);
await p.click('#chatChips .chip-s:nth-child(1)');
await p.waitForTimeout(2600);
const chat = await p.evaluate(() => {
  const items = [...document.querySelectorAll('#chatList li')];
  return {
    n: items.length,
    last: items.at(-1).innerText.replace(/\s+/g,' ').trim(),
    role: document.querySelector('#chatLog').getAttribute('role'),
    live: document.querySelector('#chatLog').getAttribute('aria-live'),
    focus: document.activeElement.id,
    nums: [...items.at(-1).querySelectorAll('.num')].map(n=>n.textContent)
  };
});
ok('chat appends question + reply', chat.n>=3, JSON.stringify(chat.n));
ok('chat log is role=log aria-live=polite', chat.role==='log' && chat.live==='polite');
ok('focus returns to input after reply', chat.focus==='chatInput', chat.focus);
ok('reply numbers rendered as .num', chat.nums.length>0, chat.nums.join(','));
/* every number the avatar says must already be on the page */
const grounded = await p.evaluate(nums => {
  const page = document.querySelector('main').innerText;
  return nums.filter(n => !page.includes(n));
}, chat.nums);
ok('every number in the reply appears on the page', grounded.length===0, 'missing: '+grounded.join(','));

/* off-topic falls back to email, not a refusal */
await p.fill('#chatInput','what is your favourite pizza');
await p.press('#chatInput','Enter');
await p.waitForTimeout(2400);
const fb = await p.evaluate(() => {
  const last = document.querySelector('#chatList li:last-child');
  const a = last.querySelector('a[href^="mailto:"]');
  return { text:last.innerText, href:a?.getAttribute('href')||'', label:a?.textContent||'',
           html:last.innerHTML, stray: /["'<>]/.test(a?.textContent||'') };
});
ok('off-topic hands over an email link', fb.href==='mailto:ismail.ibrahim.se2026@gmail.com', fb.href);
ok('email link label is clean', fb.label==='ismail.ibrahim.se2026@gmail.com' && !fb.stray, fb.label);
ok('no markup leaked into reply text', !/&lt;|"&gt;|span class/.test(fb.text), fb.text.slice(0,110));
const stickD = await p.evaluate(() => ({ top: Math.round(document.querySelector('#nav').getBoundingClientRect().top), scrolled: Math.round(window.scrollY) }));
ok('nav stays stuck to the top when scrolled (desktop)', stickD.scrolled > 200 && stickD.top <= 1, JSON.stringify(stickD));
const navBg = await p.evaluate(() => {
  const n = document.querySelector('#nav');
  return { stuck: n.classList.contains('is-stuck'), bg: getComputedStyle(n).backgroundColor };
});
// rgb() has no alpha channel; only rgba() with 4 components can be translucent.
const parts = (navBg.bg.match(/[\d.]+/g) || []);
const alpha = parts.length === 4 ? parseFloat(parts[3]) : 1;
ok('stuck nav is fully opaque (no bleed-through)', navBg.stuck && alpha === 1, navBg.bg + ' alpha=' + alpha);
await p.screenshot({ path: OUT+'/desktop-chat.png' });

/* about figure must be framed by height, not clipped to trousers */
await p.evaluate(() => document.querySelector('#about').scrollIntoView());
await p.waitForTimeout(700);
const fig = await p.evaluate(() => {
  const img = document.querySelector('.stage__media--figure');
  const st  = img.closest('.stage');
  const ir = img.getBoundingClientRect(), sr = st.getBoundingClientRect();
  return { fits: ir.top >= sr.top - 2 && ir.bottom <= sr.bottom + 2,
           ratio: +(ir.width/ir.height).toFixed(3), natural: +(img.naturalWidth/img.naturalHeight).toFixed(3) };
});
ok('about figure is fully inside its stage', fig.fits, JSON.stringify(fig));
ok('about figure keeps its aspect ratio', Math.abs(fig.ratio-fig.natural) < 0.02, JSON.stringify(fig));
const clear = await p.evaluate(() => {
  const img = document.querySelector('.stage__media--figure');
  const st = img.closest('.stage');
  const gap = st.getBoundingClientRect().bottom - img.getBoundingClientRect().bottom;
  return { gap: Math.round(gap), stageH: Math.round(st.getBoundingClientRect().height) };
});
ok('about figure has ground clearance under the feet', clear.gap >= 20, JSON.stringify(clear));
const scale = await p.evaluate(() => {
  const img = document.querySelector('.stage__media--figure');
  const copy = document.querySelector('#about .hero__copy');
  return { figH: Math.round(img.getBoundingClientRect().height),
           copyH: Math.round(copy.getBoundingClientRect().height) };
});
ok('about figure reads at the scale of the copy beside it',
   scale.figH >= scale.copyH * 0.6, JSON.stringify(scale));
await p.screenshot({ path: OUT+'/desktop-about.png' });

/* the video must not be fetched at all for a visitor who never scrolls to it */
const lazy = await browser.newContext({ viewport:{width:1440,height:900} });
const pl = await lazy.newPage();
const vidReqs = [];
pl.on('request', r => { if (/ismail-wave\.(mp4|webm)/.test(r.url())) vidReqs.push(r.url()); });
await pl.goto(TEST_URL.replace('index.html','') + '#contact', { waitUntil:'networkidle' });
await pl.waitForTimeout(1200);
ok('video is not fetched when the hero is never viewed', vidReqs.length===0, vidReqs.join(' | '));
await lazy.close();

/* ---------- 320px ---------- */
const m = await browser.newContext({ viewport:{width:320,height:720}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const pm = await m.newPage();
await pm.goto(TEST_URL,{waitUntil:'networkidle'});
await pm.waitForTimeout(900);
const hscroll = await pm.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
ok('no horizontal scroll at 320px', !hscroll);
const touch = await pm.evaluate(() => {
  const small = [...document.querySelectorAll('a[href],button')].filter(e=>{
    const r = e.getBoundingClientRect();
    return r.width>0 && r.height>0 && (r.height<44 || r.width<44) && !e.classList.contains('skip');
  }).map(e => (e.className||e.tagName)+' '+Math.round(e.getBoundingClientRect().height));
  return small;
});
ok('touch targets >= 44px at 320px', touch.length===0, touch.slice(0,6).join(' | '));

/* nothing breaks the gutter at 320px, and no text is clipped by its own box */
await pm.evaluate(()=>document.querySelectorAll('.rv').forEach(e=>e.classList.add('is-in')));
await pm.waitForTimeout(400);
const gutter = await pm.evaluate(() => {
  const pad = parseFloat(getComputedStyle(document.querySelector('.shell')).paddingLeft);
  const scrolls = el => { for (let n=el; n; n=n.parentElement) {
      const o = getComputedStyle(n).overflowX; if (o==='auto'||o==='scroll') return true; } return false; };
  const out = { over: [], clip: [] };
  document.querySelectorAll('main section, footer').forEach(sec => {
    const shell = sec.querySelector('.shell'); if (!shell) return;
    const sr = shell.getBoundingClientRect();
    const gl = sr.left + pad, gr = sr.right - pad;
    sec.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || el.classList.contains('shell')) return;
      if (el.closest('.t-hero') || el.classList.contains('t-hero')) return;  // optical shift, intended
      if (el.classList.contains('stage')) return;                            // centred plate
      if (scrolls(el)) return;                                               // scrolls in its own box
      if (r.right > gr + 1 || r.left < gl - 1)
        out.over.push(`${el.tagName}.${(el.className||'').toString().split(' ')[0]}`);
      if (el.children.length===0 && !el.classList.contains('vh') &&
          el.scrollWidth > el.clientWidth + 1)
        out.clip.push(`${el.tagName} "${el.textContent.trim().slice(0,22)}"`);
    });
  });
  return out;
});
ok('nothing breaks the gutter at 320px', gutter.over.length===0, gutter.over.slice(0,6).join(' | '));
ok('no text clipped by its own box at 320px', gutter.clip.length===0, gutter.clip.slice(0,6).join(' | '));

/* the identity label and availability line wrap cleanly, never orphaning "&" */
const wraps = await pm.evaluate(() => {
  const lines = el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
  const eb = document.querySelector('.eyebrow--id');
  const meta = document.querySelector('.hero__meta span');
  return { eyebrowLines: lines(eb), availLines: lines(meta),
           ebText: eb.textContent.trim(), amp: /&\s*$/m.test(eb.innerText) };
});
ok('identity label stays within two lines at 320px', wraps.eyebrowLines <= 2, JSON.stringify(wraps));
ok('availability line stays within two lines at 320px', wraps.availLines <= 2, JSON.stringify(wraps));

/* stacked step labels get the full width, so none of them should wrap */
const stepLabels = await pm.evaluate(() => {
  return [...document.querySelectorAll('.steps .k')].map(k => {
    const lines = Math.round(k.getBoundingClientRect().height / parseFloat(getComputedStyle(k).lineHeight));
    return { t: k.textContent.trim(), lines };
  }).filter(x => x.lines > 1);
});
ok('step labels do not wrap when stacked on mobile', stepLabels.length===0,
   stepLabels.map(x=>`"${x.t}" ${x.lines}ln`).join(' | '));
const order = await pm.evaluate(() => {
  const fig = document.querySelector('.hero .hero__fig').getBoundingClientRect();
  const h1  = document.querySelector('.hero h1').getBoundingClientRect();
  return { figTop: Math.round(fig.top + window.scrollY), h1Top: Math.round(h1.top + window.scrollY) };
});
ok('mobile: avatar sits above the headline', order.figTop < order.h1Top, JSON.stringify(order));
// the avatar plate fills the content column on mobile
const heroW = await pm.evaluate(() => {
  const stage = document.querySelector('.hero .stage');
  const sub = document.querySelector('.hero__sub');
  return { stage: Math.round(stage.getBoundingClientRect().width),
           copy: Math.round(sub.getBoundingClientRect().width),
           stageLeft: Math.round(stage.getBoundingClientRect().left),
           copyLeft: Math.round(sub.getBoundingClientRect().left) };
});
ok('mobile: avatar fills the content column',
   Math.abs(heroW.stage - heroW.copy) <= 2 && Math.abs(heroW.stageLeft - heroW.copyLeft) <= 2,
   JSON.stringify(heroW));
await pm.screenshot({ path: OUT+'/mobile-top.png' });

/* ---------- mobile menu ---------- */
await pm.evaluate(() => window.scrollTo(0,0));
await pm.click('.nav-b__toggle');
await pm.waitForTimeout(650);
const menuGeom = await pm.evaluate(() => {
  const links = [...document.querySelectorAll('#menu .nav-b__links a')];
  return { lefts: [...new Set(links.map(a => Math.round(a.getBoundingClientRect().left)))],
           heights: [...new Set(links.map(a => Math.round(a.getBoundingClientRect().height)))],
           labels: links.map(a => a.textContent.trim()) };
});
ok('mobile menu items share one left edge', menuGeom.lefts.length===1, JSON.stringify(menuGeom));
ok('mobile menu items meet the 44px floor', Math.min(...menuGeom.heights) >= 44, JSON.stringify(menuGeom.heights));
const menuCta = await pm.evaluate(() => {
  const a = [...document.querySelectorAll('#menu .offcanvas-cta a')];
  return { n: a.length, labels: a.map(x => x.textContent.trim()),
           cv: a.some(x => x.getAttribute('href').endsWith('.pdf')) };
});
ok('mobile menu offers both CTAs including the CV', menuCta.n===2 && menuCta.cv, JSON.stringify(menuCta));
await pm.screenshot({ path: OUT+'/mobile-menu.png' });

// clicking an item must close the panel AND land on the section
await pm.click('#menu .nav-b__links a[href="#work"]');
await pm.waitForTimeout(1800);
const nav = await pm.evaluate(() => ({
  open: document.querySelector('#menu').classList.contains('show'),
  backdrop: !!document.querySelector('.offcanvas-backdrop'),
  locked: getComputedStyle(document.body).overflow === 'hidden',
  workTop: Math.round(document.querySelector('#work').getBoundingClientRect().top),
  y: Math.round(window.scrollY)
}));
ok('mobile menu closes on item click', !nav.open && !nav.backdrop && !nav.locked, JSON.stringify(nav));
ok('mobile menu navigates to the section', Math.abs(nav.workTop) <= 4 && nav.y > 200, JSON.stringify(nav));
await pm.evaluate(()=>document.querySelector('#ask').scrollIntoView());
await pm.waitForTimeout(1100);
const stick = await pm.evaluate(() => {
  const r = document.querySelector('#nav').getBoundingClientRect();
  return { top: Math.round(r.top), scrolled: Math.round(window.scrollY) };
});
ok('nav stays stuck to the top when scrolled (mobile)', stick.scrolled > 200 && stick.top <= 1, JSON.stringify(stick));
await pm.screenshot({ path: OUT+'/mobile-chat.png' });

/* ---------- 200% zoom ---------- */
const z = await browser.newContext({ viewport:{width:640,height:450}, deviceScaleFactor:2 });
const pz = await z.newPage();
await pz.goto(TEST_URL,{waitUntil:'networkidle'});
await pz.waitForTimeout(700);
const zscroll = await pz.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
ok('no horizontal scroll at 200% zoom', !zscroll);

/* ---------- no JavaScript ---------- */
const nojs = await browser.newContext({ viewport:{width:1440,height:900}, javaScriptEnabled:false });
const pn = await nojs.newPage();
await pn.goto(TEST_URL,{waitUntil:'load'});
await pn.waitForTimeout(500);
const noJsVis = await pn.evaluate(() => {
  const bad = [];
  ['.hero .eyebrow--id','.hero__sub','.hero__cta','.hero__meta','.hero__fig',
   '.t-hero .ln > span','.rv','.metric'].forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (+getComputedStyle(el).opacity < 0.99) bad.push(sel);
    });
  });
  return [...new Set(bad)];
}).catch(() => ['evaluate blocked']);
ok('page renders complete with JavaScript disabled', noJsVis.length===0, noJsVis.join(' | '));
await nojs.close();

/* ---------- reduced motion ---------- */
const r = await browser.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
const pr = await r.newPage();
await pr.goto(TEST_URL,{waitUntil:'networkidle'});
await pr.waitForTimeout(900);
const rm = await pr.evaluate(() => ({
  paused: document.querySelector('#heroVideo').paused,
  sources: document.querySelector('#heroVideo').querySelectorAll('source').length,
  revealed: [...document.querySelectorAll('.rv')].every(e=>e.classList.contains('is-in')),
  metric: document.querySelector('.metric__n').textContent.trim()
}));
ok('reduced motion: video never loads', rm.paused && rm.sources===0, JSON.stringify(rm));
ok('reduced motion: content revealed', rm.revealed);
const rmHero = await pr.evaluate(() => {
  const bad = [];
  ['.hero .eyebrow--id','.hero__sub','.hero__cta','.hero__fig','.t-hero .ln > span']
    .forEach(sel => document.querySelectorAll(sel).forEach(el => {
      if (+getComputedStyle(el).opacity < 0.99) bad.push(sel); }));
  return bad;
});
ok('reduced motion: hero renders complete, no entrance', rmHero.length===0, rmHero.join(' | '));
ok('reduced motion: metric at final value', rm.metric==='100.96M', rm.metric);

await browser.close();

const fail = results.filter(r=>!r.pass);
console.log('\n' + '='.repeat(72));
results.forEach(r => console.log((r.pass?'  PASS  ':'> FAIL <') + ' ' + r.n + (r.d && !r.pass ? '\n           '+r.d : '')));
console.log('='.repeat(72));
console.log(`${results.length-fail.length}/${results.length} passed\n`);
process.exit(fail.length ? 1 : 0);
