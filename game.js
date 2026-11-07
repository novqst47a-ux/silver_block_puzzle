"use strict";
const $ = id => document.getElementById(id);
const boardEl=$("board"), tray=$("tray"), panel=$("panel");
const boardFrame=$("boardFrame");
const parkToast=$("parkToast");
const scoresDialog=$("scoresDialog"), recordLimit=5;
const storageKey=gameStorageKey("hanjul-madang","v1");
const initialSeed=(Math.random()*4294967296)>>>0;
const playableSizes=[8];
function newSession(n,seed) {
  return {board:Puzzle.fresh(n,seed),best:0,records:[],finishedAt:null};
}
function newState() {
  const sessions=Object.fromEntries(playableSizes.map(n=>[n,newSession(n,initialSeed)]));
  return {version:1,size:playableSizes[0],sessions};
}
function validBoard(b,n) {
  return b?.n===n && b.cells?.length===n*n && b.cells.every(c=>c===""||Puzzle.colors.includes(c))
    && b.hand?.length===3 && b.hand.every(p=>p===null||(Number.isInteger(p?.shape)&&Puzzle.shapes[p.shape]&&Puzzle.colors.includes(p.color)))
    && [b.seed,b.score,b.lines].every(v=>Number.isSafeInteger(v)&&v>=0);
}
const validDate=t=>Number.isSafeInteger(t)&&t>0&&t<=8640000000000000;
// Stable sorting keeps the earlier finish ahead when two scores match.
const topRecords=records=>records.sort((a,b)=>b.score-a.score).slice(0,recordLimit);
function restore() {
  try {
    const raw=localStorage.getItem(storageKey);
    if (!raw) return newState();
    const s=JSON.parse(raw);
    if (s.version!==1 || !s.sessions) throw Error();
    if (!playableSizes.includes(s.size)) s.size=playableSizes[0];
    for (const n of playableSizes) {
      const g=s.sessions[n];
      if (!g) {s.sessions[n]=newSession(n,initialSeed);continue;}
      if (!validBoard(g.board,n) || !Number.isSafeInteger(g.best)) throw Error();
      // Older saves know their personal best, but not when it was earned.
      const records=Array.isArray(g.records)?g.records.filter(r=>Number.isSafeInteger(r?.score)&&r.score>=0&&validDate(r.date)):[];
      s.sessions[n]={board:g.board,best:g.best,records:topRecords(records),finishedAt:validDate(g.finishedAt)?g.finishedAt:null};
    }
    return s;
  } catch {
    $("notice").textContent="저장된 판을 열 수 없어 새 판으로 시작해요.";
    return newState();
  }
}
let state=restore(), selected=null, focusIndex=0, gesture=null, parked=null;
let previewIndex=-1;
let toastTimer=0;
let displayedScore=0, scoreAnim=0, deltaTimer=0;
const session=()=>state.sessions[state.size];
const board=()=>session().board;
function save() {
  try { localStorage.setItem(storageKey,JSON.stringify(state)); }
  catch { $("notice").textContent="이 브라우저에서는 다음에 이어 하기 어려워요. 지금 판은 계속할 수 있어요."; }
}
const say=msg=>{$("instruction").textContent=msg;};
const defaultHelp="조각을 누르고 빈칸을 누르세요. 끌어서 점선 위치에 놓아도 좋아요.";
const parkedHelp="여기에는 놓을 수 없어요. 줄무늬 조각을 다시 잡아 옮기거나 놓을 칸을 눌러 주세요.";
const reducedMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const points=new Intl.NumberFormat(document.documentElement.lang).format;
const recordDate=new Intl.DateTimeFormat(document.documentElement.lang,{year:"numeric",month:"2-digit",day:"2-digit"}).format;
const ranks=[[0,"몸풀기 중"],[500,"기세 등등"],[1000,"천점 돌파"],[2000,"고득점 달인"],[3000,"명인 경지"]];
const nameOf=p=>Puzzle.shapes[p.shape][0];
const finiteSpot=(r,c)=>r>=0&&c>=0&&r<state.size&&c<state.size;
function noMoves(){return board().hand.every(p=>!p||Puzzle.spot(board(),p)<0);}
function finishIfStuck(){
  const g=session();
  if (g.finishedAt || !noMoves()) return false;
  g.finishedAt=Date.now();
  const score=g.board.score;
  g.best=Math.max(g.best,score);
  g.records=topRecords([...g.records,{score,date:g.finishedAt}]);
  return true;
}
function showScores(){
  interrupt();
  const {records,finishedAt}=session();
  $("gameResult").hidden=!finishedAt;
  $("closeScores").hidden=!!finishedAt;
  $("playAgain").hidden=!finishedAt;
  scoresDialog.setAttribute("closedby",finishedAt?"none":"closerequest");
  scoresDialog.setAttribute("aria-labelledby",finishedAt?"gameOverTitle finalScore":"scoresTitle");
  if(finishedAt){
    $("finalScore").textContent=points(board().score)+"점";
    $("finalDate").textContent=recordDate(finishedAt);
  }
  const rows=$("scoreRows");
  rows.replaceChildren();
  for(let i=0;i<recordLimit;i++){
    const entry=records[i],row=rows.insertRow();
    const rank=document.createElement("th");rank.scope="row";rank.textContent=(i+1)+"위";row.append(rank);
    row.insertCell().textContent=entry?points(entry.score):"—";
    row.insertCell().textContent=entry?recordDate(entry.date):"—";
  }
  if(!scoresDialog.open)scoresDialog.showModal();
}
function resumeGame(){
  if(finishIfStuck())save();
  render();
  if(session().finishedAt)showScores();
}
function renderBoard(added=[]) {
  const b=board(),n=b.n;
  const faces=new Map((b.pieces||[]).map(piece=>[piece.anchor,piece.shape]));
  const placed=new Set(added);
  boardFrame.style.setProperty("--n",n);
  boardEl.setAttribute("aria-label",n+" 곱하기 "+n+" 놀이판");
  boardEl.replaceChildren();
  for (let r=0;r<n;r++) {
    const row=document.createElement("div");
    row.className="boardrow";row.setAttribute("role","row");
    for (let c=0;c<n;c++) {
      const i=r*n+c, val=b.cells[i], el=document.createElement("div");
      el.setAttribute("role","gridcell");el.dataset.index=i;el.tabIndex=i===focusIndex?0:-1;
      el.className="cell"+(val?" filled tile-"+val:"")+(val&&placed.has(i)?" placed-pop":"");
      if (val && faces.has(i))Portraits.decorate(el,faces.get(i));
      el.setAttribute("aria-label",(r+1)+"행 "+(c+1)+"열 "+(val?"채운 칸":"빈칸"));
      row.append(el);
    }
    boardEl.append(row);
  }
}
function shapeView(piece) {
  const coords=Puzzle.shapes[piece.shape][1], shape=document.createElement("span");
  shape.className="shape tile-"+piece.color;shape.setAttribute("aria-hidden","true");
  const {width,height}=Puzzle.shapeSizes[piece.shape];
  shape.style.setProperty("--w",width);
  shape.style.setProperty("--h",height);
  const [anchorRow,anchorCol]=Puzzle.shapeAnchors[piece.shape];
  coords.forEach(([r,c])=>{
    const wrap=document.createElement("i");wrap.style.gridArea=(r+1)+"/"+(c+1);
    const tile=document.createElement("b");tile.className="minicell";
    if(r===anchorRow && c===anchorCol){tile.classList.add("anchor");Portraits.decorate(tile,piece.shape);}
    wrap.append(tile);shape.append(wrap);
  });
  return shape;
}
function renderTray(){
  tray.replaceChildren();
  board().hand.forEach((p,idx)=>{
    const btn=document.createElement("button");
    btn.className="slot";btn.dataset.slot=idx;btn.disabled=!p;
    btn.setAttribute("aria-label",p?(idx+1)+"번째 조각, "+nameOf(p):"이미 놓은 조각");
    btn.setAttribute("aria-pressed",String(idx===selected));
    if (p) btn.append(shapeView(p));
    else {const blank=document.createElement("span");blank.className="empty-mark";btn.append(blank);}
    tray.append(btn);
  });
}
function showSelection(){
  tray.querySelectorAll(".slot").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===selected)));
  boardEl.classList.toggle("aiming",selected!==null);
}
const cellAt=index=>boardEl.querySelector('[data-index="'+index+'"]');
function placementOrigin(index){
  const b=board(),[dy,dx]=Puzzle.shapeAnchors[b.hand[selected].shape];
  return [Math.floor(index/b.n)-dy,index%b.n-dx];
}
function preview(index){
  if (previewIndex===index) return;
  previewIndex=index;
  boardEl.querySelectorAll(".preview,.will-clear").forEach(el=>el.classList.remove("preview","invalid","will-clear"));
  if (index<0||selected===null) return;
  const b=board(),p=b.hand[selected];if (!p) return;
  const [r,c]=placementOrigin(index),valid=Puzzle.fits(b,p,r,c);
  for (const [dy,dx] of Puzzle.shapes[p.shape][1]) if (finiteSpot(r+dy,c+dx)) {
    const cell=cellAt((r+dy)*b.n+c+dx);
    cell.classList.add("preview");cell.classList.toggle("invalid",!valid);
  }
  if (valid) for (const i of Puzzle.wouldClear(b,p,r,c)) cellAt(i).classList.add("will-clear");
}
function hideParkToast(){
  clearTimeout(toastTimer);parkToast.hidden=true;
}
function clearParked(){
  hideParkToast();
  if (!parked) return;
  parked.shape.remove();
  parked.slot.classList.remove("holding");
  parked=null;
}
function positionParked(index,waiting=true){
  if (!parked) return;
  const {shape}=parked;
  shape.hidden=index<0;
  if (index<0) return;
  const b=board(), {width,height}=Puzzle.shapeSizes[b.hand[selected].shape];
  let [row,col]=placementOrigin(index);
  if (waiting) {
    // Keep the whole warning piece within reach, including at a clipped board edge.
    row=Math.max(0,Math.min(b.n-height,row));
    col=Math.max(0,Math.min(b.n-width,col));
    shape.style.setProperty("--nudge-x",col+width/2<b.n/2?"18%":"-18%");
    shape.style.setProperty("--nudge-y",row+height/2<b.n/2?"16%":"-16%");
  }
  shape.classList.toggle("waiting",waiting);
  shape.style.setProperty("--start-row",row-Math.floor(index/b.n));
  shape.style.setProperty("--start-col",col-index%b.n);
  const cell=cellAt(index);
  if (shape.parentNode!==cell) cell.append(shape);
}
function park(index){
  clearParked();
  const shape=shapeView(board().hand[selected]), slot=tray.children[selected];
  shape.classList.add("parked-piece");
  slot.classList.add("holding");
  parked={index,shape,slot};
  positionParked(index);
  preview(index);
  parkToast.classList.toggle("at-bottom",Math.floor(index/board().n)<board().n/2);
  parkToast.hidden=false;
  toastTimer=setTimeout(hideParkToast,4200);
  say(parkedHelp);
}
function showGoal(score,best,isRecord){
  let text,fill;
  if (isRecord) {
    text="신기록 행진 중! (+"+points(score-best)+"점 경신)";fill=100;
  } else if (best>0) {
    const remain=best-score;
    text=(remain<=120?"최고 기록 코앞! ":"최고 기록까지 ")+points(remain)+"점 남음";fill=score/best*100;
  } else {
    // A first game has no record to chase yet, so aim for the next rank.
    const next=ranks.find(([min])=>min>score);
    text=next?next[1]+"까지 "+points(next[0]-score)+"점 남음":"첫 판에 명인 경지에 올랐어요!";
    fill=next?score/next[0]*100:100;
  }
  $("goalText").textContent=text;$("goalFill").style.width=Math.min(100,Math.round(fill))+"%";
}
function showScore(target,gained){
  const el=$("score");
  cancelAnimationFrame(scoreAnim);
  if (!gained||reducedMotion()) {displayedScore=target;el.textContent=points(target);return;}
  el.classList.remove("bump");void el.offsetWidth;el.classList.add("bump");
  const from=displayedScore,started=performance.now();
  const tick=now=>{
    const t=Math.min(1,(now-started)/380);
    displayedScore=Math.round(from+(target-from)*(1-(1-t)**3));
    el.textContent=points(displayedScore);
    if (t<1) scoreAnim=requestAnimationFrame(tick);
  };
  scoreAnim=requestAnimationFrame(tick);
}
function updateScoreboard(gained=0){
  const score=board().score,best=session().best,isRecord=best>0&&score>best;
  $("scoreboard").classList.toggle("is-record",isRecord);
  $("recordSeal").hidden=!isRecord;
  $("rankPill").textContent=ranks.filter(([min])=>score>=min).pop()[1];
  $("best").textContent=points(Math.max(best,score));
  $("linesCount").textContent=points(board().lines);
  showGoal(score,best,isRecord);
  showScore(score,gained);
  clearTimeout(deltaTimer);
  const delta=$("scoreDelta");delta.hidden=!gained;
  if (gained) {
    delta.textContent="+"+points(gained);
    delta.style.animation="none";void delta.offsetWidth;delta.style.animation="";
    deltaTimer=setTimeout(()=>{delta.hidden=true;},1400);
  }
}
function render(msg=defaultHelp,{added=[],gained=0}={}){
  cancelGesture();clearParked();
  selected=null;previewIndex=-1;
  boardEl.classList.remove("aiming");
  renderBoard(added);renderTray();updateScoreboard(gained);
  $("boardTitle").textContent=state.size+"×"+state.size+" 놀이판";
  document.querySelectorAll("[data-size]").forEach(btn=>btn.setAttribute("aria-pressed",String(+btn.dataset.size===state.size)));
  const streak=board().streak||0;
  $("streakBadge").hidden=streak<2;$("streakBadge").textContent=streak+"연속 완성!";
  say(session().finishedAt?"":msg);
}
function select(idx){
  if (session().finishedAt || !board().hand[idx]) return;
  clearParked();
  selected=idx;showSelection();preview(-1);
  say(nameOf(board().hand[idx])+" 조각이에요. 가운데 흰 점이 놓일 칸을 눌러 주세요.");
}
function commit(index){
  if (session().finishedAt || selected===null || index<0) return;
  const b=board(),[r,c]=placementOrigin(index),g=session();
  if (!Puzzle.fits(b,b.hand[selected],r,c)) {
    park(index);return;
  }
  const result=Puzzle.place(b,selected,r,c);
  const ended=finishIfStuck();
  save();focusIndex=index;
  const pts="(+"+points(result.gained)+"점) 다음 조각을 골라 주세요.";
  render(result.count?result.count+"줄 완성! "+pts:"잘 놓았어요. "+pts,{added:result.added,gained:result.gained});
  if(ended){Effects.clear();showScores();}
  else if(result.count)Effects.playClear(result,b.n,{record:g.best>0&&b.score>g.best,face:Portraits.heroFace()});
}
function gridMetrics(){
  const n=board().n, first=cellAt(0).getBoundingClientRect();
  const last=cellAt(n*n-1).getBoundingClientRect();
  return {first,stepX:(last.left-first.left)/(n-1),stepY:(last.top-first.top)/(n-1)};
}
function indexAt(x,y,{first,stepX,stepY}){
  const col=Math.round((x-first.left-first.width/2)/stepX);
  const row=Math.round((y-first.top-first.height/2)/stepY);
  return finiteSpot(row,col)?row*board().n+col:-1;
}
function cancelGesture(){
  const g=gesture;
  if (!g) return;
  gesture=null;
  if (g.target.hasPointerCapture(g.id)) g.target.releasePointerCapture(g.id);
  g.ghost?.remove();
  if (parked) positionParked(parked.index);
}
function start(ev,target,type){
  if (gesture||!ev.isPrimary||ev.button!==0) return false;
  gesture={type,id:ev.pointerId,target,x:ev.clientX,y:ev.clientY,ghost:null};
  target.setPointerCapture(ev.pointerId);return true;
}
tray.addEventListener("pointerdown",ev=>{
  const btn=ev.target.closest(".slot");
  if (btn&&!btn.disabled&&start(ev,btn,"tray"))select(+btn.dataset.slot);
});
boardFrame.addEventListener("pointerdown",ev=>{
  if (selected===null) return;
  const regrab=parked && ev.target.closest(".parked-piece");
  if (!start(ev,boardFrame,regrab?"parked":"board")) return;
  hideParkToast();
  if (regrab) {
    const rect=parked.shape.getBoundingClientRect();
    gesture.grabX=ev.clientX-rect.left;
    gesture.grabY=ev.clientY-rect.top;
  } else {
    if (parked) parked.shape.hidden=true;
    preview(indexAt(ev.clientX,ev.clientY,gridMetrics()));
  }
});
function gestureIndex(g,ev){
  const grid=gridMetrics(), {first,stepX,stepY}=grid;
  const x=ev.clientX,y=ev.clientY;
  if (!g.ghost && Math.hypot(x-g.x,y-g.y)<8) {
    if (g.type==="parked") return parked.index;
    return g.type==="board"?indexAt(x,y,grid):-1;
  }
  const piece=board().hand[selected];
  if (!g.ghost) {
    g.ghost=shapeView(piece);
    g.ghost.classList.add("drag-piece");
    document.body.append(g.ghost);
    if (parked) parked.shape.hidden=true;
    say("점선을 보고 손을 떼세요. 금빛 테두리가 비치는 줄은 놓자마자 지워져요!");
  }
  const {width,height}=Puzzle.shapeSizes[piece.shape];
  const [anchorRow,anchorCol]=Puzzle.shapeAnchors[piece.shape];
  const anchorX=first.width/2+anchorCol*stepX, anchorY=first.height/2+anchorRow*stepY;
  const w=first.width+(width-1)*stepX, h=first.height+(height-1)*stepY;
  const touch=ev.pointerType==="touch";
  const lift=Math.max(18,stepY*0.5);
  let left=x-anchorX,top=y-anchorY;
  // On the board, keep the originally grabbed tile under the same part of the finger.
  if (g.type==="parked") {
    left=x-g.grabX;top=y-g.grabY;
  } else if (touch && g.type==="tray") {
    left=x-w/2;top=y-h-lift;
  }
  // A small lifted copy keeps a direct board drag visible above the thumb.
  const liftedCopy=touch && g.type!=="tray";
  const style=g.ghost.style;
  style.setProperty("--unit",first.width+"px");
  style.gap=(stepY-first.height)+"px "+(stepX-first.width)+"px";
  style.left=(liftedCopy?x-w/2:left)+"px";
  style.top=(liftedCopy?y-h-lift:top)+"px";
  g.ghost.classList.toggle("lifted-copy",liftedCopy);
  const index=indexAt(left+anchorX,top+anchorY,grid);
  if (liftedCopy && g.type==="parked") positionParked(index,false);
  return index;
}
document.addEventListener("pointermove",ev=>{
  const g=gesture;if (!g||g.id!==ev.pointerId) return;
  if (!ev.buttons) {interrupt();return;}
  preview(gestureIndex(g,ev));
});
document.addEventListener("pointerup",ev=>{
  const g=gesture;if (!g||g.id!==ev.pointerId)return;
  let idx=gestureIndex(g,ev);
  // A tap on any tile of the waiting piece still names that exact board cell.
  if (g.type==="parked"&&!g.ghost) idx=indexAt(ev.clientX,ev.clientY,gridMetrics());
  cancelGesture();
  if (g.type==="tray"&&!g.ghost) return;
  if(idx<0){
    preview(parked?.index??-1);
    say(parked?parkedHelp:"조각을 놓지 않았어요. 다시 자리를 골라 주세요.");return;
  }
  commit(idx);
});
function interrupt(){
  if (!gesture) return;
  cancelGesture();preview(parked?.index??-1);say(parked?parkedHelp:"조각을 다시 놓아 주세요.");
}
document.addEventListener("pointercancel",ev=>{if (gesture?.id===ev.pointerId) interrupt();});
window.addEventListener("blur",interrupt);
tray.addEventListener("click",ev=>{
  const btn=ev.target.closest(".slot");
  if (ev.detail===0&&btn&&!btn.disabled)select(+btn.dataset.slot);
});
boardEl.addEventListener("click",ev=>{
  const el=ev.target.closest(".cell");
  if (!el) return;
  if (ev.detail===0) commit(+el.dataset.index);
  else if (selected===null&&el.isConnected&&!session().finishedAt) say("먼저 아래에서 놓을 조각을 골라 주세요.");
});
boardEl.addEventListener("focusin",ev=>{
  if(!ev.target.matches(".cell"))return;
  const next=+ev.target.dataset.index;
  boardEl.querySelector('[tabindex="0"]')?.setAttribute("tabindex","-1");
  ev.target.tabIndex=0;focusIndex=next;
  if (!gesture && selected!==null) preview(next);
});
boardEl.addEventListener("keydown",ev=>{
  const n=state.size,r=Math.floor(focusIndex/n),c=focusIndex%n;
  if(ev.key==="Enter"||ev.key===" "){
    ev.preventDefault();commit(focusIndex);if(!scoresDialog.open)boardEl.querySelector('[tabindex="0"]').focus();return;
  }
  const dir={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[ev.key];
  if(!dir)return;
  ev.preventDefault();if(!finiteSpot(r+dir[0],c+dir[1]))return;
  const next=(r+dir[0])*n+c+dir[1];boardEl.querySelector('[data-index="'+next+'"]').focus();
});
document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&!panel.open&&!scoresDialog.open){cancelGesture();clearParked();selected=null;showSelection();preview(-1);say(defaultHelp);}});
if (playableSizes.length>1) {
  $("sizes").hidden=false;
  for (const n of playableSizes) {
    const button=document.createElement("button");
    button.dataset.size=n;
    button.textContent=n+"×"+n;
    button.onclick=()=>{
      if (state.size===n)return;
      cancelGesture();Effects.clear();state.size=n;focusIndex=0;save();resumeGame();
    };
    $("sizes").append(button);
  }
}
$("scoresBtn").onclick=showScores;
$("closeScores").onclick=()=>scoresDialog.close();
scoresDialog.addEventListener("cancel",ev=>{if(session().finishedAt)ev.preventDefault();});
$("playAgain").onclick=restart;
function dialog(title,content){
  interrupt();$("panelTitle").textContent=title;$("panelBody").innerHTML=content;
  panel.setAttribute("aria-labelledby","panelTitle");
  if (!panel.open)panel.showModal();
}
$("closeBtn").onclick=()=>panel.close();
$("photoBtn").onclick=()=>Portraits.openAlbum();
$("helpBtn").onclick=()=>dialog("놀이 방법",`<ol>
  <li>아래 조각 세 개 중 하나를 골라요. 색은 달라도 괜찮아요.</li>
  <li><b>눌러 놓기</b>는 조각을 누른 뒤, 조각 가운데의 흰 점을 놓고 싶은 칸을 눌러요.</li>
  <li><b>끌어 놓기</b>는 조각을 판으로 끌고 가서 점선 위치에 손을 떼요. 휴대폰에서는 엄지 위에 조각이 보여요. 완성될 줄은 금빛 테두리로 표시돼요.</li>
  <li>놓을 수 없는 자리에서 손을 떼면 노란 줄무늬 조각이 칸에서 살짝 비껴 떠 있어요. 다시 잡아 옮기거나 놓을 칸을 눌러 주세요.</li>
  <li>가로나 세로 한 줄이 차면 사라져요. 놓은 칸마다 1점이고, 한 번에 지운 줄에 따라 <b>1줄 +10점, 2줄 +30점, 3줄 +60점</b>을 더 받아요. 연달아 지우면 보너스 점수도 붙어요.</li></ol><p>키보드는 Tab으로 조각과 판을 찾고 방향키와 Enter로 놓을 수 있어요.</p><button class="primary" data-do="close">놀이로 돌아가기</button>`);
