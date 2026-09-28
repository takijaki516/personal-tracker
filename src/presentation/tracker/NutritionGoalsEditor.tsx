import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { NUTRITION_METRICS, type NutritionGoals } from '../../domain/data';
import { parseNutritionGoalInput, type NutritionGoalInput } from '../../domain/nutrition-goals';
import Button from './Button';
import Field from './Field';
import { styles as s } from './styles';
import { errorText, type SaveResult } from './useTrackerRecords';

type Props = {
  goals: NutritionGoals;
  busy: boolean;
  onSave: (goals: NutritionGoals) => Promise<SaveResult>;
  onClose: () => void;
};

export default function NutritionGoalsEditor({ goals, busy, onSave, onClose }: Props) {
  const [input, setInput] = useState<NutritionGoalInput>(() => ({
    calories: goals.calories?.toString() ?? '',
    carbohydrates: goals.carbohydrates?.toString() ?? '',
    protein: goals.protein?.toString() ?? '',
    fat: goals.fat?.toString() ?? '',
  }));
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) {
        onClose();
      }
      return true;
    });
    return () => subscription.remove();
  }, [busy, onClose]);

  async function submit() {
    if (busy) {
      return;
    }
    setFormError('');
    try {
      const next = parseNutritionGoalInput(input);
      const result = await onSave(next);
      if (result.ok) {
        onClose();
      } else if (result.error) {
        setFormError(result.error);
      }
    } catch (error) {
      setFormError(errorText(error));
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.editorScreen}
    >
      <View style={s.editorHeader}>
        <View style={s.editorHeaderContent}>
          <Button
            label="‹ 뒤로"
            accessibilityLabel="섭취 목표 설정 뒤로가기"
            disabled={busy}
            onPress={onClose}
          />
          <Text accessibilityRole="header" style={s.sectionTitle}>
            하루 섭취 목표
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.editorContent} keyboardShouldPersistTaps="handled">
        <Text style={s.subtitle}>모든 날짜에 동일한 하루 목표를 적용합니다.</Text>
        <Text style={s.caption}>
          항목별로 설정할 수 있으며, 빈칸으로 저장하면 목표를 해제합니다.
        </Text>
        {NUTRITION_METRICS.map(({ key, goalLabel, unit }) => (
          <Field
            key={key}
            label={`${goalLabel} (${unit})`}
            value={input[key]}
            onChangeText={(value) => {
              setInput((current) => ({
                ...current,
                [key]: value,
              }));
              setFormError('');
            }}
            numeric
            maxLength={10}
            disabled={busy}
          />
        ))}
        {!!formError && (
          <Text accessibilityRole="alert" style={s.error}>
            {formError}
          </Text>
        )}
        <View style={s.nutritionGoalActions}>
          <Button label="취소" disabled={busy} onPress={onClose} />
          <Button
            label={busy ? '저장 중…' : '목표 저장'}
            primary
            disabled={busy}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
