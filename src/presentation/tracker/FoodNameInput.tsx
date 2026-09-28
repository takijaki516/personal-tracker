import { useRef } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { styles as s } from './styles';

type Props = {
  value: string;
  disabled: boolean;
  onOpen: () => void;
};

export default function FoodNameInput({ value, disabled, onOpen }: Props) {
  const input = useRef<TextInput | null>(null);

  function openSelection() {
    if (disabled) {
      return;
    }
    input.current?.blur();
    onOpen();
  }

  return (
    <View style={s.field}>
      <Text style={s.label}>음식 이름</Text>
      <TextInput
        ref={input}
        accessibilityLabel="음식 이름"
        accessibilityHint="음식을 검색하거나 선택하는 화면으로 이동합니다."
        accessibilityState={{ disabled }}
        autoComplete="off"
        readOnly={Platform.OS === 'web' || disabled}
        showSoftInputOnFocus={false}
        value={value}
        placeholder="음식 검색 또는 직접 입력"
        onFocus={openSelection}
        onPressIn={openSelection}
        style={[s.input, disabled && { opacity: 0.4 }]}
      />
    </View>
  );
}
