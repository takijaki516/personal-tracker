import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ToastMessage } from './useTrackerRecords';

type Props = {
  message: ToastMessage | null;
  onDismiss: (message: null) => void;
};

export default function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(() => onDismiss(null), 2500);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.position}>
      <View style={styles.toast}>
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  toast: {
    maxWidth: '100%',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#245d48',
    boxShadow: '0 3px 12px rgba(0, 0, 0, 0.12)',
  },
  text: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    color: '#fff',
  },
});
