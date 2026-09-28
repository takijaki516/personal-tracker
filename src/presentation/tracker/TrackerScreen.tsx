import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { emptyDay, localDate } from '../../domain/data';
import SyncPanel from '../sync/SyncPanel';
import Button from './Button';
import ConfirmationDialog, { type Confirmation } from './ConfirmationDialog';
import DailyRecords from './DailyRecords';
import DateNavigation from './DateNavigation';
import RecordEditor, { type Editor, type RecordKind } from './RecordEditor';
import { styles as s } from './styles';
import Toast from './Toast';
import TrackerSidebar from './TrackerSidebar';
import { useTrackerRecords } from './useTrackerRecords';

export default function TrackerScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 950;
  const {
    data,
    loaded,
    blocked,
    busy,
    message,
    setMessage,
    toast,
    setToast,
    updateDay,
    saveFavoriteFood,
    removeFavoriteFood,
    refresh,
  } = useTrackerRecords();
  const [date, setDate] = useState(localDate);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const day = data.days[date] ?? emptyDay();

  function openEditor(kind: RecordKind, id: string | null = null) {
    setEditor({
      kind,
      id,
      date,
    });
  }

  function remove(kind: 'meals' | 'workouts', id: string) {
    setConfirmation({
      title: '기록 삭제',
      description: '선택한 기록을 삭제할까요? 삭제 후에는 백업 파일이 있어야 복원할 수 있어요.',
      run: async () =>
        (
          await updateDay(
            {
              ...day,
              [kind]: day[kind].filter((item) => item.id !== id),
            },
            date,
            kind === 'meals' ? '식단 삭제 성공' : '운동 삭제 성공',
          )
        ).ok,
    });
  }

  if (!loaded) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color="#245d48" />
        <Text style={s.subtitle}>기록을 불러오고 있어요.</Text>
      </View>
    );
  }
  const locked = busy || blocked;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.shell}>
        {wide && (
          <TrackerSidebar
            onSelectToday={() => {
              setDate(localDate());
            }}
          />
        )}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, !wide && { padding: 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <DateNavigation date={date} onDateChange={setDate} />
          {!!message && (
            <View style={s.notice}>
              <Text accessibilityLiveRegion="polite" style={[s.body, { flex: 1 }]}>
                {message}
              </Text>
              <Button label="닫기" onPress={() => setMessage('')} />
            </View>
          )}
          <View style={s.columns}>
            <DailyRecords
              date={date}
              day={day}
              locked={locked}
              onEdit={openEditor}
              onRemove={remove}
            />
          </View>
          <SyncPanel disabled={locked || !!editor || !!confirmation} onChange={refresh} />
        </ScrollView>
        <Toast message={toast} onDismiss={setToast} />
      </View>

      {editor && (
        <RecordEditor
          editor={editor}
          day={data.days[editor.date] ?? emptyDay()}
          days={data.days}
          favoriteFoods={data.favoriteFoods ?? []}
          busy={busy}
          onSave={(next, target) =>
            updateDay(next, target, editor.kind === 'meal' ? '식단 저장 성공' : '운동 저장 성공')
          }
          onSaveFavorite={saveFavoriteFood}
          onRemoveFavorite={removeFavoriteFood}
          onClose={() => setEditor(null)}
        />
      )}
      {confirmation && (
        <ConfirmationDialog
          confirmation={confirmation}
          busy={busy}
          message={message}
          onClose={() => setConfirmation(null)}
        />
      )}
    </SafeAreaView>
  );
}
