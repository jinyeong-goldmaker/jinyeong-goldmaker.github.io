// truthtable.js — propositional-only evaluator, truth table generator,
// tautology/contradiction/contingency classifier, and argument validity checker
// (진리표를 이용한 논증 타당성 검사).

import { collectPropAtoms } from './parser.js';

export function evaluate(ast, val) {
  switch (ast.type) {
    case 'Atom': return !!val[ast.name];
    case 'Falsum': return false;
    case 'Not': return !evaluate(ast.arg, val);
    case 'And': return evaluate(ast.left, val) && evaluate(ast.right, val);
    case 'Or': return evaluate(ast.left, val) || evaluate(ast.right, val);
    case 'Imp': return (!evaluate(ast.left, val)) || evaluate(ast.right, val);
    case 'Iff': return evaluate(ast.left, val) === evaluate(ast.right, val);
    default:
      throw new Error('진리표는 문장논리 연결사(¬∧∨→↔)와 원자문장만 지원합니다.');
  }
}

/**
 * Build a full truth table for one or more formulas sharing the same atom set.
 * Returns { atoms: string[], rows: [{ valuation: {A:bool,...}, values: bool[] }] }
 * where values[i] corresponds to formulas[i].
 */
export function buildTable(formulas) {
  const atomSet = new Set();
  for (const f of formulas) for (const a of collectPropAtoms(f)) atomSet.add(a);
  const atoms = [...atomSet].sort();
  const n = atoms.length;
  const rows = [];
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const valuation = {};
    // Row order: leftmost atom is the "slowest" column (T first), like a textbook table.
    atoms.forEach((a, idx) => {
      const bit = (mask >> (n - 1 - idx)) & 1;
      valuation[a] = bit === 0; // 0 -> T, so the very first row is all-T
    });
    const values = formulas.map(f => evaluate(f, valuation));
    rows.push({ valuation, values });
  }
  return { atoms, rows };
}

export function classify(ast) {
  const { rows } = buildTable([ast]);
  const results = rows.map(r => r.values[0]);
  const allTrue = results.every(Boolean);
  const allFalse = results.every(v => !v);
  if (allTrue) return 'tautology';
  if (allFalse) return 'contradiction';
  return 'contingency';
}

/**
 * Check whether premises semantically entail the conclusion (문장논리 논증 타당성 검사).
 * Returns { valid: boolean, counterexample: {atom:bool,...} | null, table }
 */
export function checkValidity(premises, conclusion) {
  const table = buildTable([...premises, conclusion]);
  const concIdx = premises.length;
  for (const row of table.rows) {
    const allPremisesTrue = row.values.slice(0, premises.length).every(Boolean);
    const conclusionTrue = row.values[concIdx];
    if (allPremisesTrue && !conclusionTrue) {
      return { valid: false, counterexample: row.valuation, table };
    }
  }
  return { valid: true, counterexample: null, table };
}
