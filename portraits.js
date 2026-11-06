"use strict";

// The album is independent from game saves: undo never duplicates image bytes.
const Portraits = (() => {
  const key=gameStorageKey("hanjul-album","1");
  const limit=Puzzle.shapes.length;
  const defaults=()=>({photos:[],assignments:{}});
  const center={x:50,y:50,zoom:1};
  function read(){
    const raw=localStorage.getItem(key);
    if (!raw)return defaults();
    const data=JSON.parse(raw);
    if (!Array.isArray(data.photos)||!data.assignments)throw Error("사진첩을 열 수 없어요.");
    return data;
  }
  let album;
  try{album=read();}catch{album=defaults();}
  function change(edit){
    const next=read();
    edit(next);
    localStorage.setItem(key,JSON.stringify(next));
    album=next;
  }
  function forShape(shape){
    const photos=album.photos;
    if(!photos.length)return null;
    return photos.find(p=>p.id===album.assignments[shape]) || photos[shape%photos.length];
  }
  function image(src){
    const el=new Image();
    el.alt="";el.draggable=false;el.src=src;
    return el;
  }
  function decorate(el,shape){
    const photo=forShape(shape);
    if(!photo)return;
    const img=image(photo.thumb);
    img.className="face";el.append(img);
  }
  function cropSide(source,view){
    return Math.min(source.naturalWidth,source.naturalHeight)/view.zoom;
  }
  function drawCrop(canvas,source,view){
    const side=cropSide(source,view);
    const x=(source.naturalWidth-side)*view.x/100,y=(source.naturalHeight-side)*view.y/100;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#fffaf0";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(source,x,y,side,side,0,0,canvas.width,canvas.height);
  }
  function enableCropPan(preview,source,view){
    let drag=null;
    function pan(dx,dy){
      const side=cropSide(source,view);
      // Convert movement on the displayed canvas to the saved crop percentages.
      function shift(percent,delta,dimension,displaySize){
        const room=dimension-side;
        if(room<=0)return percent;
        return Math.max(0,Math.min(100,percent-delta*side*100/(displaySize*room)));
      }
      view.x=shift(view.x,dx,source.naturalWidth,preview.clientWidth);
      view.y=shift(view.y,dy,source.naturalHeight,preview.clientHeight);
      drawCrop(preview,source,view);
    }
    preview.onpointerdown=ev=>{
      if(!ev.isPrimary || ev.button!==0 || drag)return;
      drag={id:ev.pointerId,x:ev.clientX,y:ev.clientY};
      preview.setPointerCapture(ev.pointerId);
      preview.classList.add("dragging");
    };
    preview.onpointermove=ev=>{
      if(drag?.id!==ev.pointerId)return;
      pan(ev.clientX-drag.x,ev.clientY-drag.y);
      drag.x=ev.clientX;drag.y=ev.clientY;
    };
    preview.onlostpointercapture=()=>{
      drag=null;
      preview.classList.remove("dragging");
    };
    const steps={ArrowLeft:[-6,0],ArrowRight:[6,0],ArrowUp:[0,-6],ArrowDown:[0,6]};
    preview.onkeydown=ev=>{
      const step=steps[ev.key];
      if(!step)return;
      ev.preventDefault();pan(...step);
    };
  }
  function canvas(w,h=w){
    const el=document.createElement("canvas");
    el.width=w;el.height=h;return el;
  }
  async function prepare(file){
    const url=URL.createObjectURL(file);
    try{
      const original=image(url);await original.decode();
      const factor=Math.min(1,640/Math.max(original.naturalWidth,original.naturalHeight));
      const small=canvas(Math.max(1,Math.round(original.naturalWidth*factor)),Math.max(1,Math.round(original.naturalHeight*factor)));
      const ctx=small.getContext("2d");
      ctx.fillStyle="#fffaf0";ctx.fillRect(0,0,small.width,small.height);
      ctx.drawImage(original,0,0,small.width,small.height);
      const thumb=canvas(192);drawCrop(thumb,original,center);
      const id=Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
      return {id,source:small.toDataURL("image/jpeg",.74),thumb:thumb.toDataURL("image/jpeg",.83),view:{...center}};
    }finally{URL.revokeObjectURL(url);}
  }
  function button(label,click){
    const el=document.createElement("button");el.type="button";el.textContent=label;el.onclick=click;return el;
  }
  let busy=false;
  function status(text){
    const el=document.getElementById("albumStatus");
    if(el)el.textContent=text;
  }
  function saveError(){status("사진을 저장하지 못했어요. 브라우저의 저장 공간을 확인해 주세요.");}
  function refreshGame(){
    cancelGesture();render();
  }
  async function addFiles(files){
    if(busy||!files.length)return;
    if(files.length>limit-album.photos.length){status("빈자리는 "+(limit-album.photos.length)+"개예요. 그만큼만 골라 주세요.");return;}
    busy=true;
    const picker=document.getElementById("photoFiles");picker.disabled=true;
    status("사진을 준비하고 있어요.");
    try{
      const incoming=[];
      for(const file of files)incoming.push(await prepare(file));
      change(data=>{
        if(data.photos.length+incoming.length>limit)throw Error();
        data.photos.push(...incoming);
      });
      refreshGame();
      if(panel.open && document.getElementById("photoFiles"))openAlbum("사진을 담았어요. 놓을 조각에 골고루 보여요.");
    }catch{status("사진을 담지 못했어요. JPG·PNG 사진이나 더 작은 파일로 다시 시도해 주세요.");}
    finally{busy=false;picker.disabled=false;const current=document.getElementById("photoFiles");if(current)current.disabled=false;}
  }
  function openAlbum(message=""){
    dialog("사진 꾸미기",`<p>사진 세 장만 담아도 여덟 가지 조각이 나눠 써요. 줄을 지우면 담은 사진 중 하나가 크게 나와 함께 춤춰요.</p>
      <div class="album-heading"><h3>내 사진</h3><span id="albumCount"></span></div>
      <div id="albumGrid"></div>
      <label class="fileButton">＋ 사진 담기<input id="photoFiles" type="file" accept="image/*" multiple></label>
      <p id="albumStatus" role="status"></p>
      <details id="shapeChoices"><summary>모양별 사진 고르기</summary><div id="assignmentList"></div></details>
      <p class="privacy">사진은 이 기기의 브라우저에만 저장돼요.</p>
      <button class="primary" data-do="close">놀이로 돌아가기</button>`);
    const photos=album.photos;
    $("albumCount").textContent=photos.length+" / "+limit+"장";
    const picker=$("photoFiles");picker.disabled=busy;picker.parentElement.hidden=photos.length>=limit;
    picker.onchange=()=>{const files=Array.from(picker.files);picker.value="";addFiles(files);};
    photos.forEach((p,i)=>{
      const btn=button("사진 "+(i+1),()=>editPhoto(p.id));
      btn.title="사진 "+(i+1)+" 위치 맞추기 또는 삭제";btn.prepend(image(p.thumb));$("albumGrid").append(btn);
    });
    $("shapeChoices").hidden=!photos.length;
    Puzzle.shapes.forEach(([label],shape)=>{
      const row=document.createElement("label");row.className="assignment";
      const art=shapeView({shape,color:Puzzle.colors[shape%Puzzle.colors.length]});
      const name=document.createElement("span");name.textContent=label;
      const select=document.createElement("select");
      select.add(new Option("자동 배정",""));photos.forEach((p,i)=>select.add(new Option("사진 "+(i+1),p.id)));
      select.value=album.assignments[shape]||"";
      select.onchange=()=>{
        try{
          const id=select.value;
          change(data=>{
            if(id && data.photos.some(p=>p.id===id))data.assignments[shape]=id;
            else delete data.assignments[shape];
          });
          art.querySelector(".face")?.remove();decorate(art.querySelector(".anchor"),shape);
          refreshGame();status(label+" 조각의 사진을 저장했어요.");
        }catch{select.value=album.assignments[shape]||"";saveError();}
      };
      row.append(art,name,select);$("assignmentList").append(row);
    });
    status(message);
  }
  async function editPhoto(id){
    const idx=album.photos.findIndex(p=>p.id===id),photo=album.photos[idx];
    if(!photo)return;
    dialog("사진 "+(idx+1)+" 맞추기",`<p id="cropHint">사진을 끌어 얼굴을 가운데에 놓으세요. 더 옮기려면 크기를 키워 주세요.</p>
      <canvas id="cropPreview" width="192" height="192" tabindex="0" aria-label="사진 위치, 방향키로 이동" aria-describedby="cropHint"></canvas>
      <label class="cropZoom">크기<input id="cropZoom" type="range" min="1" max="3" step="0.05" disabled></label>
      <p id="albumStatus" role="status"></p><div class="stack"><button id="cropSave" class="primary" disabled>이 모습으로 저장</button><button id="albumBack">사진첩으로</button><button id="photoDelete">사진 삭제</button></div>`);
    $("albumBack").onclick=()=>openAlbum();
    $("photoDelete").onclick=()=>{
      dialog("사진을 지울까요?",'<p>이 사진을 쓰던 조각은 남은 사진을 나눠 써요.</p><p id="albumStatus" role="status"></p><div class="stack"><button id="keepPhoto">사진 유지</button><button id="deletePhoto">이 사진 삭제</button></div>');
      $("keepPhoto").onclick=()=>editPhoto(id);
      $("deletePhoto").onclick=()=>{
        try{
          change(data=>{
            data.photos=data.photos.filter(p=>p.id!==id);
            for(const k of Object.keys(data.assignments))if(data.assignments[k]===id)delete data.assignments[k];
          });
          refreshGame();openAlbum("사진을 삭제했어요.");
        }catch{saveError();}
      };
    };
    const preview=$("cropPreview"),source=image(photo.source),view={...photo.view};
    try{await source.decode();}catch{if(preview.isConnected)status("사진을 열 수 없어요.");return;}
    if(!preview.isConnected || !panel.open)return;
    drawCrop(preview,source,view);
    enableCropPan(preview,source,view);
    const zoom=$("cropZoom");
    zoom.value=view.zoom;zoom.disabled=false;
    zoom.oninput=()=>{view.zoom=Number(zoom.value);drawCrop(preview,source,view);};
    $("cropSave").disabled=false;
    $("cropSave").onclick=()=>{
      try{
        change(data=>{const p=data.photos.find(p=>p.id===id);if(!p)throw Error();p.view=view;p.thumb=preview.toDataURL("image/jpeg",.83);});
        refreshGame();openAlbum("사진 위치를 저장했어요.");
      }catch{saveError();}
    };
  }
  let lastHero=null;
  // One random album photo for the line-clear hero. It is cropped again from the
  // larger source because the small board thumbnail blurs at this size.
  function heroFace(){
    const photos=album.photos;
    if(!photos.length)return null;
    const others=photos.filter(p=>p.id!==lastHero);
    const pool=others.length?others:photos;
    const photo=pool[Math.floor(Math.random()*pool.length)];
    lastHero=photo.id;
    const face=canvas(384),source=image(photo.source);
    source.decode().then(()=>drawCrop(face,source,photo.view)).catch(()=>{});
    return face;
  }
  return {decorate,openAlbum,heroFace};
})();
