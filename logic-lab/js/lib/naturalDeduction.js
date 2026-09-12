// naturalDeduction.js — Fitch-style natural deduction proof data model + checker.
// Mirrors 기호논리학 실습실's core idea (line-by-line proof checking with citations
// and subproofs) but implemented independently.
//
// Proof shape (plain JSON, UI-agnostic):
//   {
//     premises: [{ id, formulaText }],
//     items: [ Line | Subproof, ... ]     // top-level proof body
//   }
//   Line     = { id, kind:'line', formulaText, rule, cites: [{kind:'line'|'subproof', id}] }
//   Subproof = { id, kind:'subproof', assumption: Line, items: [Line|Subproof, ...] }
//
// `formulaText` is parsed on demand (mode-aware) so the checker never assumes AST
// objects survived JSON (de)serialization from a UI editor.

import { parseFormula, formulaToString, equalFormula, freeTermLetters, allTermLetters } from './parser.js';

// ---------------- term-matching helpers (shared by ∀E/∀I/∃I/∃E/=E) ----------------

/**
 * Does `concrete` result from substituting SOME single term for `varName` in `body`
 * (respecting variable shadowing by nested quantifiers on the same letter)?
 * Returns { term, vacuous } on success (term is null + vacuous:true if varName never
 * occurs free in body, meaning any term would do), or null on structural mismatch.
 */
export function matchSubstitution(body, varName, concrete) {
  let binding = null;
  let mismatch = false;
  function bind(name) {
    if (binding === null) binding = name;
    else if (binding !== name) mismatch = true;
  }
  function walk(b, c, shadowed) {
    if (mismatch) return false;
    if (b.type !== c.type) return false;
    switch (b.type) {
      case 'Atom': {
        if (b.name !== c.name || b.args.length !== c.args.length) return false;
        for (let i = 0; i < b.args.length; i++) {
          const bt = b.args[i].name, ct = c.args[i].name;
          if (bt === varName && !shadowed.has(varName)) bind(ct);
          else if (bt !== ct) return false;
        }
        return !mismatch;
      }
      case 'Identity': {
        if (b.neg !== c.neg) return false;
        const chk = (bt, ct) => {
          if (bt === varName && !shadowed.has(varName)) bind(ct);
          else if (bt !== ct) return false;
          return true;
        };
        return chk(b.left.name, c.left.name) && chk(b.right.name, c.right.name) && !mismatch;
      }
      case 'Falsum': return true;
      case 'Not': return walk(b.arg, c.arg, shadowed);
      case 'Forall': case 'Exists': {
        if (b.variable !== c.variable) return false;
        const s2 = new Set(shadowed);
        if (b.variable === varName) s2.add(varName);
        return walk(b.body, c.body, s2);
      }
      case 'And': case 'Or': case 'Imp': case 'Iff':
        return walk(b.left, c.left, shadowed) && walk(b.right, c.right, shadowed);
      default: return false;
    }
  }
  const ok = walk(body, concrete, new Set());
  if (!ok || mismatch) return null;
  return binding === null ? { term: null, vacuous: true } : { term: binding, vacuous: false };
}

/** Is `replaced` obtainable from `orig` by swapping ANY subset of free occurrences
 *  of term-letter `fromName` with `toName` (Leibniz partial substitution, =E)? */
