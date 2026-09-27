import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { Day } from '../../domain/data';
import Button from './Button';
import Field from './Field';
import { styles as s } from './styles';
import type { SaveResult } from './useTrackerRecords';

export type RecordKind = 'meal' | 'workout';

export type Editor = { kind: RecordKind; id: string | null; date: string };

type Props = {
  editor: Editor;
  day: Day;
  busy: boolean;
  onSave: (day: Day, date: string) => Promise<SaveResult>;
  onClose: () => void;
};

export default function RecordEditor({ editor, day, busy, onSave, onClose }: Props) {
  const meal =
    editor.kind === 'meal' ? day.meals.find((entry) => entry.id === editor.id) : undefined;
  const workout =
    editor.kind === 'workout' ? day.workouts.find((entry) => entry.id === editor.id) : undefined;
  const item = meal ?? workout;
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(meal ? String(meal.calories) : '');
  const [slot, setSlot] = useState(meal?.slot ?? '아침');
  const [formError, setFormError] = useState('');
  async function submit() {
    if (!name.trim()) {
      setFormError('이름을 입력해 주세요.');
      return;
    }
    const current = day;
    const next = { ...current };
    if (editor.kind === 'meal') {
      const calories = Number(amount.trim());
      if (!amount.trim() || !Number.isFinite(calories) || calories < 0 || calories > 20000) {
        setFormError('칼로리 0~20,000 범위로 입력해 주세요.');
        return;
      }
      const item = {
        id: editor.id ?? Crypto.randomUUID(),
        name: name.trim(),
        calories,
        slot,
      };
      next.meals = editor.id
        ? current.meals.map((m) => (m.id === editor.id ? item : m))
        : [...current.meals, item];
    }
    if (editor.kind === 'workout') {
      const item = {
        id: editor.id ?? Crypto.randomUUID(),
        name: name.trim(),
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
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.sectionTitle}>{editor.kind === 'meal' ? '식단' : '운동'} 기록</Text>
            <Text style={s.caption}>{editor.date}</Text>
            {editor.kind === 'meal' && (
              <View
                style={[
                  s.row,
                  {
                    marginTop: 15,
                    flexWrap: 'wrap',
                  },
                ]}
              >
                {['아침', '점심', '저녁', '간식'].map((t) => (
                  <Button key={t} label={t} selected={slot === t} onPress={() => setSlot(t)} />
                ))}
              </View>
            )}
            <Field
              label={editor.kind === 'meal' ? '음식 이름' : '운동 이름'}
              value={name}
              onChangeText={setName}
            />
            {editor.kind === 'meal' && (
              <Field
                label="칼로리 (kcal)"
                value={amount}
                onChangeText={setAmount}
                numeric
                maxLength={10}
              />
            )}
            {!!formError && (
              <Text accessibilityRole="alert" style={s.error}>
                {formError}
              </Text>
            )}
            <View
              style={[
                s.row,
                {
                  justifyContent: 'flex-end',
                  marginTop: 24,
                },
              ]}
            >
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
