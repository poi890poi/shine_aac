import { DEFAULT_GAME_CONFIG } from './game-core.js';

// Hosts pass their active, already-normalized AAC session.config here. The game
// never reads private AAC storage and never changes communication settings.
export function gameConfigFromAac(aacConfig,physics={}) {
  const columns=aacConfig?.columns??physics.columns??DEFAULT_GAME_CONFIG.columns;
  if(!Number.isInteger(columns)||columns<3||columns>8)throw new RangeError('AAC columns must be an integer from 3 to 8.');
  return {...physics,columns};
}
