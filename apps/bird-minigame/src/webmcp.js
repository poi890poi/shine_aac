function snapshot(game) {
  const state = game.getState();
  return {
    phase: state.phase,
    score: state.score,
    flowersRemaining: state.flowers.filter(flower => flower.height > 0).length,
    pass: state.pass
  };
}

export function registerBirdGameTools(game, context = document.modelContext) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  const registrations = [
    context.registerTool(
      {
        name: "activate_bird_game",
        title: "落下便便",
        description: "Start the garden if ready, otherwise release one white dropping. Flight is automatic.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) {
            throw new TypeError("activate_bird_game accepts an empty object.");
          }
          game.activate();
          return snapshot(game);
        }
      },
      options
    ),
    context.registerTool(
      {
        name: "restart_bird_game",
        title: "重新開始",
        description: "Reset the flowers and start a new automatic fly-by garden round.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) {
            throw new TypeError("restart_bird_game accepts an empty object.");
          }
          game.start();
          return snapshot(game);
        }
      },
      options
    )
  ];
  for (const registration of registrations) {
    void Promise.resolve(registration).catch((error) => {
      console.warn("Bird game tool registration failed.", error);
    });
  }
  return () => lifecycle.abort();
}
