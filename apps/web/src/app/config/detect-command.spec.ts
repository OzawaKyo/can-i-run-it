import { DETECT_COMMANDS, detectOs } from './detect-command';

describe('detectOs', () => {
  it('tells Windows and desktop Linux apart from systems without a command', () => {
    expect(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0')).toBe('windows');
    expect(detectOs('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe(
      'linux',
    );
    expect(
      detectOs('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0 Mobile'),
    ).toBeUndefined();
    expect(detectOs('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/130.0')).toBeUndefined();
    expect(
      detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/605.1.15'),
    ).toBeUndefined();
  });
});

describe('Linux command', () => {
  // Pasted in zsh or fish too, it runs through bash -c '…': any quote or doubled backslash
  // inside would end the string early or be rewritten by the user's shell.
  it('is a single bash -c string that survives any shell', () => {
    const { command } = DETECT_COMMANDS.linux;
    expect(command).toMatch(/^bash -c '[^']*'$/);
    expect(command).not.toContain('\\\\');
    expect(command).not.toContain('\n');
  });
});
