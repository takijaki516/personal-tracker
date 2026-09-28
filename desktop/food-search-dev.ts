import { startFoodSearchServer } from './food-search-start';

startFoodSearchServer(Number(process.env.FOOD_SEARCH_PORT ?? 8090))
  .then((server) => {
    const close = () => {
      server?.close();
      server?.closeAllConnections();
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`음식 조회 서버를 시작하지 못했습니다: ${message}`);
    process.exitCode = 1;
  });
