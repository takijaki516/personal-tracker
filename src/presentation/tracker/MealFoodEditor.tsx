import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { createMealFoodInput, type MealFoodInput } from '../../application/meal-editor';
import type { FavoriteFood } from '../../domain/data';
import { findFavoriteFood } from '../../domain/favorite-foods';
import { parseMealNutritionInput } from '../../domain/food-portion';
import Button from './Button';
import FavoriteFoods from './FavoriteFoods';
import FoodNameInput from './FoodNameInput';
import MealNutritionFields from './MealNutritionFields';
import { styles as s } from './styles';
import { errorText, type SaveResult } from './useTrackerRecords';

export type MealFoodDraft = MealFoodInput & { fromSearch?: boolean };

type FoodFeedback = { draft: MealFoodDraft; message?: string; error?: string };

type Props = {
  draft: MealFoodDraft;
  index: number;
  removable: boolean;
  favoriteFoods: FavoriteFood[];
  busy: boolean;
  onChange: (draft: MealFoodDraft) => void;
  onOpenSelection: () => void;
  onRemove: () => void;
  onSaveFavorite: (food: FavoriteFood) => Promise<SaveResult>;
  onRemoveFavorite: (id: string) => Promise<SaveResult>;
};

export default function MealFoodEditor({
  draft,
  index,
  removable,
  favoriteFoods,
  busy,
  onChange,
  onOpenSelection,
  onRemove,
  onSaveFavorite,
  onRemoveFavorite,
}: Props) {
  const [feedback, setFeedback] = useState<FoodFeedback | null>(null);
  const message = feedback?.draft === draft ? feedback.message : '';
  const error = feedback?.draft === draft ? feedback.error : '';
  const existingFavorite = findFavoriteFood(favoriteFoods, draft.name);
  const favoriteActionLabel = existingFavorite ? '☆ 즐겨찾기 업데이트' : '☆ 즐겨찾기 등록';

  function change(next: MealFoodDraft) {
    setFeedback(null);
    onChange(next);
  }

  async function saveFavorite() {
    setFeedback(null);
    try {
      const food = parseMealNutritionInput(draft.name, draft.nutritionInput);
      const result = await onSaveFavorite({
        ...food,
        id: existingFavorite?.id ?? Crypto.randomUUID(),
      });
      if (result.ok) {
        setFeedback({
          draft,
          message: existingFavorite
            ? '즐겨찾는 음식을 업데이트했습니다.'
            : '즐겨찾기에 등록했습니다.',
        });
      } else if (result.error) {
        setFeedback({
          draft,
          error: result.error,
        });
      }
    } catch (error) {
      setFeedback({
        draft,
        error: errorText(error),
      });
    }
  }

  async function removeFavorite(id: string) {
    setFeedback(null);
    const result = await onRemoveFavorite(id);
    if (result.ok) {
      setFeedback({
        draft,
        message: '즐겨찾기에서 해제했습니다.',
      });
    } else if (result.error) {
      setFeedback({
        draft,
        error: result.error,
      });
    }
  }

  return (
    <View style={s.mealFoodEditor}>
      <View style={s.between}>
        <Text accessibilityRole="header" style={s.body}>
          음식 {index + 1}
        </Text>
        {removable && (
          <Button
            label="음식 삭제"
            accessibilityLabel={`음식 ${index + 1}${draft.name ? ` ${draft.name}` : ''} 삭제`}
            disabled={busy}
            onPress={onRemove}
          />
        )}
      </View>
      <FavoriteFoods
        foods={favoriteFoods}
        disabled={busy}
        registerLabel={favoriteActionLabel}
        onRegister={() => void saveFavorite()}
        onSelect={(food) => change(createMealFoodInput(draft.id, food))}
        onRemove={(id) => void removeFavorite(id)}
      />
      <FoodNameInput value={draft.name} disabled={busy} onOpen={onOpenSelection} />
      {draft.fromSearch && (
        <Text style={[s.caption, { marginTop: 12 }]}>
          FatSecret에서 가져온 영양정보입니다. 섭취량을 조절해 주세요.
        </Text>
      )}
      <MealNutritionFields
        input={draft.nutritionInput}
        disabled={busy}
        onChange={(nutritionInput) =>
          change({
            ...draft,
            nutritionInput,
          })
        }
      />
      <View style={s.favoriteFoodActions}>
        <Button
          label={favoriteActionLabel}
          secondary
          disabled={busy}
          onPress={() => void saveFavorite()}
        />
        <Text style={s.caption}>
          {existingFavorite
            ? '같은 이름의 음식에 현재 섭취량과 영양정보를 저장합니다.'
            : '현재 음식과 섭취량·영양정보를 저장해 다음 기록에 사용할 수 있어요.'}
        </Text>
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={s.body}>
            {message}
          </Text>
        )}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
