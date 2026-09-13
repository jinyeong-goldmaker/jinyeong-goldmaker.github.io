// symbols.js — canonical symbols + flexible ASCII/LaTeX-ish input normalization.
// Combines the "click a symbol button" convenience of 논리학당 with the
// "type it your way" flexibility of 기호논리학 실습실.

export const SYM = {
  NOT: '¬',
  AND: '∧',
  OR: '∨',
  IMP: '→',
  IFF: '↔',
  FALSUM: '⊥',
  FORALL: '∀',
  EXISTS: '∃',
  NEQ: '≠',
};

// Ordered replacement table (order matters — longer/more specific patterns first).
const REPLACEMENTS = [
  [/!=/g, SYM.NEQ],
  [/<->|<=>|\\leftrightarrow|\\iff/g, SYM.IFF],
  [/->|=>|\\to|\\rightarrow|\\supset/g, SYM.IMP],
  [/\\neg|\\lnot/g, SYM.NOT],
  [/~/g, SYM.NOT],
  [/!/g, SYM.NOT],
  [/\\wedge|\\land/g, SYM.AND],
  [/&/g, SYM.AND],
  [/\^/g, SYM.AND],
  [/\\vee|\\lor/g, SYM.OR],
  [/\|/g, SYM.OR],
  [/\\bot|\\perp/g, SYM.FALSUM],
  [/\\forall/g, SYM.FORALL],
  [/\\exists/g, SYM.EXISTS],
];

function replaceWordQuantifiers(input) {
  let s = input;
  s = s.replace(/\(\s*forall\s+([a-zA-Z][0-9]*)\s*\)/gi, (_, v) => SYM.FORALL + v);
  s = s.replace(/\(\s*exists\s+([a-zA-Z][0-9]*)\s*\)/gi, (_, v) => SYM.EXISTS + v);
  s = s.replace(/\bforall\s*([a-zA-Z][0-9]*)/gi, (_, v) => SYM.FORALL + v);
  s = s.replace(/\bexists\s*([a-zA-Z][0-9]*)/gi, (_, v) => SYM.EXISTS + v);
  s = s.replace(/\(\s*∀\s*([a-zA-Z][0-9]*)\s*\)/g, (_, v) => SYM.FORALL + v);
  s = s.replace(/\(\s*∃\s*([a-zA-Z][0-9]*)\s*\)/g, (_, v) => SYM.EXISTS + v);
  s = s.replace(/\(\s*[?!]\s*([a-zA-Z][0-9]*)\s*\)/g, (_, v) => SYM.EXISTS + v);
  s = s.replace(/\(\s*([a-z][0-9]*)\s*\)/g, (_, v) => SYM.FORALL + v);
  return s;
}

export function normalize(input) {
  if (!input) return input;
  let s = input;
  s = replaceWordQuantifiers(s);
  for (const [re, rep] of REPLACEMENTS) s = s.replace(re, rep);
  return s;
}

export const PALETTE_PROP = [
  { label: '¬', insert: SYM.NOT },
  { label: '∧', insert: SYM.AND },
  { label: '∨', insert: SYM.OR },
  { label: '→', insert: SYM.IMP },
  { label: '↔', insert: SYM.IFF },
  { label: '⊥', insert: SYM.FALSUM },
  { label: '(', insert: '(', title: '여는 괄호 / Open parenthesis' },
  { label: ')', insert: ')', title: '닫는 괄호 / Close parenthesis' },
];

export const PALETTE_PRED = [
  { label: '∀', insert: SYM.FORALL, group: 'predicate' },
  { label: '∃', insert: SYM.EXISTS, group: 'predicate' },
  { label: '=', insert: '=', group: 'predicate' },
  { label: '≠', insert: SYM.NEQ, group: 'predicate' },
];
