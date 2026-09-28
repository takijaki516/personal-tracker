import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MACRONUTRIENTS, type FavoriteFood } from '../../domain/data';
import Button from './Button';
import { styles as s } from './styles';

type Props = {
  foods: FavoriteFood[];
  disabled: boolean;
  onSelect: (food: FavoriteFood) => void;
  onRemove: (id: string) => void;
};

export default function FavoriteFoods({ foods, disabled, onSelect, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const sorted = [...foods].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  return (
    <View style={s.favoriteFoods}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`즐겨찾는 음식 (${foods.length})`}
        accessibilityState={{
          expanded: open,
          disabled,
        }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          s.favoriteFoodsButton,
          s.between,
          pressed && { opacity: 0.65 },
          disabled && { opacity: 0.4 },
        ]}
      >
        <Text style={s.buttonText}>☆ 즐겨찾는 음식 ({foods.length})</Text>
        <Text style={s.buttonText}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <View style={s.favoriteFoodsList}>
          {foods.length === 0 ? (
            <View style={s.favoriteFoodsEmpty}>
              <Text style={s.body}>아직 등록한 음식이 없어요.</Text>
              <Text style={s.caption}>
                음식 이름과 칼로리를 입력한 뒤 ‘즐겨찾기 등록’을 눌러 주세요.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 240 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {sorted.map((food) => {
                const nutrition = MACRONUTRIENTS.filter(({ key }) => food[key] !== undefined)
                  .map(({ key, label }) => `${label} ${food[key]}g`)
                  .join(' · ');
                return (
                  <View key={food.id} style={s.favoriteFoodRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${food.name} 선택, ${food.calories}kcal`}
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => {
                        onSelect(food);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        s.favoriteFoodOption,
                        pressed && s.selected,
                        disabled && { opacity: 0.4 },
                      ]}
                    >
                      <Text style={s.body}>{food.name}</Text>
                      <Text style={s.caption}>{food.calories} kcal</Text>
                      {!!nutrition && <Text style={s.caption}>{nutrition}</Text>}
                    </Pressable>
                    <Button
                      label="해제"
                      accessibilityLabel={`${food.name} 즐겨찾기 해제`}
                      disabled={disabled}
                      onPress={() => onRemove(food.id)}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
