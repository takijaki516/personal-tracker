import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { styles as s } from './styles';

type Option<Value extends string> = { value: Value; label: string };

type Props<Value extends string> = {
  label: string;
  value: Value | null;
  placeholder: string;
  options: readonly Option<Value>[];
  disabled: boolean;
  onSelect: (value: Value) => void;
};

export default function Dropdown<Value extends string>({
  label,
  value,
  placeholder,
  options,
  disabled,
  onSelect,
}: Props<Value>) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selectedLabel ? `${label} 선택: ${selectedLabel}` : `${label} 선택`}
        accessibilityState={{
          expanded: open,
          disabled,
        }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={[s.input, s.between, disabled && { opacity: 0.4 }]}
      >
        <Text style={[selectedLabel ? s.body : s.caption, { flex: 1 }]}>
          {selectedLabel || placeholder}
        </Text>
        <Text style={s.body}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && !disabled && (
        <ScrollView
          style={s.workoutOptions}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: option.value === value }}
              onPress={() => {
                onSelect(option.value);
                setOpen(false);
              }}
              style={({ pressed }) => [
                s.workoutOption,
                option.value === value && s.selected,
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={s.body}>{option.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
