import { Text, View } from 'react-native';

import type { Day } from '../../domain/data';
import Button from './Button';
import type { RecordKind } from './RecordEditor';
import { styles as s } from './styles';

export type RecordTab = '전체' | '식단' | '운동';
type Props = {
  day: Day;
  tab: RecordTab;
  locked: boolean;
  onTabChange: (tab: RecordTab) => void;
  onEdit: (kind: RecordKind, id?: string) => void;
  onRemove: (kind: 'meals' | 'workouts', id: string) => void;
};

export default function DailyRecords({ day, tab, locked, onTabChange, onEdit, onRemove }: Props) {
  return (
    <>
      <View style={s.between}>
        <Text style={s.sectionTitle}>하루의 기록</Text>
        <View style={s.row}>
          {(['전체', '식단', '운동'] as const).map((t) => (
            <Button key={t} label={t} selected={t === tab} onPress={() => onTabChange(t)} />
          ))}
        </View>
      </View>
      {tab !== '운동' && (
        <View style={s.card}>
          <View style={s.between}>
            <Text style={s.sectionTitle}>🍽 식단</Text>
            <Button label="＋ 식단 추가" disabled={locked} onPress={() => onEdit('meal')} />
          </View>
          {!day.meals.length ? (
            <View style={s.empty}>
              <Text style={s.body}>오늘은 어떤 음식을 드셨나요?</Text>
              <Text style={s.caption}>음식과 칼로리를 간단히 남겨보세요.</Text>
            </View>
          ) : (
            day.meals.map((m) => (
              <View style={s.record} key={m.id}>
                <Text style={s.tag}>{m.slot}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.body}>{m.name}</Text>
                  <Text style={s.caption}>{m.calories} kcal</Text>
                </View>
                <Button label="수정" disabled={locked} onPress={() => onEdit('meal', m.id)} />
                <Button label="삭제" disabled={locked} onPress={() => onRemove('meals', m.id)} />
              </View>
            ))
          )}
        </View>
      )}
      {tab !== '식단' && (
        <View style={s.card}>
          <View style={s.between}>
            <Text style={s.sectionTitle}>↗ 운동</Text>
            <Button label="＋ 운동 추가" disabled={locked} onPress={() => onEdit('workout')} />
          </View>
          {!day.workouts.length ? (
            <View style={s.empty}>
              <Text style={s.body}>가벼운 산책도 좋은 시작이에요.</Text>
              <Text style={s.caption}>오늘 움직인 시간을 기록해 보세요.</Text>
            </View>
          ) : (
            day.workouts.map((w) => (
              <View style={s.record} key={w.id}>
                <View style={{ flex: 1 }}>
                  <Text style={s.body}>{w.name}</Text>
                  <Text style={s.caption}>
                    {w.minutes}분{w.note ? ` · ${w.note}` : ''}
                  </Text>
                </View>
                <Button label="수정" disabled={locked} onPress={() => onEdit('workout', w.id)} />
                <Button label="삭제" disabled={locked} onPress={() => onRemove('workouts', w.id)} />
              </View>
            ))
          )}
        </View>
      )}
    </>
  );
}
