import { describe, expect, it } from 'vitest';
import { foodSearchSelection, readFoodSearchResponse, type FoodSearchResult } from './food-search';

const food: FoodSearchResult = {
  name: '닭가슴살',
  brand: '하림',
  servingText: '1팩 (110g)',
  servingGrams: 110,
  calories: 115,
  carbohydrates: 0,
  protein: 24,
  fat: 1.6,
  sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/하림/닭가슴살/1팩',
};
const response = {
  query: '닭가슴살',
  sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/search?q=닭가슴살',
  foods: [food],
};

describe('food search results', () => {
  it('reads serving information and preserves zero nutrition values', () => {
    expect(readFoodSearchResponse(response, response.query)).toEqual(response);
  });

  it('accepts explicit empty results and absent optional nutrition values', () => {
    expect(
      readFoodSearchResponse(
        {
          ...response,
          foods: [],
        },
        response.query,
      ).foods,
    ).toEqual([]);
    const sparseFood = {
      name: food.name,
      servingText: '1개',
      calories: 0,
      sourceUrl: food.sourceUrl,
    };
    expect(
      readFoodSearchResponse(
        {
          ...response,
          foods: [sparseFood],
        },
        response.query,
      ).foods,
    ).toEqual([sparseFood]);
  });

  it.each([
    null,
    {
      ...response,
      query: '다른 검색어',
    },
    {
      ...response,
      foods: undefined,
    },
    {
      ...response,
      foods: Array.from({ length: 11 }, () => food),
    },
    {
      ...response,
      sourceUrl: 'https://example.com/search',
    },
  ])('rejects malformed responses instead of treating them as no results', (value) => {
    expect(() => readFoodSearchResponse(value, response.query)).toThrow('형식');
  });

  it.each([
    {
      ...food,
      calories: '115',
    },
    {
      ...food,
      calories: -1,
    },
    {
      ...food,
      calories: 20001,
    },
    {
      ...food,
      protein: Number.NaN,
    },
    {
      ...food,
      fat: 5001,
    },
    {
      ...food,
      name: ' ',
    },
    {
      ...food,
      servingText: '',
    },
    {
      ...food,
      servingGrams: 0,
    },
    {
      ...food,
      sourceUrl: 'javascript:alert(1)',
    },
  ])('rejects invalid foods before they can fill the record editor', (value) => {
    expect(() =>
      readFoodSearchResponse(
        {
          ...response,
          foods: [value],
        },
        response.query,
      ),
    ).toThrow('형식');
  });

  it('fills the editor with the branded name and the exact serving nutrition', () => {
    expect(foodSearchSelection(food)).toEqual({
      name: '하림 닭가슴살',
      calories: 115,
      carbohydrates: 0,
      protein: 24,
      fat: 1.6,
    });
  });

  it('does not repeat a brand already included in the food name', () => {
    expect(
      foodSearchSelection({
        ...food,
        name: '하림 닭가슴살',
      }).name,
    ).toBe('하림 닭가슴살');
  });

  it('keeps missing macros absent and stays within the saved name limit', () => {
    const sparseFood = {
      name: '닭가슴살',
      brand: '브'.repeat(100),
      servingText: '1개',
      calories: 0,
      sourceUrl: food.sourceUrl,
    };
    expect(foodSearchSelection(sparseFood)).toEqual({
      name: '닭가슴살',
      calories: 0,
    });
  });
});
