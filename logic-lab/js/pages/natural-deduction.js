import { verifyProof, RULES } from '../lib/naturalDeduction.js';
import { PALETTE_PROP, PALETTE_PRED } from '../lib/symbols.js';
import { wirePalette, wireModeToggle, showMessage, el } from '../lib/ui.js';

let idCounter = 0;
const newId = () => `n${++idCounter}`;

const state = {
  mode: 'pred',
  premises: [{ id: newId(), text: '' }, { id: newId(), text: '' }],
  conclusion: '',
  items: [],
};
let lastResults = null; // Map(internalId -> {ok, message}) after last verify

const RULE_KEYS = Object.keys(RULES).filter(k => k !== 'PREMISE' && k !== 'ASM');

function palette() { return state.mode === 'pred' ? [...PALETTE_PROP, ...PALETTE_PRED] : PALETTE_PROP; }

// ---------- numbering: map internal ids <-> user-facing line numbers / box ranges ----------
function numberProof() {
  let counter = 0;
  const numberOf = new Map();
  const idOfNumber = new Map();
  const rangeOfSubproof = new Map(); // subproofId -> "start-end"
  const rangeToSubproofId = new Map(); // "start-end" -> subproofId

  for (const p of state.premises) { counter++; numberOf.set(p.id, counter); idOfNumber.set(counter, p.id); }
  function walk(items) {
    for (const item of items) {
      if (item.kind === 'line') {
        counter++; numberOf.set(item.id, counter); idOfNumber.set(counter, item.id);
      } else {
        counter++; numberOf.set(item.assumption.id, counter); idOfNumber.set(counter, item.assumption.id);
        const start = counter;
        walk(item.items);
        const end = counter;
        const key = `${start}-${end}`;
        rangeOfSubproof.set(item.id, key);
        rangeToSubproofId.set(key, item.id);
      }
    }
  }
  walk(state.items);
  return { numberOf, idOfNumber, rangeOfSubproof, rangeToSubproofId };
}

function resolveCitesText(text, idOfNumber, rangeToSubproofId) {
  const raw = (text || '').split(',').map(s => s.trim()).filter(Boolean);
  return raw.map(tok => {
    const m = tok.match(/^(\d+)-(\d+)$/);
    if (m) {
      const subId = rangeToSubproofId.get(tok);
      return { kind: 'subproof', id: subId || `[알 수 없는 하위증명 ${tok}]` };
    }
    if (/^\d+$/.test(tok)) {
      const lineId = idOfNumber.get(parseInt(tok, 10));
      return { kind: 'line', id: lineId || `[알 수 없는 줄 ${tok}]` };
    }
    return { kind: 'line', id: `[알 수 없는 인용 "${tok}"]` };
  });
}

// ---------- building the verifyProof-shaped structure ----------
function toVerifiableItems(items) {
  return items.map(item => {
    if (item.kind === 'line') {
      return { id: item.id, kind: 'line', formulaText: item.text, rule: item.rule, cites: item._resolvedCites || [] };
    }
    return {
      id: item.id, kind: 'subproof',
      assumption: { id: item.assumption.id, formulaText: item.assumption.text },
      items: toVerifiableItems(item.items),
    };
  });
}

// ---------- rendering ----------
const rootEl = document.getElementById('proof-root');

function ruleSelect(item) {
  const sel = el('select', { class: 'rule-select', onchange: (e) => { item.rule = e.target.value; } });
  for (const key of RULE_KEYS) {
    const opt = el('option', { value: key }, RULES[key].label);
    if (item.rule === key) opt.selected = true;
    sel.appendChild(opt);
  }
  if (!item.rule) item.rule = RULE_KEYS[0];
  return sel;
}

function formulaField(getText, setText) {
  const input = el('input', { type: 'text', value: getText() || '' });
  input.addEventListener('input', () => setText(input.value));
  return input;
}

function resultBadge(id) {
  if (!lastResults || !lastResults.has(id)) return null;
  const r = lastResults.get(id);
  if (r.ok) return el('span', { class: 'msg ok', style: 'display:inline-block;padding:0.15rem 0.5rem;margin:0' }, '✓');
  return el('span', { class: 'msg bad', style: 'display:inline-block;padding:0.15rem 0.5rem;margin:0' }, `✗ ${r.message}`);
}

