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
import { captureRef, releaseCapture } from 'react-native-view-shot';
import {
  pickTimelinePhotos,
  timelineRangeLabel,
  saveHibikasaneImage,
} from '../lib/hibikasane';
import { formatCapturedDate } from '../lib/photoLib';

// Canvas is laid out at a fixed pixel size and captured as-is; on screen it
// is only visually scaled down (transform does not affect capture size).
const PHOTO_W = 240;
const PHOTO_H = 320;
const CARD_PAD = 10;
const CARD_W = PHOTO_W + CARD_PAD * 2;
const GAP = 2;
const PAD = 26;
const LOAD_TIMEOUT_MS = 5000;
const ROTATIONS = ['-2.2deg', '1.8deg', '-1.6deg', '2.4deg'];

function ensureFileUri(uri) {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

export default function HibikasaneModal({
  visible,
  onClose,
  onSaved,
  photos,
  seriesId,
  seriesName,
}) {
  // The session content is mounted only while visible, so every open starts
  // from fresh state (no reset effects, no stale captures on re-open).
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShown(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      onShow={() => setShown(true)}
    >
      {visible && (
        <HibikasaneSession
          shown={shown}
          onClose={onClose}
          onSaved={onSaved}
          photos={photos}
          seriesId={seriesId}
          seriesName={seriesName}
        />
      )}
    </Modal>
  );
}

function HibikasaneSession({ shown, onClose, onSaved, photos, seriesId, seriesName }) {
  const shotRef = useRef(null);
  const capturedOnceRef = useRef(false);
  const savedRef = useRef(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [capturedUri, setCapturedUri] = useState(null);
  const [saving, setSaving] = useState(false);

  const picked = useMemo(() => pickTimelinePhotos(photos), [photos]);
  const rangeLabel = useMemo(() => timelineRangeLabel(picked), [picked]);

  const canvasWidth =
    PAD * 2 + picked.length * CARD_W + Math.max(0, picked.length - 1) * GAP;
  const screenWidth = Dimensions.get('window').width;
  const previewScale = Math.min(1, (screenWidth - 24) / Math.max(canvasWidth, 1));

  const settledCount = loadedCount + failedCount;
  const allSettled = picked.length > 0 && settledCount >= picked.length;

  // Safety net: never hang forever on a stuck Image load. The timer is
  // cleared once everything settles, so timedOut cannot flip afterwards.
  useEffect(() => {
    if (allSettled) return undefined;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [allSettled]);

  // Wait for the Modal's presentation animation (onShow) before capturing:
  // snapshotting a view that is not on screen yet can produce a blank image.
  const ready = shown && picked.length > 0 && (allSettled || timedOut);

  useEffect(() => {
    if (!ready || capturedOnceRef.current) return undefined;
    capturedOnceRef.current = true;

    if (failedCount > 0 || settledCount < picked.length) {
      Alert.alert('エラー', '写真の読み込みに失敗しました。もう一度お試しください。');
      onClose();
      return undefined;
    }

    let cancelled = false;
    // Give the committed frame one beat to render before snapshotting.
    const timer = setTimeout(async () => {
      try {
        const uri = await captureRef(shotRef, {
          format: 'jpg',
          quality: 0.9,
          result: 'tmpfile',
          pixelRatio: 2,
        });
        if (cancelled) {
          releaseCapture(uri);
          return;
        }
        setCapturedUri(uri);
      } catch (error) {
        console.error('Error creating hibikasane image:', error);
        if (!cancelled) {
          Alert.alert('エラー', 'ヒビカサネの作成に失敗しました。もう一度お試しください。');
          onClose();
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, failedCount, settledCount, picked.length, onClose]);

  // Clean up the tmp capture when the session ends without saving it.
  // (A delayed release keeps the file readable for an in-flight share sheet.)
  useEffect(() => {
    return () => {
      if (capturedUri && !savedRef.current) {
        const uri = capturedUri;
        setTimeout(() => releaseCapture(uri), 10000);
      }
    };
  }, [capturedUri]);

  const handleSave = async () => {
    if (!capturedUri || saving) return;
    setSaving(true);
    try {
      await saveHibikasaneImage(seriesId, capturedUri);
      savedRef.current = true;
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving hibikasane image:', error);
      Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!capturedUri) return;
    try {
      await Share.share({ url: ensureFileUri(capturedUri) });
    } catch (error) {
      console.error('Error sharing hibikasane image:', error);
      Alert.alert('エラー', '共有に失敗しました。もう一度お試しください。');
    }
  };

  return (
    <View style={styles.backdrop}>
      {capturedUri ? (
        <>
          <Image
            source={{ uri: ensureFileUri(capturedUri) }}
            style={styles.previewImage}
            resizeMode="contain"
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>保存する</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
              <Text style={styles.secondaryButtonText}>共有</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>閉じる</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={{ transform: [{ scale: previewScale }] }}>
            <View
              ref={shotRef}
              collapsable={false}
              style={[styles.canvas, { width: canvasWidth }]}
            >
              <Text style={styles.canvasTitle} numberOfLines={1}>
                {seriesName}
              </Text>
              {!!rangeLabel && <Text style={styles.rangeLabel}>{rangeLabel}</Text>}
              <View style={styles.row}>
                {picked.map((photo, index) => {
                  const isFirst = index === 0;
                  const isLast = index === picked.length - 1;
                  const tag =
                    picked.length >= 2 && isFirst ? 'はじまり' : isLast ? 'いま' : ' ';
                  return (
                    <View
                      key={photo.uri}
                      style={[
                        styles.card,
                        { transform: [{ rotate: ROTATIONS[index % ROTATIONS.length] }] },
                        !isLast && styles.cardGap,
                      ]}
                    >
                      <Text style={[styles.cardTag, tag === ' ' && styles.cardTagEmpty]}>
                        {tag}
                      </Text>
                      <Image
                        source={{ uri: photo.uri }}
                        style={styles.photo}
                        resizeMode="cover"
                        onLoad={() => setLoadedCount(count => count + 1)}
                        onError={() => setFailedCount(count => count + 1)}
                      />
                      <Text style={styles.cardDate}>
                        {formatCapturedDate(photo.capturedAt)}
                      </Text>
                    </View>
                  );
                })}
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
        </>
      )}
    </View>
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
    paddingTop: 22,
    paddingBottom: 16,
    borderRadius: 4,
  },
  canvasTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
  rangeLabel: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#fdfdf6',
    borderRadius: 3,
    paddingHorizontal: CARD_PAD,
    paddingTop: 6,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  cardGap: {
    marginRight: GAP,
  },
  cardTag: {
    color: '#0f5132',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardTagEmpty: {
    color: 'transparent',
  },
  photo: {
    width: PHOTO_W,
    height: PHOTO_H,
    backgroundColor: '#e8e8e0',
  },
  cardDate: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  brand: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 1,
  },
  previewImage: {
    width: '92%',
    height: '60%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 22,
  },
  primaryButton: {
    backgroundColor: '#0f5132',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
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
