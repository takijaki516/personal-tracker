import { useEffect, type RefObject } from 'react';
import type { TextInput } from 'react-native';

export function useFoodInputComposition(
  input: RefObject<TextInput | null>,
  onChange: (composing: boolean) => void,
) {
  useEffect(() => {
    // React Native Web forwards TextInput refs to the actual DOM input.
    const element = input.current;
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const start = () => onChange(true);
    const end = () => onChange(false);
    element.addEventListener('compositionstart', start);
    element.addEventListener('compositionend', end);
    element.addEventListener('blur', end);
    return () => {
      element.removeEventListener('compositionstart', start);
      element.removeEventListener('compositionend', end);
      element.removeEventListener('blur', end);
    };
  }, [input, onChange]);
}
