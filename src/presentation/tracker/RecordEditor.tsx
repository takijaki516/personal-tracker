import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { applyMealFoodInputs, createMealFoodInput } from '../../application/meal-editor';
import {
  MAX_REPS,
  MAX_WEIGHT_KG,
  MAX_WORKOUT_SETS,
  MEAL_SLOTS,
  type BodyPart,
  type Day,
  type FavoriteFood,
  type Store,
  type WorkoutSet,
} from '../../domain/data';
import { WORKOUT_OPTIONS } from '../../domain/workout-options';
import Button from './Button';
import { formatDateWithWeekday } from './calendar';
import Field from './Field';
import FoodSelectionScreen from './FoodSelectionScreen';
import MealFoodEditor, { type MealFoodDraft } from './MealFoodEditor';
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
  const [name, setName] = useState(workout?.name ?? '');
  const [mealFoods, setMealFoods] = useState<MealFoodDraft[]>(() =>
    editor.kind === 'meal' ? [createMealFoodInput(meal?.id ?? Crypto.randomUUID(), meal)] : [],
  );
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
  const [foodSelectionId, setFoodSelectionId] = useState<string | null>(null);
  const selectingFood = mealFoods.find((food) => food.id === foodSelectionId);
  const foodSelectionOpen = selectingFood !== undefined;
  const editorScroll = useRef<ScrollView | null>(null);
  const scrollOffset = useRef(0);
  const returnScrollOffset = useRef<number | null>(null);

  const closeFoodSelection = useCallback(() => {
    Keyboard.dismiss();
    setFoodSelectionId(null);
  }, []);
  const restoreEditorScroll = useCallback(() => {
    if (returnScrollOffset.current === null) {
      return;
    }
    editorScroll.current?.scrollTo({
      y: returnScrollOffset.current,
      animated: false,
    });
  }, []);

  useLayoutEffect(() => {
    if (foodSelectionOpen) {
      return;
    }
    restoreEditorScroll();
    const frame = requestAnimationFrame(() => {
      restoreEditorScroll();
      returnScrollOffset.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [foodSelectionOpen, restoreEditorScroll]);
  useEffect(() => {
    if (editor.kind !== 'meal') {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) {
        if (foodSelectionOpen) {
          closeFoodSelection();
        } else {
          onClose();
        }
      }
      return true;
    });
    return () => subscription.remove();
  }, [editor.kind, busy, foodSelectionOpen, closeFoodSelection, onClose]);

  function openFoodSelection(id: string) {
    if (!busy) {
      returnScrollOffset.current = scrollOffset.current;
      setFoodSelectionId(id);
    }
  }

  function changeFood(draft: MealFoodDraft) {
    setMealFoods((current) => current.map((food) => (food.id === draft.id ? draft : food)));
    setFormError('');
  }

  function addFood() {
    const draft = createMealFoodInput(Crypto.randomUUID());
    setMealFoods((current) => [...current, draft]);
    setFormError('');
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
      setFormError('');
      try {
        next.meals = applyMealFoodInputs(current, slot, mealFoods, editor.id).meals;
      } catch (error) {
        setFormError(errorText(error));
        return;
      }
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

  const foodSelection = editor.kind === 'meal' && selectingFood && (
    <FoodSelectionScreen
      name={selectingFood.name}
      date={editor.date}
      days={days}
      favoriteFoods={favoriteFoods}
      disabled={busy}
      onClose={closeFoodSelection}
      onNameSelect={(value) => {
        changeFood({
          ...selectingFood,
          name: value,
          fromSearch: value === selectingFood.name && selectingFood.fromSearch,
        });
        closeFoodSelection();
      }}
      onFoodsSelect={(foods) => {
        const drafts = foods.map(({ food, fromSearch }, index) => ({
          ...createMealFoodInput(index === 0 ? selectingFood.id : Crypto.randomUUID(), food),
          fromSearch,
        }));
        setMealFoods((current) =>
          current.flatMap((draft) => (draft.id === selectingFood.id ? drafts : [draft])),
        );
        setFormError('');
        closeFoodSelection();
      }}
    />
  );

  const form = (
    <>
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
          {MEAL_SLOTS.map((t) => (
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
          <Text style={[s.label, { marginTop: 20 }]}>음식 ({mealFoods.length}개)</Text>
          <Text style={s.caption}>음식을 여러 개 추가하고 각각의 섭취량을 조절할 수 있어요.</Text>
          {mealFoods.map((draft, index) => (
            <MealFoodEditor
              key={draft.id}
              draft={draft}
              index={index}
              removable={mealFoods.length > 1}
              favoriteFoods={favoriteFoods}
              busy={busy}
              onChange={changeFood}
              onOpenSelection={() => openFoodSelection(draft.id)}
              onRemove={() => {
                setMealFoods((current) => current.filter((food) => food.id !== draft.id));
                setFormError('');
              }}
              onSaveFavorite={onSaveFavorite}
              onRemoveFavorite={onRemoveFavorite}
            />
          ))}
          <Button label="＋ 음식 추가" disabled={busy} onPress={addFood} />
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
                    onPress={() => setSets((current) => current.filter((_, i) => i !== index))}
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
    </>
  );

  if (editor.kind === 'meal') {
    return (
      <>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[s.editorScreen, foodSelectionOpen && s.hidden]}
          accessibilityElementsHidden={foodSelectionOpen}
          importantForAccessibility={foodSelectionOpen ? 'no-hide-descendants' : 'auto'}
        >
          <View style={s.editorHeader}>
            <View style={s.editorHeaderContent}>
              <Button
                label="‹ 뒤로"
                accessibilityLabel="식단 기록으로 돌아가기"
                disabled={busy}
                onPress={onClose}
              />
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={s.sectionTitle}>
                  {editor.id ? '식단 수정' : '식단 추가'}
                </Text>
                <Text style={s.caption}>{formatDateWithWeekday(editor.date)}</Text>
              </View>
            </View>
          </View>
          <ScrollView
            ref={editorScroll}
            style={{ flex: 1 }}
            contentContainerStyle={s.editorContent}
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => {
              if (returnScrollOffset.current === null) {
                scrollOffset.current = event.nativeEvent.contentOffset.y;
              }
            }}
            scrollEventThrottle={16}
            onLayout={() => {
              if (!foodSelectionOpen) {
                restoreEditorScroll();
              }
            }}
          >
            {form}
          </ScrollView>
        </KeyboardAvoidingView>
        {foodSelection}
      </>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.overlay}
      >
        <View style={s.modal} accessibilityViewIsModal>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.sectionTitle}>운동 기록</Text>
            <Text style={s.caption}>{editor.date}</Text>
            {form}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
