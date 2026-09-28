import { createFoodSearchServer } from './food-search-server';

async function isFoodSearchServerRunning(address: string) {
  try {
    const response = await fetch(`${address}/health`, {
      redirect: 'error',
      signal: AbortSignal.timeout(1500),
    });
    const body: unknown = await response.json();
    return (
      response.ok &&
      typeof body === 'object' &&
      body !== null &&
      'ok' in body &&
      body.ok === true &&
      'source' in body &&
      body.source === 'fatsecret-html'
    );
  } catch {
    return false;
  }
}

export async function startFoodSearchServer(port: number) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('FOOD_SEARCH_PORT는 1024~65535 범위의 정수여야 합니다.');
  }
  const server = createFoodSearchServer();
  const address = `http://127.0.0.1:${port}`;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    process.stdout.write(`FatSecret 음식 조회 서버: ${address}\n`);
    return server;
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'EADDRINUSE'
    ) {
      throw error;
    }
    if (await isFoodSearchServerRunning(address)) {
      process.stdout.write(`음식 조회 서버가 이미 실행 중입니다: ${address}\n`);
      process.stdout.write(
        '기존 서버를 사용하세요. 코드를 반영하려면 기존 터미널에서 Ctrl+C 후 다시 실행하세요.\n',
      );
      return null;
    }
    const alternativePort = port === 8090 ? 8092 : 8090;
    throw new Error(
      `127.0.0.1:${port} 포트가 사용 중이며 정상 음식 조회 서버를 확인하지 못했습니다.\n` +
        `lsof -nP -iTCP:${port} -sTCP:LISTEN 으로 사용 중인 프로세스를 확인하세요.\n` +
        `기존 서버를 종료하거나 FOOD_SEARCH_PORT=${alternativePort} npm run food-search:dev 로 다른 포트를 사용하세요.`,
    );
  }
}
