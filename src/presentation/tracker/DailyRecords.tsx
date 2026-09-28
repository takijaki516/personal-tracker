import { Text, View } from 'react-native';
import { BODY_PARTS, MEAL_SLOTS, type Day, type NutritionGoals } from '../../domain/data';
import Button from './Button';
import { formatDateWithWeekday } from './calendar';
import MealSection from './MealSection';
import NutritionSummary from './NutritionSummary';
import type { RecordKind } from './RecordEditor';
import { styles as s } from './styles';

type Props = {
  date: string;
  day: Day;
  nutritionGoals: NutritionGoals;
  locked: boolean;
  onEditGoals: () => void;
  onEdit: (kind: RecordKind, id?: string) => void;
  onRemove: (kind: 'meals' | 'workouts', id: string) => void;
};

export default function DailyRecords({
  date,
  day,
  nutritionGoals,
  locked,
  onEditGoals,
  onEdit,
  onRemove,
}: Props) {
  return (
    <>
      <Text style={[s.sectionTitle, s.recordDateTitle]}>{formatDateWithWeekday(date)}</Text>
      <View style={s.card}>
        <View style={s.between}>
          <Text style={s.sectionTitle}>식단</Text>
          <Button label="＋ 식단 추가" disabled={locked} onPress={() => onEdit('meal')} />
        </View>
        <NutritionSummary
          meals={day.meals}
          goals={nutritionGoals}
          locked={locked}
          onEditGoals={onEditGoals}
        />
        {MEAL_SLOTS.map((slot) => (
          <MealSection
            key={`${date}-${slot}`}
            slot={slot}
            meals={day.meals.filter((meal) => meal.slot === slot)}
            locked={locked}
            onEdit={(id) => onEdit('meal', id)}
            onRemove={(id) => onRemove('meals', id)}
          />
        ))}
      </View>
      <View style={s.card}>
        <View style={s.between}>
          <Text style={s.sectionTitle}>운동</Text>
          <Button label="＋ 운동 추가" disabled={locked} onPress={() => onEdit('workout')} />
        </View>
        {!day.workouts.length ? (
          <View style={s.empty}>
            <Text style={s.caption}>기록이 없습니다.</Text>
          </View>
        ) : (
          day.workouts.map((w, workoutIndex) => (
            <View style={s.workoutCard} key={w.id}>
              <View style={{ flex: 1 }}>
                <Text style={s.workoutOrder}>{workoutIndex + 1}번째 운동</Text>
                <Text style={s.body}>{w.name}</Text>
                <Text style={s.caption}>
                  {BODY_PARTS[w.bodyPart]} · 총 {w.sets.length}세트
                </Text>
                {w.sets.map((set, index) => (
                  <Text key={index} style={s.caption}>
                    {index + 1}세트 · {set.reps} reps ·{' '}
                    {set.weightKg === 0 ? 'Body weight' : `${set.weightKg}kg`}
                  </Text>
                ))}
              </View>
              <Button
                label="수정"
                secondary
                disabled={locked}
                onPress={() => onEdit('workout', w.id)}
              />
              <Button
                label="삭제"
                danger
                disabled={locked}
                onPress={() => onRemove('workouts', w.id)}
              />
            </View>
          ))
        )}
      </View>
    </>
  );
}
