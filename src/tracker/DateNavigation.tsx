import { useState } from 'react';
import { View } from 'react-native';

import { localDate, shiftDate } from '../data';
import Button from './Button';
import DatePicker from './DatePicker';
import { styles as s } from './styles';

export default function DateNavigation({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (date: string) => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  return (
    <>
      <View style={s.datebar}>
        <View style={s.row}>
          <Button label="‹ 이전" onPress={() => onDateChange(shiftDate(date, -1))} />
          <Button
            label={date}
            onPress={() => {
              setDateOpen(true);
            }}
          />
          <Button label="다음 ›" onPress={() => onDateChange(shiftDate(date, 1))} />
        </View>
        <Button label="오늘" onPress={() => onDateChange(localDate())} />
      </View>

      {dateOpen && (
        <DatePicker date={date} onSelect={onDateChange} onClose={() => setDateOpen(false)} />
      )}
    </>
  );
}
