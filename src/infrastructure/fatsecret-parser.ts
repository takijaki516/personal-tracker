import { DomUtils, parseDocument } from 'htmlparser2';
import {
  isMealAmount,
  MACRONUTRIENTS,
  MAX_MACRONUTRIENT_GRAMS,
  MAX_MEAL_CALORIES,
} from '../domain/data';
import type { FoodSearchResult } from '../domain/food-search';
import { FoodSearchError } from './food-search-error';

export const FATSECRET_ORIGIN = 'https://www.fatsecret.kr';
export const FATSECRET_SEARCH_PATH = '/칼로리-영양소/search';

type HtmlElement = NonNullable<ReturnType<typeof DomUtils.findOne>>;

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();
const hasClass = (element: HtmlElement, name: string) =>
  (element.attribs.class ?? '').split(/\s+/).includes(name);
const numberPattern = '-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';

function invalidPage(): never {
  throw new FoodSearchError(
    'invalid-page',
    'FatSecret 검색 페이지의 음식 정보를 읽지 못했습니다. 페이지 구조를 확인해 주세요.',
  );
}

function detailUrl(href: string | undefined): string {
  if (!href) {
    return invalidPage();
  }
  try {
    const url = new URL(href, FATSECRET_ORIGIN);
    const path = decodeURIComponent(url.pathname);
    if (
      url.origin !== FATSECRET_ORIGIN ||
      !path.startsWith('/칼로리-영양소/') ||
      path === FATSECRET_SEARCH_PATH
    ) {
      return invalidPage();
    }
    return url.href;
  } catch {
    return invalidPage();
  }
}

function servingGrams(text: string): number | undefined {
  const gramsPattern = `(${numberPattern})\\s*g`;
  const match =
    new RegExp(`^${gramsPattern}$`, 'i').exec(text) ??
    new RegExp(`\\(${gramsPattern}\\)`, 'i').exec(text);
  if (!match) {
    return undefined;
  }
  const grams = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(grams) && grams > 0 ? grams : undefined;
}

function parseRow(row: HtmlElement): FoodSearchResult {
  const link = DomUtils.findOne(
    (element) => element.name === 'a' && hasClass(element, 'prominent'),
    row.children,
  );
  const nutrition = DomUtils.findOne((element) => hasClass(element, 'smallText'), row.children);
  if (!link || !nutrition) {
    return invalidPage();
  }
  const name = cleanText(DomUtils.textContent(link));
  const text = cleanText(DomUtils.textContent(nutrition));
  const summary = new RegExp(
    `^(.+?)\\s*당\\s*-\\s*칼로리\\s*:\\s*(${numberPattern})\\s*kcal(?:\\s*\\||\\s*,|$)`,
    'i',
  ).exec(text);
  if (!name || !summary) {
    return invalidPage();
  }
  const calories = Number(summary[2].replaceAll(',', ''));
  if (!isMealAmount(calories, MAX_MEAL_CALORIES)) {
    return invalidPage();
  }
  const food: FoodSearchResult = {
    name,
    servingText: summary[1].trim(),
    calories,
    sourceUrl: detailUrl(link.attribs.href),
  };
  const brand = DomUtils.findOne(
    (element) => element.name === 'a' && hasClass(element, 'brand'),
    row.children,
  );
  if (brand) {
    const name = cleanText(DomUtils.textContent(brand))
      .replace(/^\((.*)\)$/, '$1')
      .trim();
    if (name) {
      food.brand = name;
    }
  }
  const grams = servingGrams(food.servingText);
  if (grams !== undefined) {
    food.servingGrams = grams;
  }
  for (const { key, label } of MACRONUTRIENTS) {
    const match = new RegExp(
      `(?:^|\\|)\\s*${label}\\s*:\\s*(${numberPattern})\\s*g(?:\\s*\\||\\s*,|\\s|$)`,
      'i',
    ).exec(text);
    if (!match) {
      if (text.includes(`${label}:`) || new RegExp(`${label}\\s*:`).test(text)) {
        return invalidPage();
      }
      continue;
    }
    const value = Number(match[1].replaceAll(',', ''));
    if (!isMealAmount(value, MAX_MACRONUTRIENT_GRAMS)) {
      return invalidPage();
    }
    food[key] = value;
  }
  return food;
}

export function parseFatSecretSearchHtml(html: string): FoodSearchResult[] {
  const document = parseDocument(html);
  const table = DomUtils.findOne(
    (element) => element.name === 'table' && hasClass(element, 'searchResult'),
    document.children,
  );
  if (!table) {
    if (DomUtils.existsOne((element) => hasClass(element, 'searchNoResult'), document.children)) {
      return [];
    }
    return invalidPage();
  }
  const rows = DomUtils.findAll((element) => element.name === 'tr', table.children);
  if (rows.length === 0 || rows.length > 10) {
    return invalidPage();
  }
  return rows.map(parseRow);
}
