import { tryParseFormula, formulaToString } from '../lib/parser.js';
import { checkValidityByTree, checkSatisfiability } from '../lib/tree.js';
import { PALETTE_PROP, PALETTE_PRED } from '../lib/symbols.js';
import { wirePalette, wireModeToggle, showMessage, el } from '../lib/ui.js';

let mode = 'pred';
const conclusionInput = document.getElementById('conclusion-input');
const paletteEl = document.getElementById('palette');

function refreshPalette() {
  wirePalette(paletteEl, conclusionInput, mode === 'pred' ? [...PALETTE_PROP, ...PALETTE_PRED] : PALETTE_PROP);
}
wireModeToggle(document.getElementById('mode-toggle'), mode, (m) => { mode = m; refreshPalette(); });
refreshPalette();

let premiseCount = 0;
function addPremiseRow() {
  premiseCount++;
  const id = `tt-premise-${premiseCount}`;
  const row = el('div', { style: 'display:flex;gap:0.5rem;align-items:center;margin-bottom:0.4rem' }, [
    el('input', { type: 'text', id, placeholder: `전제 ${premiseCount} (예: ∀x(Fx→Gx))`, style: 'flex:1' }),
    el('button', { class: 'btn danger small', type: 'button', onclick: (e) => e.currentTarget.parentElement.remove() }, '삭제'),
  ]);
  document.getElementById('premise-list').appendChild(row);
}
document.getElementById('add-premise').addEventListener('click', addPremiseRow);
addPremiseRow();

function readPremises() {
  return [...document.querySelectorAll('#premise-list input')].map(i => i.value.trim()).filter(Boolean);
}

function buildChainUl(node, leafMap) {
  const ul = el('ul', { class: 'tree-list' });
  let current = node;
  while (current) {
    const li = el('li', {}, [el('span', { class: 'tree-node' }, formulaToString(current.formula))]);
    ul.appendChild(li);
    if (current.children.length === 0) {
      const st = leafMap.get(current.id);
      if (st) {
        let text, cls;
        if (st.status === 'closed') { cls = 'tree-closed'; text = ` ✕ 닫힘${st.closedReason ? ` (${st.closedReason})` : ''}`; }
        else if (st.status === 'open') { cls = 'tree-open'; text = ' ○ 열림 (완결 — 모형 있음)'; }
        else { cls = ''; text = ' ? 확실치 않음 (전개 한도 도달)'; }
        li.appendChild(el('span', { class: cls }, text));
      }
      current = null;
    } else if (current.children.length === 1) {
      current = current.children[0];
    } else {
      const forkLi = el('li');
      const nestedUl = el('ul', { class: 'tree-list' });
      for (const child of current.children) {
        const branchLi = el('li');
        branchLi.appendChild(buildChainUl(child, leafMap));
        nestedUl.appendChild(branchLi);
      }
      forkLi.appendChild(nestedUl);
      ul.appendChild(forkLi);
      current = null;
    }
  }
  return ul;
}

function renderTree(tree) {
  const wrap = document.getElementById('tree-wrap');
  wrap.innerHTML = '';
  const leafMap = new Map(tree.leafStatuses.map(s => [s.leafNodeId, s]));
  const container = el('ul', { class: 'tree-list root' });
  container.appendChild(buildChainUl(tree.root, leafMap));
  wrap.appendChild(container);
  wrap.appendChild(el('p', { class: 'help-text' }, `가지: 닫힘 ${tree.closedCount} / 열림 ${tree.openCount} / 확실치않음 ${tree.unknownCount} (전개 단계 ${tree.stepsUsed}회)`));
}

function renderModel(model) {
  const wrap = document.getElementById('model-wrap');
  wrap.innerHTML = '';
  if (!model) return;
  const parts = [];
  parts.push(`정의역(등장한 이름): {${model.domain.join(', ') || '∅'}}`);
  if (model.trueAtoms.length) parts.push(`참: ${model.trueAtoms.join(', ')}`);
  if (model.falseAtoms.length) parts.push(`거짓: ${model.falseAtoms.join(', ')}`);
  wrap.appendChild(el('div', { class: 'msg info' }, parts.join('  /  ')));
}

