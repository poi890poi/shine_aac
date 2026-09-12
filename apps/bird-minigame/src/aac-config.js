import { DEFAULT_GAME_CONFIG } from './game-core.js';

// Hosts pass their active, already-normalized AAC session.config here. The game
// never reads private AAC storage and never changes communication settings.
export function gameConfigFromAac(aacConfig,physics={}) {
  const columns=aacConfig?.columns??physics.columns??DEFAULT_GAME_CONFIG.columns;
  if(!Number.isInteger(columns)||columns<3||columns>8)throw new RangeError('AAC columns must be an integer from 3 to 8.');
  const config={...physics,columns};
  if(aacConfig?.scanIntervalMs!==undefined) {
    const interval=aacConfig.scanIntervalMs/1000;
    const first=(aacConfig.firstCellPauseMs??aacConfig.scanIntervalMs)/1000;
    if(!(Number.isFinite(interval)&&interval>0&&Number.isFinite(first)&&first>0))throw new RangeError('AAC scan timings must be positive');
    const inset=config.approachInset??DEFAULT_GAME_CONFIG.approachInset;
    const pitch=(1-inset)/columns,firstCenter=inset+pitch/2;
    // At the fastest level, visible approach and centre-to-centre travel each
    // allow at least the configured first-cell and ordinary scan durations.
    const velocity=Math.min(pitch/interval,firstCenter/first);
    config.passSeconds=Math.max(config.passSeconds??DEFAULT_GAME_CONFIG.passSeconds,1.22/velocity);
    config.inactivitySeconds=Math.max(config.inactivitySeconds??DEFAULT_GAME_CONFIG.inactivitySeconds,config.passSeconds/0.6*2);
  }
  return config;
}
