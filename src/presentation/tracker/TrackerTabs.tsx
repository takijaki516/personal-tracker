import { Pressable, Text, View } from 'react-native';
import { styles as s } from './styles';

export type TrackerTab = 'home' | 'meals' | 'workouts';

const tabs: { key: TrackerTab; label: string }[] = [
  {
    key: 'home',
    label: 'Home',
  },
  {
    key: 'meals',
    label: '식단',
  },
  {
    key: 'workouts',
    label: '운동',
  },
];

export default function TrackerTabs({
  selected,
  onSelect,
}: {
  selected: TrackerTab;
  onSelect: (tab: TrackerTab) => void;
}) {
  return (
    <View style={s.bottomTabs}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="기록 화면 탭"
        style={s.bottomTabsContent}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            aria-selected={selected === tab.key}
            onPress={() => onSelect(tab.key)}
            style={({ pressed }) => [
              s.bottomTab,
              selected === tab.key && s.selected,
              pressed && { opacity: 0.65 },
            ]}
          >
            <Text style={[s.bottomTabText, selected === tab.key && s.bottomTabSelectedText]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
