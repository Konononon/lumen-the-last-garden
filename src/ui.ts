import {lore,moths} from './simulation.mjs';

const icons={
  journal:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-3-2H4zM22 4h-6a3 3 0 0 0-3 3v14a4 4 0 0 1 3-2h6z"/>',
  map:'<path d="m3 6 7-3 6 3 7-3v17l-7 3-6-3-7 3zM10 3v17M16 6v17"/>',
  sound:'<path d="M11 4 5 9H2v8h3l6 5zM16 8a7 7 0 0 1 0 10M20 4a12 12 0 0 1 0 18"/>',
  mute:'<path d="M11 4 5 9H2v8h3l6 5zM17 10l6 8M23 10l-6 8"/>',
  menu:'<path d="M4 7h18M4 13h18M4 19h18"/>',
  fullscreen:'<path d="M3 9V3h6M17 3h6v6M23 17v6h-6M9 23H3v-6"/>',
  close:'<path d="m6 6 14 14M20 6 6 20"/>',
  star:'<path d="m13 2 3.5 7.5L24 13l-7.5 3.5L13 24l-3.5-7.5L2 13l7.5-3.5z"/>'
};
const icon=(name:keyof typeof icons)=>`<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[name]}</svg>`;
const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
type Actions={start:(fresh:boolean)=>void;pause:()=>void;mute:()=>boolean;quality:(v:string)=>void;restart:()=>void;pulse:()=>void;interact:()=>void;movement:(key:string,down:boolean)=>void;photo:()=>void};

