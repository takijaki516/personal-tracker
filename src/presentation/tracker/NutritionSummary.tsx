import { Text, View } from 'react-native';
import type { Meal, NutritionGoals } from '../../domain/data';
import { getDailyNutrition, getNutritionProgress } from '../../domain/nutrition-goals';
import Button from './Button';
import { styles as s } from './styles';

type Props = {
  meals: Meal[];
  goals: NutritionGoals;
  locked: boolean;
  onEditGoals: () => void;
};

const formatAmount = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export default function NutritionSummary({ meals, goals, locked, onEditGoals }: Props) {
  const hasGoals = Object.keys(goals).length > 0;

  return (
    <View style={s.nutritionSummary}>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>하루 섭취량</Text>
          <Text style={s.caption}>선택한 날짜의 식단 합계</Text>
        </View>
        <Button
          label={hasGoals ? '목표 수정' : '목표 설정'}
          secondary
          disabled={locked}
          onPress={onEditGoals}
        />
      </View>
      <View style={s.nutritionGrid}>
        {getDailyNutrition(meals).map(({ key, label, unit, consumed, missing }) => {
          const goal = goals[key];
          const progress = goal === undefined ? null : getNutritionProgress(consumed, goal);
          let status = '목표 미설정';
          if (progress) {
            status = '목표 도달';
            if (progress.remaining > 0) {
              status = `${formatAmount(progress.remaining)} ${unit} 남음`;
            } else if (progress.excess > 0) {
              status = `${formatAmount(progress.excess)} ${unit} 초과`;
            }
          }
          return (
            <View key={key} style={s.nutritionMetric}>
              <Text style={s.label}>{label}</Text>
              <Text style={s.nutritionAmount}>
                {formatAmount(consumed)} <Text style={s.caption}>{unit}</Text>
              </Text>
              <Text style={s.caption}>
                {goal === undefined ? '목표 미설정' : `목표 ${formatAmount(goal)} ${unit}`}
              </Text>
              {progress && (
                <>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={`${label} 목표 대비 섭취량`}
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: progress.percent,
                      text: `${formatAmount(consumed)} / ${formatAmount(goal ?? 0)} ${unit}`,
                    }}
                    style={s.nutritionProgressTrack}
                  >
                    <View
                      style={[
                        s.nutritionProgressFill,
                        { width: `${progress.percent}%` },
                        progress.excess > 0 && s.nutritionProgressOver,
                      ]}
                    />
                  </View>
                  <Text style={[s.caption, progress.excess > 0 && s.nutritionOverText]}>
                    {status}
                  </Text>
                </>
              )}
              {missing > 0 && <Text style={s.caption}>미입력 {missing}개 · 입력된 값 기준</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}
