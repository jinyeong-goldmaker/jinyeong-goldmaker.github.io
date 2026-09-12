import { tryParseFormula, formulaToString } from '../lib/parser.js';
import { buildTable, classify, checkValidity } from '../lib/truthtable.js';
import { PALETTE_PROP } from '../lib/symbols.js';
import { wirePalette, showMessage, el } from '../lib/ui.js';

const singleInput = document.getElementById('single-input');
const conclusionInput = document.getElementById('conclusion-input');
wirePalette(document.getElementById('single-palette'), singleInput, PALETTE_PROP);
wirePalette(document.getElementById('arg-palette'), conclusionInput, PALETTE_PROP);

function renderTable(atoms, formulasLabels, rows, options = {}) {
  const table = el('table', { class: 'truth-table' });
  const thead = el('tr', {}, [
    ...atoms.map(a => el('th', {}, a)),
    ...formulasLabels.map(l => el('th', { class: 'main-col' }, l)),
  ]);
  table.appendChild(el('thead', {}, thead));
  const tbody = el('tbody');
  rows.forEach((row, i) => {
    const isCounter = options.counterRowIndex === i;
    const tr = el('tr', { class: isCounter ? 'counter-row' : '' }, [
      ...atoms.map(a => el('td', {}, row.valuation[a] ? 'T' : 'F')),
      ...row.values.map(v => el('td', { class: 'main-col' }, v ? 'T' : 'F')),
    ]);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

document.getElementById('single-run').addEventListener('click', () => {
  const msg = document.getElementById('single-msg');
  const wrap = document.getElementById('single-table-wrap');
  wrap.innerHTML = '';
  const raw = singleInput.value.trim();
  if (!raw) { showMessage(msg, '문장을 입력하세요.', 'bad'); return; }
  const res = tryParseFormula(raw, 'prop');
  if (!res.ok) { showMessage(msg, `구문 오류: ${res.error}`, 'bad'); return; }
  const { atoms, rows } = buildTable([res.ast]);
  const kind = classify(res.ast);
  const kindLabel = { tautology: '항진명제 (tautology)', contradiction: '모순명제 (contradiction)', contingency: '우연명제 (contingency)' }[kind];
  showMessage(msg, `해석된 문장: ${formulaToString(res.ast)}  —  ${kindLabel}`, kind === 'contradiction' ? 'bad' : 'ok');
  wrap.appendChild(renderTable(atoms, [formulaToString(res.ast)], rows));
});

let premiseCount = 0;
function addPremiseRow() {
  premiseCount++;
  const id = `premise-${premiseCount}`;
  const row = el('div', { style: 'display:flex;gap:0.5rem;align-items:center;margin-bottom:0.4rem' }, [
    el('input', { type: 'text', id, placeholder: `전제 ${premiseCount} (예: A→B)`, style: 'flex:1' }),
    el('button', { class: 'btn danger small', type: 'button', onclick: (e) => e.currentTarget.parentElement.remove() }, '삭제'),
  ]);
  document.getElementById('premise-list').appendChild(row);
}
document.getElementById('add-premise').addEventListener('click', addPremiseRow);
addPremiseRow();
addPremiseRow();

document.getElementById('arg-run').addEventListener('click', () => {
  const msg = document.getElementById('arg-msg');
  const wrap = document.getElementById('arg-table-wrap');
  wrap.innerHTML = '';
  const premiseInputs = [...document.querySelectorAll('#premise-list input')].map(i => i.value.trim()).filter(Boolean);
  const concRaw = conclusionInput.value.trim();
  if (premiseInputs.length === 0 || !concRaw) { showMessage(msg, '전제를 하나 이상 입력하고 결론도 입력하세요.', 'bad'); return; }
  const parsedPremises = [];
  for (const p of premiseInputs) {
    const r = tryParseFormula(p, 'prop');
    if (!r.ok) { showMessage(msg, `전제 구문 오류 (${p}): ${r.error}`, 'bad'); return; }
    parsedPremises.push(r.ast);
  }
  const concRes = tryParseFormula(concRaw, 'prop');
  if (!concRes.ok) { showMessage(msg, `결론 구문 오류: ${concRes.error}`, 'bad'); return; }

  const result = checkValidity(parsedPremises, concRes.ast);
  const labels = [...parsedPremises.map(formulaToString), `∴ ${formulaToString(concRes.ast)}`];
  let counterRowIndex = -1;
  if (!result.valid) {
    counterRowIndex = result.table.rows.findIndex(r => r.valuation === result.counterexample);
  }
  if (result.valid) {
    showMessage(msg, '타당한 논증입니다 (모든 전제가 참이면서 결론이 거짓인 경우가 없습니다).', 'ok');
  } else {
    const ce = Object.entries(result.counterexample).map(([k, v]) => `${k}=${v ? 'T' : 'F'}`).join(', ');
    showMessage(msg, `타당하지 않은 논증입니다. 반례: ${ce}`, 'bad');
  }
  wrap.appendChild(renderTable(result.table.atoms, labels, result.table.rows, { counterRowIndex }));
});

// Prefill from URL query (used by the exercises page):
//   ?formula=...                       -> section 1 (single formula)
//   ?premises=A→B|A&conclusion=B       -> section 2 (argument validity), '|'-separated premises
(() => {
  const qp = new URLSearchParams(location.search);
  const f = qp.get('formula');
  if (f) { singleInput.value = f; document.getElementById('single-run').click(); }
  const premisesParam = qp.get('premises');
  const concParam = qp.get('conclusion');
  if (premisesParam) {
    const list = premisesParam.split('|').map(s => s.trim()).filter(Boolean);
    document.getElementById('premise-list').innerHTML = '';
    premiseCount = 0;
    for (const p of list) { addPremiseRow(); const inputs = document.querySelectorAll('#premise-list input'); inputs[inputs.length - 1].value = p; }
    if (concParam) conclusionInput.value = concParam;
    document.getElementById('arg-run').click();
  }
})();
