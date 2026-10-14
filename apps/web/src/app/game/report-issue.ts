import type { GameRecord } from '@can-i-run-it/domain';

/** "owner/name" of the GitHub repository that takes data error reports; empty hides the button. */
export const ISSUE_REPOSITORY = 'OzawaKyo/can-i-run-it';

/**
 * A link that opens a pre-filled GitHub issue about a game's data. It carries only the game
 * and the requirements as published, never the user's own configuration.
 */
export function reportIssueUrl(game: GameRecord): string | undefined {
  if (!ISSUE_REPOSITORY) return undefined;
  const lines = [
    `Game: ${game.name} (Steam app ${game.appid})`,
    `Data updated: ${game.updatedAt}`,
    '',
    '**What is wrong?**',
    '',
    '',
    '**Requirements as published**',
    ...(['minimum', 'recommended'] as const).flatMap((tier) => {
      const raw = game.requirements[tier]?.raw;
      return raw
        ? [`- ${tier}:`, ...Object.entries(raw).map(([label, text]) => `  - ${label}: ${text}`)]
        : [];
    }),
  ];
  const params = new URLSearchParams({
    title: `Data error: ${game.name}`,
    body: lines.join('\n'),
    labels: 'data',
  });
  return `https://github.com/${ISSUE_REPOSITORY}/issues/new?${params}`;
}
