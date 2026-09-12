// parser.js — tokenizer + recursive-descent parser for propositional & predicate logic.
//
// Grammar (informal):
//   formula   := iff
//   iff       := imp ( '↔' imp )*          (chains left-to-right)
//   imp       := or ( '→' imp )?           (right-assoc)
//   or        := and ( '∨' and )*
//   and       := unary ( '∧' unary )*
//   unary     := '¬' unary
//             |  ('∀'|'∃') VAR unary
//             |  primary
//   primary   := '(' formula ')'
//             |  '⊥'
//             |  PRED ( '(' term (',' term)* ')' | term* )    -- term* only in predicate mode
//             |  term ('='|'≠') term                          -- identity, predicate mode only
//   term      := lowercase-ident
//
// A PRED token is a single uppercase letter plus optional digits (e.g. P, P1, F, R2).
// A term token is a single lowercase letter plus optional digits (e.g. x, x1, a).
// Binary connectives use ordinary precedence (∧ tightest, then ∨, then →, then ↔) so that
// "A∧B→C" parses as "(A∧B)→C" without forcing full parenthesization — but full
// parenthesization is always accepted too, matching either source tool's style.

import { normalize, SYM } from './symbols.js';

export class ParseError extends Error {
  constructor(message, pos) {
    super(message);
    this.pos = pos;
  }
}

// ---------- Tokenizer ----------

const TOKEN_SPEC = [
  ['WS', /^\s+/],
  ['LPAREN', /^\(/],
  ['RPAREN', /^\)/],
  ['COMMA', /^,/],
  ['IFF', /^↔/],
  ['IMP', /^→/],
  ['AND', /^∧/],
  ['OR', /^∨/],
  ['NOT', /^¬/],
  ['FORALL', /^∀/],
  ['EXISTS', /^∃/],
  ['FALSUM', /^⊥/],
  ['NEQ', /^≠/],
  ['EQ', /^=/],
  ['UPPER', /^[A-Z][0-9]*/],
  ['LOWER', /^[a-z][0-9]*/],
];

export function tokenize(raw) {
  const s = normalize(raw);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let matched = false;
    for (const [type, re] of TOKEN_SPEC) {
      const m = re.exec(rest);
      if (m) {
        matched = true;
        if (type !== 'WS') tokens.push({ type, text: m[0], pos: i });
        i += m[0].length;
        break;
      }
    }
    if (!matched) {
      throw new ParseError(`인식할 수 없는 문자: "${s[i]}"`, i);
    }
  }
  tokens.push({ type: 'EOF', text: '', pos: i });
  return tokens;
}

// ---------- Parser ----------

class Parser {
  constructor(tokens, mode) {
    this.tokens = tokens;
    this.i = 0;
    this.mode = mode; // 'prop' | 'pred'
  }
  peek() { return this.tokens[this.i]; }
  next() { return this.tokens[this.i++]; }
  expect(type, msg) {
    const t = this.next();
    if (t.type !== type) throw new ParseError(msg || `'${type}'가 필요합니다 (여기서 발견: '${t.text || 'EOF'}')`, t.pos);
    return t;
  }

  parseFormula() {
    const node = this.parseIff();
    return node;
  }

  parseIff() {
    let left = this.parseImp();
    while (this.peek().type === 'IFF') {
      this.next();
      const right = this.parseImp();
      left = { type: 'Iff', left, right };
    }
    return left;
  }

  parseImp() {
    const left = this.parseOr();
    if (this.peek().type === 'IMP') {
      this.next();
      const right = this.parseImp(); // right-assoc
      return { type: 'Imp', left, right };
    }
    return left;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.peek().type === 'OR') {
      this.next();
      const right = this.parseAnd();
      left = { type: 'Or', left, right };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseUnary();
    while (this.peek().type === 'AND') {
      this.next();
      const right = this.parseUnary();
      left = { type: 'And', left, right };
    }
    return left;
  }

