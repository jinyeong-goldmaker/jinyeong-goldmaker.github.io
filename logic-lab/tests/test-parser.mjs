import { parseFormula, formulaToString, mainConnective, collectPropAtoms, freeTermLetters, substitute } from '../js/lib/parser.js';

function t(desc, fn) {
  try { fn(); console.log('OK  ', desc); }
  catch (e) { console.log('FAIL', desc, '->', e.message); process.exitCode = 1; }
}
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} expected ${b}, got ${a}`); }

t('propositional shorthand precedence A∧B→C', () => {
  const ast = parseFormula('A∧B->C', 'prop');
  assertEq(ast.type, 'Imp');
  assertEq(formulaToString(ast), 'A∧B→C');
});

t('fully parenthesized still works', () => {
  const ast = parseFormula('(A∧B)→¬C', 'prop');
  assertEq(mainConnective(ast).symbol, '→');
});

t('ascii aliases normalize (~, &, v is NOT aliased in pred mode)', () => {
  const ast = parseFormula('~A & B', 'prop');
  assertEq(formulaToString(ast), '¬A∧B');
});

t('predicate juxtaposed args Rxy', () => {
  const ast = parseFormula('Rxy', 'pred');
  assertEq(ast.type, 'Atom');
  assertEq(ast.args.length, 2);
  assertEq(formulaToString(ast), 'Rxy');
});

t('predicate paren args R(x,y)', () => {
  const ast = parseFormula('R(x,y)', 'pred');
  assertEq(formulaToString(ast), 'Rxy');
});

t('quantifier minimal scope', () => {
  const ast = parseFormula('∀xFx∧Gx', 'pred');
  assertEq(ast.type, 'And');
  assertEq(ast.left.type, 'Forall');
});

t('quantifier wide scope with parens', () => {
  const ast = parseFormula('∀x(Fx∧Gx)', 'pred');
  assertEq(ast.type, 'Forall');
  assertEq(ast.body.type, 'And');
});

t('word-form forall/exists', () => {
  const ast = parseFormula('(forall x)(Fx -> Gx)', 'pred');
  assertEq(ast.type, 'Forall');
  assertEq(formulaToString(ast), '∀x(Fx→Gx)');
});

t('identity', () => {
  const ast = parseFormula('x=y', 'pred');
  assertEq(ast.type, 'Identity');
  assertEq(formulaToString(ast), 'x=y');
});

t('neq', () => {
  const ast = parseFormula('x!=y', 'pred');
  assertEq(ast.type, 'Identity');
  assertEq(ast.neg, true);
});

t('collectPropAtoms', () => {
  const ast = parseFormula('(A∧B)→(A∨C)', 'prop');
  const atoms = [...collectPropAtoms(ast)].sort();
  assertEq(atoms.join(','), 'A,B,C');
});

t('free vs bound term letters', () => {
  const ast = parseFormula('∀x(Fx)∧Gx', 'pred'); // second Gx has FREE x
  const free = [...freeTermLetters(ast)].sort();
  assertEq(free.join(','), 'x');
});

t('substitute for forall-elim', () => {
  const ast = parseFormula('Fx', 'pred'); // body of ∀x Fx after stripping quantifier
  const sub = substitute(ast, 'x', 'a');
  assertEq(formulaToString(sub), 'Fa');
});

t('capture detection throws', () => {
  let threw = false;
  try {
    // substituting y for x inside ∀y(Fxy) should be flagged as capture
    const ast = parseFormula('∀y(Fxy)', 'pred');
    substitute(ast, 'x', 'y');
  } catch (e) { threw = true; }
  if (!threw) throw new Error('expected capture error');
});

t('predicate mode rejects lowercase-as-propositional-atom nonsense gracefully', () => {
  let threw = false;
  try { parseFormula('x', 'pred'); } catch (e) { threw = true; }
  if (!threw) throw new Error('bare term should not parse as formula');
});

t('propositional mode rejects predicates with args', () => {
  let threw = false;
  try { parseFormula('Fx', 'prop'); } catch (e) { threw = true; }
  if (!threw) throw new Error('should reject term letters in prop mode');
});

console.log('done');
