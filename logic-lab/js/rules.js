window.LogicRules=(()=>{const E=LogicParser.eq,PE=LogicProofEngine;
function isNegPair(a,b){return a&&b&&((a.k==='not'&&E(a.a,b))||(b.k==='not'&&E(b.a,a)))}
function validate(i,rows,asts,premises,engine){
  const r=rows[i],cur=asts[i],lineRefs=r.refs.filter(x=>x.type==='line').map(x=>x.n),ranges=r.refs.filter(x=>x.type==='range'),prior=n=>n>=1&&n<=i?asts[n-1]:null;
  if(r.structureError)return[false,r.structureError];
  if(!cur)return[false,'문장 형식을 확인하세요.'];
  if(r.rule==='Premise')return premises.some(p=>E(p,cur))?[true,'전제와 일치합니다.']:[false,'주어진 전제와 일치하지 않습니다.'];
  if(r.rule==='AS')return r.refs.length===0?[true,'보조증명의 가정입니다.']:[false,'AS는 참조 행을 사용하지 않습니다.'];
  const closedRange=g=>PE.findClosed(engine,g.start,g.end);
  const rangeReady=(g,label)=>{const s=closedRange(g);if(!s)return[null,`${label}의 범위 ${g.start}-${g.end}는 /로 닫힌 보조증명이어야 합니다.`];if(!PE.samePath(s.parentPath,r.scope))return[null,`${label}는 현재 행과 같은 바깥 범위에서 닫힌 보조증명을 참조해야 합니다.`];return[s,null]};
  if(r.rule==='→I'||r.rule==='¬I'){
    if(ranges.length!==1||r.refs.length!==1)return[false,`${r.rule}는 닫힌 보조증명 범위 하나(예: 2-4)를 참조합니다.`];
    const g=ranges[0],[s,err]=rangeReady(g,r.rule);if(err)return[false,err];
    const a=rows[g.start-1],end=asts[g.end-1];if(!a||a.rule!=='AS'||!end)return[false,'참조한 보조증명 범위를 확인하세요.'];
    if(r.rule==='→I')return cur.k==='imp'&&E(cur.l,asts[g.start-1])&&E(cur.r,end)?[true,'→I 적용이 올바릅니다.']:[false,'현재 문장은 보조증명의 가정과 마지막 문장으로 만든 조건문이어야 합니다.'];
    if(end.k!=='bot')return[false,'¬I의 보조증명은 ⊥로 끝나야 합니다.'];
    return cur.k==='not'&&E(cur.a,asts[g.start-1])?[true,'¬I 적용이 올바릅니다.']:[false,'현재 문장은 보조증명에서 가정한 문장의 부정이어야 합니다.'];
  }
  if(r.rule==='∨E'){
    if(lineRefs.length!==1||ranges.length!==2||r.refs.length!==3)return[false,'∨E는 선언문 한 행과 닫힌 보조증명 두 범위를 참조합니다. 예: 1,2-3,4-5'];
    const d=prior(lineRefs[0]);if(!d||d.k!=='or')return[false,'∨E의 첫 참조는 A ∨ B 형태의 선언문이어야 합니다.'];
    const [g1,g2]=ranges,[s1,e1]=rangeReady(g1,'∨E'),[s2,e2]=rangeReady(g2,'∨E');if(e1)return[false,e1];if(e2)return[false,e2];
    const a1=rows[g1.start-1],a2=rows[g2.start-1],z1=asts[g1.end-1],z2=asts[g2.end-1];
    if(a1?.rule!=='AS'||a2?.rule!=='AS')return[false,'∨E의 두 보조증명은 각각 AS 행에서 시작해야 합니다.'];
    const assumptions=(E(asts[g1.start-1],d.l)&&E(asts[g2.start-1],d.r))||(E(asts[g1.start-1],d.r)&&E(asts[g2.start-1],d.l));
    if(!assumptions)return[false,'두 보조증명의 가정은 선언문의 두 선언지와 각각 일치해야 합니다.'];
    return z1&&z2&&E(z1,cur)&&E(z2,cur)?[true,'∨E 적용이 올바릅니다.']:[false,'두 보조증명은 모두 현재 문장과 같은 결론으로 끝나야 합니다.'];
  }
  if(r.rule==='↔I'){
    if(ranges.length!==2||r.refs.length!==2)return[false,'↔I는 닫힌 보조증명 두 범위를 참조합니다. 예: 2-3,4-5'];
    if(cur.k!=='iff')return[false,'↔I의 현재 문장은 쌍조건문이어야 합니다.'];
    const [g1,g2]=ranges,[s1,e1]=rangeReady(g1,'↔I'),[s2,e2]=rangeReady(g2,'↔I');if(e1)return[false,e1];if(e2)return[false,e2];
    if(rows[g1.start-1]?.rule!=='AS'||rows[g2.start-1]?.rule!=='AS')return[false,'↔I의 두 보조증명은 각각 AS 행에서 시작해야 합니다.'];
    const a1=asts[g1.start-1],z1=asts[g1.end-1],a2=asts[g2.start-1],z2=asts[g2.end-1];
    const ok=(E(a1,cur.l)&&E(z1,cur.r)&&E(a2,cur.r)&&E(z2,cur.l))||(E(a1,cur.r)&&E(z1,cur.l)&&E(a2,cur.l)&&E(z2,cur.r));
    return ok?[true,'↔I 적용이 올바릅니다.']:[false,'한 보조증명은 A에서 B를, 다른 보조증명은 B에서 A를 도출해야 합니다.'];
  }
  if(ranges.length)return[false,'이 규칙은 보조증명 범위를 참조하지 않습니다.'];
  for(const n of lineRefs){if(n<1||n>=r.n)return[false,'참조 행은 현재 행보다 앞에 있어야 합니다.'];const q=rows[n-1];if(!PE.accessible(q,r))return[false,`${n}행은 닫힌 보조증명 안에 있으므로 여기서 직접 참조할 수 없습니다.`]}
  if(r.rule==='R'){if(lineRefs.length!==1)return[false,'R은 한 행을 참조합니다.'];const a=prior(lineRefs[0]);return a&&E(a,cur)?[true,'반복이 올바릅니다.']:[false,'참조 행과 같은 문장이어야 합니다.']}
  if(r.rule==='∧I'){if(lineRefs.length!==2)return[false,'∧I는 두 행을 참조합니다.'];const a=prior(lineRefs[0]),b=prior(lineRefs[1]);return a&&b&&cur.k==='and'&&((E(cur.l,a)&&E(cur.r,b))||(E(cur.l,b)&&E(cur.r,a)))?[true,'∧I 적용이 올바릅니다.']:[false,'현재 문장은 참조한 두 문장의 연언이어야 합니다.']}
  if(r.rule==='∧E'){if(lineRefs.length!==1)return[false,'∧E는 한 행을 참조합니다.'];const a=prior(lineRefs[0]);return a&&a.k==='and'&&(E(cur,a.l)||E(cur,a.r))?[true,'∧E 적용이 올바릅니다.']:[false,'참조 행이 연언이고 현재 문장이 그 연언지 중 하나여야 합니다.']}
  if(r.rule==='∨I'){if(lineRefs.length!==1)return[false,'∨I는 한 행을 참조합니다.'];const a=prior(lineRefs[0]);return a&&cur.k==='or'&&(E(cur.l,a)||E(cur.r,a))?[true,'∨I 적용이 올바릅니다.']:[false,'현재 선언의 한 선언지가 참조 행과 같아야 합니다.']}
  if(r.rule==='→E'){if(lineRefs.length!==2)return[false,'→E는 두 행을 참조합니다.'];const a=prior(lineRefs[0]),b=prior(lineRefs[1]),ok=a&&a.k==='imp'&&b&&E(a.l,b)&&E(a.r,cur)||b&&b.k==='imp'&&a&&E(b.l,a)&&E(b.r,cur);return ok?[true,'→E 적용이 올바릅니다.']:[false,'한 참조 행은 A → B, 다른 행은 A, 현재 문장은 B여야 합니다.']}
  if(r.rule==='⊥I'){if(lineRefs.length!==2)return[false,'⊥I는 서로 모순되는 두 행을 참조합니다.'];const a=prior(lineRefs[0]),b=prior(lineRefs[1]);return cur.k==='bot'&&isNegPair(a,b)?[true,'⊥I 적용이 올바릅니다.']:[false,'참조한 두 문장은 A와 ¬A여야 하고 현재 문장은 ⊥이어야 합니다.']}
  if(r.rule==='⊥E'){if(lineRefs.length!==1)return[false,'⊥E는 ⊥인 한 행을 참조합니다.'];const a=prior(lineRefs[0]);return a?.k==='bot'?[true,'⊥E 적용이 올바릅니다.']:[false,'⊥E의 참조 행은 ⊥이어야 합니다.']}
  if(r.rule==='↔E'){if(lineRefs.length!==2)return[false,'↔E는 쌍조건문과 그 한쪽 문장을 참조합니다.'];const a=prior(lineRefs[0]),b=prior(lineRefs[1]);let iff,x;if(a?.k==='iff'){iff=a;x=b}else if(b?.k==='iff'){iff=b;x=a}else return[false,'한 참조 행은 A ↔ B 형태여야 합니다.'];return x&&((E(x,iff.l)&&E(cur,iff.r))||(E(x,iff.r)&&E(cur,iff.l)))?[true,'↔E 적용이 올바릅니다.']:[false,'쌍조건문의 한쪽과 일치하는 참조에서 다른 쪽을 도출해야 합니다.']}
  return[false,'추론 규칙을 선택하세요.'];
}
return{validate}})();
