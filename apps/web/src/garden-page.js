import { mountBirdGame } from '../../bird-minigame/src/embed.js';

const token = new URLSearchParams(location.hash.slice(1)).get('token');
let game;
const send = (type, detail = {}) => parent.postMessage({ channel: 'shine-bird-garden', token, type, ...detail }, '*');
window.addEventListener('message', async event => {
  const message = event.data;
  if (event.source !== parent || !token || message?.channel !== 'shine-bird-garden' || message.token !== token) return;
  if (message.type === 'init' && !game) {
    try {
      game = mountBirdGame(document.querySelector('#game-mount'), {
        getAacConfig: () => ({ columns: message.columns, scanIntervalMs:message.scanIntervalMs, firstCellPauseMs:message.firstCellPauseMs }),
        cameraStatus:message.cameraStatus,
        speciesSelection: 'random', reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        onExit: reason => send('exit', { reason }),
        onEvent: event => {
          if (event.type !== 'tick') send('state', { phase: event.state.phase, speciesId: event.speciesId,
            columns: event.state.flowers.length, ammo: event.state.ammo, speedLevel:event.state.speedLevel, event: event.type });
        }
      });
      await game.ready;
      send('ready', { speciesId: game.getBirdSpecies(), columns: game.getState().flowers.length,
        passSeconds:game.getState().config.passSeconds, speedLevel:game.getState().speedLevel });
      document.querySelector('[data-game-primary]').focus();
    } catch { send('exit', { reason: 'asset-error' }); }
  } else if (message.type === 'activate' && game) {
    if (game.getState().phase === 'paused') game.resume(); else game.activate();
  } else if (message.type === 'pause') game?.pause();
  else if(message.type==='camera-status')game?.setCameraStatus(message.cameraStatus);
});
window.addEventListener('pagehide', () => game?.destroy(), { once: true });
send('hello');
