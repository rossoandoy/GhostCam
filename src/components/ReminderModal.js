import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  loadReminderSettings,
  saveReminderSettings,
  ensureNotificationPermission,
  applyReminderSchedule,
} from '../lib/reminderStore';

const PRESETS = [
  { label: '朝 8:00', hour: 8, minute: 0 },
  { label: '昼 12:00', hour: 12, minute: 0 },
  { label: '夜 20:00', hour: 20, minute: 0 },
];

const pad = n => String(n).padStart(2, '0');

export default function ReminderModal({ visible, onClose }) {
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    loadReminderSettings().then(settings => {
      if (!alive) return;
      setEnabled(settings.enabled);
      setHour(settings.hour);
      setMinute(settings.minute);
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  const shiftHour = delta => setHour(current => (current + delta + 24) % 24);
  const shiftMinute = delta => setMinute(current => (current + delta + 60) % 60);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (enabled) {
        const permission = await ensureNotificationPermission();
        if (permission === 'blocked') {
          Alert.alert(
            '通知が許可されていません',
            '設定アプリでヒビカメの通知を許可すると、リマインダーが使えます。',
            [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: '設定を開く',
                onPress: () =>
                  Linking.openSettings().catch(() =>
                    Alert.alert('エラー', '設定を開けませんでした。')
                  ),
              },
            ]
          );
          return;
        }
        if (permission !== 'granted') {
          Alert.alert('リマインダー', '通知が許可されなかったため、リマインダーはオフのままです。');
          return;
        }
      }

      const settings = { enabled, hour, minute };
      await applyReminderSchedule(settings);
      await saveReminderSettings(settings);
      onClose();
    } catch (error) {
      console.error('Error saving reminder:', error);
      Alert.alert('エラー', 'リマインダーの設定に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>撮影リマインダー</Text>
          <Text style={styles.description}>
            毎日決まった時間に通知でお知らせします。通知は端末内で完結し、外部への送信はありません。
          </Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>リマインダー</Text>
            <Switch value={enabled} onValueChange={setEnabled} />
          </View>

          <View pointerEvents={enabled ? 'auto' : 'none'} style={!enabled && styles.dimmed}>
            <Text style={styles.timeText}>{`${pad(hour)}:${pad(minute)}`}</Text>

            <View style={styles.stepperRow}>
              <View style={styles.stepperGroup}>
                <TouchableOpacity style={styles.stepperButton} onPress={() => shiftHour(-1)}>
                  <Text style={styles.stepperButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperLabel}>時</Text>
                <TouchableOpacity style={styles.stepperButton} onPress={() => shiftHour(1)}>
                  <Text style={styles.stepperButtonText}>＋</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.stepperGroup}>
                <TouchableOpacity style={styles.stepperButton} onPress={() => shiftMinute(-5)}>
                  <Text style={styles.stepperButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperLabel}>分</Text>
                <TouchableOpacity style={styles.stepperButton} onPress={() => shiftMinute(5)}>
                  <Text style={styles.stepperButtonText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.presetRow}>
              {PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.presetChip}
                  onPress={() => {
                    setHour(preset.hour);
                    setMinute(preset.minute);
                  }}
                >
                  <Text style={styles.presetChipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: '85%',
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    color: '#fff',
    fontSize: 15,
  },
  dimmed: {
    opacity: 0.35,
  },
  timeText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 14,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  stepperLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginLeft: 8,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
