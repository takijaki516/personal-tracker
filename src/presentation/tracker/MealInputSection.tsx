import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { foodUnitLabel, getMealNutritionPreview } from '../../domain/food-portion';
import type { MealFoodDraft } from './MealFoodEditor';
import { formatFoodNutritionSummary, formatNutritionSummary } from './nutrition-summary';
import { styles as s } from './styles';

type Props = {
  slot: string;
  drafts: MealFoodDraft[];
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export default function MealInputSection({
  slot,
  drafts,
  expanded,
  busy,
  onToggle,
  children,
}: Props) {
  const previews = drafts.map((draft) => getMealNutritionPreview(draft.nutritionInput));
  const summary = formatNutritionSummary(previews.map((preview) => preview ?? {}));

  return (
    <View style={s.mealSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${slot} 음식 입력 ${expanded ? '접기' : '펼치기'} (${summary})`}
        accessibilityState={{
          expanded,
          disabled: busy,
        }}
        disabled={busy}
        onPress={onToggle}
        style={({ pressed }) => [
          s.mealSectionHeader,
          s.mealInputSectionHeader,
          pressed && { opacity: 0.65 },
          busy && { opacity: 0.4 },
        ]}
      >
        <View style={s.mealInputSectionHeading}>
          <Text style={s.label}>
            {slot}{' '}
            <Text style={[s.caption, s.mealInputSectionHeaderText]}>(음식 {drafts.length}개)</Text>
          </Text>
          <Text style={[s.caption, s.mealInputSectionHeaderText]}>{summary}</Text>
        </View>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={s.mealSectionArrow}
        >
          {expanded ? '▴' : '▾'}
        </Text>
      </Pressable>
      {!expanded && drafts.length === 0 && (
        <View style={s.mealRecord}>
          <Text style={s.caption}>음식이 없습니다.</Text>
        </View>
      )}
      {!expanded &&
        drafts.map((draft, index) => {
          const portion = draft.nutritionInput.portion;
          const quantity = portion.quantity.trim();
          return (
            <View key={draft.id} style={s.mealRecord}>
              <View style={s.between}>
                <Text style={[s.body, s.mealName]}>{draft.name.trim() || '음식 이름 미입력'}</Text>
                <Text style={s.caption}>
                  {quantity ? `${quantity} ${foodUnitLabel(portion.unit)}` : '섭취량 미입력'}
                </Text>
              </View>
              <Text style={s.caption}>{formatFoodNutritionSummary(previews[index])}</Text>
            </View>
          );
        })}
      <View
        style={[s.mealInputSectionContent, !expanded && s.hidden]}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      >
        {children}
      </View>
    </View>
  );
}
