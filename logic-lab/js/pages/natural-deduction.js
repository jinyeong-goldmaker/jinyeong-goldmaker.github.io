import { verifyProof, RULES } from '../lib/naturalDeduction.js';
import { PALETTE_PROP, PALETTE_PRED } from '../lib/symbols.js';
import { wirePalette, wireModeToggle, showMessage, el } from '../lib/ui.js';

let idCounter = 0;
const newId = () => `n${++idCounter}`;
const isEnglish = document.documentElement.lang === 'en';

const state = {
  mode: 'prop',
  premises: [{ id: newId(), text: '' }, { id: newId(), text: '' }],
  conclusion: '',
  items: [],
};
let lastResults = null;

const RULE_KEYS = Object.keys(RULES).filter(k => k !== 'PREMISE' && k !== 'ASM');

const RULE_LABEL_EN = {
  REIT: 'Reiteration (R)', AND_I: '∧ Introduction', AND_E: '∧ Elimination', OR_I: '∨ Introduction', OR_E: '∨ Elimination',
  IMP_I: '→ Introduction', IMP_E: '→ Elimination (MP)', IFF_I: '↔ Introduction', IFF_E: '↔ Elimination',
  NOT_I: '¬ Introduction', NOT_E: '¬ Elimination (⊥ Intro)', FALSUM_E: '⊥ Elimination', DNE: 'Double-negation Elim.', DNI: 'Double-negation Intro.',
  MT: 'Modus Tollens (MT)', HS: 'Hypothetical Syllogism (HS)', DS: 'Disjunctive Syllogism (DS)', DEM: 'De Morgan',
  FORALL_E: '∀ Elimination', FORALL_I: '∀ Introduction', EXISTS_I: '∃ Introduction', EXISTS_E: '∃ Elimination',
  ID_I: 'Identity Introduction (=I)', ID_E: 'Identity Elimination (=E)'
};

const RULE_DESC_KO = {
  REIT: '앞서 얻은 문장 A를 그대로 다시 쓴다.',
  AND_I: 'A와 B로부터 A∧B를 도출한다.',
  AND_E: 'A∧B로부터 A 또는 B를 도출한다.',
  OR_I: 'A로부터 A∨B(또는 B∨A)를 도출한다.',
  OR_E: 'A∨B와 두 경우의 하위증명으로 공통 결론 C를 도출한다.',
  IMP_I: 'A를 가정해 B를 얻은 하위증명으로 A→B를 도출한다.',
  IMP_E: 'A→B와 A로부터 B를 도출한다.',
  IFF_I: 'A→B와 B→A(또는 두 하위증명)로 A↔B를 도출한다.',
  IFF_E: 'A↔B와 한쪽 문장으로 다른 쪽을 도출한다.',
  NOT_I: 'A를 가정해 ⊥를 얻은 하위증명으로 ¬A를 도출한다.',
  NOT_E: 'A와 ¬A로부터 ⊥를 도출한다.',
  FALSUM_E: '⊥로부터 임의의 문장을 도출한다.',
  DNE: '¬¬A로부터 A를 도출한다.',
  DNI: 'A로부터 ¬¬A를 도출한다.',
  MT: 'A→B와 ¬B로부터 ¬A를 도출한다.',
  HS: 'A→B와 B→C로부터 A→C를 도출한다.',
  DS: 'A∨B와 ¬A(또는 ¬B)로부터 남은 선언지를 도출한다.',
  DEM: '드모르간 법칙에 따라 부정·연언·선언을 동치 변형한다.',
  FORALL_E: '∀xFx로부터 적절한 사례 Fa를 도출한다.',
  FORALL_I: '임의의 이름에 대한 사례 Fa로부터 ∀xFx를 도출한다.',
  EXISTS_I: '사례 Fa로부터 ∃xFx를 도출한다.',
  EXISTS_E: '∃xFx와 신선한 이름을 쓰는 하위증명으로 결론 C를 도출한다.',
  ID_I: '인용 없이 t=t를 도출한다.',
  ID_E: 't₁=t₂와 한 문장으로부터 동일한 항을 치환한 문장을 도출한다.'
};

