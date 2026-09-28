import { createServer, type ServerResponse } from 'node:http';
import type { FoodSearchResponse } from '../src/domain/food-search';
import { FoodSearchError, readFoodSearchQuery } from '../src/infrastructure/food-search-error';
import { createFatSecretSearch } from './food-search-client';

const developmentOrigins = new Set(['http://localhost:8081', 'http://127.0.0.1:8081']);

type Search = (query: string, signal: AbortSignal) => Promise<FoodSearchResponse>;

function reply(response: ServerResponse, status: number, body: object) {
  if (response.destroyed || response.writableEnded) {
    return;
  }
  response.writeHead(status).end(JSON.stringify(body, null, 2));
}

export function createFoodSearchServer(search: Search = createFatSecretSearch()) {
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin');
    const origin = request.headers.origin;
    if (origin && !developmentOrigins.has(origin)) {
      reply(response, 403, {
        error: {
          code: 'forbidden-origin',
          message: '허용되지 않은 웹 주소입니다.',
        },
      });
      return;
    }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
    }
    let url: URL;
    try {
      url = new URL(request.url ?? '/', 'http://127.0.0.1');
    } catch {
      reply(response, 400, {
        error: {
          code: 'invalid-url',
          message: '조회 주소를 확인해 주세요.',
        },
      });
      return;
    }
    if (!['/health', '/foods/search'].includes(url.pathname)) {
      reply(response, 404, {
        error: {
          code: 'not-found',
          message: '지원하지 않는 조회 경로입니다.',
        },
      });
      return;
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.writeHead(204).end();
      return;
    }
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET, OPTIONS');
      reply(response, 405, {
        error: {
          code: 'method-not-allowed',
          message: 'GET 요청만 지원합니다.',
        },
      });
      return;
    }
    if (url.pathname === '/health') {
      reply(response, 200, {
        ok: true,
        source: 'fatsecret-html',
      });
      return;
    }
    const controller = new AbortController();
    const cancel = () => {
      if (!response.writableEnded) {
        controller.abort();
      }
    };
    response.once('close', cancel);
    try {
      reply(
        response,
        200,
        await search(readFoodSearchQuery(url.searchParams.get('q')), controller.signal),
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      if (error instanceof FoodSearchError) {
        let status = 502;
        if (error.code === 'invalid-query') {
          status = 400;
        } else if (error.code === 'upstream-timeout') {
          status = 504;
        }
        reply(response, status, {
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        console.error('음식 조회 서버 오류:', error);
        reply(response, 500, {
          error: {
            code: 'internal-error',
            message: '음식 조회를 완료하지 못했습니다.',
          },
        });
      }
    } finally {
      response.off('close', cancel);
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxConnections = 8;
  return server;
}
