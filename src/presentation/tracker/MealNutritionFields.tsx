import { Text, View } from 'react-native';
import { NUTRITION_METRICS, nutritionForPortion, type FoodNutrition } from '../../domain/data';
import {
  changeMealNutrition,
  changeMealQuantity,
  changeMealUnit,
  foodUnitLabel,
  parseFoodPortionInput,
  type MealNutritionInput,
} from '../../domain/food-portion';
import Button from './Button';
import Field from './Field';
import { styles as s } from './styles';

type Props = {
  input: MealNutritionInput;
  disabled: boolean;
  onChange: (input: MealNutritionInput) => void;
};

export default function MealNutritionFields({ input, disabled, onChange }: Props) {
  let totals: FoodNutrition | null = null;
  try {
    totals = nutritionForPortion(parseFoodPortionInput(input.portion));
  } catch {
    // Keep incomplete input editable; saving reports the specific validation error.
  }

  return (
    <>
      <View style={s.portionUnits}>
        <Text style={s.label}>양의 단위</Text>
        <View style={s.row}>
          {(['g', 'serving'] as const).map((unit) => (
            <Button
              key={unit}
              label={foodUnitLabel(unit)}
              selected={input.portion.unit === unit}
              disabled={disabled}
              onPress={() => onChange(changeMealUnit(input, unit))}
            />
          ))}
        </View>
      </View>
      <Field
        label={`섭취량 (${foodUnitLabel(input.portion.unit)})`}
        value={input.portion.quantity}
        onChangeText={(value) => onChange(changeMealQuantity(input, value))}
        numeric
        maxLength={10}
        disabled={disabled}
      />
      <Text style={s.caption}>
        {input.pendingUnit
          ? '영양값은 유지됩니다. 변경한 단위로 현재 식단의 섭취량을 입력해 주세요.'
          : '섭취량을 바꾸면 칼로리와 영양소가 함께 조정됩니다.'}
      </Text>
      <View accessibilityLiveRegion="polite" style={s.portionNutritionSummary}>
        <Text style={s.label}>총 영양정보</Text>
        <View style={s.nutritionGrid}>
          {NUTRITION_METRICS.map(({ key, label, unit }) => {
            const amount = totals?.[key];
            let value = '—';
            if (totals) {
              value =
                amount === undefined
                  ? '미입력'
                  : `${amount.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} ${unit}`;
            }
            return (
              <View key={key} style={s.nutritionMetric}>
                <Text style={s.caption}>{key === 'calories' ? '총 칼로리' : label}</Text>
                <Text style={s.portionNutritionAmount}>{value}</Text>
              </View>
            );
          })}
        </View>
        {!totals && <Text style={s.caption}>섭취량과 영양값을 입력하면 합계가 표시됩니다.</Text>}
      </View>
      {NUTRITION_METRICS.map(({ key, label, unit }) => (
        <Field
          key={key}
          label={`${key === 'calories' ? '총 칼로리' : label} (${unit})`}
          value={input.nutrition[key]}
          onChangeText={(value) => onChange(changeMealNutrition(input, key, value))}
          numeric
          maxLength={10}
          disabled={disabled}
        />
      ))}
      <Text style={s.caption}>현재 섭취량에 해당하는 영양값입니다. 직접 수정할 수 있습니다.</Text>
    </>
  );
}
