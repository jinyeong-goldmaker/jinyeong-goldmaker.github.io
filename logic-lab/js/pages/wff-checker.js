import { tryParseFormula, formulaToString, mainConnective } from '../lib/parser.js';
import { PALETTE_PROP, PALETTE_PRED } from '../lib/symbols.js';
import { wirePalette, wireModeToggle, showMessage, el } from '../lib/ui.js';

let mode = 'prop';
const input = document.getElementById('formula-input');
const paletteEl = document.getElementById('palette');

function refreshPalette() {
  wirePalette(paletteEl, input, mode === 'pred' ? [...PALETTE_PROP, ...PALETTE_PRED] : PALETTE_PROP);
}
wireModeToggle(document.getElementById('mode-toggle'), mode, (m) => { mode = m; refreshPalette(); });
refreshPalette();

function describeNode(node) {
  switch (node.type) {
    case 'Atom': return node.args.length ? `술어 원자문장 (${node.name}, 항 ${node.args.length}개)` : `원자문장 (${node.name})`;
    case 'Falsum': return '모순 상수 ⊥';
    case 'Identity': return node.neg ? '부동일성 (≠)' : '동일성 (=)';
    case 'Not': return '부정 (¬)';
    case 'And': return '연언 (∧)';
    case 'Or': return '선언 (∨)';
    case 'Imp': return '조건 (→)';
    case 'Iff': return '쌍조건 (↔)';
    case 'Forall': return `전칭양화 (∀${node.variable})`;
    case 'Exists': return `존재양화 (∃${node.variable})`;
    default: return '?';
  }
}

function children(node) {
  switch (node.type) {
    case 'Not': return [node.arg];
    case 'Forall': case 'Exists': return [node.body];
    case 'And': case 'Or': case 'Imp': case 'Iff': return [node.left, node.right];
    default: return [];
  }
}

function renderNode(node, isRoot) {
  const li = el('li', {}, [
    el('span', { class: isRoot ? 'tree-node' : 'tree-node', html: `<strong>${formulaToString(node)}</strong> — ${describeNode(node)}${isRoot ? ' <em>(주연결사)</em>' : ''}` }),
  ]);
  const kids = children(node);
  if (kids.length) {
    const ul = el('ul', { class: 'tree-list' });
    for (const k of kids) ul.appendChild(renderNode(k, false));
    li.appendChild(ul);
  }
  return li;
}

document.getElementById('run').addEventListener('click', () => {
  const msg = document.getElementById('msg');
  const wrap = document.getElementById('tree-wrap');
  wrap.innerHTML = '';
  const raw = input.value.trim();
  if (!raw) { showMessage(msg, '문장을 입력하세요.', 'bad'); return; }
  const res = tryParseFormula(raw, mode);
  if (!res.ok) { showMessage(msg, `적형식이 아닙니다 (구문 오류): ${res.error}`, 'bad'); return; }
  const mc = mainConnective(res.ast);
  showMessage(msg, `적형식(WFF)입니다. 해석: ${formulaToString(res.ast)}  /  주연결사: ${mc.name}`, 'ok');
  const ul = el('ul', { class: 'tree-list root' }, [renderNode(res.ast, true)]);
  wrap.appendChild(ul);
});

// Prefill from URL query (used by the exercises page): ?formula=...&mode=prop|pred
(() => {
  const qp = new URLSearchParams(location.search);
  const f = qp.get('formula');
  const m = qp.get('mode');
  if (m === 'prop' || m === 'pred') {
    mode = m;
    document.querySelectorAll('#mode-toggle button[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    refreshPalette();
  }
  if (f) { input.value = f; document.getElementById('run').click(); }
})();
