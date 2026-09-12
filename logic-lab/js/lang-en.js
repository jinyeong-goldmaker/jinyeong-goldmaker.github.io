(() => {
  const exact = new Map([
    ['문장논리','Propositional Logic'], ['술어논리','Predicate Logic'], ['삭제','Delete'], ['상자 삭제','Delete box'],
    ['+ 전제 추가','+ Add premise'], ['+ 줄 추가','+ Add line'], ['+ 하위증명(가정) 추가','+ Add subproof (assumption)'], ['+ 하위증명 추가','+ Add subproof'],
    ['증명 검증하기','Verify proof'], ['적형식 확인 + 주연결사 찾기','Check WFF + main connective'], ['진리표 생성','Generate truth table'],
    ['타당성 검사','Check validity'], ['진리나무로 타당성 검사','Check validity by tableau'], ['(전제만) 충족가능성 검사','Check satisfiability (premises only)'],
    ['규칙','Rule'], ['인용 개수','Citations'], ['나무 구조','Tree structure'], ['결론','Conclusion'], ['결론 (목표)','Conclusion (target)'],
    ['홈으로','Home'], ['원자문장','atomic formula'], ['부정 (¬)','negation (¬)'], ['연언 (∧)','conjunction (∧)'], ['선언 (∨)','disjunction (∨)'],
    ['조건 (→)','conditional (→)'], ['쌍조건 (↔)','biconditional (↔)'], ['모순 상수 ⊥','falsum ⊥'], ['동일성 (=)','identity (=)'], ['부동일성 (≠)','non-identity (≠)']
  ]);
  const replacements = [
    [/^전제 (\d+)$/, 'Premise $1'], [/^전제 (\d+) \(예:/, 'Premise $1 (e.g.'], [/^가정 \(하위증명 (.*)\)$/, 'Assumption (subproof $1)'],
    [/인용 \(예: 1,2\)/g,'Citations (e.g. 1,2)'], [/문장을 입력하세요\./g,'Enter a formula.'], [/적형식이 아닙니다/g,'Not a well-formed formula'], [/구문 오류/g,'syntax error'],
    [/적형식\(WFF\)입니다\. 해석:/g,'Well-formed formula (WFF). Parsed as:'], [/해석된 문장:/g,'Parsed formula:'], [/주연결사:/g,'Main connective:'], [/(\(주연결사\))/g,'(main connective)'],
    [/술어 원자문장 \(([^)]*)\)/g,'predicate atom ($1)'], [/항 (\d+)개/g,'$1 term(s)'], [/전칭양화 \(∀([^)]*)\)/g,'universal quantification (∀$1)'], [/존재양화 \(∃([^)]*)\)/g,'existential quantification (∃$1)'],
    [/증명이 완성되었습니다! 모든 줄이 올바르고 결론에 도달했습니다\./g,'Proof complete: every line is correct and the conclusion has been reached.'],
    [/모든 줄이 올바릅니다\./g,'Every line is correct.'], [/오류가 있는 줄이 있습니다 \(아래 ✗ 표시를 확인하세요\)\./g,'Some lines contain errors (see the ✗ marks below).'],
    [/모든 줄은 올바르지만 아직 목표 결론에 도달하지 않았습니다\./g,'All lines are correct, but the target conclusion has not yet been reached.'],
    [/검증 중 오류:/g,'Verification error:'], [/전제를 하나 이상 입력하고 결론도 입력하세요\./g,'Enter at least one premise and a conclusion.'], [/전제를 하나 이상, 결론도 입력하세요\./g,'Enter at least one premise and a conclusion.'], [/전제를 하나 이상 입력하세요\./g,'Enter at least one premise.'],
    [/전제 구문 오류/g,'Premise syntax error'], [/결론 구문 오류/g,'Conclusion syntax error'],
    [/모든 가지가 닫혔습니다 → 타당한 논증입니다\./g,'All branches are closed → the argument is valid.'],
    [/열린 가지가 있습니다 → 타당하지 않은 논증입니다 \(아래 모형 참고\)\./g,'An open branch remains → the argument is invalid (see the model below).'],
    [/전개 한도\(([^)]*)\) 내에 결론이 나지 않았습니다 — 확실치 않습니다\./g,'The expansion limit ($1) was reached without a result — undetermined.'],
    [/전개 한도 내에 결론이 나지 않았습니다 — 확실치 않습니다\./g,'The expansion limit was reached without a result — undetermined.'],
    [/전제들을 동시에 만족하는 모형이 있습니다 \(충족가능\)\./g,'There is a model satisfying all premises (satisfiable).'],
    [/모든 가지가 닫혔습니다 → 전제들이 동시에 참일 수 없습니다 \(충족불가능\)\./g,'All branches are closed → the premises cannot all be true (unsatisfiable).'],
    [/확실치 않음/g,'undetermined'], [/확실치 않습니다/g,'undetermined'], [/충족가능/g,'satisfiable'], [/충족불가능/g,'unsatisfiable'],
    [/정의역\(등장한 이름\):/g,'Domain (names occurring):'], [/참:/g,'True:'], [/거짓:/g,'False:'],
    [/닫힘/g,'closed'], [/열림/g,'open'], [/완결 — 모형 있음/g,'complete — model exists'], [/전개 한도 도달/g,'expansion limit reached'], [/전개 단계/g,'expansion steps'], [/가지:/g,'Branches:'],
    [/항진명제 \(tautology\)/g,'tautology'], [/모순명제 \(contradiction\)/g,'contradiction'], [/우연명제 \(contingency\)/g,'contingency'],
    [/타당한 논증입니다 \(모든 전제가 참이면서 결론이 거짓인 경우가 없습니다\)\./g,'The argument is valid (there is no row with all premises true and the conclusion false).'],
    [/타당하지 않은 논증입니다\. 반례:/g,'The argument is invalid. Counterexample:'], [/타당한 논증입니다/g,'The argument is valid'], [/타당하지 않은 논증입니다/g,'The argument is invalid']
  ];
  function translateText(s) {
    const trimmed = s.trim();
    if (exact.has(trimmed)) return s.replace(trimmed, exact.get(trimmed));
    let out = s;
    for (const [re, rep] of replacements) out = out.replace(re, rep);
    return out;
  }
  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { const n = translateText(root.nodeValue); if (n !== root.nodeValue) root.nodeValue = n; return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.placeholder) root.placeholder = translateText(root.placeholder);
      if (root.title) root.title = translateText(root.title);
    }
    for (const child of root.childNodes) walk(child);
  }
  walk(document.body);
  new MutationObserver(ms => { for (const m of ms) { for (const n of m.addedNodes) walk(n); if (m.type === 'characterData') walk(m.target); } }).observe(document.body, { childList:true, subtree:true, characterData:true });
})();
