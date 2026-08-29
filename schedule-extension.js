(function(){
  'use strict';

  function pad2(n){return String(n).padStart(2,'0');}
  function esc2(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function hideEl(id){var e=document.getElementById(id);if(e)e.classList.add('hidden');}
  function showEl(id){var e=document.getElementById(id);if(e)e.classList.remove('hidden');}
  var shiftYm=null, shiftData=null, shiftSelected=[];

  function injectStyle(){
    var st=document.createElement('style');
    st.textContent='\
      .nav-row{grid-template-columns:1fr 1fr!important;}\
      .holiday-notice{background:#fff4e5;color:#9a5b00;border:1px solid #f4d39b;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:14px;font-weight:700;line-height:1.55;}\
      .holiday-notice small{display:block;font-size:11px;font-weight:400;margin-top:3px;color:#9a6d2d;}\
      .shift-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;}\
      .shift-head button{background:#eaf2fd;border:1px solid #c5dcfa;color:#2c7be5;border-radius:9px;padding:8px 13px;font-size:17px;font-weight:bold;}\
      .shift-head .ym{font-size:17px;font-weight:800;}\
      .shift-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}\
      .shift-stat{background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:10px;text-align:center;}\
      .shift-stat .k{font-size:10px;color:#8a94a6;font-weight:700}.shift-stat .v{font-size:20px;font-weight:800;margin-top:2px;}\
      .shift-status{background:#fff;border:1px solid #e6e9ee;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:13px;}\
      .shift-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}\
      .shift-week{font-size:11px;text-align:center;color:#7b8797;font-weight:700;padding:5px 0;}\
      .shift-day{min-height:62px;background:#fff;border:1px solid #e4e8ee;border-radius:10px;padding:6px;position:relative;text-align:left;cursor:pointer;}\
      .shift-day.blank{visibility:hidden}.shift-day .n{font-size:14px;font-weight:800}.shift-day .tag{display:block;font-size:9px;margin-top:5px;line-height:1.25;color:#8a94a6;}\
      .shift-day.sun,.shift-day.holiday{background:#fff3f4;border-color:#f3d5d9}.shift-day.sun .n,.shift-day.holiday .n{color:#d64555}.shift-day.sat .n{color:#2c7be5;}\
      .shift-day.selected{background:#eaf2fd;border:2px solid #2c7be5}.shift-day.selected .tag{color:#2c7be5;font-weight:800}.shift-day:disabled{cursor:default;opacity:1;}\
      .shift-submit{width:100%;margin-top:14px;padding:14px;border:none;border-radius:11px;background:#2c7be5;color:#fff;font-size:16px;font-weight:800}.shift-submit:disabled{background:#b7c0cf}.shift-help{font-size:11px;color:#8a94a6;line-height:1.6;margin:10px 2px;}\
    ';
    document.head.appendChild(st);
  }

  function injectUi(){
    var nav=document.querySelector('#mobilePunchView .nav-row');
    if(nav && !document.getElementById('shiftNavBtn')){
      var b=document.createElement('button');b.className='nav-btn';b.id='shiftNavBtn';b.innerHTML='🗓 シフト';b.onclick=openShiftPage;nav.insertBefore(b,nav.children[1]||null);
    }
    function addNotice(parentId,id,resultId){
      if(document.getElementById(id))return;
      var result=document.getElementById(resultId);if(!result)return;
      var div=document.createElement('div');div.id=id;div.className='holiday-notice hidden';result.parentNode.insertBefore(div,result.nextSibling);
    }
    addNotice('kioskPunchView','kioskHolidayNotice','kioskResult');
    addNotice('mobilePunchView','mobileHolidayNotice','mobileResult');

    if(!document.getElementById('shiftView')){
      var div=document.createElement('div');div.id='shiftView';div.className='punch-view hidden';
      div.innerHTML='<div class="p-inner">'+
        '<button class="back-btn" id="shiftBackBtn">← 打刻へもどる</button>'+
        '<div class="shift-head"><button id="shiftPrevBtn">‹</button><div class="ym" id="shiftYmLabel">----</div><button id="shiftNextBtn">›</button></div>'+
        '<div id="shiftSummary" class="shift-summary"></div><div id="shiftStatus" class="shift-status">読み込み中…</div>'+
        '<div id="shiftCalendar" class="shift-calendar"></div><div id="shiftHelp" class="shift-help"></div>'+
        '<div id="shiftResult" class="result hidden"></div><button id="shiftSubmitBtn" class="shift-submit">翌月シフトを申請する</button></div>';
      document.body.appendChild(div);
      document.getElementById('shiftBackBtn').onclick=function(){if(typeof window.backToMobile==='function')window.backToMobile();};
      document.getElementById('shiftPrevBtn').onclick=function(){shiftShiftYm(-1);};
      document.getElementById('shiftNextBtn').onclick=function(){shiftShiftYm(1);};
      document.getElementById('shiftSubmitBtn').onclick=submitShiftRequestUI;
    }
  }

  function renderWorkPlanNotice(plan,id){
    var el=document.getElementById(id);if(!el)return;
    if(!plan||!plan.isHoliday){el.classList.add('hidden');el.innerHTML='';return;}
    var label=plan.holidayType?'（'+esc2(plan.holidayType)+'）':'';
    el.innerHTML='⚠ 本日は休日です'+label+'<small>勤務する場合はそのまま打刻できます。休日出勤として勤怠集計時に判定します。</small>';el.classList.remove('hidden');
  }
  function loadTodayWorkPlan(staffId,id){
    window.google.script.run.withSuccessHandler(function(p){renderWorkPlanNotice(p,id);}).withFailureHandler(function(){hideEl(id);}).getTodayWorkPlan(staffId);
  }

  function openShiftPage(){
    var n=new Date(),d=new Date(n.getFullYear(),n.getMonth()+1,1);shiftYm=shiftYm||(d.getFullYear()+'-'+pad2(d.getMonth()+1));
    if(typeof window.showOnly==='function')window.showOnly('shiftView');else showEl('shiftView');
    window.scrollTo(0,0);loadShiftPage();
  }
  function shiftShiftYm(delta){var p=(shiftYm||'').split('-'),d=new Date(Number(p[0]),Number(p[1])-1+delta,1);shiftYm=d.getFullYear()+'-'+pad2(d.getMonth()+1);loadShiftPage();}
  function loadShiftPage(){
    var label=document.getElementById('shiftYmLabel');if(label)label.textContent=(shiftYm||'').replace('-','年')+'月';
    document.getElementById('shiftCalendar').innerHTML='<div class="empty" style="grid-column:1/-1;">読み込み中…</div>';hideEl('shiftResult');
    window.google.script.run.withSuccessHandler(function(d){if(!d||!d.success){showResult((d&&d.message)||'シフトを取得できませんでした。',false);return;}shiftData=d;shiftSelected=d.request&&d.request.days?d.request.days.slice():[];renderShiftPage();}).withFailureHandler(function(){showResult('通信エラー',false);}).getShiftPortalData(window.currentAccount.staffId,shiftYm);
  }
  function showResult(msg,ok){var e=document.getElementById('shiftResult');e.textContent=(ok?'✓ ':'✗ ')+msg;e.className='result '+(ok?'ok':'ng');e.classList.remove('hidden');}
  function renderShiftPage(){
    if(!shiftData)return;var req=shiftData.request||{},required=shiftData.requiredDays;
    document.getElementById('shiftSummary').innerHTML='<div class="shift-stat"><div class="k">必要シフト休</div><div class="v">'+(required==null?'—':required)+'</div></div><div class="shift-stat"><div class="k">選択</div><div class="v">'+shiftSelected.length+'</div></div><div class="shift-stat"><div class="k">残り</div><div class="v">'+(required==null?'—':Math.max(0,required-shiftSelected.length))+'</div></div>';
    var status=req.status||'未申請',extra=(status==='差戻し'&&req.returnReason)?'<br><small>差戻理由：'+esc2(req.returnReason)+'</small>':'';
    document.getElementById('shiftStatus').innerHTML='<strong>'+esc2(status)+'</strong>'+(shiftData.deadline?'申請締切 '+esc2(shiftData.deadline):'')+extra;
    var cal=document.getElementById('shiftCalendar');cal.innerHTML='';['月','火','水','木','金','土','日'].forEach(function(w){var e=document.createElement('div');e.className='shift-week';e.textContent=w;cal.appendChild(e);});
    var rows=shiftData.calendar||[];if(rows.length){var p=rows[0].date.split('/'),first=new Date(Number(p[0]),Number(p[1])-1,1),blanks=(first.getDay()+6)%7;for(var b=0;b<blanks;b++){var z=document.createElement('div');z.className='shift-day blank';cal.appendChild(z);}}
    rows.forEach(function(day){var sel=shiftSelected.indexOf(day.date)>=0,btn=document.createElement('button');btn.type='button';btn.className='shift-day'+(day.weekday==='日'?' sun':'')+(day.weekday==='土'?' sat':'')+(day.holiday?' holiday':'')+(sel?' selected':'');btn.disabled=!!day.holiday||!shiftData.editable;var tag=sel?'シフト休':(day.holiday?(day.holidayType||'休日'):'勤務日');btn.innerHTML='<span class="n">'+day.day+'</span><span class="tag">'+esc2(tag)+'</span>';btn.onclick=function(){toggleShiftDay(day.date);};cal.appendChild(btn);});
    document.getElementById('shiftHelp').textContent=required==null?'管理者がこの月の必要シフト休数をまだ設定していません。':(shiftData.editable?'日曜・祝日・会社休日以外からシフト休を選択してください。必要日数と一致すると申請できます。':'承認済み・申請中の月、または翌月以外は閲覧のみです。');
    var submit=document.getElementById('shiftSubmitBtn');submit.classList.toggle('hidden',!shiftData.editable);submit.disabled=required==null||shiftSelected.length!==Number(required||0);
  }
  function toggleShiftDay(date){if(!shiftData||!shiftData.editable)return;var i=shiftSelected.indexOf(date);if(i>=0)shiftSelected.splice(i,1);else shiftSelected.push(date);shiftSelected.sort();renderShiftPage();}
  function submitShiftRequestUI(){
    if(!shiftData||!shiftData.editable)return;var btn=document.getElementById('shiftSubmitBtn');btn.disabled=true;btn.textContent='申請中…';
    window.google.script.run.withSuccessHandler(function(r){btn.textContent='翌月シフトを申請する';if(r&&r.success){showResult(r.message,true);loadShiftPage();}else{showResult((r&&r.message)||'申請できませんでした。',false);renderShiftPage();}}).withFailureHandler(function(){btn.textContent='翌月シフトを申請する';showResult('通信エラー',false);renderShiftPage();}).submitShiftRequest({accountId:window.currentAccount.id,staffId:window.currentAccount.staffId,ym:shiftYm,days:shiftSelected});
  }

  window.openShiftPage=openShiftPage;

  window.addEventListener('load',function(){
    injectStyle();injectUi();
    if(typeof window.showOnly==='function'){
      var originalShowOnly=window.showOnly;window.showOnly=function(id){if(id!=='shiftView')hideEl('shiftView');originalShowOnly(id);};
    }
    if(typeof window.openKioskPunch==='function'){
      var originalKiosk=window.openKioskPunch;window.openKioskPunch=function(staff){originalKiosk(staff);if(staff&&staff.id)loadTodayWorkPlan(staff.id,'kioskHolidayNotice');};
    }
    if(typeof window.enterMobile==='function'){
      var originalMobile=window.enterMobile;window.enterMobile=function(staffId){originalMobile(staffId);if(staffId)loadTodayWorkPlan(staffId,'mobileHolidayNotice');};
    }
  });
})();
