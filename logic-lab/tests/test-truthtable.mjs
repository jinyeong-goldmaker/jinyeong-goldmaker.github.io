import { parseFormula } from '../js/lib/parser.js';
import { buildTable, classify, checkValidity } from '../js/lib/truthtable.js';

function t(desc, fn) {
  try { fn(); console.log('OK  ', desc); }
  catch (e) { console.log('FAIL', desc, '->', e.message); process.exitCode = 1; }
}
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg||''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

t('tautology A∨¬A', () => {
  assertEq(classify(parseFormula('A∨¬A', 'prop')), 'tautology');
});
t('contradiction A∧¬A', () => {
  assertEq(classify(parseFormula('A∧¬A', 'prop')), 'contradiction');
});
t('contingency A∧B', () => {
  assertEq(classify(parseFormula('A∧B', 'prop')), 'contingency');
});
t('table row count for 2 atoms = 4', () => {
  const { rows, atoms } = buildTable([parseFormula('A∧B', 'prop')]);
  assertEq(atoms.join(','), 'A,B');
  assertEq(rows.length, 4);
});
t('modus ponens valid', () => {
  const p1 = parseFormula('A→B', 'prop');
  const p2 = parseFormula('A', 'prop');
  const c = parseFormula('B', 'prop');
  const r = checkValidity([p1, p2], c);
  assertEq(r.valid, true);
});
t('affirming the consequent invalid, counterexample found', () => {
  const p1 = parseFormula('A→B', 'prop');
  const p2 = parseFormula('B', 'prop');
  const c = parseFormula('A', 'prop');
  const r = checkValidity([p1, p2], c);
  assertEq(r.valid, false);
  assertEq(r.counterexample.A, false);
  assertEq(r.counterexample.B, true);
});
console.log('done');
