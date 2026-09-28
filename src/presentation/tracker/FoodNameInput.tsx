import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type BlurEvent,
} from 'react-native';
import type { FavoriteFood, Store } from '../../domain/data';
import { getFoodSuggestions } from '../../domain/food-suggestions';
import { styles as s } from './styles';

type Props = {
  value: string;
  days: Store['days'];
  favoriteFoods: FavoriteFood[];
  disabled: boolean;
  onChangeText: (value: string) => void;
  onSelect: (food: FavoriteFood) => void;
};

type Option = { food: FavoriteFood; date?: string };

export default function FoodNameInput({
  value,
  days,
  favoriteFoods,
  disabled,
  onChangeText,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(
    () => getFoodSuggestions(days, favoriteFoods, value),
    [days, favoriteFoods, value],
  );
  const visible = open && !disabled;
  const searching = value.trim().length > 0;
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

  function handleBlur(event: BlurEvent) {
    // Web focus can move from the input to an option before its click is handled.
    if (Platform.OS === 'web' && 'relatedTarget' in event) {
      const { currentTarget, relatedTarget } = event;
      if (
        currentTarget instanceof Node &&
        relatedTarget instanceof Node &&
        currentTarget.contains(relatedTarget)
      ) {
        return;
      }
    }
    setOpen(false);
  }

  return (
    <View style={s.field} onBlur={handleBlur}>
      <Text style={s.label}>음식 이름</Text>
      <TextInput
        accessibilityLabel="음식 이름"
        accessibilityRole="combobox"
        accessibilityState={{
          disabled,
          expanded: visible,
        }}
        autoComplete="off"
        editable={!disabled}
        value={value}
        maxLength={100}
        onFocus={() => setOpen(true)}
        onPressIn={() => setOpen(true)}
        onBlur={Platform.OS === 'web' ? undefined : () => setOpen(false)}
        onChangeText={(text) => {
          onChangeText(text);
          setOpen(true);
        }}
        style={[s.input, disabled && { opacity: 0.4 }]}
      />
      {visible && (
        <View style={s.foodSuggestions}>
          {sections.map((section) => (
            <View key={section.title}>
              <View style={s.foodSuggestionsHeader}>
                <Text accessibilityRole="header" style={s.buttonText}>
                  {section.title}
                </Text>
                <Text style={s.caption}>{section.options.length}</Text>
              </View>
              {section.options.length === 0 ? (
                <Text style={[s.caption, s.foodSuggestionsEmpty]}>{section.emptyText}</Text>
              ) : (
                <ScrollView
                  style={s.foodSuggestionsOptions}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {section.options.map(({ food, date }: Option) => (
                    <Pressable
                      key={food.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${section.title}: ${food.name} 선택, ${food.calories}kcal`}
                      onPress={() => {
                        onSelect(food);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [s.foodSuggestionOption, pressed && s.selected]}
                    >
                      <Text style={s.body}>{food.name}</Text>
                      <Text style={s.caption}>
                        {food.calories} kcal{date ? ` · ${date}` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
