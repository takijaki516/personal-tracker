import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const checks = ['format:check', 'lint'];

export function runQualityChecks(root, stopHookActive, run = spawnSync) {
  const failures = [];
  for (const check of checks) {
    const result = run('npm', ['run', check], {
      cwd: root,
      encoding: 'utf8',
      timeout: 45000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' },
    });
    if (result.status !== 0 || result.error) {
      const output = [result.error?.message, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n');
      failures.push(
        `npm run ${check} 실패 (exit ${result.status ?? 'unknown'}):\n${output.slice(-6000)}`,
      );
    }
  }
  if (failures.length === 0) {
    return {};
  }

  const reason = [
    '최종 Oxfmt/Oxlint 검사가 실패했습니다. 진단을 확인하고 수정한 뒤 npm run format:check와 npm run lint를 다시 실행하세요.',
    '기존 사용자 변경을 되돌리거나 규칙을 비활성화해서 통과시키지 마세요. 환경 문제 또는 요청 범위 밖의 문제라면 원인을 사용자에게 보고하세요.',
    ...failures,
  ].join('\n\n');

  // Recheck after the repair turn, but do not create an endless continuation loop.
  if (stopHookActive) {
    return {
      systemMessage: `${reason}\n\n자동 재시도 후에도 실패했습니다. 완료 또는 검사 통과로 보고하지 말고 남은 실패를 설명하세요.`,
    };
  }
  return { decision: 'block', reason };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const event = JSON.parse(readFileSync(0, 'utf8'));
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major !== 24 || minor < 3) {
      throw new Error(
        `Node 24.3 이상, 25 미만이 필요합니다. 현재: ${process.version}. nvm use를 실행하세요.`,
      );
    }
    process.stdout.write(
      `${JSON.stringify(runQualityChecks(projectRoot, event.stop_hook_active === true))}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ systemMessage: `Codex 종료 검사 실행 실패: ${String(error)}. 검사 통과로 보고하지 말고 환경 문제를 해결한 뒤 npm run format:check와 npm run lint를 실행하세요.` })}\n`,
    );
  }
}
