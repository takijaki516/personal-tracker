import type { RefObject } from 'react';
import type { TextInput } from 'react-native';

export function useFoodInputComposition(
  _input: RefObject<TextInput | null>,
  _onChange: (composing: boolean) => void,
): void {}
