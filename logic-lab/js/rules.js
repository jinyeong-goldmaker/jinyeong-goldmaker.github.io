window.LogicRules=(()=>{const E=LogicParser.eq;
function validate(i,rows,asts,premises){let r=rows[i],cur=asts[i],lineRefs=r.refs.filter(x=>x.type==='line').map(x=>x.n),ranges=r.refs.filter(x=>x.type==='range'),prior=n=>n>=1&&n<=i?asts[n-1]:null;
if(!cur)return[false,'문장 형식을 확인하세요.'];
if(r.rule==='Premise')return premises.some(p=>E(p,cur))?[true,'전제와 일치합니다.']:[false,'주어진 전제와 일치하지 않습니다.'];
if(r.rule==='AS')return r.refs.length===0?[true,'보조증명의 가정입니다.']:[false,'AS는 참조 행을 사용하지 않습니다.'];
if(r.rule==='→I'){if(ranges.length!==1||r.refs.length!==1)return[false,'→I는 완결된 보조증명 범위 하나(예: 2-4)를 참조합니다.'];let g=ranges[0],a=rows[g.start-1],end=asts[g.end-1];if(g.start<1||g.end>=r.n||g.start>g.end||!a||!end)return[false,'참조한 보조증명 범위를 확인하세요.'];if(a.rule!=='AS')return[false,'→I의 참조 범위는 AS 행에서 시작해야 합니다.'];if(cur.k!=='imp'||!E(cur.l,asts[g.start-1])||!E(cur.r,end))return[false,'현재 문장은 보조증명의 가정과 마지막 문장으로 만든 조건문이어야 합니다.'];return[true,'→I 적용이 올바르며 가정이 해제되었습니다.'];}
if(ranges.length)return[false,'이 규칙은 보조증명 범위를 참조하지 않습니다.'];
if(r.rule==='R'){if(lineRefs.length!==1)return[false,'R은 한 행을 참조합니다.'];let a=prior(lineRefs[0]);return a&&E(a,cur)?[true,'반복이 올바릅니다.']:[false,'참조 행과 같은 문장이어야 합니다.']}
if(r.rule==='∧I'){if(lineRefs.length!==2)return[false,'∧I는 두 행을 참조합니다.'];let a=prior(lineRefs[0]),b=prior(lineRefs[1]);return a&&b&&cur.k==='and'&&((E(cur.l,a)&&E(cur.r,b))||(E(cur.l,b)&&E(cur.r,a)))?[true,'∧I 적용이 올바릅니다.']:[false,'현재 문장은 참조한 두 문장의 연언이어야 합니다.']}
if(r.rule==='∧E'){if(lineRefs.length!==1)return[false,'∧E는 한 행을 참조합니다.'];let a=prior(lineRefs[0]);return a&&a.k==='and'&&(E(cur,a.l)||E(cur,a.r))?[true,'∧E 적용이 올바릅니다.']:[false,'참조 행이 연언이고 현재 문장이 그 연언지 중 하나여야 합니다.']}
if(r.rule==='∨I'){if(lineRefs.length!==1)return[false,'∨I는 한 행을 참조합니다.'];let a=prior(lineRefs[0]);return a&&cur.k==='or'&&(E(cur.l,a)||E(cur.r,a))?[true,'∨I 적용이 올바릅니다.']:[false,'현재 선언의 한 선언지가 참조 행과 같아야 합니다.']}
if(r.rule==='→E'){if(lineRefs.length!==2)return[false,'→E는 두 행을 참조합니다.'];let a=prior(lineRefs[0]),b=prior(lineRefs[1]),ok=a&&a.k==='imp'&&b&&E(a.l,b)&&E(a.r,cur)||b&&b.k==='imp'&&a&&E(b.l,a)&&E(b.r,cur);return ok?[true,'→E 적용이 올바릅니다.']:[false,'한 참조 행은 A → B, 다른 행은 A, 현재 문장은 B여야 합니다.']}
return[false,'추론 규칙을 선택하세요.']}
return{validate}})();