export function isValidPartialSubstitution(orig, replaced, fromName, toName) {
  function walk(o, r, shadowed) {
    if (o.type !== r.type) return false;
    switch (o.type) {
      case 'Atom': {
        if (o.name !== r.name || o.args.length !== r.args.length) return false;
        for (let i = 0; i < o.args.length; i++) {
          const ot = o.args[i].name, rt = r.args[i].name;
          if (ot === fromName && !shadowed.has(fromName)) { if (rt !== fromName && rt !== toName) return false; }
          else if (ot !== rt) return false;
        }
        return true;
      }
      case 'Identity': {
        if (o.neg !== r.neg) return false;
        const chk = (ot, rt) => {
          if (ot === fromName && !shadowed.has(fromName)) return rt === fromName || rt === toName;
          return ot === rt;
        };
        return chk(o.left.name, r.left.name) && chk(o.right.name, r.right.name);
      }
      case 'Falsum': return true;
      case 'Not': return walk(o.arg, r.arg, shadowed);
      case 'Forall': case 'Exists': {
        if (o.variable !== r.variable) return false;
        const s2 = new Set(shadowed);
        if (o.variable === fromName) s2.add(fromName);
        return walk(o.body, r.body, s2);
      }
      case 'And': case 'Or': case 'Imp': case 'Iff':
        return walk(o.left, r.left, shadowed) && walk(o.right, r.right, shadowed);
      default: return false;
    }
  }
  return walk(orig, replaced, new Set());
}

function demorgan(f) {
  if (f.type === 'Not' && f.arg.type === 'And') return { type: 'Or', left: { type: 'Not', arg: f.arg.left }, right: { type: 'Not', arg: f.arg.right } };
  if (f.type === 'Not' && f.arg.type === 'Or') return { type: 'And', left: { type: 'Not', arg: f.arg.left }, right: { type: 'Not', arg: f.arg.right } };
  if (f.type === 'Or' && f.left.type === 'Not' && f.right.type === 'Not') return { type: 'Not', arg: { type: 'And', left: f.left.arg, right: f.right.arg } };
  if (f.type === 'And' && f.left.type === 'Not' && f.right.type === 'Not') return { type: 'Not', arg: { type: 'Or', left: f.left.arg, right: f.right.arg } };
  return null;
}

// ---------------- flattening / scoping ----------------

function flatten(proof) {
  const registry = new Map(); // id -> entry
  const order = { n: 0 };
  const flat = [];

  for (const prem of proof.premises) {
    const entry = { id: prem.id, kind: 'line', rule: 'PREMISE', formulaText: prem.formulaText, cites: [], scopePath: [], order: order.n++ };
    registry.set(prem.id, entry);
    flat.push(entry);
  }

  function walkItems(items, scopePath) {
    for (const item of items) {
      if (item.kind === 'line') {
        const entry = { id: item.id, kind: 'line', rule: item.rule, formulaText: item.formulaText, cites: item.cites || [], scopePath: scopePath.slice(), order: order.n++ };
        registry.set(item.id, entry);
        flat.push(entry);
      } else if (item.kind === 'subproof') {
        const innerScope = scopePath.concat([item.id]);
        const asmEntry = { id: item.assumption.id, kind: 'line', rule: 'ASM', formulaText: item.assumption.formulaText, cites: [], scopePath: innerScope, order: order.n++ };
        registry.set(item.assumption.id, asmEntry);
        flat.push(asmEntry);
        walkItems(item.items, innerScope);
        const lastReal = item.items.length ? item.items[item.items.length - 1] : item.assumption;
        const lastEntry = registry.get(lastReal.id) || asmEntry;
        const spEntry = {
          id: item.id, kind: 'subproof', scopePath: scopePath.slice(),
          assumptionId: item.assumption.id, conclusionId: lastEntry.id, order: order.n++,
        };
        registry.set(item.id, spEntry);
        flat.push(spEntry);
      }
    }
  }
  walkItems(proof.items, []);
  return { registry, flat };
}

function isPrefix(prefix, arr) {
  if (prefix.length > arr.length) return false;
  for (let i = 0; i < prefix.length; i++) if (prefix[i] !== arr[i]) return false;
  return true;
}

function isVisible(target, fromEntry) {
  if (target.kind === 'line') {
    return isPrefix(target.scopePath, fromEntry.scopePath) && target.order < fromEntry.order;
  }
  // subproof: visible if its PARENT scope is a prefix of from's scope, and it's fully closed before `from`
  return isPrefix(target.scopePath, fromEntry.scopePath) && target.order < fromEntry.order;
}

