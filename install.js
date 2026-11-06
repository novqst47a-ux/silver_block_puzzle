"use strict";

(() => {
  const button=document.getElementById("installBtn");
  const standalone=matchMedia("(display-mode: standalone)");
  let pending=null;
  let installed=false;

  function updateButton(){
    button.hidden=installed || standalone.matches || navigator.standalone===true;
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
    const appleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
    let steps;
    if(appleMobile){
      steps="<li>Safari에서 이 게임을 열고 <b>공유</b>를 누르세요.</li><li><b>홈 화면에 추가</b>를 고르세요.</li><li>‘웹 앱으로 열기’가 보이면 켜고 <b>추가</b>를 누르세요.</li>";
    }else if(/Android/.test(navigator.userAgent)){
      steps="<li>Chrome에서 이 게임을 열고 오른쪽 위 <b>⋮</b> 메뉴를 누르세요.</li><li><b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 선택하세요.</li><li>화면에 뜬 <b>설치</b> 또는 <b>추가</b>를 누르세요.</li>";
    }else{
      steps="<li>Chrome이나 Edge에서 이 게임을 여세요.</li><li>주소창의 <b>설치 아이콘</b>을 누르거나 브라우저 메뉴에서 앱 설치를 선택하세요.</li>";
    }
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