const RULE_DESC_EN = {
  REIT: 'Repeat a previously derived formula A.',
  AND_I: 'From A and B, infer A∧B.',
  AND_E: 'From A∧B, infer either conjunct A or B.',
  OR_I: 'From A, infer A∨B (or B∨A).',
  OR_E: 'From A∨B and two case subproofs, infer their common conclusion C.',
  IMP_I: 'From a subproof assuming A and deriving B, infer A→B.',
  IMP_E: 'From A→B and A, infer B.',
  IFF_I: 'From A→B and B→A (or two subproofs), infer A↔B.',
  IFF_E: 'From A↔B and one side, infer the other side.',
  NOT_I: 'From a subproof assuming A and deriving ⊥, infer ¬A.',
  NOT_E: 'From A and ¬A, infer ⊥.',
  FALSUM_E: 'From ⊥, infer any formula.',
  DNE: 'From ¬¬A, infer A.',
  DNI: 'From A, infer ¬¬A.',
  MT: 'From A→B and ¬B, infer ¬A.',
  HS: 'From A→B and B→C, infer A→C.',
  DS: 'From A∨B and ¬A (or ¬B), infer the remaining disjunct.',
  DEM: 'Apply De Morgan equivalence to negation, conjunction, and disjunction.',
  FORALL_E: 'From ∀xFx, infer an appropriate instance Fa.',
  FORALL_I: 'From Fa for an arbitrary name, infer ∀xFx.',
  EXISTS_I: 'From an instance Fa, infer ∃xFx.',
  EXISTS_E: 'From ∃xFx and a fresh-name subproof, infer conclusion C.',
  ID_I: 'Infer t=t without citing a line.',
  ID_E: 'From t₁=t₂ and a formula, infer the result of substituting identical terms.'
};

function ruleLabel(key) { return isEnglish ? (RULE_LABEL_EN[key] || key) : RULES[key].label; }
function ruleDesc(key) { return isEnglish ? RULE_DESC_EN[key] : RULE_DESC_KO[key]; }
function palette() { return state.mode === 'pred' ? [...PALETTE_PROP, ...PALETTE_PRED] : PALETTE_PROP; }

function numberProof() {
  let counter = 0;
  const numberOf = new Map();
  const idOfNumber = new Map();
  const rangeOfSubproof = new Map();
  const rangeToSubproofId = new Map();
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

function toVerifiableItems(items) {
  return items.map(item => {
    if (item.kind === 'line') return { id: item.id, kind: 'line', formulaText: item.text, rule: item.rule, cites: item._resolvedCites || [] };
    return { id: item.id, kind: 'subproof', assumption: { id: item.assumption.id, formulaText: item.assumption.text }, items: toVerifiableItems(item.items) };
  });
}

const rootEl = document.getElementById('proof-root');

function ruleSelect(item) {
  const sel = el('select', { class: 'rule-select', onchange: (e) => { item.rule = e.target.value; } });
  for (const key of RULE_KEYS) {
    const opt = el('option', { value: key }, ruleLabel(key));
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
          wrap.appendChild(input); wrap.appendChild(paletteWrap);
          const badge = resultBadge(item.id); if (badge) wrap.appendChild(badge);
          return wrap;
        })(),
        (() => {
          const wrap = el('div');
          wrap.appendChild(ruleSelect(item));
          const cites = el('input', { type: 'text', class: 'cites-input', placeholder: isEnglish ? 'Citations (e.g. 1,2)' : '인용 (예: 1,2)', value: item.citesText || '' });
          cites.addEventListener('input', () => { item.citesText = cites.value; });
          wrap.appendChild(document.createElement('br')); wrap.appendChild(cites);
          return wrap;
        })(),
        el('button', { class: 'btn danger small', type: 'button', onclick: () => { removeItem(items, item); render(); } }, isEnglish ? 'Delete' : '삭제'),
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
          wrap.appendChild(input); wrap.appendChild(paletteWrap);
          const badge = resultBadge(item.assumption.id); if (badge) wrap.appendChild(badge);
          return wrap;
        })(),
        el('div', { class: 'help-text' }, isEnglish ? `Assumption (subproof ${range || ''})` : `가정 (하위증명 ${range || ''})`),
        el('button', { class: 'btn danger small', type: 'button', onclick: () => { removeItem(items, item); render(); } }, isEnglish ? 'Delete box' : '상자 삭제'),
      ]);
      box.appendChild(asmRow);
      const inner = el('div'); box.appendChild(inner); renderItems(item.items, inner, numbering);
      const localBtns = el('div', { style: 'margin:0.3rem 0 0.6rem' }, [
        el('button', { class: 'btn secondary small', type: 'button', onclick: () => { item.items.push(makeLine()); render(); } }, isEnglish ? '+ Add line' : '+ 줄 추가'),
        el('button', { class: 'btn secondary small', type: 'button', onclick: () => { item.items.push(makeSubproof()); render(); } }, isEnglish ? '+ Add subproof' : '+ 하위증명 추가'),
      ]);
      box.appendChild(localBtns); container.appendChild(box);
    }
  }
}

