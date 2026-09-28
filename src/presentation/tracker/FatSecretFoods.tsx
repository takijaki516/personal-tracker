import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MACRONUTRIENTS } from '../../domain/data';
import type { FoodSearchResult } from '../../domain/food-search';
import { searchFoods } from '../../infrastructure/food-search';
import Button from './Button';
import { createFoodAutocomplete, type FoodAutocompleteState } from './food-autocomplete';
import { styles as s } from './styles';

type Props = {
  query: string;
  composing: boolean;
  onSelect: (food: FoodSearchResult) => void;
};

export default function FatSecretFoods({ query, composing, onSelect }: Props) {
  const [state, setState] = useState<FoodAutocompleteState>({
    query: '',
    status: 'idle',
  });
  const autocomplete = useMemo(() => createFoodAutocomplete(searchFoods, setState), []);
  useEffect(() => {
    autocomplete.update(query, composing);
    return autocomplete.cancel;
  }, [autocomplete, query, composing]);
  const normalizedQuery = query.trim();
  let visibleState = state;
  if (composing) {
    visibleState = {
      query: normalizedQuery,
      status: 'composing',
    };
  } else if (state.query !== normalizedQuery) {
    visibleState = {
      query: normalizedQuery,
      status: normalizedQuery ? 'waiting' : 'idle',
    };
  }

  return (
    <View>
      <View style={s.foodSuggestionsHeader}>
        <Text accessibilityRole="header" style={s.buttonText}>
          FatSecret 검색
        </Text>
        {visibleState.status === 'success' && (
          <Text style={s.caption}>{visibleState.foods.length}</Text>
        )}
      </View>
      <View style={s.foodSearchActions}>
        {visibleState.status === 'idle' && (
          <Text style={s.caption}>
            음식 이름을 입력하면 한국 음식과 브랜드 제품을 자동으로 검색해요.
          </Text>
        )}
        {(visibleState.status === 'waiting' || visibleState.status === 'composing') && (
          <Text style={s.caption}>입력을 마치면 자동으로 검색해요.</Text>
        )}
        {visibleState.status === 'loading' && (
          <View style={s.foodSearchLoading} accessibilityState={{ busy: true }}>
            <ActivityIndicator
              accessibilityLabel="FatSecret 음식 정보 조회 중"
              size="small"
              color="#245d48"
            />
            <Text accessibilityLiveRegion="polite" style={s.body}>
              FatSecret에서 음식 정보를 가져오고 있어요.
            </Text>
          </View>
        )}
        {visibleState.status === 'error' && (
          <>
            <Text accessibilityRole="alert" style={s.error}>
              {visibleState.message}
            </Text>
            <Button
              label="다시 시도"
              secondary
              onPress={() => autocomplete.update(query, composing)}
            />
          </>
        )}
        {visibleState.status === 'success' && visibleState.foods.length === 0 && (
          <Text accessibilityLiveRegion="polite" style={s.caption}>
            검색 결과가 없어요. 다른 음식 이름으로 검색해 주세요.
          </Text>
        )}
      </View>
      {visibleState.status === 'success' && visibleState.foods.length > 0 && (
        <>
          <View>
            {visibleState.foods.map((food, index) => (
              <Pressable
                key={`${food.sourceUrl}:${index}`}
                accessibilityRole="button"
                accessibilityLabel={`FatSecret: ${food.brand ? `${food.brand} ` : ''}${food.name} 선택, ${food.servingText}, ${food.calories}kcal`}
                onPress={() => onSelect(food)}
                style={({ pressed }) => [s.foodSuggestionOption, pressed && s.selected]}
              >
                <Text style={s.body}>{food.name}</Text>
                {!!food.brand && <Text style={s.caption}>{food.brand}</Text>}
                <Text style={s.caption}>
                  {food.servingText} · {food.calories} kcal
                </Text>
                <Text style={s.caption}>
                  {MACRONUTRIENTS.map(
                    ({ key, label }) =>
                      `${label} ${food[key] === undefined ? '미제공' : `${food[key]}g`}`,
                  ).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.caption, s.foodSuggestionsEmpty]}>
            표시된 제공량 기준이에요. 선택한 뒤 섭취량을 입력하면 영양값이 자동 계산됩니다.
          </Text>
        </>
      )}
    </View>
  );
}
