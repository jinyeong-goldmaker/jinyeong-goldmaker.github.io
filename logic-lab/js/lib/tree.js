// tree.js — semantic tableau / 진리나무(truth tree) method.
// Works for both propositional and predicate logic (predicate trees may not
// terminate in general — a step budget makes the result "확실치 않음/UNKNOWN"
// rather than hanging forever, which is the honest, correct behavior for an
// undecidable procedure).

import { formulaToString, freeTermLetters, allTermLetters, substitute, equalFormula } from './parser.js';

let idCounter = 0;
function nextId() { return ++idCounter; }

function isNegOf(type) { return type === 'Not'; }

// ---- Union-find over term letters, built from non-negated identity literals ----
class DSU {
  constructor() { this.parent = new Map(); }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r);
    // path compression
    let cur = x;
    while (this.parent.get(cur) !== r) { const nxt = this.parent.get(cur); this.parent.set(cur, r); cur = nxt; }
    return r;
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function literalKey(formula, dsu) {
  // Returns a canonical string key for a literal atom/identity, with term letters
  // normalized through the union-find so a=b lets Fa and Fb be recognized as the "same".
  if (formula.type === 'Atom') {
    const args = formula.args.map(t => dsu.find(t.name)).join(',');
    return `${formula.name}(${args})`;
  }
  if (formula.type === 'Identity') {
    const l = dsu.find(formula.left.name), r = dsu.find(formula.right.name);
    return `EQ(${[l, r].sort().join(',')})`;
  }
  return null;
}

function isLiteral(f) {
  if (f.type === 'Atom' || f.type === 'Identity' || f.type === 'Falsum') return true;
  if (f.type === 'Not' && (f.arg.type === 'Atom' || f.arg.type === 'Identity')) return true;
  return false;
}

// Classify a formula for tableau expansion. Returns null if it's a literal (no rule).
function classifyRule(f) {
  switch (f.type) {
    case 'And':
      return { kind: 'alpha', parts: [f.left, f.right] };
    case 'Or':
      return { kind: 'beta', branches: [[f.left], [f.right]] };
    case 'Imp':
      return { kind: 'beta', branches: [[{ type: 'Not', arg: f.left }], [f.right]] };
    case 'Iff':
      return { kind: 'beta', branches: [[f.left, f.right], [{ type: 'Not', arg: f.left }, { type: 'Not', arg: f.right }]] };
    case 'Forall':
      return { kind: 'gamma', variable: f.variable, body: f.body };
    case 'Exists':
      return { kind: 'delta', variable: f.variable, body: f.body };
    case 'Not': {
      const inner = f.arg;
      if (inner.type === 'Not') return { kind: 'alpha', parts: [inner.arg] };
      if (inner.type === 'And') return { kind: 'beta', branches: [[{ type: 'Not', arg: inner.left }], [{ type: 'Not', arg: inner.right }]] };
      if (inner.type === 'Or') return { kind: 'alpha', parts: [{ type: 'Not', arg: inner.left }, { type: 'Not', arg: inner.right }] };
      if (inner.type === 'Imp') return { kind: 'alpha', parts: [inner.left, { type: 'Not', arg: inner.right }] };
      if (inner.type === 'Iff') {
        return {
          kind: 'beta',
          branches: [
            [inner.left, { type: 'Not', arg: inner.right }],
            [{ type: 'Not', arg: inner.left }, inner.right],
          ],
        };
      }
      if (inner.type === 'Forall') return { kind: 'delta', variable: inner.variable, body: { type: 'Not', arg: inner.body } };
      if (inner.type === 'Exists') return { kind: 'gamma', variable: inner.variable, body: { type: 'Not', arg: inner.body } };
      return null; // literal (¬Atom, ¬Identity, ¬⊥, ¬¬... handled above)
    }
    default:
      return null;
  }
}

function freshConstantFactory(reserved) {
  const used = new Set(reserved);
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let suffix = 0;
  return function fresh() {
    while (true) {
      for (const L of letters) {
        const name = suffix === 0 ? L : `${L}${suffix}`;
        if (!used.has(name)) { used.add(name); return name; }
      }
      suffix++;
    }
  };
}

/**
 * Build a semantic tableau starting from a list of formulas (all asserted true on
 * the root branch). Returns { root, status, branches } where status is one of
 * 'closed' (all branches closed -> the formula set is unsatisfiable),
 * 'open' (a fully-expanded open branch was found -> satisfiable, has a model),
 * 'unknown' (step budget exhausted before finishing -> inconclusive).
 */
