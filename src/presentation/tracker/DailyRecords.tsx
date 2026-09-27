import { Text, View } from 'react-native';
import type { Day } from '../../domain/data';
import Button from './Button';
import { formatDateWithWeekday } from './calendar';
import type { RecordKind } from './RecordEditor';
import { styles as s } from './styles';

type Props = {
  date: string;
  day: Day;
  locked: boolean;
  onEdit: (kind: RecordKind, id?: string) => void;
  onRemove: (kind: 'meals' | 'workouts', id: string) => void;
};

export default function DailyRecords({ date, day, locked, onEdit, onRemove }: Props) {
  return (
    <>
      <Text style={[s.sectionTitle, s.recordDateTitle]}>{formatDateWithWeekday(date)}</Text>
      <View style={s.card}>
        <View style={s.between}>
          <Text style={s.sectionTitle}>식단</Text>
          <Button label="＋ 식단 추가" disabled={locked} onPress={() => onEdit('meal')} />
        </View>
        {!day.meals.length ? (
          <View style={s.empty}>
            <Text style={s.caption}>기록이 없습니다.</Text>
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
          day.workouts.map((w) => (
            <View style={s.record} key={w.id}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{w.name}</Text>
              </View>
              <Button label="수정" disabled={locked} onPress={() => onEdit('workout', w.id)} />
              <Button label="삭제" disabled={locked} onPress={() => onRemove('workouts', w.id)} />
            </View>
          ))
        )}
      </View>
    </>
  );
}
