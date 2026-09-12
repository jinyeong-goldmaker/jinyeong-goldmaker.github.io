window.LogicProofEngine=(()=>{
function samePath(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i])}
function prefix(a,b){return a.length<=b.length&&a.every((x,i)=>x===b[i])}
function analyze(rawRows){
  const open=[],closed=[],rows=[];
  rawRows.forEach((raw,i)=>{
    const n=i+1;
    let formula=(raw.formula||'').trim();
    const closes=/\/\s*$/.test(formula);
    if(closes) formula=formula.replace(/\/\s*$/,'').trim();
    if(raw.rule==='AS') open.push(n);
    const scope=[...open];
    const row={...raw,n,formula,scope,closes,structureError:null};
    if(closes){
      if(!open.length){
        row.structureError='닫을 보조증명이 없습니다. /는 열린 보조증명의 마지막 행에만 사용하세요.';
      }else{
        const start=open.pop();
        closed.push({start,end:n,path:scope,parentPath:scope.slice(0,-1)});
      }
    }
    rows.push(row);
  });
  return {rows,closed,openScopes:[...open],samePath,prefix};
}
function findClosed(engine,start,end){return engine.closed.find(s=>s.start===start&&s.end===end)||null}
function accessible(fromRow,toRow){return prefix(fromRow.scope,toRow.scope)}
return{analyze,findClosed,accessible,samePath,prefix};
})();
