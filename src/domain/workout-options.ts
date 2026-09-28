import type { Workout } from './data';

export type WorkoutOption = Pick<Workout, 'name' | 'bodyPart'>;

export const WORKOUT_OPTIONS: readonly WorkoutOption[] = [
  {
    name: 'Bench Press',
    bodyPart: 'chest',
  },
  {
    name: 'Smith Machine Bench Press',
    bodyPart: 'chest',
  },
  {
    name: 'Incline Bench Press',
    bodyPart: 'chest',
  },
  {
    name: 'Smith Machine Incline Bench Press',
    bodyPart: 'chest',
  },
  {
    name: 'Push-up',
    bodyPart: 'chest',
  },
  {
    name: 'Machine Chest Press',
    bodyPart: 'chest',
  },
  {
    name: 'Machine Incline Chest Press',
    bodyPart: 'chest',
  },
  {
    name: 'Pull-up',
    bodyPart: 'back',
  },
  {
    name: 'Lat Pulldown',
    bodyPart: 'back',
  },
  {
    name: 'Low Row',
    bodyPart: 'back',
  },
  {
    name: 'DY Row',
    bodyPart: 'back',
  },
  {
    name: 'Cable Row',
    bodyPart: 'back',
  },
  {
    name: 'Dumbbell Row',
    bodyPart: 'back',
  },
  {
    name: 'Machine Pulldown',
    bodyPart: 'back',
  },
  {
    name: 'Machine Curl',
    bodyPart: 'biceps',
  },
  {
    name: 'Dumbbell Curl',
    bodyPart: 'biceps',
  },
  {
    name: 'Hammer Curl',
    bodyPart: 'biceps',
  },
  {
    name: 'Cable Curl',
    bodyPart: 'biceps',
  },
  {
    name: 'Cable Pushdown',
    bodyPart: 'triceps',
  },
  {
    name: 'One-arm Cable Pushdown',
    bodyPart: 'triceps',
  },
  {
    name: 'Viking Press',
    bodyPart: 'shoulders',
  },
  {
    name: 'Dumbbell Shoulder Press',
    bodyPart: 'shoulders',
  },
  {
    name: 'Machine Shoulder Press',
    bodyPart: 'shoulders',
  },
  {
    name: 'Dumbbell Side Lateral Raise',
    bodyPart: 'shoulders',
  },
  {
    name: 'Reverse Fly',
    bodyPart: 'shoulders',
  },
  {
    name: 'Linear Hack Squat',
    bodyPart: 'legs',
  },
  {
    name: 'Hack Squat',
    bodyPart: 'legs',
  },
  {
    name: 'Leg Press',
    bodyPart: 'legs',
  },
  {
    name: 'Leg Extension',
    bodyPart: 'legs',
  },
  {
    name: 'Leg Curl',
    bodyPart: 'legs',
  },
  {
    name: 'adduction(내전)',
    bodyPart: 'legs',
  },
  {
    name: 'abduction(외전)',
    bodyPart: 'legs',
  },
];
