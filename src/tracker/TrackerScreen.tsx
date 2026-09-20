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

import { emptyDay, localDate, parseStore } from '../data';
import { exportBackup, importBackup } from '../platform';
import SyncPanel from '../SyncPanel';
import BackupPanel from './BackupPanel';
import Button from './Button';
import ConfirmationDialog, { type Confirmation } from './ConfirmationDialog';
import DailyRecords, { type RecordTab } from './DailyRecords';
import DailySummary from './DailySummary';
import DateNavigation from './DateNavigation';
import RecordEditor, { type Editor, type RecordKind } from './RecordEditor';
import { styles as s } from './styles';
import TrackerSidebar from './TrackerSidebar';
import { errorText, useTrackerRecords } from './useTrackerRecords';
import WeightPanel from './WeightPanel';

export default function TrackerScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 950;
  const { data, loaded, blocked, busy, message, setMessage, updateDay, persist, refresh } =
    useTrackerRecords();
  const [date, setDate] = useState(localDate);
  const [tab, setTab] = useState<RecordTab>('전체');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const day = data.days[date] ?? emptyDay();

  function openEditor(kind: RecordKind, id: string | null = null) {
    setEditor({ kind, id, date });
  }

  function remove(kind: 'meals' | 'workouts', id: string) {
    setConfirmation({
      title: '기록 삭제',
      description: '선택한 기록을 삭제할까요? 삭제 후에는 백업 파일이 있어야 복원할 수 있어요.',
      run: async () =>
        (await updateDay({ ...day, [kind]: day[kind].filter((item) => item.id !== id) }, date)).ok,
    });
  }

  function removeWeight() {
    setConfirmation({
      title: '체중 삭제',
      description: `${date}의 체중 기록을 삭제할까요?`,
      run: async () => (await updateDay({ ...day, weight: null }, date)).ok,
    });
  }
  async function backup() {
    try {
      await exportBackup(JSON.stringify(data, null, 2), `운동관리-${localDate()}.json`);
    } catch (error) {
      setMessage(errorText(error));
    }
  }
  async function restore() {
    try {
      const raw = await importBackup();
      if (raw === null) {
        return;
      }
      const next = parseStore(raw);
      setConfirmation({
        title: '백업 복원',
        description: `${Object.keys(next.days).length}일의 기록으로 이 기기의 전체 기록을 교체합니다. 먼저 현재 기록을 백업해 주세요.`,
        run: async () => (await persist(next, true)).ok,
      });
    } catch (error) {
      setMessage(errorText(error));
    }
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
              setTab('전체');
            }}
          />
        )}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, !wide && { padding: 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          {!wide && <Text style={[s.brand, { marginBottom: 28 }]}>▣ 운동관리</Text>}
          <Text style={s.eyebrow}>MY DAILY JOURNAL</Text>
          <Text accessibilityRole="header" style={s.title}>
            오늘도, 나를 돌보는 하루
          </Text>
          <Text style={s.subtitle}>잘 먹고, 가볍게 움직이고, 조금씩 기록해요.</Text>
          <DateNavigation date={date} onDateChange={setDate} />
          {!!message && (
            <View style={s.notice}>
              <Text accessibilityLiveRegion="polite" style={[s.body, { flex: 1 }]}>
                {message}
              </Text>
              <Button label="닫기" onPress={() => setMessage('')} />
            </View>
          )}
          <DailySummary day={day} wide={wide} />
          <View style={[s.columns, wide && { flexDirection: 'row' }]}>
            <View style={{ flex: wide ? 1.4 : undefined, gap: 16 }}>
              <DailyRecords
                day={day}
                tab={tab}
                locked={locked}
                onTabChange={setTab}
                onEdit={openEditor}
                onRemove={remove}
              />
            </View>
            <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
              <WeightPanel
                days={data.days}
                date={date}
                weight={day.weight}
                locked={locked}
                onEdit={() => openEditor('weight')}
                onRemove={removeWeight}
                onDateChange={setDate}
              />
            </View>
          </View>
          <SyncPanel disabled={locked || !!editor || !!confirmation} onChange={refresh} />
          <BackupPanel locked={locked} busy={busy} onExport={backup} onRestore={restore} />
        </ScrollView>
      </View>

      {editor && (
        <RecordEditor
          editor={editor}
          day={data.days[editor.date] ?? emptyDay()}
          busy={busy}
          onSave={updateDay}
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
