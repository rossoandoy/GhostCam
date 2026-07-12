import React, { useState } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSeries } from '../context/SeriesContext';
import SeriesFormModal from './SeriesFormModal';

export default function SeriesPickerModal({ visible, onClose }) {
  const { seriesList, activeSeries, setActiveSeries } = useSeries();
  const [formVisible, setFormVisible] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);

  const handleSelect = async id => {
    try {
      await setActiveSeries(id);
      onClose();
    } catch (error) {
      console.error('Error switching series:', error);
      Alert.alert('エラー', 'シリーズの切り替えに失敗しました。もう一度お試しください。');
    }
  };

  const handleLongPress = series => {
    setEditingSeries(series);
    setFormVisible(true);
  };

  const handleAddNew = () => {
    setEditingSeries(null);
    setFormVisible(true);
  };

  const handleFormClose = () => {
    setFormVisible(false);
    setEditingSeries(null);
    onClose();
  };

  return (
    <>
      {/* Hidden (not unmounted) while the form sheet is open: two stacked
          RN Modals on screen at once is unstable on iOS devices. */}
      <Modal
        visible={visible && !formVisible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.title}>シリーズを選択</Text>

            <ScrollView style={styles.list} bounces={false}>
              {seriesList.map(series => {
                const isActive = activeSeries && activeSeries.id === series.id;
                return (
                  <TouchableOpacity
                    key={series.id}
                    style={styles.row}
                    onPress={() => handleSelect(series.id)}
                    onLongPress={() => handleLongPress(series)}
                  >
                    <View style={styles.rowTextContainer}>
                      <Text style={styles.rowName}>{series.name}</Text>
                      {!!series.locationLabel && (
                        <Text style={styles.rowLabel}>{series.locationLabel}</Text>
                      )}
                    </View>
                    {isActive && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.addRow} onPress={handleAddNew}>
              <Text style={styles.addRowText}>＋ 新しいシリーズ</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <SeriesFormModal visible={formVisible} series={editingSeries} onClose={handleFormClose} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  rowTextContainer: {
    flex: 1,
  },
  rowName: {
    color: '#fff',
    fontSize: 16,
  },
  rowLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  addRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  addRowText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
