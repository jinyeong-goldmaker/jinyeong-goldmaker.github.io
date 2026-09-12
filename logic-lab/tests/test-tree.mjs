import { parseFormula, formulaToString } from '../js/lib/parser.js';
import { checkValidityByTree, checkSatisfiability } from '../js/lib/tree.js';

function t(desc, fn) {
  try { fn(); console.log('OK  ', desc); }
  catch (e) { console.log('FAIL', desc, '->', e.message); process.exitCode = 1; }
}
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg||''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

t('propositional modus ponens valid via tree', () => {
  const p1 = parseFormula('A→B', 'prop');
  const p2 = parseFormula('A', 'prop');
  const c = parseFormula('B', 'prop');
  const r = checkValidityByTree([p1, p2], c);
  assertEq(r.valid, true);
});

t('propositional affirming consequent invalid via tree, has model', () => {
  const p1 = parseFormula('A→B', 'prop');
  const p2 = parseFormula('B', 'prop');
  const c = parseFormula('A', 'prop');
  const r = checkValidityByTree([p1, p2], c);
  assertEq(r.valid, false);
  if (!r.tree.model) throw new Error('expected a countermodel');
});

t('predicate: universal instantiation + MP chain valid', () => {
  const p1 = parseFormula('∀x(Fx→Gx)', 'pred');
  const p2 = parseFormula('Fa', 'pred');
  const c = parseFormula('Ga', 'pred');
  const r = checkValidityByTree([p1, p2], c);
  assertEq(r.valid, true);
});

t('predicate: ∀xFx entails ∃xFx (non-empty domain)', () => {
  const p1 = parseFormula('∀xFx', 'pred');
  const c = parseFormula('∃xFx', 'pred');
  const r = checkValidityByTree([p1], c);
  assertEq(r.valid, true);
});

t('predicate: ∃xFx does NOT entail ∀xFx, countermodel found', () => {
  const p1 = parseFormula('∃xFx', 'pred');
  const c = parseFormula('∀xFx', 'pred');
  const r = checkValidityByTree([p1], c);
  assertEq(r.valid, false);
  if (!r.tree.model || r.tree.model.domain.length < 2) throw new Error('expected 2-element countermodel, got ' + JSON.stringify(r.tree.model));
});

t('identity: a=b, Fa therefore Fb valid', () => {
  const p1 = parseFormula('a=b', 'pred');
  const p2 = parseFormula('Fa', 'pred');
  const c = parseFormula('Fb', 'pred');
  const r = checkValidityByTree([p1, p2], c);
  assertEq(r.valid, true);
});

t('satisfiability: A∧¬A unsatisfiable', () => {
  const f = parseFormula('A∧¬A', 'prop');
  const r = checkSatisfiability(f);
  assertEq(r.satisfiable, false);
});

t('satisfiability: ∃x(Fx∧¬Gx) satisfiable', () => {
  const f = parseFormula('∃x(Fx∧¬Gx)', 'pred');
  const r = checkSatisfiability(f);
  assertEq(r.satisfiable, true);
});

console.log('done');
