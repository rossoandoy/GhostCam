import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSeries } from '../context/SeriesContext';

// New/edit shared modal for a series. `series` is null for create mode.
export default function SeriesFormModal({ visible, series, onClose }) {
  const { createSeries, updateSeries } = useSeries();
  const [name, setName] = useState('');
  const [locationLabel, setLocationLabel] = useState('');

  const isEdit = !!series;

  useEffect(() => {
    if (visible) {
      setName(series ? series.name : '');
      setLocationLabel(series ? series.locationLabel : '');
    }
  }, [visible, series]);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;

    try {
      if (isEdit) {
        await updateSeries(series.id, { name, locationLabel });
      } else {
        await createSeries({ name, locationLabel });
      }

      onClose();
    } catch (error) {
      console.error('Error saving series:', error);
      Alert.alert('エラー', 'シリーズの保存に失敗しました。もう一度お試しください。');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.avoidingView}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>
              {isEdit ? 'シリーズを編集' : '新しいシリーズ'}
            </Text>

            <Text style={styles.label}>シリーズ名</Text>
            <TextInput
              style={styles.input}
              placeholder="例: 子供の成長"
              placeholderTextColor="#8e8e93"
              value={name}
              onChangeText={setName}
              maxLength={30}
              autoFocus
            />

            <Text style={styles.label}>場所ラベル（任意）</Text>
            <TextInput
              style={styles.input}
              placeholder="例: リビング"
              placeholderTextColor="#8e8e93"
              value={locationLabel}
              onChangeText={setLocationLabel}
              maxLength={30}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!canSave}
              >
                <Text style={styles.saveButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
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
  avoidingView: {
    width: '100%',
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
    marginBottom: 16,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    marginBottom: 16,
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
