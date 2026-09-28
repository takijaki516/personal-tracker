import { Pressable, Text } from 'react-native';
import { styles as s } from './styles';

export default function Button({
  label,
  onPress,
  primary = false,
  disabled = false,
  selected = false,
  danger = false,
  secondary = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  selected?: boolean;
  danger?: boolean;
  secondary?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled,
        selected,
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondaryButton,
        danger && s.dangerButton,
        primary && s.primary,
        selected && s.selected,
        pressed && { opacity: 0.65 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          secondary && s.secondaryText,
          danger && s.dangerText,
          primary && { color: '#fff' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