function pause(){dialog("잠깐 쉬기",`<p>현재 점수는 <b>${points(board().score)}점</b>이에요. 같은 기기와 브라우저에서 두던 판을 이어 할 수 있어요.</p><p>${navigator.serviceWorker?.controller?"오프라인 준비가 끝났어요.":"온라인에서 게임을 이용하고 있어요."}</p><div class="stack"><button class="primary" data-do="close">이어 하기</button><button data-do="new">새 판 시작</button></div>`);}
$("pauseBtn").onclick=pause;
function confirmNew(){dialog("새 판을 시작할까요?",`<p>지금 판의 점수는 점수판에 남지 않아요.</p><div class="stack"><button class="primary" data-do="restart">새 판 시작</button><button data-do="close">계속하기</button></div>`);}
function restart(){
  const g=session();
  g.best=Math.max(g.best,g.board.score);
  g.board=Puzzle.fresh(state.size,(Math.random()*4294967296)>>>0);
  g.finishedAt=null;
  Effects.clear();
  if(scoresDialog.open)scoresDialog.close();
  if(panel.open)panel.close();
  focusIndex=0;save();render("새 판이에요. 아래 조각부터 골라 보세요.");
  tray.querySelector(".slot").focus({preventScroll:true});
}
// A drag can suppress the browser's next synthetic click. Finish a deliberate
// single-finger button tap on release, while leaving scroll and pinch alone.
let buttonTouch=null;
document.addEventListener("touchstart",ev=>{
  const button=ev.target.closest("button:not(.slot)");
  const t=ev.changedTouches[0];
  buttonTouch=ev.touches.length===1 && button && !button.disabled
    ? {button,id:t.identifier,x:t.clientX,y:t.clientY} : null;
},{passive:true});
document.addEventListener("touchmove",ev=>{
  if(!buttonTouch)return;
  const t=ev.touches[0];
  if(ev.touches.length!==1 || Math.hypot(t.clientX-buttonTouch.x,t.clientY-buttonTouch.y)>12)buttonTouch=null;
},{passive:true});
document.addEventListener("touchcancel",()=>{buttonTouch=null;});
document.addEventListener("touchend",ev=>{
  const tap=buttonTouch,t=ev.changedTouches[0];buttonTouch=null;
  if(!tap || !ev.cancelable || t.identifier!==tap.id || ev.touches.length)return;
  if(!tap.button.contains(document.elementFromPoint(t.clientX,t.clientY)))return;
  ev.preventDefault();
  tap.button.focus({preventScroll:true});
  tap.button.click();
},{passive:false});
$("panelBody").onclick=ev=>{
  const btn=ev.target.closest("button");if(!btn)return;
  if(btn.dataset.do==="close")panel.close();
  if(btn.dataset.do==="new")confirmNew();
  if(btn.dataset.do==="restart")restart();
};
resumeGame();
if("serviceWorker" in navigator && window.isSecureContext && location.protocol!=="file:"){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
