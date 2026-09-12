import { verifyProof } from '../js/lib/naturalDeduction.js';

function t(desc, fn) {
  try { fn(); console.log('OK  ', desc); }
  catch (e) { console.log('FAIL', desc, '->', e.message); process.exitCode = 1; }
}
function check(result, desc) {
  if (!result.overallOk) {
    const bad = [...result.lineResults.entries()].filter(([, v]) => !v.ok);
    throw new Error(`${desc}: 실패한 줄 -> ${JSON.stringify(bad)}`);
  }
  if (result.reachedConclusion === false) throw new Error(`${desc}: 결론에 도달하지 못함`);
}

t('→I: prove A→A', () => {
  const proof = {
    premises: [],
    items: [
      { id: 's1', kind: 'subproof', assumption: { id: 'a1', formulaText: 'A' }, items: [
        { id: 'l1', kind: 'line', formulaText: 'A', rule: 'REIT', cites: [{ kind: 'line', id: 'a1' }] },
      ] },
      { id: 'l2', kind: 'line', formulaText: 'A→A', rule: 'IMP_I', cites: [{ kind: 'subproof', id: 's1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'prop', conclusionText: 'A→A' });
  check(r, '→I');
});

t('→E (MP): A, A→B ⊢ B', () => {
  const proof = {
    premises: [{ id: 'p1', formulaText: 'A' }, { id: 'p2', formulaText: 'A→B' }],
    items: [
      { id: 'l1', kind: 'line', formulaText: 'B', rule: 'IMP_E', cites: [{ kind: 'line', id: 'p1' }, { kind: 'line', id: 'p2' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'prop', conclusionText: 'B' });
  check(r, '→E');
});

t('∧I then ∧E round trip', () => {
  const proof = {
    premises: [{ id: 'p1', formulaText: 'A' }, { id: 'p2', formulaText: 'B' }],
    items: [
      { id: 'l1', kind: 'line', formulaText: 'B∧A', rule: 'AND_I', cites: [{ kind: 'line', id: 'p1' }, { kind: 'line', id: 'p2' }] },
      { id: 'l2', kind: 'line', formulaText: 'A', rule: 'AND_E', cites: [{ kind: 'line', id: 'l1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'prop', conclusionText: 'A' });
  check(r, '∧I/∧E');
});

t('¬I: A→B, A→¬B ⊢ ¬A (reductio)', () => {
  const proof = {
    premises: [{ id: 'p1', formulaText: 'A→B' }, { id: 'p2', formulaText: 'A→¬B' }],
    items: [
      { id: 's1', kind: 'subproof', assumption: { id: 'a1', formulaText: 'A' }, items: [
        { id: 'l1', kind: 'line', formulaText: 'B', rule: 'IMP_E', cites: [{ kind: 'line', id: 'p1' }, { kind: 'line', id: 'a1' }] },
        { id: 'l2', kind: 'line', formulaText: '¬B', rule: 'IMP_E', cites: [{ kind: 'line', id: 'p2' }, { kind: 'line', id: 'a1' }] },
        { id: 'l3', kind: 'line', formulaText: '⊥', rule: 'NOT_E', cites: [{ kind: 'line', id: 'l1' }, { kind: 'line', id: 'l2' }] },
      ] },
      { id: 'l4', kind: 'line', formulaText: '¬A', rule: 'NOT_I', cites: [{ kind: 'subproof', id: 's1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'prop', conclusionText: '¬A' });
  check(r, '¬I');
});

t('predicate: ∀x(Fx→Gx), Fa ⊢ Ga', () => {
  const proof = {
    premises: [{ id: 'p0', formulaText: '∀x(Fx→Gx)' }, { id: 'p1', formulaText: 'Fa' }],
    items: [
      { id: 'l1', kind: 'line', formulaText: 'Fa→Ga', rule: 'FORALL_E', cites: [{ kind: 'line', id: 'p0' }] },
      { id: 'l2', kind: 'line', formulaText: 'Ga', rule: 'IMP_E', cites: [{ kind: 'line', id: 'l1' }, { kind: 'line', id: 'p1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'pred', conclusionText: 'Ga' });
  check(r, '∀E chain');
});

t('predicate: ∃xFx, ∀x(Fx→Gx) ⊢ ∃xGx (via ∃E)', () => {
  const proof = {
    premises: [{ id: 'p0', formulaText: '∃xFx' }, { id: 'p1', formulaText: '∀x(Fx→Gx)' }],
    items: [
      { id: 's1', kind: 'subproof', assumption: { id: 'a1', formulaText: 'Fa' }, items: [
        { id: 'l1', kind: 'line', formulaText: 'Fa→Ga', rule: 'FORALL_E', cites: [{ kind: 'line', id: 'p1' }] },
        { id: 'l2', kind: 'line', formulaText: 'Ga', rule: 'IMP_E', cites: [{ kind: 'line', id: 'l1' }, { kind: 'line', id: 'a1' }] },
        { id: 'l3', kind: 'line', formulaText: '∃xGx', rule: 'EXISTS_I', cites: [{ kind: 'line', id: 'l2' }] },
      ] },
      { id: 'l4', kind: 'line', formulaText: '∃xGx', rule: 'EXISTS_E', cites: [{ kind: 'line', id: 'p0' }, { kind: 'subproof', id: 's1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'pred', conclusionText: '∃xGx' });
  check(r, '∃E');
});

t('∃E rejects leaking the fresh witness into the conclusion', () => {
  const proof = {
    premises: [{ id: 'p0', formulaText: '∃xFx' }],
    items: [
      { id: 's1', kind: 'subproof', assumption: { id: 'a1', formulaText: 'Fa' }, items: [
        { id: 'l1', kind: 'line', formulaText: 'Fa', rule: 'REIT', cites: [{ kind: 'line', id: 'a1' }] },
      ] },
      { id: 'l2', kind: 'line', formulaText: 'Fa', rule: 'EXISTS_E', cites: [{ kind: 'line', id: 'p0' }, { kind: 'subproof', id: 's1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'pred' });
  if (r.overallOk) throw new Error('should have rejected witness leakage');
});

t('∀I rejects generalizing a premise-constrained constant', () => {
  const proof = {
    premises: [{ id: 'p0', formulaText: 'Fa' }],
    items: [
      { id: 'l1', kind: 'line', formulaText: '∀xFx', rule: 'FORALL_I', cites: [{ kind: 'line', id: 'p0' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'pred' });
  if (r.overallOk) throw new Error('should have rejected eigenvariable violation');
});

t('∀I accepts generalizing a truly arbitrary derived instance', () => {
  const proof = {
    premises: [{ id: 'p0', formulaText: '∀xFx' }],
    items: [
      { id: 'l1', kind: 'line', formulaText: 'Fb', rule: 'FORALL_E', cites: [{ kind: 'line', id: 'p0' }] },
      { id: 'l2', kind: 'line', formulaText: '∀xFx', rule: 'FORALL_I', cites: [{ kind: 'line', id: 'l1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'pred', conclusionText: '∀xFx' });
  check(r, '∀I valid case');
});

t('=E: a=b, Fa ⊢ Fb', () => {
  const proof = {
    premises: [{ id: 'p0', formulaText: 'a=b' }, { id: 'p1', formulaText: 'Fa' }],
    items: [
      { id: 'l1', kind: 'line', formulaText: 'Fb', rule: 'ID_E', cites: [{ kind: 'line', id: 'p0' }, { kind: 'line', id: 'p1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'pred', conclusionText: 'Fb' });
  check(r, '=E');
});

t('scope violation: citing inside a closed subproof from outside is rejected', () => {
  const proof = {
    premises: [],
    items: [
      { id: 's1', kind: 'subproof', assumption: { id: 'a1', formulaText: 'A' }, items: [
        { id: 'l1', kind: 'line', formulaText: 'A', rule: 'REIT', cites: [{ kind: 'line', id: 'a1' }] },
      ] },
      { id: 'l2', kind: 'line', formulaText: 'A', rule: 'REIT', cites: [{ kind: 'line', id: 'a1' }] },
    ],
  };
  const r = verifyProof(proof, { mode: 'prop' });
  if (r.overallOk) throw new Error('should have rejected out-of-scope citation');
});

console.log('done');
