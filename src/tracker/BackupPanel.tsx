import { Text, View } from 'react-native';

import Button from './Button';
import { styles as s } from './styles';

export default function BackupPanel({
  locked,
  busy,
  onExport,
  onRestore,
}: {
  locked: boolean;
  busy: boolean;
  onExport: () => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  return (
    <View style={s.footer}>
      <Text style={s.body}>기록 백업 및 복원</Text>
      <Text style={s.caption}>
        백업 복원은 현재 기록을 교체합니다. 복원한 변경 사항도 연결된 기기에 동기화됩니다. 자동
        백업도 이 기기에 있으므로 앱 데이터를 삭제하기 전 외부로 내보내 주세요.
      </Text>
      <View style={[s.row, { marginTop: 8 }]}>
        <Button label="백업 내보내기" disabled={locked} onPress={() => void onExport()} />
        <Button label="백업 복원" disabled={busy} onPress={() => void onRestore()} />
      </View>
    </View>
  );
}