function removeItem(items, item) { const idx = items.indexOf(item); if (idx >= 0) items.splice(idx, 1); }
function makeLine() { return { id: newId(), kind: 'line', text: '', rule: RULE_KEYS[0], citesText: '' }; }
function makeSubproof() { return { id: newId(), kind: 'subproof', assumption: { id: newId(), text: '' }, items: [] }; }

function renderPremises() {
  const wrap = document.getElementById('premise-list'); wrap.innerHTML = '';
  state.premises.forEach((p, idx) => {
    const paletteWrap = el('div', { class: 'symbol-palette', style: 'margin:0 0 0.3rem' });
    const input = el('input', { type: 'text', value: p.text, placeholder: isEnglish ? `Premise ${idx + 1}` : `전제 ${idx + 1}`, style: 'flex:1' });
    input.addEventListener('input', () => { p.text = input.value; });
    wirePalette(paletteWrap, input, palette());
    const badge = resultBadge(p.id);
    wrap.appendChild(el('div', { style: 'margin-bottom:0.5rem' }, [
      el('div', { style: 'display:flex;gap:0.5rem;align-items:center' }, [
        input, badge,
        el('button', { class: 'btn danger small', type: 'button', onclick: () => { state.premises.splice(idx, 1); render(); } }, isEnglish ? 'Delete' : '삭제'),
      ]), paletteWrap,
    ]));
  });
}

function renderConclusionPalette() {
  const input = document.getElementById('conclusion-input');
  let wrap = document.getElementById('conclusion-palette');
  if (!wrap) {
    wrap = el('div', { id: 'conclusion-palette', class: 'symbol-palette' });
    input.insertAdjacentElement('afterend', wrap);
  }
  wirePalette(wrap, input, palette());
}

function renderRuleHelp() {
  const wrap = document.getElementById('rule-help'); wrap.innerHTML = '';
  const grid = el('div', { class: 'rule-help-grid' });
  for (const key of RULE_KEYS) {
    grid.appendChild(el('div', { class: 'rule-help-item' }, [
      el('strong', {}, ruleLabel(key)),
      el('span', {}, ruleDesc(key) || ''),
    ]));
  }
  wrap.appendChild(grid);
}

function render() {
  renderPremises();
  document.getElementById('conclusion-input').value = state.conclusion;
  renderConclusionPalette();
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
  function attachCites(items) {
    for (const item of items) {
      if (item.kind === 'line') item._resolvedCites = resolveCitesText(item.citesText, numbering.idOfNumber, numbering.rangeToSubproofId);
      else attachCites(item.items);
    }
  }
  attachCites(state.items);
  const proof = { premises: state.premises.map(p => ({ id: p.id, formulaText: p.text })), items: toVerifiableItems(state.items) };
  let result;
  try { result = verifyProof(proof, { mode: state.mode, conclusionText: state.conclusion || null }); }
  catch (e) { showMessage(msg, `검증 중 오류: ${e.message}`, 'bad'); return; }
  lastResults = result.lineResults; render();
  if (result.overallOk && (state.conclusion ? result.reachedConclusion : true)) {
    showMessage(msg, state.conclusion ? '증명이 완성되었습니다! 모든 줄이 올바르고 결론에 도달했습니다.' : '모든 줄이 올바릅니다.', 'ok');
  } else if (!result.overallOk) showMessage(msg, '오류가 있는 줄이 있습니다 (아래 ✗ 표시를 확인하세요).', 'bad');
  else showMessage(msg, '모든 줄은 올바르지만 아직 목표 결론에 도달하지 않았습니다.', 'info');
});

renderRuleHelp();

(() => {
  const qp = new URLSearchParams(location.search);
  const m = qp.get('mode');
  if (m === 'prop' || m === 'pred') {
    state.mode = m;
    document.querySelectorAll('#mode-toggle button[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  }
  const premisesParam = qp.get('premises');
  const concParam = qp.get('conclusion');
  if (premisesParam) state.premises = premisesParam.split('|').map(s => s.trim()).filter(Boolean).map(text => ({ id: newId(), text }));
  if (concParam) state.conclusion = concParam;
})();

render();