export function buildTree(initialFormulas, { stepLimit = 600 } = {}) {
  idCounter = 0;
  const reserved = new Set();
  for (const f of initialFormulas) for (const l of allTermLetters(f)) reserved.add(l);
  const fresh = freshConstantFactory(reserved);

  // Build the initial trunk (shared chain) for the starting formulas.
  let root = null, prevNode = null;
  for (const f of initialFormulas) {
    const node = { id: nextId(), formula: f, parent: prevNode, children: [] };
    if (prevNode) prevNode.children.push(node); else root = node;
    prevNode = node;
  }
  if (!root) throw new Error('빈 논증입니다.');

  function pathFormulas(leaf) {
    const out = [];
    let n = leaf;
    while (n) { out.push(n); n = n.parent; }
    return out.reverse();
  }

  function checkClosed(pathNodes) {
    const dsu = new DSU();
    for (const n of pathNodes) {
      if (n.formula.type === 'Identity' && !n.formula.neg) dsu.union(n.formula.left.name, n.formula.right.name);
    }
    const posKeys = new Set(), negKeys = new Set();
    for (const n of pathNodes) {
      const f = n.formula;
      if (f.type === 'Falsum') return { closed: true, reason: '⊥ 발생' };
      if (f.type === 'Atom') posKeys.add(literalKey(f, dsu));
      else if (f.type === 'Identity' && !f.neg) { /* handled via dsu, still check t=t trivial */ }
      else if (f.type === 'Identity' && f.neg) {
        if (dsu.find(f.left.name) === dsu.find(f.right.name)) return { closed: true, reason: `${formulaToString(f.left ? f : f)} 모순 (동일성)` };
        negKeys.add(literalKey({ type: 'Identity', left: f.left, right: f.right, neg: false }, dsu));
      } else if (f.type === 'Not' && f.arg.type === 'Atom') negKeys.add(literalKey(f.arg, dsu));
      else if (f.type === 'Not' && f.arg.type === 'Identity' && !f.arg.neg) negKeys.add(literalKey(f.arg, dsu));
    }
    for (const k of posKeys) if (k && negKeys.has(k)) return { closed: true, reason: `${k} 와 그 부정이 동시에 성립` };
    return { closed: false };
  }

  // Branch bookkeeping, keyed by leaf node id. `constants` tracks term-letters that
  // act as genuine constants/parameters on this branch (free occurrences only) — it
  // must NOT include letters that are merely used as bound variable names somewhere
  // (those live in `reserved`, which only protects fresh-constant generation from
  // colliding with a quantifier's own bound-variable letter).
  const initialFreeConstants = new Set();
  for (const f of initialFormulas) for (const l of freeTermLetters(f)) initialFreeConstants.add(l);

  const branches = new Map();
  branches.set(prevNode.id, {
    leaf: prevNode,
    usedAlphaBetaDelta: new Set(),
    forallUsed: new Map(), // forallNodeId -> Set(constants)
    constants: new Set(initialFreeConstants),
    status: 'active',
    closedReason: null,
  });

  let steps = 0;
  let workQueue = [prevNode.id];

  function appendChild(leafNode, formula) {
    const node = { id: nextId(), formula, parent: leafNode, children: [] };
    leafNode.children.push(node);
    return node;
  }

  while (workQueue.length > 0 && steps < stepLimit) {
    const leafId = workQueue.shift();
    const br = branches.get(leafId);
    if (!br || br.status !== 'active') continue;
    steps++;

    const path = pathFormulas(br.leaf);
    const closedCheck = checkClosed(path);
    if (closedCheck.closed) { br.status = 'closed'; br.closedReason = closedCheck.reason; continue; }

    // find next expandable node in priority order: alpha, delta, beta, gamma
    let chosen = null, chosenKind = null;
    for (const kind of ['alpha', 'delta', 'beta', 'gamma']) {
      for (const n of path) {
        if (isLiteral(n.formula)) continue;
        const rule = classifyRule(n.formula);
        if (!rule || rule.kind !== kind) continue;
        if (kind === 'gamma') {
          const usedSet = br.forallUsed.get(n.id) || new Set();
          const targets = br.constants.size > 0 ? [...br.constants] : [fresh()];
          const remaining = targets.filter(c => !usedSet.has(c));
          if (remaining.length === 0) continue; // fully instantiated already
          chosen = n; chosenKind = kind; break;
        } else {
          if (br.usedAlphaBetaDelta.has(n.id)) continue;
          chosen = n; chosenKind = kind; break;
        }
      }
      if (chosen) break;
    }

    if (!chosen) { br.status = 'open'; continue; } // fully expanded, nothing left, no closure -> genuine model

    const rule = classifyRule(chosen.formula);
    if (chosenKind === 'alpha') {
      br.usedAlphaBetaDelta.add(chosen.id);
      let leaf = br.leaf;
      for (const part of rule.parts) {
        leaf = appendChild(leaf, part);
        for (const t of freeTermLetters(part)) br.constants.add(t);
      }
      br.leaf = leaf;
      workQueue.push(leaf.id);
      branches.delete(leafId); branches.set(leaf.id, br);
    } else if (chosenKind === 'delta') {
      br.usedAlphaBetaDelta.add(chosen.id);
      const c = fresh();
      const inst = substitute(rule.body, rule.variable, c);
      const leaf = appendChild(br.leaf, inst);
      br.constants.add(c);
      br.leaf = leaf;
      workQueue.push(leaf.id);
      branches.delete(leafId); branches.set(leaf.id, br);
    } else if (chosenKind === 'beta') {
      br.usedAlphaBetaDelta.add(chosen.id);
      const newLeaves = [];
      rule.branches.forEach((additions) => {
        // clone branch state
        const cloned = {
          leaf: br.leaf,
          usedAlphaBetaDelta: new Set(br.usedAlphaBetaDelta),
          forallUsed: new Map([...br.forallUsed].map(([k, v]) => [k, new Set(v)])),
          constants: new Set(br.constants),
          status: 'active',
          closedReason: null,
        };
        let leaf = cloned.leaf;
        for (const add of additions) {
          leaf = appendChild(leaf, add);
          for (const t of freeTermLetters(add)) cloned.constants.add(t);
        }
        cloned.leaf = leaf;
        branches.set(leaf.id, cloned);
        newLeaves.push(leaf.id);
      });
      branches.delete(leafId);
      workQueue.push(...newLeaves);
    } else if (chosenKind === 'gamma') {
      const usedSet = br.forallUsed.get(chosen.id) || new Set();
      const targets = br.constants.size > 0 ? [...br.constants] : [fresh()];
      const c = targets.find(x => !usedSet.has(x));
      const inst = substitute(rule.body, rule.variable, c);
      const leaf = appendChild(br.leaf, inst);
      usedSet.add(c);
      br.forallUsed.set(chosen.id, usedSet);
      br.constants.add(c);
      br.leaf = leaf;
      workQueue.push(leaf.id);
      branches.delete(leafId); branches.set(leaf.id, br);
    }
  }

  // anything left 'active' in the queue when budget ran out is unknown
  for (const id of workQueue) {
    const br = branches.get(id);
    if (br && br.status === 'active') br.status = 'unknown';
  }
  for (const br of branches.values()) {
    if (br.status === 'active') br.status = 'open'; // no more work items reference it => fully expanded
  }

  const statuses = [...branches.values()].map(b => b.status);
  let overall;
  if (statuses.every(s => s === 'closed')) overall = 'closed';
  else if (statuses.some(s => s === 'open')) overall = 'open';
  else overall = 'unknown';

  // Build a model (valuation) from the first open branch, if any.
  let model = null;
  for (const br of branches.values()) {
    if (br.status !== 'open') continue;
    model = extractModel(pathFormulas(br.leaf));
    break;
  }

  const leafStatuses = [...branches.values()].map(br => ({
    leafNodeId: br.leaf.id,
    status: br.status,
    closedReason: br.closedReason,
  }));

  return {
    root,
    status: overall,
    branchCount: branches.size,
    closedCount: statuses.filter(s => s === 'closed').length,
    openCount: statuses.filter(s => s === 'open').length,
    unknownCount: statuses.filter(s => s === 'unknown').length,
    model,
    stepsUsed: steps,
    stepLimitHit: steps >= stepLimit,
    leafStatuses,
  };
}

function extractModel(pathNodes) {
  const trueAtoms = [];
  const falseAtoms = [];
  const constants = new Set();
  for (const n of pathNodes) {
    const f = n.formula;
    for (const t of allTermLetters(f)) constants.add(t);
    if (f.type === 'Atom') trueAtoms.push(formulaToString(f));
    else if (f.type === 'Not' && f.arg.type === 'Atom') falseAtoms.push(formulaToString(f.arg));
  }
  return { domain: [...constants].sort(), trueAtoms: [...new Set(trueAtoms)], falseAtoms: [...new Set(falseAtoms)] };
}

// ---- High level helpers ----

export function checkValidityByTree(premises, conclusion, opts) {
  const tree = buildTree([...premises, { type: 'Not', arg: conclusion }], opts);
  return {
    valid: tree.status === 'closed' ? true : (tree.status === 'open' ? false : null),
    tree,
  };
}

export function checkSatisfiability(formula, opts) {
  const tree = buildTree([formula], opts);
  return { satisfiable: tree.status === 'closed' ? false : (tree.status === 'open' ? true : null), tree };
}
