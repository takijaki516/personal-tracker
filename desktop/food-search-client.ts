import type { FoodSearchResponse } from '../src/domain/food-search';
import {
  FATSECRET_ORIGIN,
  FATSECRET_SEARCH_PATH,
  parseFatSecretSearchHtml,
} from '../src/infrastructure/fatsecret-parser';
import { FoodSearchError, readFoodSearchQuery } from '../src/infrastructure/food-search-error';

export const MAX_FOOD_SEARCH_HTML_BYTES = 1_000_000;

async function readHtml(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new FoodSearchError('invalid-page', 'FatSecret 검색 페이지의 내용이 비어 있습니다.');
  }
  const decoder = new TextDecoder();
  let html = '';
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        return html + decoder.decode();
      }
      size += value.byteLength;
      if (size > MAX_FOOD_SEARCH_HTML_BYTES) {
        await reader.cancel();
        throw new FoodSearchError(
          'response-too-large',
          'FatSecret 검색 페이지가 크기 제한을 초과했습니다.',
        );
      }
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export function createFatSecretSearch(fetchPage: typeof fetch = fetch) {
  return async (value: unknown, signal?: AbortSignal): Promise<FoodSearchResponse> => {
    const query = readFoodSearchQuery(value);
    signal?.throwIfAborted();
    const url = new URL(FATSECRET_SEARCH_PATH, FATSECRET_ORIGIN);
    url.searchParams.set('q', query);
    try {
      const response = await fetchPage(url, {
        headers: {
          Accept: 'text/html',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        redirect: 'error',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
          : AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new FoodSearchError(
          'upstream-http',
          `FatSecret 검색 요청이 실패했습니다. (HTTP ${response.status})`,
        );
      }
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
        await response.body?.cancel();
        throw new FoodSearchError('invalid-page', 'FatSecret 응답이 HTML 페이지가 아닙니다.');
      }
      return {
        query,
        sourceUrl: url.href,
        foods: parseFatSecretSearchHtml(await readHtml(response)),
      };
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof FoodSearchError) {
        throw error;
      }
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
        throw new FoodSearchError('upstream-timeout', 'FatSecret 검색 요청 시간이 초과되었습니다.');
      }
      throw new FoodSearchError('upstream-network', 'FatSecret 검색 페이지에 연결하지 못했습니다.');
    }
  };
}
