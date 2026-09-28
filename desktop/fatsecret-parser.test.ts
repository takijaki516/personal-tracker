import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFatSecretSearchHtml } from '../src/infrastructure/fatsecret-parser';

const html = readFileSync(
  new URL('../src/infrastructure/fixtures/fatsecret-search.html', import.meta.url),
  'utf8',
);

describe('FatSecret Korean search HTML', () => {
  it('extracts each row with its own brand, serving, nutrition and detail URL', () => {
    const foods = parseFatSecretSearchHtml(html);
    expect(foods).toHaveLength(2);
    expect(foods[0]).toEqual({
      name: '샘플 닭가슴살',
      servingText: '100 g',
      servingGrams: 100,
      calories: 109,
      carbohydrates: 0,
      protein: 22.98,
      fat: 1.23,
      sourceUrl: new URL('/칼로리-영양소/일반명/샘플-닭가슴살', 'https://www.fatsecret.kr').href,
    });
    expect(foods[1]).toEqual({
      name: '갈릭 & 닭가슴살',
      brand: '샘플브랜드',
      servingText: '1인분 (110g)',
      servingGrams: 110,
      calories: 130,
      carbohydrates: 2,
      protein: 25,
      fat: 2,
      sourceUrl: new URL(
        '/칼로리-영양소/샘플브랜드/갈릭-닭가슴살/1인분',
        'https://www.fatsecret.kr',
      ).href,
    });
  });

  it('returns no foods only for the explicit no-results markup', () => {
    expect(
      parseFatSecretSearchHtml('<div class="searchNoResult">검색결과가 없습니다.</div>'),
    ).toEqual([]);
    expect(() => parseFatSecretSearchHtml('<html>일시적으로 사용할 수 없습니다.</html>')).toThrow(
      '페이지 구조',
    );
    expect(() => parseFatSecretSearchHtml('<table class="searchResult"></table>')).toThrow(
      '페이지 구조',
    );
    expect(() => parseFatSecretSearchHtml(html.replaceAll('prominent', 'changed-class'))).toThrow(
      '페이지 구조',
    );
  });

  it('preserves zero calories and keeps missing nutrients absent', () => {
    const foods = parseFatSecretSearchHtml(
      html.replace('109kcal', '0kcal').replace(' | 탄수화물: 0g', ''),
    );
    expect(foods[0].calories).toBe(0);
    expect(foods[0].carbohydrates).toBeUndefined();
    expect(foods[0].protein).toBe(22.98);
  });

  it.each(['-1', '20001', 'NaN', 'abc', '1,,000'])(
    'rejects malformed or out-of-range calories: %s',
    (value) => {
      expect(() => parseFatSecretSearchHtml(html.replace('109kcal', `${value}kcal`))).toThrow(
        '음식 정보',
      );
    },
  );

  it.each(['-1', '5001', 'NaN', 'abc'])(
    'rejects invalid present nutrients rather than treating them as missing: %s',
    (value) => {
      expect(() =>
        parseFatSecretSearchHtml(html.replace('지방: 1.23g', `지방: ${value}g`)),
      ).toThrow('음식 정보');
    },
  );

  it('reads correctly grouped thousands separators', () => {
    expect(parseFatSecretSearchHtml(html.replace('109kcal', '1,109kcal'))[0].calories).toBe(1109);
  });

  it.each(['100ml', '1개', '1컵 (240ml)'])(
    'keeps the serving text without inventing a gram weight: %s',
    (serving) => {
      const foods = parseFatSecretSearchHtml(html.replace(/100 g\s+당/, `${serving}당`));
      expect(foods[0].servingText).toBe(serving);
      expect(foods[0].servingGrams).toBeUndefined();
    },
  );

  it.each([
    'https://other.test/food',
    'javascript:alert(1)',
    '/칼로리-영양소/search?q=밥',
    '/%broken',
  ])('rejects a detail URL outside the expected Korean food pages: %s', (url) => {
    expect(() =>
      parseFatSecretSearchHtml(html.replace('/칼로리-영양소/일반명/샘플-닭가슴살', url)),
    ).toThrow('음식 정보');
  });
});
