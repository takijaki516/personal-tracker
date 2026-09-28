import { BODY_PARTS, type BodyPart } from '../../domain/data';
import type { WorkoutOption } from '../../domain/workout-options';
import Dropdown from './Dropdown';

type Props = {
  name: string;
  bodyPart: BodyPart | null;
  options: readonly WorkoutOption[];
  disabled: boolean;
  onBodyPartChange: (bodyPart: BodyPart) => void;
  onSelect: (option: WorkoutOption) => void;
};

const bodyPartOptions = (Object.entries(BODY_PARTS) as [BodyPart, string][]).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export default function WorkoutSelect({
  name,
  bodyPart,
  options,
  disabled,
  onBodyPartChange,
  onSelect,
}: Props) {
  const workouts = options.filter((option) => option.bodyPart === bodyPart);
  let placeholder = '운동을 선택해 주세요';
  if (bodyPart === null) {
    placeholder = '운동 부위를 먼저 선택해 주세요';
  } else if (workouts.length === 0) {
    placeholder = '등록된 운동이 없습니다';
  }

  return (
    <>
      <Dropdown
        label="운동 부위"
        value={bodyPart}
        placeholder="운동 부위를 선택해 주세요"
        options={bodyPartOptions}
        disabled={disabled}
        onSelect={onBodyPartChange}
      />
      <Dropdown
        key={bodyPart ?? 'unselected'}
        label="운동"
        value={name || null}
        placeholder={placeholder}
        options={workouts.map((option) => ({
          value: option.name,
          label: option.name,
        }))}
        disabled={disabled || bodyPart === null || workouts.length === 0}
        onSelect={(selectedName) => {
          const option = workouts.find((workout) => workout.name === selectedName);
          if (option) {
            onSelect(option);
          }
        }}
      />
    </>
  );
}
