import { Game } from './Game';

let game: Game | null = null;
let pending: Promise<Game> | null = null;

/** The single Game instance shared by the React UI. */
export function getGame(): Game | null {
  return game;
}

export function createGame(container: HTMLElement): Promise<Game> {
  if (pending) return pending;
  pending = (async () => {
    const g = new Game(container);
    await g.init();
    game = g;
    (window as unknown as { worldcruise: unknown }).worldcruise = g;
    return g;
  })();
  return pending;
}