function collectProtectedLetters(premises, registry, scopePath) {
  const acc = new Set();
  for (const p of premises) {
    const ast = parseFormula(p.formulaText, 'pred');
    for (const l of freeTermLetters(ast)) acc.add(l);
  }
  for (const subId of scopePath) {
    const sp = registry.get(subId);
    if (!sp) continue;
    const asm = registry.get(sp.assumptionId);
    const ast = parseFormula(asm.formulaText, 'pred');
    for (const l of freeTermLetters(ast)) acc.add(l);
  }
  return acc;
}

// ---------------- rule checkers ----------------
// Each rule receives (newFormula, cited[], ctx) where cited[] are resolved objects:
//   { kind:'line', formula } or { kind:'subproof', assumption, conclusion }
// ctx = { premises, registry, fromEntry, mode }

function need(cond, msg) { return cond ? { ok: true } : { ok: false, message: msg }; }

export const RULES = {
  PREMISE: { label: '전제', arity: 0, check: () => ({ ok: true }) },
  ASM: { label: '가정', arity: 0, check: () => ({ ok: true }) },

  REIT: {
    label: '반복 (R)', arity: 1,
    check: (f, [a]) => need(equalFormula(f, a.formula), '인용한 문장과 정확히 같아야 합니다.'),
  },
  AND_I: {
    label: '∧ 도입', arity: 2,
    check: (f, [a, b]) => {
      if (f.type !== 'And') return { ok: false, message: '결론이 ∧ 형태가 아닙니다.' };
      const pairOk = (equalFormula(f.left, a.formula) && equalFormula(f.right, b.formula)) ||
        (equalFormula(f.left, b.formula) && equalFormula(f.right, a.formula));
      return need(pairOk, '인용한 두 문장이 결론의 좌변·우변과 일치해야 합니다.');
    },
  },
  AND_E: {
    label: '∧ 제거', arity: 1,
    check: (f, [a]) => {
      if (a.formula.type !== 'And') return { ok: false, message: '인용한 문장이 ∧ 형태가 아닙니다.' };
      return need(equalFormula(f, a.formula.left) || equalFormula(f, a.formula.right), '결론은 인용한 연언의 좌변 또는 우변이어야 합니다.');
    },
  },
  OR_I: {
    label: '∨ 도입', arity: 1,
    check: (f, [a]) => {
      if (f.type !== 'Or') return { ok: false, message: '결론이 ∨ 형태가 아닙니다.' };
      return need(equalFormula(f.left, a.formula) || equalFormula(f.right, a.formula), '인용한 문장이 결론의 선언지 중 하나와 일치해야 합니다.');
    },
  },
  OR_E: {
    label: '∨ 제거', arity: 3, shape: ['line', 'subproof', 'subproof'],
    check: (f, [disj, sp1, sp2]) => {
      if (disj.formula.type !== 'Or') return { ok: false, message: '첫 번째 인용은 ∨ 문장이어야 합니다.' };
      if (!equalFormula(sp1.assumption, disj.formula.left)) return { ok: false, message: '첫 번째 하위증명의 가정이 좌측 선언지와 일치해야 합니다.' };
      if (!equalFormula(sp2.assumption, disj.formula.right)) return { ok: false, message: '두 번째 하위증명의 가정이 우측 선언지와 일치해야 합니다.' };
      if (!equalFormula(sp1.conclusion, f) || !equalFormula(sp2.conclusion, f)) return { ok: false, message: '두 하위증명 모두 결론과 같은 문장으로 끝나야 합니다.' };
      return { ok: true };
    },
  },
  IMP_I: {
    label: '→ 도입', arity: 1, shape: ['subproof'],
    check: (f, [sp]) => {
      if (f.type !== 'Imp') return { ok: false, message: '결론이 → 형태가 아닙니다.' };
      if (!equalFormula(f.left, sp.assumption)) return { ok: false, message: '하위증명의 가정이 조건문의 전건과 일치해야 합니다.' };
      if (!equalFormula(f.right, sp.conclusion)) return { ok: false, message: '하위증명의 결론이 조건문의 후건과 일치해야 합니다.' };
      return { ok: true };
    },
  },
  IMP_E: {
    label: '→ 제거 (MP)', arity: 2,
    check: (f, [a, b]) => {
      const tryPair = (imp, ant) => imp.formula.type === 'Imp' && equalFormula(imp.formula.left, ant.formula) && equalFormula(imp.formula.right, f);
      return need(tryPair(a, b) || tryPair(b, a), '하나는 A→B, 다른 하나는 A 형태여야 하며 결론은 B여야 합니다.');
    },
  },
  IFF_I: {
    label: '↔ 도입', arity: 2,
    check: (f, cited) => {
      if (f.type !== 'Iff') return { ok: false, message: '결론이 ↔ 형태가 아닙니다.' };
      if (cited.every(c => c.kind === 'subproof')) {
        const [s1, s2] = cited;
        const fwd = equalFormula(s1.assumption, f.left) && equalFormula(s1.conclusion, f.right);
        const bwd = equalFormula(s2.assumption, f.right) && equalFormula(s2.conclusion, f.left);
        const fwd2 = equalFormula(s2.assumption, f.left) && equalFormula(s2.conclusion, f.right);
        const bwd2 = equalFormula(s1.assumption, f.right) && equalFormula(s1.conclusion, f.left);
        return need((fwd && bwd) || (fwd2 && bwd2), '두 하위증명이 각각 A⊢B, B⊢A 를 보여야 합니다.');
      }
      if (cited.every(c => c.kind === 'line')) {
        const [a, b] = cited;
        const ok = (a.formula.type === 'Imp' && b.formula.type === 'Imp') &&
          ((equalFormula(a.formula.left, f.left) && equalFormula(a.formula.right, f.right) && equalFormula(b.formula.left, f.right) && equalFormula(b.formula.right, f.left)) ||
           (equalFormula(b.formula.left, f.left) && equalFormula(b.formula.right, f.right) && equalFormula(a.formula.left, f.right) && equalFormula(a.formula.right, f.left)));
        return need(ok, '두 조건문이 A→B 와 B→A 형태여야 합니다.');
      }
      return { ok: false, message: '두 하위증명 또는 두 조건문 줄을 인용해야 합니다.' };
    },
  },
  IFF_E: {
    label: '↔ 제거', arity: 2,
    check: (f, [a, b]) => {
      const tryPair = (iff, side) => iff.formula.type === 'Iff' &&
        ((equalFormula(iff.formula.left, side.formula) && equalFormula(iff.formula.right, f)) ||
         (equalFormula(iff.formula.right, side.formula) && equalFormula(iff.formula.left, f)));
      return need(tryPair(a, b) || tryPair(b, a), '하나는 A↔B, 다른 하나는 A 또는 B 형태여야 합니다.');
    },
  },
  NOT_I: {
    label: '¬ 도입', arity: 1, shape: ['subproof'],
    check: (f, [sp]) => {
      if (f.type !== 'Not') return { ok: false, message: '결론이 ¬ 형태가 아닙니다.' };
      if (sp.conclusion.type !== 'Falsum') return { ok: false, message: '하위증명은 ⊥ 로 끝나야 합니다.' };
      return need(equalFormula(f.arg, sp.assumption), '결론의 부정 대상이 하위증명의 가정과 일치해야 합니다.');
    },
  },
  NOT_E: {
    label: '¬ 제거 (⊥ 도입)', arity: 2,
    check: (f, [a, b]) => {
      if (f.type !== 'Falsum') return { ok: false, message: '결론은 ⊥ 이어야 합니다.' };
      const contra = (x, y) => x.formula.type === 'Not' && equalFormula(x.formula.arg, y.formula);
      return need(contra(a, b) || contra(b, a), '두 문장이 서로 모순(A, ¬A)이어야 합니다.');
    },
  },
  FALSUM_E: {
    label: '⊥ 제거', arity: 1,
    check: (f, [a]) => need(a.formula.type === 'Falsum', '인용한 문장이 ⊥ 이어야 합니다.'),
  },
  DNE: {
    label: '이중부정 제거', arity: 1,
    check: (f, [a]) => {
      if (a.formula.type !== 'Not' || a.formula.arg.type !== 'Not') return { ok: false, message: '인용한 문장이 ¬¬A 형태여야 합니다.' };
      return need(equalFormula(f, a.formula.arg.arg), '결론은 이중부정을 제거한 A여야 합니다.');
    },
  },
  DNI: {
    label: '이중부정 도입', arity: 1,
    check: (f, [a]) => {
      if (f.type !== 'Not' || f.arg.type !== 'Not') return { ok: false, message: '결론이 ¬¬A 형태여야 합니다.' };
      return need(equalFormula(f.arg.arg, a.formula), '결론은 인용한 문장의 이중부정이어야 합니다.');
    },
  },

  MT: {
    label: '후건부정 (MT)', arity: 2,
    check: (f, [a, b]) => {
      const tryPair = (imp, negB) => imp.formula.type === 'Imp' && negB.formula.type === 'Not' && equalFormula(imp.formula.right, negB.formula.arg);
      const found = tryPair(a, b) ? a : (tryPair(b, a) ? b : null);
      if (!found) return { ok: false, message: '하나는 A→B, 다른 하나는 ¬B 형태여야 합니다.' };
      return need(equalFormula(f, { type: 'Not', arg: found.formula.left }), '결론은 ¬A 여야 합니다.');
    },
  },
  HS: {
    label: '가언삼단논법 (HS)', arity: 2,
    check: (f, [a, b]) => {
      const tryPair = (x, y) => x.formula.type === 'Imp' && y.formula.type === 'Imp' && equalFormula(x.formula.right, y.formula.left);
      const pair = tryPair(a, b) ? [a, b] : (tryPair(b, a) ? [b, a] : null);
      if (!pair) return { ok: false, message: '두 조건문이 A→B, B→C 형태로 이어져야 합니다.' };
      return need(f.type === 'Imp' && equalFormula(f.left, pair[0].formula.left) && equalFormula(f.right, pair[1].formula.right), '결론은 A→C 여야 합니다.');
    },
  },
  DS: {
    label: '선언삼단논법 (DS)', arity: 2,
    check: (f, [a, b]) => {
      const tryPair = (disj, negSide) => {
        if (disj.formula.type !== 'Or' || negSide.formula.type !== 'Not') return null;
        if (equalFormula(disj.formula.left, negSide.formula.arg)) return disj.formula.right;
        if (equalFormula(disj.formula.right, negSide.formula.arg)) return disj.formula.left;
        return null;
      };
      const r = tryPair(a, b) || tryPair(b, a);
      if (!r) return { ok: false, message: '하나는 A∨B, 다른 하나는 ¬A(또는 ¬B) 형태여야 합니다.' };
      return need(equalFormula(f, r), '결론은 남은 선언지여야 합니다.');
    },
  },
  DEM: {
    label: '드모르간 (DeMorgan)', arity: 1,
    check: (f, [a]) => {
      const t = demorgan(a.formula);
      if (!t) return { ok: false, message: '인용한 문장이 드모르간 변형 대상이 아닙니다 (¬(A∧B), ¬(A∨B), ¬A∨¬B, ¬A∧¬B 중 하나).' };
      return need(equalFormula(f, t), '드모르간 법칙에 따른 동치식과 일치하지 않습니다.');
    },
  },

  FORALL_E: {
    label: '∀ 제거', arity: 1,
    check: (f, [a]) => {
      if (a.formula.type !== 'Forall') return { ok: false, message: '인용한 문장이 ∀ 문장이어야 합니다.' };
      const m = matchSubstitution(a.formula.body, a.formula.variable, f);
      return need(!!m, '결론이 ∀ 문장의 적절한 예화(대입)여야 합니다.');
    },
  },
  FORALL_I: {
    label: '∀ 도입', arity: 1,
    check: (f, [a], ctx) => {
      if (f.type !== 'Forall') return { ok: false, message: '결론이 ∀ 형태가 아닙니다.' };
      const m = matchSubstitution(f.body, f.variable, a.formula);
      if (!m) return { ok: false, message: '인용한 문장이 결론의 적절한 예화가 아닙니다.' };
      if (m.vacuous) return { ok: true };
      const c = m.term;
      const protectedLetters = collectProtectedLetters(ctx.premises, ctx.registry, ctx.fromEntry.scopePath);
      if (protectedLetters.has(c)) {
        return { ok: false, message: `'${c}'가 전제/가정에 자유롭게 나타나 임의의 개체로 일반화할 수 없습니다 (고정변항 조건 위반).` };
      }
      return { ok: true };
    },
  },
  EXISTS_I: {
    label: '∃ 도입', arity: 1,
    check: (f, [a]) => {
      if (f.type !== 'Exists') return { ok: false, message: '결론이 ∃ 형태가 아닙니다.' };
      const m = matchSubstitution(f.body, f.variable, a.formula);
      return need(!!m, '인용한 문장이 결론의 적절한 사례(instance)가 아닙니다.');
    },
  },
  EXISTS_E: {
    label: '∃ 제거', arity: 2, shape: ['line', 'subproof'],
    check: (f, [a, sp], ctx) => {
      if (a.formula.type !== 'Exists') return { ok: false, message: '첫 번째 인용은 ∃ 문장이어야 합니다.' };
      const m = matchSubstitution(a.formula.body, a.formula.variable, sp.assumption);
      if (!m) return { ok: false, message: '하위증명의 가정이 ∃ 문장의 적절한 예화(신선한 이름 사용)가 아닙니다.' };
      if (!equalFormula(f, sp.conclusion)) return { ok: false, message: '결론은 하위증명의 결론과 같아야 합니다.' };
      if (!m.vacuous) {
        const c = m.term;
        const outerProtected = collectProtectedLetters(ctx.premises, ctx.registry, ctx.fromEntry.scopePath);
        if (outerProtected.has(c)) return { ok: false, message: `'${c}'는 이미 전제/가정에 나타나 신선한 이름이 아닙니다.` };
        if (freeTermLetters(f).has(c)) return { ok: false, message: `'${c}'가 결론에 남아있어 신선한 이름 조건을 위반합니다.` };
      }
      return { ok: true };
    },
  },

  ID_I: {
    label: '동일성 도입 (=I)', arity: 0,
    check: (f) => need(f.type === 'Identity' && !f.neg && f.left.name === f.right.name, '결론은 t=t 형태여야 합니다 (인용 불필요).'),
  },
  ID_E: {
    label: '동일성 제거 (=E)', arity: 2,
    check: (f, [a, b]) => {
      const tryPair = (eq, phi) => {
        if (eq.formula.type !== 'Identity' || eq.formula.neg) return null;
        const { left, right } = eq.formula;
        if (isValidPartialSubstitution(phi.formula, f, left.name, right.name)) return true;
        if (isValidPartialSubstitution(phi.formula, f, right.name, left.name)) return true;
        return null;
      };
      const ok = tryPair(a, b) || tryPair(b, a);
      return need(!!ok, '하나는 t1=t2, 다른 하나는 그 항을 포함하는 문장이어야 하며, 결론은 항을 치환한 결과여야 합니다.');
    },
  },
};

