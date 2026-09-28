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
import { formatFoodQuantity } from '../../domain/food-portion';
import { foodSearchSelection } from '../../domain/food-search';
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
  onFoodsSelect: (foods: SelectedFood[]) => void;
};

type Option = { food: FavoriteFood; date?: string };

type SelectedFood = {
  key: string;
  food: Omit<FavoriteFood, 'id'>;
  fromSearch: boolean;
};

export default function FoodSelectionScreen({
  name,
  date,
  days,
  favoriteFoods,
  disabled,
  onClose,
  onNameSelect,
  onFoodsSelect,
}: Props) {
  const [query, setQuery] = useState(name);
  const [composing, setComposing] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState<SelectedFood[]>([]);
  const input = useRef<TextInput | null>(null);
  useFoodInputComposition(input, setComposing);
  const suggestions = useMemo(
    () => getFoodSuggestions(days, favoriteFoods, query),
    [days, favoriteFoods, query],
  );
  const normalizedQuery = query.trim();
  const searching = normalizedQuery.length > 0;
  const canComplete = !disabled && !composing && (selectedFoods.length > 0 || searching);
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

  function completeSelection() {
    if (!canComplete) {
      return;
    }
    if (selectedFoods.length > 0) {
      onFoodsSelect(selectedFoods);
    } else {
      onNameSelect(normalizedQuery);
    }
  }

  function toggleFood(selection: SelectedFood) {
    setSelectedFoods((current) =>
      current.some((food) => food.key === selection.key)
        ? current.filter((food) => food.key !== selection.key)
        : [...current, selection],
    );
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
            onSubmitEditing={completeSelection}
            style={s.input}
          />
          <Text style={s.caption}>음식을 여러 개 선택한 뒤 선택 완료를 눌러 주세요.</Text>
          <View style={[s.row, { justifyContent: 'flex-end' }]}>
            <Button
              label={
                selectedFoods.length > 0 ? `선택 완료 (${selectedFoods.length}개)` : '선택 완료'
              }
              primary={canComplete}
              secondary={!canComplete}
              disabled={!canComplete}
              onPress={completeSelection}
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
        {selectedFoods.length > 0 && (
          <View style={s.foodSuggestions}>
            <View style={s.foodSuggestionsHeader}>
              <Text accessibilityLiveRegion="polite" style={s.buttonText}>
                선택한 음식 ({selectedFoods.length}개)
              </Text>
            </View>
            <View style={s.selectedFoods}>
              {selectedFoods.map((selection) => (
                <Button
                  key={selection.key}
                  label={`${selection.food.name} ×`}
                  accessibilityLabel={`${selection.food.name} 선택 해제`}
                  selected
                  disabled={disabled}
                  onPress={() => toggleFood(selection)}
                />
              ))}
            </View>
          </View>
        )}
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
              section.options.map(({ food, date: recordedDate }: Option) => {
                const key = JSON.stringify([section.title, recordedDate, food.id]);
                const checked = selectedFoods.some((selection) => selection.key === key);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${section.title}: ${food.name} 선택, ${food.calories}kcal`}
                    accessibilityState={{
                      checked,
                      disabled,
                    }}
                    disabled={disabled}
                    onPress={() =>
                      toggleFood({
                        key,
                        food,
                        fromSearch: false,
                      })
                    }
                    style={({ pressed }) => [
                      s.foodSuggestionOption,
                      (checked || pressed) && s.selected,
                    ]}
                  >
                    <Text style={s.body}>
                      {checked ? '☑' : '☐'} {food.name}
                    </Text>
                    {food.portion && (
                      <Text style={s.caption}>
                        섭취량 {formatFoodQuantity(food.portion.quantity, food.portion.unit)}
                      </Text>
                    )}
                    <Text style={s.caption}>
                      {food.calories} kcal{recordedDate ? ` · ${recordedDate}` : ''}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ))}
        {canSearchFoods() && (
          <View style={s.foodSuggestions}>
            <FatSecretFoods
              query={query}
              composing={composing}
              disabled={disabled}
              selectedUrls={selectedFoods.filter((food) => food.fromSearch).map((food) => food.key)}
              onSelect={(food) =>
                toggleFood({
                  key: food.sourceUrl,
                  food: foodSearchSelection(food),
                  fromSearch: true,
                })
              }
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
