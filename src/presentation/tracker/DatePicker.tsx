import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { localDate } from '../../domain/data';
import Button from './Button';
import { calendarDates, shiftMonth } from './calendar';
import { styles as s } from './styles';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

export default function DatePicker({
  date,
  onSelect,
  onClose,
}: {
  date: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(date.slice(0, 7));
  const today = localDate();
  const [year, monthNumber] = month.split('-');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.modal, s.calendarModal]} accessibilityViewIsModal>
          <View style={s.between}>
            <Text style={s.sectionTitle}>날짜 선택</Text>
            <Button label="닫기" onPress={onClose} />
          </View>
          <View style={[s.between, s.calendarMonthHeader]}>
            <Button
              label="‹"
              accessibilityLabel="이전 달"
              onPress={() => setMonth(shiftMonth(month, -1))}
            />
            <Text style={s.calendarMonthLabel}>
              {year}년 {Number(monthNumber)}월
            </Text>
            <Button
              label="›"
              accessibilityLabel="다음 달"
              onPress={() => setMonth(shiftMonth(month, 1))}
            />
          </View>
          <View style={s.calendarGrid}>
            {weekdays.map((weekday) => (
              <View key={weekday} style={s.calendarCell}>
                <Text style={s.calendarWeekday}>{weekday}</Text>
              </View>
            ))}
            {calendarDates(month).map((day, index) => (
              <View key={day ?? `empty-${index}`} style={s.calendarCell}>
                {day && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${day} 선택`}
                    accessibilityState={{ selected: day === date }}
                    onPress={() => {
                      onSelect(day);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      s.calendarDay,
                      day === today && s.calendarToday,
                      day === date && s.calendarSelectedDay,
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <Text style={[s.calendarDayText, day === date && s.calendarSelectedDayText]}>
                      {Number(day.slice(-2))}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