  parseUnary() {
    const t = this.peek();
    if (t.type === 'NOT') {
      this.next();
      return { type: 'Not', arg: this.parseUnary() };
    }
    if (t.type === 'FORALL' || t.type === 'EXISTS') {
      if (this.mode !== 'pred') throw new ParseError('양화사는 술어논리 모드에서만 사용할 수 있습니다.', t.pos);
      this.next();
      const v = this.expect('LOWER', '양화사 뒤에는 변항(소문자)이 와야 합니다.');
      const body = this.parseUnary();
      return { type: t.type === 'FORALL' ? 'Forall' : 'Exists', variable: v.text, body };
    }
    return this.parsePrimary();
  }

  parseTerm() {
    const t = this.expect('LOWER', '항(term)이 필요합니다.');
    return { type: 'Term', name: t.text };
  }

  parsePrimary() {
    const t = this.peek();
    if (t.type === 'LPAREN') {
      this.next();
      const inner = this.parseFormula();
      this.expect('RPAREN', "')'가 필요합니다.");
      return inner;
    }
    if (t.type === 'FALSUM') { this.next(); return { type: 'Falsum' }; }
    if (t.type === 'UPPER') {
      this.next();
      const name = t.text;
      const args = [];
      if (this.peek().type === 'LPAREN') {
        this.next();
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseTerm());
          while (this.peek().type === 'COMMA') { this.next(); args.push(this.parseTerm()); }
        }
        this.expect('RPAREN', "')'가 필요합니다.");
        if (this.mode !== 'pred' && args.length > 0) {
          throw new ParseError('문장논리 모드에서는 술어에 항을 붙일 수 없습니다.', t.pos);
        }
      } else if (this.mode === 'pred') {
        while (this.peek().type === 'LOWER') args.push(this.parseTerm());
      }
      return { type: 'Atom', name, args };
    }
    if (t.type === 'LOWER') {
      if (this.mode !== 'pred') {
        throw new ParseError('소문자는 술어논리 모드에서만 항으로 사용할 수 있습니다.', t.pos);
      }
      const left = this.parseTerm();
      if (this.peek().type === 'EQ') {
        this.next();
        const right = this.parseTerm();
        return { type: 'Identity', left, right, neg: false };
      }
      if (this.peek().type === 'NEQ') {
        this.next();
        const right = this.parseTerm();
        return { type: 'Identity', left, right, neg: true };
      }
      throw new ParseError(`항 '${left.name}'는 단독으로 문장이 될 수 없습니다 (등식이 필요합니다).`, t.pos);
    }
    throw new ParseError(`예상치 못한 토큰: '${t.text || 'EOF'}'`, t.pos);
  }
}

/**
 * Parse a raw formula string. mode: 'prop' (propositional) or 'pred' (predicate).
 * Throws ParseError on failure.
 */
export function parseFormula(raw, mode = 'pred') {
  const tokens = tokenize(raw);
  const p = new Parser(tokens, mode);
  const node = p.parseFormula();
  if (p.peek().type !== 'EOF') {
    throw new ParseError(`여기서부터 해석할 수 없습니다: '${p.peek().text}'`, p.peek().pos);
  }
  return node;
}

export function tryParseFormula(raw, mode = 'pred') {
  try {
    return { ok: true, ast: parseFormula(raw, mode) };
  } catch (e) {
    return { ok: false, error: e.message, pos: e.pos };
  }
}

// ---------- AST utilities ----------

export function mainConnective(ast) {
  switch (ast.type) {
    case 'Not': return { symbol: SYM.NOT, name: '부정 (¬)' };
    case 'And': return { symbol: SYM.AND, name: '연언 (∧)' };
    case 'Or': return { symbol: SYM.OR, name: '선언 (∨)' };
    case 'Imp': return { symbol: SYM.IMP, name: '조건 (→)' };
    case 'Iff': return { symbol: SYM.IFF, name: '쌍조건 (↔)' };
    case 'Forall': return { symbol: SYM.FORALL, name: '전칭양화 (∀)' };
    case 'Exists': return { symbol: SYM.EXISTS, name: '존재양화 (∃)' };
    case 'Falsum': return { symbol: SYM.FALSUM, name: '모순 (⊥)' };
    case 'Identity': return { symbol: ast.neg ? '≠' : '=', name: ast.neg ? '부동일성 (≠)' : '동일성 (=)' };
    case 'Atom': return { symbol: ast.name, name: `원자문장/술어 (${ast.name})` };
    default: return null;
  }
}