// ---------------- top-level verification ----------------

/**
 * Verify a whole proof. `mode` is 'prop' or 'pred' (grammar for parsing formulaText).
 * Returns { lineResults: Map(id -> {ok, message, formula}), overallOk, reachedConclusion }
 */
export function verifyProof(proof, { mode = 'pred', conclusionText = null } = {}) {
  const { registry, flat } = flatten(proof);
  const lineResults = new Map();

  function resolveFormula(text) {
    return parseFormula(text, mode);
  }

  function resolveCite(cite, fromEntry) {
    const target = registry.get(cite.id);
    if (!target) return { error: `인용한 줄 '${cite.id}'을 찾을 수 없습니다.` };
    if (!isVisible(target, fromEntry)) return { error: `줄/하위증명 '${cite.id}'은 이 위치에서 인용할 수 없습니다 (범위를 벗어남).` };
    if (target.kind === 'line') {
      return { kind: 'line', formula: resolveFormula(target.formulaText) };
    }
    const asm = registry.get(target.assumptionId);
    const concl = registry.get(target.conclusionId);
    return {
      kind: 'subproof',
      assumption: resolveFormula(asm.formulaText),
      conclusion: resolveFormula(concl.formulaText),
    };
  }

  let allOk = true;
  for (const entry of flat) {
    if (entry.kind !== 'line') continue;
    if (entry.rule === 'PREMISE' || entry.rule === 'ASM') {
      try { resolveFormula(entry.formulaText); lineResults.set(entry.id, { ok: true }); }
      catch (e) { allOk = false; lineResults.set(entry.id, { ok: false, message: `문장 해석 오류: ${e.message}` }); }
      continue;
    }
    const ruleDef = RULES[entry.rule];
    if (!ruleDef) { allOk = false; lineResults.set(entry.id, { ok: false, message: `알 수 없는 규칙: ${entry.rule}` }); continue; }
    let formula;
    try { formula = resolveFormula(entry.formulaText); }
    catch (e) { allOk = false; lineResults.set(entry.id, { ok: false, message: `문장 해석 오류: ${e.message}` }); continue; }

    const resolvedCites = [];
    let citeError = null;
    for (const c of entry.cites) {
      const r = resolveCite(c, entry);
      if (r.error) { citeError = r.error; break; }
      resolvedCites.push(r);
    }
    if (citeError) { allOk = false; lineResults.set(entry.id, { ok: false, message: citeError }); continue; }
    if (resolvedCites.length !== ruleDef.arity && !(ruleDef.arity === 0)) {
      // arity mismatch (allow 0-arity rules like ID_I / PREMISE / ASM to ignore this)
      if (ruleDef.arity !== 0) {
        allOk = false;
        lineResults.set(entry.id, { ok: false, message: `이 규칙은 인용이 ${ruleDef.arity}개 필요합니다.` });
        continue;
      }
    }
    let result;
    try {
      result = ruleDef.check(formula, resolvedCites, { premises: proof.premises, registry, fromEntry: entry });
    } catch (e) {
      result = { ok: false, message: `검사 중 오류: ${e.message}` };
    }
    if (!result.ok) allOk = false;
    lineResults.set(entry.id, { ok: result.ok, message: result.message, formula: formulaToString(formula) });
  }

  // conclusion reached? last top-level item (depth 0) must be a line matching conclusionText
  let reachedConclusion = null;
  if (conclusionText) {
    const topLevelLines = flat.filter(e => e.kind === 'line' && e.scopePath.length === 0 && e.rule !== 'PREMISE');
    const last = topLevelLines[topLevelLines.length - 1];
    if (last) {
      try {
        const lastFormula = resolveFormula(registry.get(last.id).formulaText);
        const target = resolveFormula(conclusionText);
        reachedConclusion = equalFormula(lastFormula, target);
      } catch (e) { reachedConclusion = false; }
    } else {
      reachedConclusion = false;
    }
  }

  return { lineResults, overallOk: allOk, reachedConclusion };
}
