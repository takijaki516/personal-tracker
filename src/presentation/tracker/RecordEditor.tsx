import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import {
  MACRONUTRIENTS,
  MAX_REPS,
  MAX_WEIGHT_KG,
  MAX_WORKOUT_SETS,
  type BodyPart,
  type Day,
  type FavoriteFood,
  type Meal,
  type Store,
  type WorkoutSet,
} from '../../domain/data';
import { findFavoriteFood, parseFoodInput } from '../../domain/favorite-foods';
import { foodSearchSelection, type FoodSearchResult } from '../../domain/food-search';
import { WORKOUT_OPTIONS } from '../../domain/workout-options';
import Button from './Button';
import FavoriteFoods from './FavoriteFoods';
import Field from './Field';
import FoodNameInput from './FoodNameInput';
import { styles as s } from './styles';
import { errorText, type SaveResult } from './useTrackerRecords';
import WorkoutSelect from './WorkoutSelect';

export type RecordKind = 'meal' | 'workout';

export type Editor = { kind: RecordKind; id: string | null; date: string };

type SetInput = { reps: string; weightKg: string };

type Props = {
  editor: Editor;
  day: Day;
  days: Store['days'];
  favoriteFoods: FavoriteFood[];
  busy: boolean;
  onSave: (day: Day, date: string) => Promise<SaveResult>;
  onSaveFavorite: (food: FavoriteFood) => Promise<SaveResult>;
  onRemoveFavorite: (id: string) => Promise<SaveResult>;
  onClose: () => void;
};

export default function RecordEditor({
  editor,
  day,
  days,
  favoriteFoods,
  busy,
  onSave,
  onSaveFavorite,
  onRemoveFavorite,
  onClose,
}: Props) {
  const meal =
    editor.kind === 'meal' ? day.meals.find((entry) => entry.id === editor.id) : undefined;
  const workout =
    editor.kind === 'workout' ? day.workouts.find((entry) => entry.id === editor.id) : undefined;
  const item = meal ?? workout;
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(meal ? String(meal.calories) : '');
  const [macros, setMacros] = useState(() => ({
    carbohydrates: meal?.carbohydrates?.toString() ?? '',
    protein: meal?.protein?.toString() ?? '',
    fat: meal?.fat?.toString() ?? '',
  }));
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
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const [selectedSearchFood, setSelectedSearchFood] = useState<FoodSearchResult | null>(null);
  const existingFavorite = findFavoriteFood(favoriteFoods, name);
  const favoriteActionLabel = existingFavorite ? '☆ 즐겨찾기 업데이트' : '☆ 즐겨찾기 등록';

  function selectFood(food: Omit<FavoriteFood, 'id'>) {
    setName(food.name);
    setAmount(String(food.calories));
    setMacros({
      carbohydrates: food.carbohydrates?.toString() ?? '',
      protein: food.protein?.toString() ?? '',
      fat: food.fat?.toString() ?? '',
    });
    setFormError('');
    setFavoriteMessage('');
    setSelectedSearchFood(null);
  }

  function readFood() {
    setFormError('');
    setFavoriteMessage('');
    try {
      return parseFoodInput({
        name,
        calories: amount,
        ...macros,
      });
    } catch (error) {
      setFormError(errorText(error));
      return null;
    }
  }

  async function saveFavorite() {
    const food = readFood();
    if (!food) {
      return;
    }
    const result = await onSaveFavorite({
      ...food,
      id: existingFavorite?.id ?? Crypto.randomUUID(),
    });
    if (result.ok) {
      setFavoriteMessage(
        existingFavorite ? '즐겨찾는 음식을 업데이트했습니다.' : '즐겨찾기에 등록했습니다.',
      );
    } else if (result.error) {
      setFormError(result.error);
    }
  }

  async function removeFavorite(id: string) {
    setFormError('');
    setFavoriteMessage('');
    const result = await onRemoveFavorite(id);
    if (result.ok) {
      setFavoriteMessage('즐겨찾기에서 해제했습니다.');
    } else if (result.error) {
      setFormError(result.error);
    }
  }

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
      const food = readFood();
      if (!food) {
        return;
      }
      const item: Meal = {
        ...food,
        id: editor.id ?? Crypto.randomUUID(),
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
                  <Button
                    key={t}
                    label={t}
                    selected={slot === t}
                    disabled={busy}
                    onPress={() => setSlot(t)}
                  />
                ))}
              </View>
            )}
            {editor.kind === 'meal' && (
              <>
                <FavoriteFoods
                  foods={favoriteFoods}
                  disabled={busy}
                  registerLabel={favoriteActionLabel}
                  onRegister={() => void saveFavorite()}
                  onSelect={selectFood}
                  onRemove={(id) => void removeFavorite(id)}
                />
                <FoodNameInput
                  value={name}
                  days={days}
                  favoriteFoods={favoriteFoods}
                  disabled={busy}
                  onChangeText={(value) => {
                    setName(value);
                    setSelectedSearchFood(null);
                  }}
                  onSelect={selectFood}
                  onSearchSelect={(food) => {
                    selectFood(foodSearchSelection(food));
                    setSelectedSearchFood(food);
                  }}
                />
              </>
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
              <>
                {selectedSearchFood && (
                  <Text style={[s.caption, { marginTop: 12 }]}>
                    FatSecret · {selectedSearchFood.servingText} 기준 영양정보입니다. 섭취량이
                    다르면 아래 값을 조정해 주세요.
                  </Text>
                )}
                <Field
                  label="총 칼로리 (kcal)"
                  value={amount}
                  onChangeText={setAmount}
                  numeric
                  maxLength={10}
                  disabled={busy}
                />
                {MACRONUTRIENTS.map(({ key, label }) => (
                  <Field
                    key={key}
                    label={`${label} (g)`}
                    value={macros[key]}
                    onChangeText={(value) =>
                      setMacros((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }
                    numeric
                    maxLength={10}
                    disabled={busy}
                  />
                ))}
                <Text style={s.caption}>영양소는 알고 있는 값만 입력해 주세요.</Text>
                <View style={s.favoriteFoodActions}>
                  <Button
                    label={favoriteActionLabel}
                    secondary
                    disabled={busy}
                    onPress={() => void saveFavorite()}
                  />
                  <Text style={s.caption}>
                    {existingFavorite
                      ? '같은 이름의 음식에 현재 칼로리와 영양소를 저장합니다.'
                      : '현재 음식과 칼로리·영양소를 저장해 다음 기록에 사용할 수 있어요.'}
                  </Text>
                  {!!favoriteMessage && (
                    <Text accessibilityLiveRegion="polite" style={s.body}>
                      {favoriteMessage}
                    </Text>
                  )}
                </View>
              </>
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
