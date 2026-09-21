import { Pressable, Text } from 'react-native';
import { styles as s } from './styles';

export default function Button({
  label,
  onPress,
  primary = false,
  disabled = false,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled,
        selected,
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        primary && s.primary,
        selected && s.selected,
        pressed && { opacity: 0.65 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[s.buttonText, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}
