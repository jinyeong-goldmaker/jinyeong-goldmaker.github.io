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
  // not-equal (before generic NOT handling)
  [/!=/g, SYM.NEQ],
  // biconditional / conditional (must come before single-char arrows)
  [/<->|<=>|\\leftrightarrow|\\iff/g, SYM.IFF],
  [/->|=>|\\to|\\rightarrow|\\supset/g, SYM.IMP],
  // negation — ~, !, are never valid identifier characters, so no ambiguity
  [/\\neg|\\lnot/g, SYM.NOT],
  [/~/g, SYM.NOT],
  [/!/g, SYM.NOT],
  // and
  [/\\wedge|\\land/g, SYM.AND],
  [/&/g, SYM.AND],
  [/\^/g, SYM.AND],
  // or — NOTE: bare "v" is deliberately NOT aliased to ∨ because 'v' is also a
  // valid term letter in predicate mode; use "|" or ∨ directly instead.
  [/\\vee|\\lor/g, SYM.OR],
  [/\|/g, SYM.OR],
  // falsum / contradiction
  [/\\bot|\\perp/g, SYM.FALSUM],
  // quantifiers written as \forall / \exists
  [/\\forall/g, SYM.FORALL],
  [/\\exists/g, SYM.EXISTS],
];

// Word-style / Quine-style quantifier aliases handled separately because they consume
// a following variable letter and/or wrapping parens, e.g.:
//   "forall x"   -> "∀x"
//   "(forall x)" -> "∀x"
//   "(∃x)"       -> "∃x"     (parens here are decorative, not a scope group)
//   "(x)"        -> "∀x"     (classic Quine notation: "(x)Fx" = "∀xFx")
//   "(?x)" "(!x)"-> "∃x"
function replaceWordQuantifiers(input) {
  let s = input;
  s = s.replace(/\(\s*forall\s+([a-zA-Z][0-9]*)\s*\)/gi, (_, v) => SYM.FORALL + v);
  s = s.replace(/\(\s*exists\s+([a-zA-Z][0-9]*)\s*\)/gi, (_, v) => SYM.EXISTS + v);
  s = s.replace(/\bforall\s*([a-zA-Z][0-9]*)/gi, (_, v) => SYM.FORALL + v);
  s = s.replace(/\bexists\s*([a-zA-Z][0-9]*)/gi, (_, v) => SYM.EXISTS + v);
  s = s.replace(/\(\s*∀\s*([a-zA-Z][0-9]*)\s*\)/g, (_, v) => SYM.FORALL + v);
  s = s.replace(/\(\s*∃\s*([a-zA-Z][0-9]*)\s*\)/g, (_, v) => SYM.EXISTS + v);
  s = s.replace(/\(\s*[?!]\s*([a-zA-Z][0-9]*)\s*\)/g, (_, v) => SYM.EXISTS + v);
  // Bare Quine form "(x)" meaning ∀x — only a single lowercase-ident between parens,
  // nothing else, so this never collides with a real grouping paren (a lone term
  // can never be a complete formula on its own).
  s = s.replace(/\(\s*([a-z][0-9]*)\s*\)/g, (_, v) => SYM.FORALL + v);
  return s;
}

/**
 * Normalize a raw user-typed formula into one using only canonical symbols.
 * Does NOT touch parentheses/commas/letters/digits.
 */
export function normalize(input) {
  if (!input) return input;
  let s = input;
  s = replaceWordQuantifiers(s);
  for (const [re, rep] of REPLACEMENTS) s = s.replace(re, rep);
  return s;
}

// Palette definitions used by the on-screen symbol buttons (id -> {label, insert}).
// Parentheses are deliberately placed last so they are visually separated from
// logical operators while remaining available anywhere a formula is entered.
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
  { label: '∀', insert: SYM.FORALL },
  { label: '∃', insert: SYM.EXISTS },
  { label: '=', insert: '=' },
  { label: '≠', insert: SYM.NEQ },
];
