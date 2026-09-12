window.LogicRules=(()=>{const E=LogicParser.eq;
function prefix(a,b){return a.length<=b.length&&a.every((x,i)=>x===b[i])}
function isNegPair(a,b){return a&&b&&((a.k==='not'&&E(a.a,b))||(b.k==='not'&&E(b.a,a)))}
function validate(i,rows,asts,premises){let r=rows[i],cur=asts[i],lineRefs=r.refs.filter(x=>x.type==='line').map(x=>x.n),ranges=r.refs.filter(x=>x.type==='range'),prior=n=>n>=1&&n<=i?asts[n-1]:null;
if(!cur)return[false,'문장 형식을 확인하세요.'];
if(r.rule==='Premise')return premises.some(p=>E(p,cur))?[true,'전제와 일치합니다.']:[false,'주어진 전제와 일치하지 않습니다.'];
if(r.rule==='AS')return r.refs.length===0?[true,'보조증명의 가정입니다.']:[false,'AS는 참조 행을 사용하지 않습니다.'];
if(r.rule==='→I'||r.rule==='¬I'){if(ranges.length!==1||r.refs.length!==1)return[false,`${r.rule}는 보조증명 범위 하나(예: 2-4)를 참조합니다.`];let g=ranges[0],a=rows[g.start-1],z=rows[g.end-1],end=asts[g.end-1];if(g.start<1||g.end>=r.n||g.start>g.end||!a||!z||!end)return[false,'참조한 보조증명 범위를 확인하세요.'];if(a.rule!=='AS')return[false,`${r.rule}의 참조 범위는 AS 행에서 시작해야 합니다.`];if(!a.scope.includes(g.start)||!z.scope.includes(g.start))return[false,'참조 범위가 하나의 보조증명을 이루지 않습니다.'];if(r.scope.includes(g.start))return[false,`${r.rule} 행은 해제하려는 가정의 보조증명 밖에 있어야 합니다.`];if(r.rule==='→I'){if(cur.k!=='imp'||!E(cur.l,asts[g.start-1])||!E(cur.r,end))return[false,'현재 문장은 보조증명의 가정과 마지막 문장으로 만든 조건문이어야 합니다.'];return[true,'→I 적용이 올바르며 가정이 해제되었습니다.'];}if(end.k!=='bot')return[false,'¬I의 보조증명은 ⊥로 끝나야 합니다.'];if(cur.k!=='not'||!E(cur.a,asts[g.start-1]))return[false,'현재 문장은 보조증명에서 가정한 문장의 부정이어야 합니다.'];return[true,'¬I 적용이 올바르며 가정이 해제되었습니다.'];}
if(ranges.length)return[false,'이 규칙은 보조증명 범위를 참조하지 않습니다.'];
for(const n of lineRefs){if(n<1||n>=r.n)return[false,'참조 행은 현재 행보다 앞에 있어야 합니다.'];let q=rows[n-1];if(!prefix(q.scope,r.scope))return[false,`${n}행은 이미 닫힌 보조증명 안에 있으므로 여기서 직접 참조할 수 없습니다.`]}
if(r.rule==='R'){if(lineRefs.length!==1)return[false,'R은 한 행을 참조합니다.'];let a=prior(lineRefs[0]);return a&&E(a,cur)?[true,'반복이 올바릅니다.']:[false,'참조 행과 같은 문장이어야 합니다.']}
if(r.rule==='∧I'){if(lineRefs.length!==2)return[false,'∧I는 두 행을 참조합니다.'];let a=prior(lineRefs[0]),b=prior(lineRefs[1]);return a&&b&&cur.k==='and'&&((E(cur.l,a)&&E(cur.r,b))||(E(cur.l,b)&&E(cur.r,a)))?[true,'∧I 적용이 올바릅니다.']:[false,'현재 문장은 참조한 두 문장의 연언이어야 합니다.']}
if(r.rule==='∧E'){if(lineRefs.length!==1)return[false,'∧E는 한 행을 참조합니다.'];let a=prior(lineRefs[0]);return a&&a.k==='and'&&(E(cur,a.l)||E(cur,a.r))?[true,'∧E 적용이 올바릅니다.']:[false,'참조 행이 연언이고 현재 문장이 그 연언지 중 하나여야 합니다.']}
if(r.rule==='∨I'){if(lineRefs.length!==1)return[false,'∨I는 한 행을 참조합니다.'];let a=prior(lineRefs[0]);return a&&cur.k==='or'&&(E(cur.l,a)||E(cur.r,a))?[true,'∨I 적용이 올바릅니다.']:[false,'현재 선언의 한 선언지가 참조 행과 같아야 합니다.']}
if(r.rule==='→E'){if(lineRefs.length!==2)return[false,'→E는 두 행을 참조합니다.'];let a=prior(lineRefs[0]),b=prior(lineRefs[1]),ok=a&&a.k==='imp'&&b&&E(a.l,b)&&E(a.r,cur)||b&&b.k==='imp'&&a&&E(b.l,a)&&E(b.r,cur);return ok?[true,'→E 적용이 올바릅니다.']:[false,'한 참조 행은 A → B, 다른 행은 A, 현재 문장은 B여야 합니다.']}
if(r.rule==='⊥I'){if(lineRefs.length!==2)return[false,'⊥I는 서로 모순되는 두 행을 참조합니다.'];let a=prior(lineRefs[0]),b=prior(lineRefs[1]);return cur.k==='bot'&&isNegPair(a,b)?[true,'⊥I 적용이 올바릅니다.']:[false,'참조한 두 문장은 A와 ¬A여야 하고 현재 문장은 ⊥이어야 합니다.'];}
return[false,'추론 규칙을 선택하세요.']}
return{validate}})();
