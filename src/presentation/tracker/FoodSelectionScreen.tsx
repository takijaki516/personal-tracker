import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { FavoriteFood, Store } from '../../domain/data';
import type { FoodSearchResult } from '../../domain/food-search';
import { getFoodSuggestions } from '../../domain/food-suggestions';
import { canSearchFoods } from '../../infrastructure/food-search';
import Button from './Button';
import { formatDateWithWeekday } from './calendar';
import FatSecretFoods from './FatSecretFoods';
import { styles as s } from './styles';
import { useFoodInputComposition } from './useFoodInputComposition';

type Props = {
  name: string;
  date: string;
  days: Store['days'];
  favoriteFoods: FavoriteFood[];
  disabled: boolean;
  onClose: () => void;
  onNameSelect: (name: string) => void;
  onSelect: (food: FavoriteFood) => void;
  onSearchSelect: (food: FoodSearchResult) => void;
};

type Option = { food: FavoriteFood; date?: string };

export default function FoodSelectionScreen({
  name,
  date,
  days,
  favoriteFoods,
  disabled,
  onClose,
  onNameSelect,
  onSelect,
  onSearchSelect,
}: Props) {
  const [query, setQuery] = useState(name);
  const [composing, setComposing] = useState(false);
  const input = useRef<TextInput | null>(null);
  useFoodInputComposition(input, setComposing);
  const suggestions = useMemo(
    () => getFoodSuggestions(days, favoriteFoods, query),
    [days, favoriteFoods, query],
  );
  const normalizedQuery = query.trim();
  const searching = normalizedQuery.length > 0;
  const canComplete = !disabled && !composing && searching;
  const sections = [
    {
      title: '즐겨찾기',
      options: suggestions.favorites.map((food): Option => ({ food })),
      emptyText: searching ? '일치하는 즐겨찾기가 없어요.' : '등록된 즐겨찾기가 없어요.',
    },
    {
      title: '최근 음식',
      options: suggestions.recent,
      emptyText: searching ? '일치하는 최근 음식이 없어요.' : '아직 기록한 음식이 없어요.',
    },
  ];

  function applyName() {
    if (canComplete) {
      onNameSelect(normalizedQuery);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.editorScreen}
    >
      <View style={s.editorHeader}>
        <View style={s.editorHeaderContent}>
          <Button
            label="‹ 뒤로"
            accessibilityLabel="식단 입력으로 돌아가기"
            disabled={disabled}
            onPress={onClose}
          />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={s.sectionTitle}>
              음식 선택
            </Text>
            <Text style={s.caption}>{formatDateWithWeekday(date)}</Text>
          </View>
        </View>
        <View style={[s.editorContent, s.foodSelectionQuery]}>
          <Text style={s.label}>음식 검색</Text>
          <TextInput
            ref={input}
            accessibilityLabel="음식 검색"
            accessibilityState={{ disabled }}
            autoFocus={!disabled}
            autoComplete="off"
            readOnly={disabled}
            value={query}
            maxLength={100}
            placeholder="음식 이름을 입력하세요"
            onChangeText={setQuery}
            returnKeyType="done"
            onSubmitEditing={applyName}
            style={s.input}
          />
          <View style={[s.row, { justifyContent: 'flex-end' }]}>
            <Button
              label="선택 완료"
              primary={canComplete}
              secondary={!canComplete}
              disabled={!canComplete}
              onPress={applyName}
            />
          </View>
        </View>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.editorContent, s.foodSelectionSections]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {sections.map((section) => (
          <View key={section.title} style={s.foodSuggestions}>
            <View style={s.foodSuggestionsHeader}>
              <Text accessibilityRole="header" style={s.buttonText}>
                {section.title}
              </Text>
              <Text style={s.caption}>{section.options.length}</Text>
            </View>
            {section.options.length === 0 ? (
              <Text style={[s.caption, s.foodSuggestionsEmpty]}>{section.emptyText}</Text>
            ) : (
              section.options.map(({ food, date: recordedDate }: Option) => (
                <Pressable
                  key={food.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${section.title}: ${food.name} 선택, ${food.calories}kcal`}
                  disabled={disabled}
                  onPress={() => onSelect(food)}
                  style={({ pressed }) => [s.foodSuggestionOption, pressed && s.selected]}
                >
                  <Text style={s.body}>{food.name}</Text>
                  <Text style={s.caption}>
                    {food.calories} kcal{recordedDate ? ` · ${recordedDate}` : ''}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ))}
        {canSearchFoods() && (
          <View style={s.foodSuggestions}>
            <FatSecretFoods query={query} composing={composing} onSelect={onSearchSelect} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
