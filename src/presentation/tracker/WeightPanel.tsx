import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { shiftDate, type Store } from '../../domain/data';
import Button from './Button';
import { styles as s } from './styles';

type Props = {
  days: Store['days'];
  date: string;
  weight: number | null;
  locked: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onDateChange: (date: string) => void;
};

export default function WeightPanel({
  days,
  date,
  weight,
  locked,
  onEdit,
  onRemove,
  onDateChange,
}: Props) {
  const [history, setHistory] = useState(false);
  const weights = Object.entries(days)
    .filter(([d, v]) => d <= date && d >= shiftDate(date, -29) && v.weight !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  const values = weights.map(([, v]) => v.weight!);
  const low = Math.min(...values) - 0.5;
  const high = Math.max(...values) + 0.5;
  const points = weights.map(([d, v]) => ({
    date: d,
    x: 20 + ((Date.parse(d) - Date.parse(shiftDate(date, -29))) / 86400000 / 29) * 560,
    y: 110 - ((v.weight! - low) / (high - low)) * 85,
  }));

  return (
    <>
      <View style={[s.between, { minHeight: 44 }]}>
        <Text style={s.sectionTitle}>내 몸의 변화</Text>
        <Text style={s.caption}>최근 30일</Text>
      </View>
      <View style={s.card}>
        <View style={s.between}>
          <Text style={s.sectionTitle}>체중 기록</Text>
          <Button label={weight === null ? '＋ 기록' : '수정'} disabled={locked} onPress={onEdit} />
        </View>
        <Text style={s.weight}>
          {weight ?? '—'}
          <Text style={s.unit}> kg</Text>
        </Text>
        {weights.length ? (
          <>
            <Svg
              width="100%"
              height={150}
              viewBox="0 0 600 140"
              accessibilityLabel="최근 30일 체중 추이"
            >
              <Line x1="20" x2="580" y1="115" y2="115" stroke="#e2e7dd" />
              {points.length > 1 && (
                <Polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke="#42745a"
                  strokeWidth="3"
                  fill="none"
                />
              )}
              {points.map((p) => (
                <Circle key={p.date} cx={p.x} cy={p.y} r="4" fill="#42745a" />
              ))}
            </Svg>
            <View style={s.between}>
              <Text style={s.caption}>{shiftDate(date, -29).slice(5)}</Text>
              <Text style={s.caption}>{date.slice(5)}</Text>
            </View>
            <Button
              label={`${history ? '접기' : '체중 기록 보기'} (${weights.length}개)`}
              onPress={() => setHistory(!history)}
            />
            {history &&
              weights.map(([d, v]) => (
                <View key={d} style={s.between}>
                  <Button label={d} onPress={() => onDateChange(d)} />
                  <Text style={s.body}>{v.weight} kg</Text>
                </View>
              ))}
          </>
        ) : (
          <View style={s.empty}>
            <Text style={s.body}>변화는 기록에서 시작돼요.</Text>
            <Text style={s.caption}>체중을 입력하면 추이가 표시돼요.</Text>
          </View>
        )}
        {weight !== null && (
          <Button label="선택한 날짜의 체중 삭제" disabled={locked} onPress={onRemove} />
        )}
      </View>
      <View style={s.gentle}>
        <Text style={s.sectionTitle}>작은 기록, 나다운 루틴</Text>
        <Text style={s.subtitle}>
          완벽한 하루가 아니어도 괜찮아요.{'\n'}기록을 이어가는 것만으로 충분해요.
        </Text>
      </View>
    </>
  );
}