function renderItems(items, container, numbering) {
  for (const item of items) {
    if (item.kind === 'line') {
      const num = numbering ? numbering.numberOf.get(item.id) : null;
      const row = el('div', { class: 'proof-line' }, [
        el('div', { class: 'lineno' }, num ? `${num}.` : '·'),
        (() => {
          const wrap = el('div');
          const paletteWrap = el('div', { class: 'symbol-palette' });
          const input = formulaField(() => item.text, (v) => { item.text = v; });
          wirePalette(paletteWrap, input, palette());
          wrap.appendChild(input);
          wrap.appendChild(paletteWrap);
          const badge = resultBadge(item.id);
          if (badge) wrap.appendChild(badge);
          return wrap;
        })(),
        (() => {
          const wrap = el('div');
          wrap.appendChild(ruleSelect(item));
          const cites = el('input', { type: 'text', class: 'cites-input', placeholder: '인용 (예: 1,2)', value: item.citesText || '' });
          cites.addEventListener('input', () => { item.citesText = cites.value; });
          wrap.appendChild(document.createElement('br'));
          wrap.appendChild(cites);
          return wrap;
        })(),
        el('button', { class: 'btn danger small', type: 'button', onclick: () => { removeItem(items, item); render(); } }, '삭제'),
      ]);
      container.appendChild(row);
    } else {
      const range = numbering ? numbering.rangeOfSubproof.get(item.id) : null;
      const box = el('div', { class: 'proof-box' });
      const asmNum = numbering ? numbering.numberOf.get(item.assumption.id) : null;
      const asmRow = el('div', { class: 'proof-line assumption' }, [
        el('div', { class: 'lineno' }, asmNum ? `${asmNum}.` : '·'),
        (() => {
          const wrap = el('div');
          const paletteWrap = el('div', { class: 'symbol-palette' });
          const input = formulaField(() => item.assumption.text, (v) => { item.assumption.text = v; });
          wirePalette(paletteWrap, input, palette());
          wrap.appendChild(input);
          wrap.appendChild(paletteWrap);
          const badge = resultBadge(item.assumption.id);
          if (badge) wrap.appendChild(badge);
          return wrap;
        })(),
        el('div', { class: 'help-text' }, `가정 (하위증명 ${range || ''})`),
        el('button', { class: 'btn danger small', type: 'button', onclick: () => { removeItem(items, item); render(); } }, '상자 삭제'),
      ]);
      box.appendChild(asmRow);
      const inner = el('div');
      box.appendChild(inner);
      renderItems(item.items, inner, numbering);
      const localBtns = el('div', { style: 'margin:0.3rem 0 0.6rem' }, [
        el('button', { class: 'btn secondary small', type: 'button', onclick: () => { item.items.push(makeLine()); render(); } }, '+ 줄 추가'),
        el('button', { class: 'btn secondary small', type: 'button', onclick: () => { item.items.push(makeSubproof()); render(); } }, '+ 하위증명 추가'),
      ]);
      box.appendChild(localBtns);
      container.appendChild(box);
    }
  }
}

function removeItem(items, item) {
  const idx = items.indexOf(item);
  if (idx >= 0) items.splice(idx, 1);
}

function makeLine() { return { id: newId(), kind: 'line', text: '', rule: RULE_KEYS[0], citesText: '' }; }
function makeSubproof() { return { id: newId(), kind: 'subproof', assumption: { id: newId(), text: '' }, items: [] }; }

