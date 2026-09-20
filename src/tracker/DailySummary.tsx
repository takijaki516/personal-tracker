import { Text, View } from 'react-native';

import type { Day } from '../data';
import { styles as s } from './styles';

export default function DailySummary({ day, wide }: { day: Day; wide: boolean }) {
  return (
    <View style={s.stats}>
      {[
        [
          '오늘의 식단',
          day.meals.reduce((n, m) => n + m.calories, 0).toLocaleString(),
          'kcal',
          `${day.meals.length}개의 식단`,
        ],
        ['나의 체중', String(day.weight ?? '—'), 'kg', '오늘의 몸 상태'],
        [
          '오늘의 운동',
          String(day.workouts.reduce((n, w) => n + w.minutes, 0)),
          '분',
          `${day.workouts.length}개의 운동`,
        ],
      ].map(([label, value, unit, caption]) => (
        <View key={label} style={[s.stat, !wide && { padding: 12 }]}>
          <Text style={s.caption}>{label}</Text>
          <Text style={[s.statValue, !wide && { fontSize: 26 }]}>
            {value}
            <Text style={s.unit}> {unit}</Text>
          </Text>
          <Text style={s.caption}>{caption}</Text>
        </View>
      ))}
    </View>
  );
}
