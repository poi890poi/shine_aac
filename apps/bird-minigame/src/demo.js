import { mountBirdGame } from "./embed.js";
import { registerBirdGameTools } from "./webmcp.js";

const mount = document.querySelector("#game-mount");
const game = mountBirdGame(mount, {
  aacConfig: { columns: Number(new URLSearchParams(location.search).get('columns')??4) },
  physics: {dropMode:new URLSearchParams(location.search).get('dropMode')??'flyby'},
  onEvent(event) {
    document.body.dataset.gameResult = event.state.phase;
  }
});

window.birdGame = game;
const unregisterTools = registerBirdGameTools(game);
window.addEventListener("pagehide", unregisterTools, { once: true });
