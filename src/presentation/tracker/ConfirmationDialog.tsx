import { Modal, Text, View } from 'react-native';
import Button from './Button';
import { styles as s } from './styles';

export type Confirmation = { title: string; description: string; run: () => Promise<boolean> };

type Props = { confirmation: Confirmation; busy: boolean; message: string; onClose: () => void };

export default function ConfirmationDialog({ confirmation, busy, message, onClose }: Props) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <View style={s.overlay}>
        <View style={s.modal} accessibilityViewIsModal>
          <Text style={s.sectionTitle}>{confirmation.title}</Text>
          <Text style={[s.body, { marginVertical: 20 }]}>{confirmation.description}</Text>
          <View style={[s.row, { justifyContent: 'flex-end' }]}>
            <Button label="취소" disabled={busy} onPress={() => onClose()} />
            <Button
              label={busy ? '처리 중…' : '확인'}
              primary
              disabled={busy}
              onPress={() => {
                void confirmation.run().then((ok) => {
                  if (ok) {
                    onClose();
                  }
                });
              }}
            />
          </View>
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={s.caption}>
              {message}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
