export type FoodSearchErrorCode =
  | 'invalid-query'
  | 'invalid-page'
  | 'upstream-http'
  | 'upstream-network'
  | 'upstream-timeout'
  | 'response-too-large';

export class FoodSearchError extends Error {
  constructor(
    readonly code: FoodSearchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FoodSearchError';
  }
}

export function readFoodSearchQuery(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new FoodSearchError('invalid-query', '검색어를 1~100자로 입력해 주세요.');
  }
  return value.trim();
}
