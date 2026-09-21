import { SafeAreaProvider } from 'react-native-safe-area-context';

import TrackerScreen from './src/presentation/tracker/TrackerScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <TrackerScreen />
    </SafeAreaProvider>
  );
}