function termToString(t) { return t.name; }

// Binary operator precedence: higher binds tighter. Unary-ish forms (Not/Forall/Exists/
// Atom/Falsum/Identity) are always tighter than any binary op, so they're given a value
// above the tightest binary op and never need parens as a child.
const PREC = { And: 3, Or: 2, Imp: 1, Iff: 0 };
const ASSOC = { And: 'left', Or: 'left', Imp: 'right', Iff: 'left' };
const OP_STR = { And: '∧', Or: '∨', Imp: '→', Iff: '↔' };
const UNARY_LEVEL = 4;

function precOf(node) { return node.type in PREC ? PREC[node.type] : UNARY_LEVEL; }

/**
 * Render a formula, adding the minimum parentheses needed so re-parsing reproduces
 * the same tree. `parentPrec`/`side` describe the binary context this node sits in
 * (undefined at the top level).
 */
export function formulaToString(ast, parentPrec = -1, side = null) {
  switch (ast.type) {
    case 'Atom':
      return ast.args.length ? `${ast.name}${ast.args.map(termToString).join('')}` : ast.name;
    case 'Falsum':
      return SYM.FALSUM;
    case 'Identity':
      return `${termToString(ast.left)}${ast.neg ? '≠' : '='}${termToString(ast.right)}`;
    case 'Not':
      return `${SYM.NOT}${wrapIfBinary(ast.arg)}`;
    case 'Forall':
      return `${SYM.FORALL}${ast.variable}${wrapIfBinary(ast.body)}`;
    case 'Exists':
      return `${SYM.EXISTS}${ast.variable}${wrapIfBinary(ast.body)}`;
    case 'And': case 'Or': case 'Imp': case 'Iff': {
      const p = PREC[ast.type];
      const l = formulaToString(ast.left, p, 'left');
      const r = formulaToString(ast.right, p, 'right');
      const inner = `${l}${OP_STR[ast.type]}${r}`;
      const needsParens = parentPrec >= 0 && (
        p < parentPrec || (p === parentPrec && needsParensAtSamePrec(parentPrec, side))
      );
      return needsParens ? `(${inner})` : inner;
    }
    default:
      return '?';
  }
}

const PREC_TO_TYPE = Object.fromEntries(Object.entries(PREC).map(([k, v]) => [v, k]));

// At equal precedence: left-assoc parents need parens around a same-prec RIGHT child;
// right-assoc parents (Imp) need parens around a same-prec LEFT child.
function needsParensAtSamePrec(parentPrec, side) {
  const parentType = PREC_TO_TYPE[parentPrec];
  const assoc = ASSOC[parentType];
  return assoc === 'left' ? side === 'right' : side === 'left';
}

function wrapIfBinary(node) {
  const s = formulaToString(node);
  return (node.type in PREC) ? `(${s})` : s;
}

// Structural equality (alpha-equivalence NOT performed; bound variable names must match).
export function equalFormula(a, b) {
  if (a === b) return true;
  if (!a || !b || a.type !== b.type) return false;
  switch (a.type) {
    case 'Atom':
      return a.name === b.name && a.args.length === b.args.length &&
        a.args.every((t, i) => t.name === b.args[i].name);
    case 'Falsum':
      return true;
    case 'Identity':
      return a.neg === b.neg && a.left.name === b.left.name && a.right.name === b.right.name;
    case 'Not':
      return equalFormula(a.arg, b.arg);
    case 'Forall':
    case 'Exists':
      return a.variable === b.variable && equalFormula(a.body, b.body);
    case 'And': case 'Or': case 'Imp': case 'Iff':
      return equalFormula(a.left, b.left) && equalFormula(a.right, b.right);
    default:
      return false;
  }
}

