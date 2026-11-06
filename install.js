"use strict";

(() => {
  const android=navigator.userAgentData?.platform==="Android" || /Android/i.test(navigator.userAgent);
  if(!android)return;
  const button=document.getElementById("installBtn");
  const standalone=matchMedia("(display-mode: standalone)");
  let pending=null;
  let installed=false;

  function updateButton(){
    button.hidden=installed || standalone.matches;
  }
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    pending=event;
    updateButton();
  });
  window.addEventListener("appinstalled",()=>{
    installed=true;
    pending=null;
    updateButton();
  });
  standalone.addEventListener("change",updateButton);

  function showSteps(){
    const steps="<li>Chrome에서 이 게임을 열고 오른쪽 위 <b>⋮</b> 메뉴를 누르세요.</li><li><b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 선택하세요.</li><li>화면에 뜬 <b>설치</b> 또는 <b>추가</b>를 누르세요.</li>";
    dialog("앱 설치","<ol>"+steps+"</ol><button class='primary' data-do='close'>놀이로 돌아가기</button>");
  }
  button.onclick=async()=>{
    if(!pending){showSteps();return;}
    const request=pending;
    pending=null;
    button.disabled=true;
    try{
      await request.prompt();
      await request.userChoice;
    }catch{showSteps();}
    finally{button.disabled=false;}
  };
  updateButton();
})();
