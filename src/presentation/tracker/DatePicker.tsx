import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { isDate } from '../../domain/data';
import Button from './Button';
import Field from './Field';
import { styles as s } from './styles';

export default function DatePicker({
  date,
  onSelect,
  onClose,
}: {
  date: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [dateDraft, setDateDraft] = useState(date);
  const [formError, setFormError] = useState('');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose()}>
      <View style={s.overlay}>
        <View style={s.modal} accessibilityViewIsModal>
          <Text style={s.sectionTitle}>날짜 선택</Text>
          <Field
            label="날짜 (YYYY-MM-DD)"
            value={dateDraft}
            onChangeText={setDateDraft}
            maxLength={10}
          />
          {!!formError && <Text style={s.error}>{formError}</Text>}
          <View
            style={[
              s.row,
              {
                justifyContent: 'flex-end',
                marginTop: 20,
              },
            ]}
          >
            <Button label="취소" onPress={() => onClose()} />
            <Button
              label="이동"
              primary
              onPress={() => {
                if (isDate(dateDraft)) {
                  onSelect(dateDraft);
                  onClose();
                } else {
                  setFormError('올바른 날짜를 입력해 주세요. 예: 2026-09-14');
                }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
