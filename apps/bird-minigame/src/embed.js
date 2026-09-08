import { createBirdRenderer } from "./bird-renderer.js";
import { createGameState, updateGame, dropBudget } from "./game-core.js";
import { createGameAudio } from "./game-audio.js";
import { gameConfigFromAac } from './aac-config.js';
import { gameIcon } from './game-icons.js';
import {BIRD_SPECIES,createSpeciesSelection} from './bird-species.js';

export function mountBirdGame(container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError("mountBirdGame requires an HTMLElement container.");
  const speciesSelection=createSpeciesSelection(options);
  // Separate cosmetic RNG: scenery never changes which bird the host draws.
  const sceneryRandom=options.sceneryRandom??Math.random;
  const scenerySeed=()=>{const n=sceneryRandom();if(!Number.isFinite(n)||n<0||n>=1)throw new RangeError('sceneryRandom must return [0,1)');return Math.floor(n*4294967296);};
  let selectedSpecies=speciesSelection.get(),pickerPage=Math.floor(BIRD_SPECIES.indexOf(selectedSpecies)/4);
  const root = document.createElement("div");
  root.className = "bird-game";
  root.innerHTML = `
    <div class="game-hud">
      <button type="button" data-game-settings aria-label="輔助設定" aria-expanded="false">${gameIcon('settings')}</button>
      <button type="button" data-game-pause aria-label="暫停">${gameIcon('pause')}</button>
      <button type="button" data-game-exit aria-label="離開">${gameIcon('exit')}</button>
    </div>
    <div class="helper-controls" data-game-helper hidden>
      <button type="button" data-game-mode aria-label="落下模式：每趟一次">${gameIcon('flyby')}</button>
      <button type="button" data-game-speed aria-label="飛行速度：標準">${gameIcon('normal')}</button>
      <button type="button" data-game-sound aria-label="音效：開" aria-pressed="false">${gameIcon('sound')}</button>
    </div>
    <p class="sr-only" data-game-status role="status" aria-live="polite"></p>
    <div class="game-stage">
      <canvas class="game-canvas" tabindex="0" role="application"
        aria-label="藍鵲自動飛過花園。點一下或按空白鍵，落下白色便便，讓花變矮。"></canvas>
      <div class="game-overlay" data-game-overlay>
        <button type="button" data-game-primary aria-label="開始">${gameIcon('play')}</button>
        <div class="bird-picker" ${speciesSelection.mode==='random'?'hidden':''}>
        <div class="bird-choices" role="group" aria-label="選擇鳥兒">
          ${BIRD_SPECIES.map(b=>`<button type="button" data-game-bird="${b.id}" aria-label="${b.name}" aria-pressed="false" disabled><canvas aria-hidden="true"></canvas></button>`).join('')}
        </div>
        <div class="bird-pages">
          <button type="button" data-bird-previous aria-label="上一頁鳥兒"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5L8 12l7 7" fill="none" stroke="currentColor" stroke-width="3"/></svg></button>
          <div class="bird-page-dots" aria-hidden="true">${Array.from({length:Math.ceil(BIRD_SPECIES.length/4)},()=>'<span></span>').join('')}</div>
          <button type="button" data-bird-next aria-label="下一頁鳥兒"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3"/></svg></button>
        </div>
        </div>
      </div>
    </div>`;
  container.replaceChildren(root);
  const find = selector => root.querySelector(selector);
  const canvas = find("canvas"), overlay = find("[data-game-overlay]");
  const primary = find("[data-game-primary]");
  const pauseButton = find("[data-game-pause]"), exitButton = find("[data-game-exit]");
  const status = find("[data-game-status]");
  const birdChoices=[...root.querySelectorAll('[data-game-bird]')];let birdArtReady=false;
  const previousBirdPage=find('[data-bird-previous]'),nextBirdPage=find('[data-bird-next]'),pageDots=[...root.querySelectorAll('.bird-page-dots span')];
  const speed = find("[data-game-speed]"), sound = find("[data-game-sound]");
  const modeButton=find('[data-game-mode]');
  const settings = find('[data-game-settings]'), helper = find('[data-game-helper]');
  const inputTarget = options.inputTarget ?? document;
  const hostPhysics=()=>gameConfigFromAac(options.getAacConfig?.()??options.aacConfig,options.physics);
  let state = createGameState(hostPhysics());
  let destroyed = false, frame = 0, previous = performance.now(), muted = Boolean(options.muted);
  speed.value = String(state.config.passSeconds);
  modeButton.value=state.config.dropMode;
  const audio = createGameAudio(); audio.setMuted(muted);
  const renderer = createBirdRenderer(canvas, {
    species:selectedSpecies.id,
    columns: state.config.columns,
    pixelStyle: options.pixelStyle,
    featherDynamics: options.featherDynamics,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  });
  const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  const setIcon=(element,name)=>{if(element.dataset.icon!==name){element.innerHTML=gameIcon(name);element.dataset.icon=name;}};
  function sync() {
    const messages = {
      ready: selectedSpecies.name+"會自己飛。你只需要選擇落下的時機。", paused: "已暫停", landing: "花都變矮了，準備降落！",
      won: "安全降落！", exited: "遊戲已結束"
    };
    setText(status, messages[state.phase] ?? (state.mode === "rescue" ? "碰到高花了，保留進度再試一次。" :
      state.mode === "guided" ? "停在這裡等你。點一下，讓這朵花變矮。" :
      state.mode === "entry" ? "第 " + state.pass + " 趟 · "+selectedSpecies.name+"從左邊飛來" : "第 " + state.pass + " 趟 · 對準花朵，點一下"));
    overlay.hidden = !["ready", "won", "exited"].includes(state.phase);
    setIcon(primary,state.phase==='ready'?'play':'replay');
    primary.setAttribute('aria-label',state.phase==='ready'?'開始':'再玩一次');
    setIcon(pauseButton,state.phase==='paused'?'play':'pause');
    pauseButton.setAttribute('aria-label',state.phase==='paused'?'繼續':'暫停');
    pauseButton.disabled = !["running", "paused", "landing"].includes(state.phase);
    root.dataset.phase=state.phase;
    const budget=dropBudget(state);
    canvas.setAttribute('aria-label',state.config.dropMode==='recharge'?`剩餘 ${budget.available} 次，最多 ${budget.capacity} 次，每 ${state.config.refillSeconds} 秒補充一次。點按畫面或使用開關落下。`:budget.available?'點按畫面或使用開關，落下一次便便。':'本趟已落下，下趟再試。');
    speed.disabled = !["ready", "won", "exited"].includes(state.phase);
    modeButton.disabled=speed.disabled;
    for(const [index,button] of birdChoices.entries()){button.hidden=Math.floor(index/4)!==pickerPage;button.disabled=!birdArtReady||speed.disabled;button.setAttribute('aria-pressed',String(button.dataset.gameBird===selectedSpecies.id));}
    previousBirdPage.disabled=pickerPage===0||speed.disabled;nextBirdPage.disabled=pickerPage===pageDots.length-1||speed.disabled;
    pageDots.forEach((dot,i)=>dot.classList.toggle('active',i===pickerPage));
    root.dataset.species=selectedSpecies.id;root.dataset.speciesSelection=speciesSelection.mode;
    setIcon(modeButton,modeButton.value);
    modeButton.setAttribute('aria-label',modeButton.value==='flyby'?'落下模式：每趟一次':'落下模式：定時補充');
    setIcon(sound,muted?'muted':'sound');sound.setAttribute('aria-label',muted?'音效：關':'音效：開');sound.setAttribute('aria-pressed',String(muted));
    setIcon(speed,Number(speed.value)===8?'slow':Number(speed.value)===4?'fast':'normal');
    speed.setAttribute('aria-label',`飛行速度：${Number(speed.value)===8?'慢速':Number(speed.value)===4?'快速':'標準'}`);
  }
  function dispatch(action) {
    if (destroyed) return state;
    const result = updateGame(state, action); state = result.state;
    for (const event of result.events) {
      if (["pause", "exit", "reset"].includes(event.type)) audio.stop();
      else audio.play(event.type);
      const detail = { ...event, state, speciesId:selectedSpecies.id };
      root.dispatchEvent(new CustomEvent("birdgame:" + event.type, { detail }));
      options.onEvent?.(detail);
      if (event.type === "exit") options.onExit?.(event.reason);
    }
    sync(); return state;
  }
  function activate() { audio.unlock(); if(['ready','won','exited'].includes(state.phase)){start();return;} dispatch({ type: "DROP" }); }
  function start() {
    renderer.setScenerySeed(scenerySeed());
    selectedSpecies=speciesSelection.beginRound();renderer.setSpecies(selectedSpecies.id);
    audio.unlock();
    state = createGameState({ ...hostPhysics(), passSeconds: Number(speed.value),dropMode:modeButton.value });
    helper.hidden=true;settings.setAttribute('aria-expanded','false');
    dispatch({ type: "START" }); canvas.focus({ preventScroll: true });
  }
  function togglePause() { dispatch({ type: state.phase === "paused" ? "RESUME" : "PAUSE" }); }
  function exit(reason = "helper") { dispatch({ type: "EXIT", reason }); }
  function onKey(event) {
    if (event.code === "Escape") { exit(); return; }
    if (event.repeat || !["Space", "Enter"].includes(event.code)) return;
    // Native helper controls retain keyboard behavior instead of dropping through them.
    if (root.contains(event.target) && event.target !== canvas) return;
    event.preventDefault(); event.stopPropagation(); activate();
  }
  const onExternal = event => { event.preventDefault(); event.stopPropagation(); activate(); };
  const onPointer = event => { event.preventDefault(); activate(); };
  const onHidden = () => { if (document.hidden) exit("background"); };
  const onPageHide = () => exit("background");
  const onExit = () => exit();
  const onSound = () => { muted = !muted; audio.setMuted(muted); sync(); };
  const onSettings=()=>{helper.hidden=!helper.hidden;settings.setAttribute('aria-expanded',String(!helper.hidden));};
  const onSpeed=()=>{const values=[8,6,4];speed.value=String(values[(values.indexOf(Number(speed.value))+1)%3]);sync();};
  const onMode=()=>{
    if(modeButton.disabled)return;
    modeButton.value=modeButton.value==='flyby'?'recharge':'flyby';
    state=createGameState({...hostPhysics(),passSeconds:Number(speed.value),dropMode:modeButton.value});sync();
  };
  function setBirdSpecies(id){
    if(!['ready','won','exited'].includes(state.phase))throw new Error('Choose a bird between rounds');
    selectedSpecies=speciesSelection.choose(id);pickerPage=Math.floor(BIRD_SPECIES.indexOf(selectedSpecies)/4);renderer.setSpecies(id);sync();return selectedSpecies.id;
  }
  const onPreviousBirdPage=()=>{if(!previousBirdPage.disabled){pickerPage--;sync();}};
  const onNextBirdPage=()=>{if(!nextBirdPage.disabled){pickerPage++;sync();}};
  previousBirdPage.addEventListener('click',onPreviousBirdPage);nextBirdPage.addEventListener('click',onNextBirdPage);
  const onBird=event=>setBirdSpecies(event.currentTarget.dataset.gameBird);
  for(const button of birdChoices)button.addEventListener('click',onBird);
  primary.addEventListener("click", start);
  canvas.addEventListener("pointerdown", onPointer);
  pauseButton.addEventListener("click", togglePause);
  exitButton.addEventListener("click", onExit);
  sound.addEventListener("click", onSound);
  settings.addEventListener('click',onSettings);speed.addEventListener('click',onSpeed);
  modeButton.addEventListener('click',onMode);
  inputTarget.addEventListener("keydown", onKey);
  inputTarget.addEventListener("shine-aac:activate", onExternal);
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", onPageHide);
  function loop(now) {
    if (destroyed) return;
    dispatch({ type: "TICK", seconds: (now - previous) / 1000 }); previous = now;
    renderer.render(state); frame = requestAnimationFrame(loop);
  }
  sync(); frame = requestAnimationFrame(loop);
  renderer.ready.then(()=>{if(destroyed)return;for(const button of birdChoices)renderer.paintChoice(button.querySelector('canvas'),button.dataset.gameBird);birdArtReady=true;sync();},()=>{});
  renderer.ready.catch(() => {
    dispatch({ type: "EXIT", reason: "asset-error" });
    setText(status,'圖像載入失敗，請重新整理。');setIcon(primary,'error');primary.setAttribute('aria-label','圖像載入失敗，請重新整理');primary.disabled = true;
  });
  return {
    ready: renderer.ready, start, activate, exit,
    pause: () => dispatch({ type: "PAUSE" }), resume: () => dispatch({ type: "RESUME" }),
    reset: () => { state=createGameState({...hostPhysics(),passSeconds:Number(speed.value),dropMode:modeButton.value});return dispatch({ type: "RESET" }); }, getState: () => state,
    setPixelStyle: style => renderer.setStyle(style),
    setBirdSpecies,getBirdSpecies:()=>selectedSpecies.id,
    getSpeciesSelection:()=>speciesSelection.mode,
    getScenery:()=>renderer.getScenery(),
    destroy() {
      destroyed = true; cancelAnimationFrame(frame); audio.destroy();renderer.destroy();
      primary.removeEventListener("click", start);
      canvas.removeEventListener("pointerdown", onPointer); pauseButton.removeEventListener("click", togglePause);
      exitButton.removeEventListener("click", onExit); sound.removeEventListener("click", onSound);
      settings.removeEventListener('click',onSettings);speed.removeEventListener('click',onSpeed);
      modeButton.removeEventListener('click',onMode);
      for(const button of birdChoices)button.removeEventListener('click',onBird);
      previousBirdPage.removeEventListener('click',onPreviousBirdPage);nextBirdPage.removeEventListener('click',onNextBirdPage);
      inputTarget.removeEventListener("keydown", onKey); inputTarget.removeEventListener("shine-aac:activate", onExternal);
      document.removeEventListener("visibilitychange", onHidden); window.removeEventListener("pagehide", onPageHide);
      root.remove();
    }
  };
}
