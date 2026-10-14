import type { GameRecord } from '@can-i-run-it/domain';
import { ISSUE_REPOSITORY, reportIssueUrl } from './report-issue';

const game: GameRecord = {
  appid: 292030,
  name: 'The Witcher 3',
  slug: 'the-witcher-3',
  source: 'steam',
  updatedAt: '2026-10-14',
  requirements: {
    minimum: {
      cpu: { raw: [], ids: [] },
      gpu: { raw: [], ids: [] },
      raw: { graphics: 'GeForce GTX 1660' },
    },
  },
};

describe('reportIssueUrl', () => {
  it('is hidden until a repository is configured, then pre-fills the published requirements', () => {
    const url = reportIssueUrl(game);
    if (!ISSUE_REPOSITORY) {
      expect(url).toBeUndefined();
      return;
    }
    const params = new URL(url as string).searchParams;
    expect(params.get('title')).toBe('Data error: The Witcher 3');
    expect(params.get('body')).toContain('Steam app 292030');
    expect(params.get('body')).toContain('graphics: GeForce GTX 1660');
  });
});
