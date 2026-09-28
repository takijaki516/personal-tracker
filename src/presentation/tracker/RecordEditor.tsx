import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import {
  MAX_REPS,
  MAX_WEIGHT_KG,
  MAX_WORKOUT_SETS,
  type BodyPart,
  type Day,
  type WorkoutSet,
} from '../../domain/data';
import { WORKOUT_OPTIONS } from '../../domain/workout-options';
import Button from './Button';
import Field from './Field';
import { styles as s } from './styles';
import type { SaveResult } from './useTrackerRecords';
import WorkoutSelect from './WorkoutSelect';

export type RecordKind = 'meal' | 'workout';

export type Editor = { kind: RecordKind; id: string | null; date: string };

type SetInput = { reps: string; weightKg: string };

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
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(workout?.bodyPart ?? null);
  const [sets, setSets] = useState<SetInput[]>(
    workout?.sets.map((set) => ({
      reps: String(set.reps),
      weightKg: String(set.weightKg),
    })) ?? [
      {
        reps: '',
        weightKg: '',
      },
    ],
  );
  const [formError, setFormError] = useState('');
  function updateSet(index: number, field: keyof SetInput, value: string) {
    setSets((current) =>
      current.map((set, position) =>
        position === index
          ? {
              ...set,
              [field]: value,
            }
          : set,
      ),
    );
  }
  async function submit() {
    const current = day;
    const next = { ...current };
    if (editor.kind === 'meal') {
      if (!name.trim()) {
        setFormError('이름을 입력해 주세요.');
        return;
      }
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
      if (bodyPart === null) {
        setFormError('운동 부위를 선택해 주세요.');
        return;
      }
      if (!name.trim()) {
        setFormError('운동을 선택해 주세요.');
        return;
      }
      const parsedSets: WorkoutSet[] = [];
      for (const [index, set] of sets.entries()) {
        const reps = Number(set.reps.trim());
        const weightKg = Number(set.weightKg.trim());
        if (!set.reps.trim() || !Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) {
          setFormError(`${index + 1}세트의 횟수를 1~${MAX_REPS} 범위의 정수로 입력해 주세요.`);
          return;
        }
        if (
          !set.weightKg.trim() ||
          !Number.isFinite(weightKg) ||
          weightKg < 0 ||
          weightKg > MAX_WEIGHT_KG
        ) {
          setFormError(`${index + 1}세트의 중량을 0~${MAX_WEIGHT_KG}kg 범위로 입력해 주세요.`);
          return;
        }
        parsedSets.push({
          reps,
          weightKg,
        });
      }
      const item = {
        id: editor.id ?? Crypto.randomUUID(),
        name: name.trim(),
        bodyPart,
        sets: parsedSets,
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
            {editor.kind === 'meal' && (
              <Field label="음식 이름" value={name} onChangeText={setName} />
            )}
            {editor.kind === 'workout' && (
              <>
                <WorkoutSelect
                  name={name}
                  bodyPart={bodyPart}
                  options={WORKOUT_OPTIONS}
                  disabled={busy}
                  onBodyPartChange={(part) => {
                    if (part !== bodyPart) {
                      setName('');
                    }
                    setBodyPart(part);
                    setFormError('');
                  }}
                  onSelect={(option) => {
                    setName(option.name);
                    setBodyPart(option.bodyPart);
                    setFormError('');
                  }}
                />
                <Text style={[s.label, { marginTop: 20 }]}>세트 ({sets.length})</Text>
                {sets.map((set, index) => (
                  <View key={index} style={s.workoutSet}>
                    <View style={s.between}>
                      <Text style={s.body}>{index + 1}세트</Text>
                      {sets.length > 1 && (
                        <Button
                          label="세트 삭제"
                          disabled={busy}
                          onPress={() =>
                            setSets((current) => current.filter((_, i) => i !== index))
                          }
                        />
                      )}
                    </View>
                    <View style={s.workoutSetFields}>
                      <View style={s.workoutSetField}>
                        <Field
                          label="횟수 (reps)"
                          value={set.reps}
                          onChangeText={(value) => updateSet(index, 'reps', value)}
                          numeric
                          maxLength={4}
                        />
                      </View>
                      <View style={s.workoutSetField}>
                        <Field
                          label="중량 (kg)"
                          value={set.weightKg}
                          onChangeText={(value) => updateSet(index, 'weightKg', value)}
                          numeric
                          maxLength={7}
                        />
                      </View>
                    </View>
                    <Text style={s.caption}>0kg은 Body weight로 표시됩니다.</Text>
                  </View>
                ))}
                <Button
                  label="＋ 세트 추가"
                  disabled={busy || sets.length >= MAX_WORKOUT_SETS}
                  onPress={() =>
                    setSets((current) => [
                      ...current,
                      {
                        reps: '',
                        weightKg: '',
                      },
                    ])
                  }
                />
              </>
            )}
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