// All distinct propositional atom names (0-arity), used by the truth-table tool.
export function collectPropAtoms(ast, set = new Set()) {
  switch (ast.type) {
    case 'Atom': set.add(ast.name); break;
    case 'Falsum': case 'Identity': break;
    case 'Not': collectPropAtoms(ast.arg, set); break;
    case 'Forall': case 'Exists': collectPropAtoms(ast.body, set); break;
    case 'And': case 'Or': case 'Imp': case 'Iff':
      collectPropAtoms(ast.left, set); collectPropAtoms(ast.right, set); break;
  }
  return set;
}

// Free term-letters (variables occurring outside any binder for that same letter,
// PLUS all constants/parameters — i.e. every term letter that isn't currently bound).
export function freeTermLetters(ast, bound = new Set(), acc = new Set()) {
  switch (ast.type) {
    case 'Atom':
      for (const t of ast.args) if (!bound.has(t.name)) acc.add(t.name);
      break;
    case 'Identity':
      if (!bound.has(ast.left.name)) acc.add(ast.left.name);
      if (!bound.has(ast.right.name)) acc.add(ast.right.name);
      break;
    case 'Falsum': break;
    case 'Not': freeTermLetters(ast.arg, bound, acc); break;
    case 'Forall': case 'Exists': {
      const b2 = new Set(bound); b2.add(ast.variable);
      freeTermLetters(ast.body, b2, acc);
      break;
    }
    case 'And': case 'Or': case 'Imp': case 'Iff':
      freeTermLetters(ast.left, bound, acc);
      freeTermLetters(ast.right, bound, acc);
      break;
  }
  return acc;
}

// Every term-letter occurring anywhere (bound or free) — used for freshness checks.
export function allTermLetters(ast, acc = new Set()) {
  switch (ast.type) {
    case 'Atom': for (const t of ast.args) acc.add(t.name); break;
    case 'Identity': acc.add(ast.left.name); acc.add(ast.right.name); break;
    case 'Falsum': break;
    case 'Not': allTermLetters(ast.arg, acc); break;
    case 'Forall': case 'Exists': acc.add(ast.variable); allTermLetters(ast.body, acc); break;
    case 'And': case 'Or': case 'Imp': case 'Iff':
      allTermLetters(ast.left, acc); allTermLetters(ast.right, acc); break;
  }
  return acc;
}

/**
 * Substitute every FREE occurrence of term-letter `varName` with term-letter `withName`.
 * Throws if this would capture `withName` under a binder (basic capture-avoidance check).
 */
export function substitute(ast, varName, withName, bound = new Set()) {
  switch (ast.type) {
    case 'Atom':
      return { ...ast, args: ast.args.map(t => (!bound.has(varName) && t.name === varName) ? { type: 'Term', name: withName } : t) };
    case 'Identity': {
      const sub = (t) => (!bound.has(varName) && t.name === varName) ? { type: 'Term', name: withName } : t;
      return { ...ast, left: sub(ast.left), right: sub(ast.right) };
    }
    case 'Falsum':
      return ast;
    case 'Not':
      return { type: 'Not', arg: substitute(ast.arg, varName, withName, bound) };
    case 'Forall': case 'Exists': {
      if (ast.variable === withName && !bound.has(varName) && ast.variable !== varName) {
        // substituting would capture withName under this binder
        throw new Error(`치환 시 변항 포획이 발생합니다 ('${withName}'가 '${ast.variable}'에 의해 묶입니다).`);
      }
      const b2 = new Set(bound); b2.add(ast.variable);
      return { type: ast.type, variable: ast.variable, body: substitute(ast.body, varName, withName, b2) };
    }
    case 'And': case 'Or': case 'Imp': case 'Iff':
      return { type: ast.type, left: substitute(ast.left, varName, withName, bound), right: substitute(ast.right, varName, withName, bound) };
    default:
      return ast;
  }
}
