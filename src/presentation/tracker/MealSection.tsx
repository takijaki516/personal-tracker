import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MACRONUTRIENTS, type Meal } from '../../domain/data';
import { formatFoodQuantity } from '../../domain/food-portion';
import { getDailyNutrition } from '../../domain/nutrition-goals';
import Button from './Button';
import { styles as s } from './styles';

type Props = {
  slot: string;
  meals: Meal[];
  locked: boolean;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

const TOTAL_LABELS = {
  calories: '총',
  carbohydrates: '탄',
  protein: '단',
  fat: '지',
};

export default function MealSection({ slot, meals, locked, onEdit, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const summary = getDailyNutrition(meals)
    .map(({ key, consumed, missing, unit }) => {
      const label = TOTAL_LABELS[key];
      if (missing > 0 && missing === meals.length) {
        return `${label}: 미입력`;
      }
      const amount = consumed.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
      const missingText = missing > 0 ? ` (미입력 ${missing}개)` : '';
      return `${label}: ${amount} ${unit}${missingText}`;
    })
    .join(', ');

  return (
    <View style={s.mealSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${slot} 식단 (${summary}) ${expanded ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [s.mealSectionHeader, pressed && { opacity: 0.65 }]}
      >
        <Text style={[s.label, s.mealSectionTitle]}>
          {slot} <Text style={s.caption}>({summary})</Text>
        </Text>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={s.mealSectionArrow}
        >
          {expanded ? '▴' : '▾'}
        </Text>
      </Pressable>
      {!meals.length && (
        <View style={s.mealRecord}>
          <Text style={s.caption}>기록이 없습니다.</Text>
        </View>
      )}
      {meals.map((meal) => (
        <View style={s.mealRecord} key={meal.id}>
          <View style={s.between}>
            <Text style={[s.body, s.mealName]}>{meal.name}</Text>
            <Text style={s.caption}>
              {formatFoodQuantity(meal.portion?.quantity ?? 1, meal.portion?.unit ?? 'serving')}
            </Text>
          </View>
          {expanded && (
            <>
              <View>
                <Text style={s.caption}>총 칼로리 {meal.calories} kcal</Text>
                {MACRONUTRIENTS.map(({ key, label }) => (
                  <Text key={key} style={s.caption}>
                    {label} {meal[key] === undefined ? '미입력' : `${meal[key]} g`}
                  </Text>
                ))}
              </View>
              <View style={s.mealRecordActions}>
                <Button label="수정" secondary disabled={locked} onPress={() => onEdit(meal.id)} />
                <Button label="삭제" danger disabled={locked} onPress={() => onRemove(meal.id)} />
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  );
}
