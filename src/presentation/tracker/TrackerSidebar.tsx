import { Text, View } from 'react-native';
import Button from './Button';
import { styles as s } from './styles';

export default function TrackerSidebar({ onSelectToday }: { onSelectToday: () => void }) {
  return (
    <View style={s.sidebar}>
      <Text style={s.brand}>▣ 운동관리</Text>
      <Text style={s.subtitle}>나를 돌보는 작은 기록</Text>
      <View style={{ marginTop: 40 }}>
        <Button label="◫ 나의 기록" selected onPress={onSelectToday} />
      </View>
      <View style={{ flex: 1 }} />
      <Text style={s.eyebrow}>EVERY LITTLE DAY</Text>
      <Text style={s.sidebarQuote}>꾸준함은 작은{'\n'}기록에서 시작돼요.</Text>
    </View>
  );
}