document.getElementById('run-validity').addEventListener('click', () => {
  const msg = document.getElementById('msg');
  document.getElementById('model-wrap').innerHTML = '';
  document.getElementById('tree-wrap').innerHTML = '';
  const premiseTexts = readPremises();
  const concText = conclusionInput.value.trim();
  if (premiseTexts.length === 0 || !concText) { showMessage(msg, '전제를 하나 이상, 결론도 입력하세요.', 'bad'); return; }
  const premises = [];
  for (const p of premiseTexts) {
    const r = tryParseFormula(p, mode);
    if (!r.ok) { showMessage(msg, `전제 구문 오류 (${p}): ${r.error}`, 'bad'); return; }
    premises.push(r.ast);
  }
  const cr = tryParseFormula(concText, mode);
  if (!cr.ok) { showMessage(msg, `결론 구문 오류: ${cr.error}`, 'bad'); return; }

  const { valid, tree } = checkValidityByTree(premises, cr.ast);
  if (valid === true) showMessage(msg, '모든 가지가 닫혔습니다 → 타당한 논증입니다.', 'ok');
  else if (valid === false) showMessage(msg, '열린 가지가 있습니다 → 타당하지 않은 논증입니다 (아래 모형 참고).', 'bad');
  else showMessage(msg, `전개 한도(${tree.stepsUsed}단계) 내에 결론이 나지 않았습니다 — 확실치 않습니다.`, 'info');
  renderModel(tree.model);
  renderTree(tree);
});

document.getElementById('run-sat').addEventListener('click', () => {
  const msg = document.getElementById('msg');
  document.getElementById('model-wrap').innerHTML = '';
  document.getElementById('tree-wrap').innerHTML = '';
  const premiseTexts = readPremises();
  if (premiseTexts.length === 0) { showMessage(msg, '전제를 하나 이상 입력하세요.', 'bad'); return; }
  const premises = [];
  for (const p of premiseTexts) {
    const r = tryParseFormula(p, mode);
    if (!r.ok) { showMessage(msg, `전제 구문 오류 (${p}): ${r.error}`, 'bad'); return; }
    premises.push(r.ast);
  }
  // combine all premises with AND for a single-formula satisfiability test
  const combined = premises.reduce((acc, f) => acc ? { type: 'And', left: acc, right: f } : f, null);
  const { satisfiable, tree } = checkSatisfiability(combined);
  if (satisfiable === true) showMessage(msg, '전제들을 동시에 만족하는 모형이 있습니다 (충족가능).', 'ok');
  else if (satisfiable === false) showMessage(msg, '모든 가지가 닫혔습니다 → 전제들이 동시에 참일 수 없습니다 (충족불가능).', 'bad');
  else showMessage(msg, '전개 한도 내에 결론이 나지 않았습니다 — 확실치 않습니다.', 'info');
  renderModel(tree.model);
  renderTree(tree);
});

// Prefill is from URL query (used by the exercises page):
//   ?mode=prop|pred&premises=P1|P2&conclusion=C  (conclusion omitted -> satisfiability check)
(() => {
  const qp = new URLSearchParams(location.search);
  const m = qp.get('mode');
  if (m === 'prop' || m === 'pred') {
    mode = m;
    document.querySelectorAll('#mode-toggle button[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    refreshPalette();
  }
  const premisesParam = qp.get('premises');
  const concParam = qp.get('conclusion');
  if (premisesParam) {
    const list = premisesParam.split('|').map(s => s.trim()).filter(Boolean);
    document.getElementById('premise-list').innerHTML = '';
    premiseCount = 0;
    for (const p of list) { addPremiseRow(); const inputs = document.querySelectorAll('#premise-list input'); inputs[inputs.length - 1].value = p; }
    if (concParam) { conclusionInput.value = concParam; document.getElementById('run-validity').click(); }
    else document.getElementById('run-sat').click();
  }
})();
