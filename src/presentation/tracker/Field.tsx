import { Text, TextInput, View } from 'react-native';
import { styles as s } from './styles';

export default function Field({
  label,
  value,
  onChangeText,
  numeric = false,
  multiline = false,
  maxLength = 100,
  disabled = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        editable={!disabled}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          s.input,
          disabled && { opacity: 0.4 },
          multiline && {
            minHeight: 86,
            textAlignVertical: 'top',
          },
        ]}
      />
    </View>
  );
}
