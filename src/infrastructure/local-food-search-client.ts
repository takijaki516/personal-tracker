import { readFoodSearchResponse, type FoodSearchResponse } from '../domain/food-search';
import { readFoodSearchQuery } from './food-search-error';

const connectionError = '음식 조회 서버에 연결할 수 없어요. 개발 서버를 다시 실행해 주세요.';

export type LookupFetch = (url: string, init: RequestInit) => Promise<Response>;

function serverErrorMessage(value: unknown, status: number): string {
  if (status === 504) {
    return 'FatSecret 검색 시간이 초과됐어요. 다시 검색해 주세요.';
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'object' &&
    value.error !== null &&
    'code' in value.error &&
    value.error.code === 'invalid-page'
  ) {
    return 'FatSecret 페이지에서 음식 정보를 읽지 못했어요. 잠시 후 다시 검색해 주세요.';
  }
  return 'FatSecret 음식을 조회하지 못했어요. 잠시 후 다시 검색해 주세요.';
}

export function createLocalFoodSearch(baseUrl: string, fetchLookup: LookupFetch = fetch) {
  return async (value: string, signal: AbortSignal): Promise<FoodSearchResponse> => {
    const query = readFoodSearchQuery(value);
    signal.throwIfAborted();
    const url = new URL('/foods/search', baseUrl);
    url.searchParams.set('q', query);
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timeout = setTimeout(abort, 12000);
    signal.addEventListener('abort', abort, { once: true });
    try {
      let response: Response;
      try {
        response = await fetchLookup(url.href, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw error;
        }
        throw new Error(connectionError);
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error('음식 검색 응답을 읽지 못했어요. 다시 검색해 주세요.');
      }
      if (!response.ok) {
        throw new Error(serverErrorMessage(body, response.status));
      }
      return readFoodSearchResponse(body, query);
    } catch (error) {
      signal.throwIfAborted();
      if (controller.signal.aborted) {
        throw new Error('FatSecret 검색 시간이 초과됐어요. 다시 검색해 주세요.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  };
}
