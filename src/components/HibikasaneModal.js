import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  Share,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { pickTimelinePhotos } from '../lib/hibikasane';
import { formatCapturedDate } from '../lib/photoLib';

// Canvas is laid out at a fixed pixel size and captured as-is; on screen it
// is only visually scaled down (transform does not affect capture size).
const PHOTO_W = 240;
const PHOTO_H = 320;
const GAP = 10;
const PAD = 24;

export default function HibikasaneModal({ visible, onClose, photos, seriesName }) {
  const shotRef = useRef(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const picked = useMemo(
    () => (visible ? pickTimelinePhotos(photos) : []),
    [visible, photos]
  );

  const canvasWidth = PAD * 2 + picked.length * PHOTO_W + Math.max(0, picked.length - 1) * GAP;
  const screenWidth = Dimensions.get('window').width;
  const previewScale = Math.min(1, (screenWidth - 32) / Math.max(canvasWidth, 1));

  useEffect(() => {
    if (!visible) return undefined;
    setLoadedCount(0);
    setTimedOut(false);
    setCapturing(false);
    // Safety net: never hang forever on a stuck Image load.
    const timer = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [visible]);

  const ready = picked.length > 0 && (loadedCount >= picked.length || timedOut);

  useEffect(() => {
    if (!visible || !ready || capturing) return undefined;
    let cancelled = false;
    setCapturing(true);

    // Give the committed frame one beat to render before snapshotting.
    const timer = setTimeout(async () => {
      try {
        const uri = await captureRef(shotRef, {
          format: 'jpg',
          quality: 0.9,
          result: 'tmpfile',
          pixelRatio: 2,
        });
        if (cancelled) return;
        await Share.share({ url: uri });
      } catch (error) {
        console.error('Error creating hibikasane image:', error);
        if (!cancelled) {
          Alert.alert('エラー', 'ヒビカサネの作成に失敗しました。もう一度お試しください。');
        }
      } finally {
        if (!cancelled) {
          onClose();
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready]);

  const handleImageSettled = () => setLoadedCount(count => count + 1);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={{ transform: [{ scale: previewScale }] }}>
          <View ref={shotRef} collapsable={false} style={[styles.canvas, { width: canvasWidth }]}>
            <Text style={styles.canvasTitle} numberOfLines={1}>
              {seriesName}
            </Text>
            <View style={styles.row}>
              {picked.map((photo, index) => (
                <View
                  key={photo.uri}
                  style={[styles.cell, index === picked.length - 1 && styles.cellLast]}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photo}
                    resizeMode="cover"
                    onLoad={handleImageSettled}
                    onError={handleImageSettled}
                  />
                  <Text style={styles.dateLabel}>{formatCapturedDate(photo.capturedAt)}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.brand}>ヒビカメ — ヒビカサネ</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.statusText}>ヒビカサネを作成中…</Text>
        </View>

        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>キャンセル</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    backgroundColor: '#0f241f',
    paddingHorizontal: PAD,
    paddingTop: 20,
    paddingBottom: 14,
    borderRadius: 4,
  },
  canvasTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cell: {
    width: PHOTO_W,
    marginRight: GAP,
  },
  cellLast: {
    marginRight: 0,
  },
  photo: {
    width: PHOTO_W,
    height: PHOTO_H,
    borderRadius: 6,
    backgroundColor: '#000',
  },
  dateLabel: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
  },
  brand: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