export class GameUI {
  root=document.querySelector<HTMLElement>('#interface')!;
  modal=false;
  mode='intro';
  state:any;
  actions:Actions;
  toastTimer=0;
  hudTimer=0;
  currentModal='';
  previousFocus:HTMLElement|null=null;
  photo=false;
  constructor(actions:Actions,state:any,hasSave:boolean){
    this.actions=actions;this.state=state;
    this.root.innerHTML=`
      <section id="intro" class="intro" aria-label="Lumen 시작 화면">
        <div class="intro-shade"></div><div class="edition"><span class="tiny-star">✧</span> 작은 세계에 남은 커다란 이야기</div>
        <div class="intro-copy"><div class="title-ornament">✧</div><h1>LUMEN</h1><p class="subtitle">마지막 달빛 정원</p><div class="fine-line"></div>
        <p class="intro-story">누군가를 기다리던 정원에<br>당신의 작은 등불이 도착했습니다.</p>
        <button id="start" class="primary"><span>${hasSave?'이어 탐험하기':'정원으로 들어가기'}</span><span class="button-star">✧</span></button>
        ${hasSave?'<button id="new-game" class="text-button">새로운 이야기 시작</button>':''}
        <div class="intro-footnote">걷고, 귀 기울이고, 잊힌 빛을 찾아보세요.</div></div>
        <div class="intro-bottom"><span>세 개의 별빛. 하나의 오래된 약속.</span><span>헤드폰과 함께하면 더 깊이 들립니다</span></div>
      </section>
      <section id="hud" class="hud hidden" aria-label="탐험 정보">
        <div class="quest"><div class="brand-small">LUMEN <span>마지막 달빛 정원</span></div><div class="quest-body"><span class="quest-symbol">✧</span><div><div id="objective">세 개의 별빛을 되찾으세요</div><div class="shards" id="shards"></div></div></div></div>
        <nav class="tools" aria-label="정원 도구"><button data-open="journal" class="icon-button" aria-label="기록장 J" title="기록장 [J]">${icon('journal')}</button><button data-open="map" class="icon-button" aria-label="지도 M" title="지도 [M]">${icon('map')}</button><button id="sound" class="icon-button" aria-label="소리 끄기" title="소리">${icon('sound')}</button><button data-open="pause" class="icon-button" aria-label="메뉴 Escape" title="메뉴 [Esc]">${icon('menu')}</button></nav>
        <div class="region"><div class="region-line"></div><span id="region-name">기다림의 입구</span><small id="region-detail">달빛이 길을 기억하는 곳</small></div>
        <button id="interaction" class="interaction hidden"><kbd>E</kbd><span id="interaction-name"></span><span class="interaction-arrow">✧</span></button>
        <div class="controls-hint"><span><kbd>W A S D</kbd> 이동</span><span>드래그 시점 · 휠 확대</span><span><kbd>Q</kbd> 등불 <kbd>F</kbd> 감상</span></div>
        <div class="mobile-controls"><div class="dpad"><button data-move="KeyW" aria-label="앞으로">↑</button><button data-move="KeyA" aria-label="왼쪽">←</button><button data-move="KeyS" aria-label="뒤로">↓</button><button data-move="KeyD" aria-label="오른쪽">→</button></div><button id="mobile-pulse" aria-label="등불 파동">✧</button></div>
      </section>
      <button id="intro-sound" class="intro-sound icon-button" aria-label="소리 켜기">${icon('sound')}</button>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
      <div id="modal-root"></div>
      <div id="photo-hint" class="photo-hint hidden">감상 모드 · 드래그로 시점 회전 · 휠로 확대 · F로 돌아가기</div>
    `;
    document.querySelector('#start')!.addEventListener('click',()=>actions.start(!hasSave));document.querySelector('#new-game')?.addEventListener('click',()=>actions.start(true));
    this.root.querySelectorAll<HTMLElement>('[data-open]').forEach(el=>el.addEventListener('click',()=>this.open(el.dataset.open!)));
    for(const id of ['sound','intro-sound'])document.querySelector('#'+id)!.addEventListener('click',()=>this.setSound(actions.mute()));
    document.querySelector('#interaction')!.addEventListener('click',()=>actions.interact());document.querySelector('#mobile-pulse')!.addEventListener('click',()=>actions.pulse());
    this.root.querySelectorAll<HTMLElement>('[data-move]').forEach(el=>{el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);actions.movement(el.dataset.move!,true);});el.addEventListener('pointerup',()=>actions.movement(el.dataset.move!,false));el.addEventListener('pointercancel',()=>actions.movement(el.dataset.move!,false));});
    document.querySelector('#start')?.setAttribute('autofocus','');
    document.addEventListener('keydown',e=>{if(!this.modal)return;if(e.code==='Escape'){e.preventDefault();this.close();}if(e.code==='Tab'){const elements=Array.from(document.querySelectorAll<HTMLElement>('#modal-root button, #modal-root select')).filter(el=>!el.hasAttribute('disabled'));if(!elements.length)return;const i=elements.indexOf(document.activeElement as HTMLElement);const n=(i+(e.shiftKey?-1:1)+elements.length)%elements.length;e.preventDefault();elements[n].focus();}});
  }
  play(){this.mode='playing';document.querySelector('#intro')!.classList.add('hidden');document.querySelector('#intro-sound')!.classList.add('hidden');document.querySelector('#hud')!.classList.remove('hidden');this.toast('等불이 도착했습니다. 정원지기 이오에게 말을 걸어 보세요.'.replace('等','등'),5500);}
  setSound(muted:boolean){for(const id of ['sound','intro-sound']){const el=document.querySelector('#'+id)!;el.innerHTML=icon(muted?'mute':'sound');el.setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');}const btn=document.querySelector('#modal-mute');if(btn)btn.textContent=muted?'소리 켜기':'소리 끄기';}
  toast(text:string,duration=3400){const el=document.querySelector<HTMLElement>('#toast')!;el.textContent=text;el.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>el.classList.remove('visible'),duration);}
  showDialog(title:string,body:string){this.show(`<div class="dialog-emblem">✧</div><p class="panel-caption">정원에서 발견한 이야기</p><h2>${escape(title)}</h2><div class="dialog-text"><p>${escape(body).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</p></div><button class="primary" data-close>기억해 두기 <span>✧</span></button>`,'dialog');}
  show(content:string,type:string){
    this.currentModal=type;this.modal=true;this.actions.pause();this.previousFocus=document.activeElement as HTMLElement;
    document.querySelector('#modal-root')!.innerHTML=`<div class="modal-backdrop"><section class="panel ${type}-panel" role="dialog" aria-modal="true" aria-label="${type==='map'?'정원 지도':type==='journal'?'여행 기록장':'정원 이야기'}"><button class="panel-close icon-button" data-close aria-label="닫기">${icon('close')}</button>${content}</section></div>`;
    document.querySelectorAll('[data-close]').forEach(e=>e.addEventListener('click',()=>this.close()));
    document.querySelector('.modal-backdrop')!.addEventListener('click',e=>{if(e.target===e.currentTarget)this.close();});
    (document.querySelector('#modal-root [data-close]') as HTMLElement)?.focus();
  }
  close(){if(!this.modal)return;this.modal=false;this.currentModal='';document.querySelector('#modal-root')!.innerHTML='';this.actions.pause();this.previousFocus?.focus();}
  open(type:string){
    if(this.modal){this.close();return;}
    if(type==='journal'){
      const count=this.state.shards.filter(Boolean).length;
      this.show(`<p class="panel-caption">당신의 발소리를 기억하는 정원</p><h2>여행 기록장</h2><div class="journal-summary"><span>별빛 <b>${count}/3</b></span><span>기록 <b>${this.state.memories.length}/6</b></span><span>빛나비 <b>${this.state.moths.length}/${moths.length}</b></span></div><div class="journal-quest"><h3>${this.state.finished?'다시 찾아온 봄':'오래된 약속'}</h3><p>${this.state.finished?'정원의 세 가지 기억을 되찾았습니다. 남은 기록과 빛나비를 찾아 천천히 걸어보세요.':'바람의 종, 별빛 거울, 기억의 우물에서 빛을 모아 북쪽 달의 문으로 가져가세요. 각 장소의 작은 기록석에 단서가 있습니다.'}</p></div><div class="entries">${Object.entries(lore).map(([id,entry])=>`<article class="entry ${this.state.memories.includes(id)?'':'unread'}"><span class="entry-symbol">${this.state.memories.includes(id)?'✧':'·'}</span><div><h3>${this.state.memories.includes(id)?escape(entry.title):'아직 발견하지 않은 기록'}</h3>${this.state.memories.includes(id)?`<p>${escape(entry.body).replace(/\n/g,'<br>')}</p>`:'<p>등불을 들고 정원의 작은 기록석을 찾아보세요.</p>'}</div></article>`).join('')}</div>`,'journal');
    }else if(type==='map'){
      const px=(this.state.position.x+25)*8,py=(this.state.position.z+25)*8;
      this.show(`<p class="panel-caption">달빛으로 그린 작은 세계</p><h2>정원 지도</h2><div class="map-wrap"><svg viewBox="0 0 400 400" role="img" aria-label="북쪽 달의 문, 서쪽 바람의 종, 동쪽 별빛 거울, 남서쪽 기억의 우물 지도"><defs><radialGradient id="mapland"><stop stop-color="#4c6b60"/><stop offset="1" stop-color="#2d4947"/></radialGradient></defs><path d="M205 19C300 13 359 72 379 145S365 310 306 365 121 382 51 309 8 156 52 82 129 21 205 19" fill="url(#mapland)" stroke="#9ba484" stroke-width="1"/><path d="M205 14Q179 61 210 108T211 206 209 286 190 382" stroke="#83b9ad" fill="none" stroke-width="19" opacity=".5"/><path d="M200 356 200 320 160 272 104 280M160 272 128 224 88 152 128 96 200 64M200 320 260 296 312 248 312 152 264 80 200 64M200 64 211 128 312 152" fill="none" stroke="#c2b58b" stroke-width="2" stroke-dasharray="4 3" opacity=".7"/><g stroke="#d7c397" stroke-width="5"><path d="M192 295h42M194 128h42"/></g><g fill="#dab79d" opacity=".4">${Array.from({length:28},(_,i)=>`<circle cx="${200+Math.cos(i*2.4)*(142+(i%4)*8)}" cy="${200+Math.sin(i*2.4)*(141+(i%3)*9)}" r="${7+i%4*2}"/>`).join('')}</g><g class="map-label"><text x="200" y="46" text-anchor="middle">달의 문</text><text x="88" y="132" text-anchor="middle">바람의 종</text><text x="312" y="132" text-anchor="middle">별빛 거울</text><text x="104" y="306" text-anchor="middle">기억의 우물</text><text x="200" y="382" text-anchor="middle">기다림의 입구</text></g><g fill="#f3db9f">${[[88,152],[312,152],[104,280]].map(([x,y],i)=>`<path d="m${x} ${y-8} 3 5 5 3-5 3-3 5-3-5-5-3 5-3z" opacity="${this.state.shards[i]?1:.3}"/>`).join('')}</g><circle cx="${px}" cy="${py}" r="5" fill="#fbe9c3" stroke="#142f35" stroke-width="2"/><circle cx="${px}" cy="${py}" r="10" fill="none" stroke="#fbe9c3" opacity=".4"/><g class="map-compass"><path d="m365 20 4 14-4 14-4-14z" fill="#e8d6ae"/><text x="365" y="15" text-anchor="middle">N</text></g></svg></div><p class="map-note">밝은 점은 당신의 위치입니다. 물길은 두 개의 다리로 건널 수 있어요.</p>`,'map');
    }else{
      this.show(`<p class="panel-caption">잠시 등불을 내려놓고</p><h2>정원의 쉼표</h2><div class="pause-controls"><div><kbd>W A S D / 방향키</kbd><span>걷기</span></div><div><kbd>Shift</kbd><span>달리기</span></div><div><kbd>E / 클릭</kbd><span>가까운 대상과 상호작용</span></div><div><kbd>Q</kbd><span>등불의 파동 · 숨은 빛나비 찾기</span></div><div><kbd>드래그 / 휠</kbd><span>시점 회전 / 거리 조절</span></div><div><kbd>J / M / F</kbd><span>기록장 / 지도 / 감상 모드</span></div></div><label class="setting">화면 품질<select id="quality"><option value="standard">균형</option><option value="high">선명하게</option><option value="low">가볍게</option></select></label><div class="pause-options"><button id="modal-mute" class="text-button">소리 켜기 / 끄기</button><button id="fullscreen" class="text-button">전체 화면</button><button id="photo" class="text-button">감상 모드</button></div><button data-close class="primary">다시 걷기 <span>✧</span></button><button id="restart" class="text-button restart">이야기 처음부터 시작</button><p class="save-note">당신의 여정은 자동으로 기록됩니다.</p>`,'pause');
      const select=document.querySelector<HTMLSelectElement>('#quality')!;select.value=localStorage.getItem('lumen-quality')??'standard';select.addEventListener('change',()=>this.actions.quality(select.value));
      document.querySelector('#modal-mute')!.addEventListener('click',()=>this.setSound(this.actions.mute()));
      document.querySelector('#fullscreen')!.addEventListener('click',()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>this.toast('전체 화면은 브라우저 메뉴에서도 열 수 있습니다.'));});
      document.querySelector('#photo')!.addEventListener('click',()=>{this.close();this.actions.photo();});
      document.querySelector('#restart')!.addEventListener('click',()=>{this.show('<p class="panel-caption">새로운 첫걸음</p><h2>다시 시작할까요?</h2><p class="dialog-text">현재 별빛, 기록, 빛나비 수집과 위치가 초기화됩니다.</p><button id="confirm-restart" class="primary">처음부터 시작 <span>✧</span></button><button data-close class="text-button">현재 여정 계속하기</button>','dialog');document.querySelector('#confirm-restart')!.addEventListener('click',()=>{this.close();this.actions.restart();});});
    }
  }
  ending(){this.show(`<div class="ending-stars">✧ ✦ ✧</div><p class="panel-caption">당신이 되찾은 것은</p><h2>또 한 번의 봄</h2><div class="dialog-text">바람에 노래가 돌아오고,<br>물 위에 별이 내려앉았습니다.<br><br>누군가를 기다리던 정원은<br>이제 당신의 발소리를 기억합니다.</div><div class="ending-stats"><span>별빛 <b>3/3</b></span><span>기록 <b>${this.state.memories.length}/6</b></span><span>빛나비 <b>${this.state.moths.length}/6</b></span></div><button class="primary" data-close>정원에 머물기 <span>✧</span></button>`,'ending');}
  setPhoto(on:boolean){this.photo=on;document.querySelector('#hud')!.classList.toggle('hidden',on);document.querySelector('#photo-hint')!.classList.toggle('hidden',!on);document.querySelector('#toast')!.classList.remove('visible');}
  update(state:any,near:any,dt:number){
    this.state=state;this.hudTimer+=dt;if(this.hudTimer<.15)return;this.hudTimer=0;
    document.querySelector('#objective')!.textContent=state.finished?'봄이 돌아온 정원을 탐험하세요':state.shards.every(Boolean)?'북쪽 달의 문에 별빛을 놓으세요':'세 개의 별빛을 되찾으세요';
    const shardHtml=['바람','거울','우물'].map((name,i)=>`<span class="${state.shards[i]?'collected':''}"><span>✧</span> ${name}</span>`).join('');const el=document.querySelector('#shards')!;if(el.innerHTML!==shardHtml)el.innerHTML=shardHtml;
    const button=document.querySelector('#interaction')!;button.classList.toggle('hidden',!near||this.modal||this.photo);if(near)document.querySelector('#interaction-name')!.textContent=near.name;
    const {x,z}=state.position;let region='기다림의 입구',detail='달빛이 길을 기억하는 곳';if(z<-12){region='잠든 천문 정원';detail='오래된 약속이 별이 되는 곳';}else if(x<-7&&z<1){region='바람의 회랑';detail='꽃, 달, 그리고 별의 노래';}else if(x>8&&z<3){region='별빛 관측소';detail='빛을 잇는 세 개의 거울';}else if(x<-7){region='기억의 우물';detail='물 아래에 남겨진 속삭임';}else if(x>5){region='꽃잎 산책로';detail='작은 편지가 기다리는 길';}document.querySelector('#region-name')!.textContent=region;document.querySelector('#region-detail')!.textContent=detail;
  }
}
