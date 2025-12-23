import { getScreenshotPath } from '../scraper';
import path from 'path';

describe('scraper helpers', () => {
  it('builds screenshot path', () => {
    const runId = '123';
    const p = getScreenshotPath(runId);
    expect(path.basename(p)).toBe('123.png');
  });
});
