import { describe, expect, it } from 'vitest';
import { runQualityChecks } from './codex-stop-check.mjs';

function runner(results) {
  const calls = [];
  return {
    calls,
    run(command, args, options) {
      calls.push({
        command,
        args,
        cwd: options.cwd,
      });
      return results[calls.length - 1];
    },
  };
}

const passed = {
  status: 0,
  stdout: 'ok',
  stderr: '',
};
const failed = {
  status: 1,
  stdout: 'diagnostic',
  stderr: 'failure detail',
};

describe('Codex Stop quality checks', () => {
  it('allows completion only after both commands succeed in the project root', () => {
    const commands = runner([passed, passed]);
    expect(runQualityChecks('/project', false, commands.run)).toEqual({});
    expect(commands.calls).toEqual([
      {
        command: 'npm',
        args: ['run', 'format:check'],
        cwd: '/project',
      },
      {
        command: 'npm',
        args: ['run', 'lint'],
        cwd: '/project',
      },
    ]);
  });

  it('runs lint even when formatting fails and reports both failures', () => {
    const commands = runner([failed, failed]);
    const result = runQualityChecks('/project', false, commands.run);
    expect(commands.calls).toHaveLength(2);
    expect(result.decision).toBe('block');
    expect(result.reason).toContain('npm run format:check 실패');
    expect(result.reason).toContain('npm run lint 실패');
    expect(result.reason).toContain('failure detail');
  });

  it('blocks completion for lint violations after formatting succeeds', () => {
    const commands = runner([passed, failed]);
    expect(runQualityChecks('/project', false, commands.run).decision).toBe('block');
  });

  it('reports unavailable commands and timeouts as failures', () => {
    const commands = runner([
      {
        status: null,
        error: new Error('spawn npm ENOENT'),
      },
      {
        status: null,
        error: new Error('ETIMEDOUT'),
      },
    ]);
    const result = runQualityChecks('/project', false, commands.run);
    expect(result.decision).toBe('block');
    expect(result.reason).toContain('ENOENT');
    expect(result.reason).toContain('ETIMEDOUT');
  });

  it('rechecks a repair turn and reports failure without an infinite continuation loop', () => {
    const commands = runner([passed, failed]);
    const result = runQualityChecks('/project', true, commands.run);
    expect(commands.calls).toHaveLength(2);
    expect(result.decision).toBeUndefined();
    expect(result.systemMessage).toContain('자동 재시도 후에도 실패');
    expect(result.systemMessage).toContain('npm run lint 실패');
  });

  it('allows a successful repair turn to complete', () => {
    const commands = runner([passed, passed]);
    expect(runQualityChecks('/project', true, commands.run)).toEqual({});
  });
});
