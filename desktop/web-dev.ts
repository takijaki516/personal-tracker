import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { startFoodSearchServer } from './food-search-start';

async function start() {
  const port = Number(process.env.FOOD_SEARCH_PORT ?? 8090);
  const server = await startFoodSearchServer(port);
  const expo = spawn(
    process.execPath,
    [
      resolve('node_modules/expo/bin/cli'),
      'start',
      '--web',
      '--port',
      '8081',
      ...process.argv.slice(2),
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        EXPO_PUBLIC_FOOD_SEARCH_URL: `http://127.0.0.1:${port}`,
      },
    },
  );
  function stop() {
    expo.kill('SIGTERM');
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const [code] = await once(expo, 'exit');
    process.exitCode = typeof code === 'number' ? code : 0;
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    server?.close();
    server?.closeAllConnections();
  }
}

start().catch((error: unknown) => {
  console.error('웹 개발 서버를 시작하지 못했습니다:', error);
  process.exitCode = 1;
});