function renderPremises() {
  const wrap = document.getElementById('premise-list');
  wrap.innerHTML = '';
  state.premises.forEach((p, idx) => {
    const paletteWrap = el('div', { class: 'symbol-palette', style: 'margin:0 0 0.3rem' });
    const input = el('input', { type: 'text', value: p.text, placeholder: `전제 ${idx + 1}`, style: 'flex:1' });
    input.addEventListener('input', () => { p.text = input.value; });
    wirePalette(paletteWrap, input, palette());
    const badge = resultBadge(p.id);
    const row = el('div', { style: 'margin-bottom:0.5rem' }, [
      el('div', { style: 'display:flex;gap:0.5rem;align-items:center' }, [
        input,
        badge,
        el('button', { class: 'btn danger small', type: 'button', onclick: () => { state.premises.splice(idx, 1); render(); } }, '삭제'),
      ]),
      paletteWrap,
    ]);
    wrap.appendChild(row);
  });
}

function renderRuleHelp() {
  const wrap = document.getElementById('rule-help');
  wrap.innerHTML = '';
  const table = el('table', { class: 'truth-table' });
  const thead = el('tr', {}, [el('th', {}, '규칙'), el('th', {}, '인용 개수')]);
  table.appendChild(el('thead', {}, thead));
  const tbody = el('tbody');
  for (const key of RULE_KEYS) {
    tbody.appendChild(el('tr', {}, [el('td', {}, RULES[key].label), el('td', {}, String(RULES[key].arity))]));
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
}

function render() {
  renderPremises();
  document.getElementById('conclusion-input').value = state.conclusion;
  rootEl.innerHTML = '';
  const numbering = numberProof();
  renderItems(state.items, rootEl, numbering);
}

wireModeToggle(document.getElementById('mode-toggle'), state.mode, (m) => { state.mode = m; lastResults = null; render(); });

document.getElementById('add-premise').addEventListener('click', () => { state.premises.push({ id: newId(), text: '' }); render(); });
document.getElementById('conclusion-input').addEventListener('input', (e) => { state.conclusion = e.target.value; });
document.getElementById('add-line-root').addEventListener('click', () => { state.items.push(makeLine()); render(); });
document.getElementById('add-subproof-root').addEventListener('click', () => { state.items.push(makeSubproof()); render(); });

document.getElementById('verify').addEventListener('click', () => {
  const msg = document.getElementById('msg');
  const numbering = numberProof();

  // resolve citesText -> structured cites on every line (mutates a private field, not shown to user)
  function attachCites(items) {
    for (const item of items) {
      if (item.kind === 'line') {
        item._resolvedCites = resolveCitesText(item.citesText, numbering.idOfNumber, numbering.rangeToSubproofId);
      } else {
        attachCites(item.items);
      }
    }
  }
  attachCites(state.items);

  const proof = {
    premises: state.premises.map(p => ({ id: p.id, formulaText: p.text })),
    items: toVerifiableItems(state.items),
  };

  let result;
  try {
    result = verifyProof(proof, { mode: state.mode, conclusionText: state.conclusion || null });
  } catch (e) {
    showMessage(msg, `검증 중 오류: ${e.message}`, 'bad');
    return;
  }
  lastResults = result.lineResults;
  render();

  if (result.overallOk && (state.conclusion ? result.reachedConclusion : true)) {
    showMessage(msg, state.conclusion ? '증명이 완성되었습니다! 모든 줄이 올바르고 결론에 도달했습니다.' : '모든 줄이 올바릅니다.', 'ok');
  } else if (!result.overallOk) {
    showMessage(msg, '오류가 있는 줄이 있습니다 (아래 ✗ 표시를 확인하세요).', 'bad');
  } else {
    showMessage(msg, '모든 줄은 올바르지만 아직 목표 결론에 도달하지 않았습니다.', 'info');
  }
});

renderRuleHelp();

// Prefill from URL query (used by the exercises page): ?mode=prop|pred&premises=P1|P2&conclusion=C
(() => {
  const qp = new URLSearchParams(location.search);
  const m = qp.get('mode');
  if (m === 'prop' || m === 'pred') {
    state.mode = m;
    document.querySelectorAll('#mode-toggle button[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  }
  const premisesParam = qp.get('premises');
  const concParam = qp.get('conclusion');
  if (premisesParam) {
    const list = premisesParam.split('|').map(s => s.trim()).filter(Boolean);
    state.premises = list.map(text => ({ id: newId(), text }));
  }
  if (concParam) state.conclusion = concParam;
})();

render();
