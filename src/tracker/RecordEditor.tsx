import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';

import type { Day } from '../data';
import Button from './Button';
import Field from './Field';
import { styles as s } from './styles';
import type { SaveResult } from './useTrackerRecords';

export type RecordKind = 'meal' | 'workout' | 'weight';
export type Editor = { kind: RecordKind; id: string | null; date: string };
type Props = {
  editor: Editor;
  day: Day;
  busy: boolean;
  onSave: (day: Day, date: string) => Promise<SaveResult>;
  onClose: () => void;
};

const fields = {
  meal: { title: '식단', amountLabel: '칼로리 (kcal)', max: 20000, range: '칼로리 0~20,000' },
  workout: {
    title: '운동',
    amountLabel: '운동 시간 (분)',
    max: 1440,
    range: '운동 시간 0.1~1,440분',
  },
  weight: { title: '체중', amountLabel: '체중 (kg)', max: 500, range: '체중 0.1~500kg' },
};

export default function RecordEditor({ editor, day, busy, onSave, onClose }: Props) {
  const field = fields[editor.kind];
  const item =
    editor.kind === 'meal'
      ? day.meals.find((meal) => meal.id === editor.id)
      : day.workouts.find((workout) => workout.id === editor.id);
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(() => {
    if (editor.kind === 'weight') {
      return String(day.weight ?? '');
    }
    if (item) {
      return String('calories' in item ? item.calories : item.minutes);
    }
    return '';
  });
  const [slot, setSlot] = useState(item && 'slot' in item ? item.slot : '아침');
  const [note, setNote] = useState(item && 'note' in item ? item.note : '');
  const [formError, setFormError] = useState('');
  async function submit() {
    const n = Number(amount.trim());
    if (
      !amount.trim() ||
      !Number.isFinite(n) ||
      n < (editor.kind === 'meal' ? 0 : 0.1) ||
      n > field.max ||
      (editor.kind !== 'weight' && !name.trim())
    ) {
      setFormError(`이름과 수치를 확인해 주세요. ${field.range} 범위로 입력할 수 있어요.`);
      return;
    }
    const current = day;
    const next = { ...current };
    if (editor.kind === 'weight') {
      next.weight = n;
    }
    if (editor.kind === 'meal') {
      const item = { id: editor.id ?? Crypto.randomUUID(), name: name.trim(), calories: n, slot };
      next.meals = editor.id
        ? current.meals.map((m) => (m.id === editor.id ? item : m))
        : [...current.meals, item];
    }
    if (editor.kind === 'workout') {
      const item = {
        id: editor.id ?? Crypto.randomUUID(),
        name: name.trim(),
        minutes: n,
        note: note.trim(),
      };
      next.workouts = editor.id
        ? current.workouts.map((w) => (w.id === editor.id ? item : w))
        : [...current.workouts, item];
    }
    const result = await onSave(next, editor.date);
    if (result.ok) {
      onClose();
    } else if (result.error) {
      setFormError(result.error);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.overlay}
      >
        <View style={s.modal} accessibilityViewIsModal>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sectionTitle}>{field.title} 기록</Text>
            <Text style={s.caption}>{editor.date}</Text>
            {editor.kind === 'meal' && (
              <View style={[s.row, { marginTop: 15, flexWrap: 'wrap' }]}>
                {['아침', '점심', '저녁', '간식'].map((t) => (
                  <Button key={t} label={t} selected={slot === t} onPress={() => setSlot(t)} />
                ))}
              </View>
            )}
            {editor.kind !== 'weight' && (
              <Field
                label={editor.kind === 'meal' ? '음식 이름' : '운동 이름'}
                value={name}
                onChangeText={setName}
              />
            )}
            <Field
              label={field.amountLabel}
              value={amount}
              onChangeText={setAmount}
              numeric
              maxLength={10}
            />
            {editor.kind === 'workout' && (
              <Field
                label="메모 (선택)"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={500}
              />
            )}
            {!!formError && (
              <Text accessibilityRole="alert" style={s.error}>
                {formError}
              </Text>
            )}
            <View style={[s.row, { justifyContent: 'flex-end', marginTop: 24 }]}>
              <Button label="취소" disabled={busy} onPress={() => onClose()} />
              <Button
                label={busy ? '저장 중…' : '기록 저장'}
                primary
                disabled={busy}
                onPress={() => void submit()}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
