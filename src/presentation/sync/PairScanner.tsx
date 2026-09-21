import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
export default function PairScanner({ onScan }: { onScan: (code: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const scanned = useRef(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void (async () => {
            const result = permission?.granted ? permission : await requestPermission();
            if (result.granted) {
              setError('');
              scanned.current = false;
              setOpen(true);
            } else {
              setError('QR 스캔을 사용하려면 설정에서 카메라 권한을 허용해 주세요.');
            }
          })().catch(() => setError('카메라를 열 수 없습니다. 연결 코드를 직접 입력해 주세요.'));
        }}
        style={{ padding: 12 }}
      >
        <Text style={{ color: '#245d48' }}>Mac QR 코드 스캔</Text>
      </Pressable>
      {!!error && <Text>{error}</Text>}
      <Modal visible={open} onRequestClose={() => setOpen(false)} animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: '#000',
            paddingTop: 50,
          }}
        >
          <Text
            style={{
              color: '#fff',
              padding: 20,
            }}
          >
            Mac의 ‘기기 연결’에 표시된 QR 코드를 비춰 주세요.
          </Text>
          {open && (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (scanned.current) {
                  return;
                }
                scanned.current = true;
                setOpen(false);
                onScan(data);
              }}
            />
          )}
          <Pressable onPress={() => setOpen(false)} style={{ padding: 30 }}>
            <Text style={{ color: '#fff' }}>닫기</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
