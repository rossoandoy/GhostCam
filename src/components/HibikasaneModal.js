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

// The canvas is laid out at a fixed pixel size and captured as-is when the
// user taps 保存/共有; on screen it is only visually scaled down (transform
// does not affect the captured size). Because capture happens on a user tap,
// the view is always on screen by then — no presentation-timing guards needed.
const PHOTO_W = 240;
const PHOTO_H = 320;
const LOAD_TIMEOUT_MS = 5000;
const ROTATIONS = ['-2.2deg', '1.8deg', '-1.6deg', '2.4deg'];

export const HIBIKASANE_TEMPLATES = [
  { id: 'scrap', label: 'スクラップ' },
  { id: 'minimal', label: 'シンプル' },
  { id: 'film', label: 'フィルム' },
];

// Per-template layout metrics used for canvas width calculation.
const METRICS = {
  scrap: { cellW: PHOTO_W + 20, gap: 2, pad: 26 },
  minimal: { cellW: PHOTO_W, gap: 6, pad: 28 },
  film: { cellW: PHOTO_W, gap: 4, pad: 26 },
};

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
  // from fresh state.
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      {visible && (
        <HibikasaneSession
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

function HibikasaneSession({ onClose, onSaved, photos, seriesId, seriesName }) {
  const shotRef = useRef(null);
  const abortedRef = useRef(false);
  const [template, setTemplate] = useState('scrap');
  const [settledMap, setSettledMap] = useState({});
  const [timedOut, setTimedOut] = useState(false);
  const [busy, setBusy] = useState(null); // null | 'save' | 'share'

  const picked = useMemo(() => pickTimelinePhotos(photos), [photos]);
  const rangeLabel = useMemo(() => timelineRangeLabel(picked), [picked]);

  const { cellW, gap, pad } = METRICS[template];
  const canvasWidth = pad * 2 + picked.length * cellW + Math.max(0, picked.length - 1) * gap;
  const screenWidth = Dimensions.get('window').width;
  const previewScale = Math.min(1, (screenWidth - 24) / Math.max(canvasWidth, 1));

  // Image sources never change across template switches, so a uri-keyed map
  // stays correct even though the <Image> elements remount per template.
  const settledValues = picked.map(photo => settledMap[photo.uri]);
  const allSettled = picked.length > 0 && settledValues.every(Boolean);
  const anyFailed = settledValues.includes('error');

  useEffect(() => {
    if (allSettled) return undefined;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [allSettled]);

  useEffect(() => {
    if (abortedRef.current) return;
    if (anyFailed || (timedOut && !allSettled)) {
      abortedRef.current = true;
      Alert.alert('エラー', '写真の読み込みに失敗しました。もう一度お試しください。');
      onClose();
    }
  }, [anyFailed, timedOut, allSettled, onClose]);

  const capture = () =>
    captureRef(shotRef, { format: 'jpg', quality: 0.9, result: 'tmpfile', pixelRatio: 2 });

  const handleSave = async () => {
    if (!allSettled || busy) return;
    setBusy('save');
    try {
      const uri = await capture();
      await saveHibikasaneImage(seriesId, uri);
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving hibikasane image:', error);
      Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (!allSettled || busy) return;
    setBusy('share');
    try {
      const uri = await capture();
      await Share.share({ url: ensureFileUri(uri) });
      // The share extension may still read the tmp file after the sheet
      // closes, so clean it up after a generous delay.
      setTimeout(() => releaseCapture(uri), 10000);
    } catch (error) {
      console.error('Error sharing hibikasane image:', error);
      Alert.alert('エラー', '共有に失敗しました。もう一度お試しください。');
    } finally {
      setBusy(null);
    }
  };

  const markSettled = (uri, value) =>
    setSettledMap(map => (map[uri] === 'ok' ? map : { ...map, [uri]: value }));

  const isFilm = template === 'film';
  const isScrap = template === 'scrap';
  const actionsDisabled = !allSettled || !!busy;

  return (
    <View style={styles.backdrop}>
      <View style={{ transform: [{ scale: previewScale }] }}>
        <View
          ref={shotRef}
          collapsable={false}
          style={[styles.canvasBase, canvasStyles[template], { width: canvasWidth }]}
        >
          <Text style={[styles.titleBase, titleStyles[template]]} numberOfLines={1}>
            {seriesName}
          </Text>
          {!!rangeLabel && (
            <Text style={[styles.rangeBase, rangeStyles[template]]}>{rangeLabel}</Text>
          )}

          {isFilm && <Sprockets width={canvasWidth - pad * 2} />}

          <View style={[styles.row, isFilm && styles.rowFilm]}>
            {picked.map((photo, index) => {
              const isFirst = index === 0;
              const isLast = index === picked.length - 1;
              const marginRight = isLast ? 0 : gap;

              if (isScrap) {
                const tag =
                  picked.length >= 2 && isFirst ? 'はじまり' : isLast ? 'いま' : ' ';
                return (
                  <View
                    key={photo.uri}
                    style={[
                      styles.scrapCard,
                      { marginRight, transform: [{ rotate: ROTATIONS[index % ROTATIONS.length] }] },
                    ]}
                  >
                    <Text style={[styles.scrapTag, tag === ' ' && styles.tagEmpty]}>{tag}</Text>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photo}
                      resizeMode="cover"
                      onLoad={() => markSettled(photo.uri, 'ok')}
                      onError={() => markSettled(photo.uri, 'error')}
                    />
                    <Text style={styles.scrapDate}>{formatCapturedDate(photo.capturedAt)}</Text>
                  </View>
                );
              }

              return (
                <View key={photo.uri} style={{ marginRight }}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photo}
                    resizeMode="cover"
                    onLoad={() => markSettled(photo.uri, 'ok')}
                    onError={() => markSettled(photo.uri, 'error')}
                  />
                  <Text style={isFilm ? styles.filmDate : styles.minimalDate}>
                    {formatCapturedDate(photo.capturedAt)}
                  </Text>
                </View>
              );
            })}
          </View>

          {isFilm && <Sprockets width={canvasWidth - pad * 2} />}

          <Text style={[styles.brandBase, brandStyles[template]]}>ヒビカメ — ヒビカサネ</Text>
        </View>
      </View>

      <View style={styles.templateRow}>
        {HIBIKASANE_TEMPLATES.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.templateChip, template === item.id && styles.templateChipActive]}
            onPress={() => setTemplate(item.id)}
            disabled={!!busy}
          >
            <Text
              style={[
                styles.templateChipText,
                template === item.id && styles.templateChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!allSettled ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.statusText}>よみこみ中…</Text>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, actionsDisabled && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={actionsDisabled}
          >
            <Text style={styles.primaryButtonText}>
              {busy === 'save' ? '保存中…' : '保存する'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, actionsDisabled && styles.buttonDisabled]}
            onPress={handleShare}
            disabled={actionsDisabled}
          >
            <Text style={styles.secondaryButtonText}>共有</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={!!busy}>
        <Text style={styles.cancelButtonText}>閉じる</Text>
      </TouchableOpacity>
    </View>
  );
}

function Sprockets({ width }) {
  const count = Math.max(4, Math.floor(width / 48));
  return (
    <View style={[styles.sprocketRow, { width }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.sprocket} />
      ))}
    </View>
  );
}

const canvasStyles = {
  scrap: { backgroundColor: '#0f241f' },
  minimal: { backgroundColor: '#faf8f3' },
  film: { backgroundColor: '#141414' },
};

const titleStyles = {
  scrap: { color: '#fff' },
  minimal: { color: '#26323a' },
  film: { color: '#f2f2f2' },
};

const rangeStyles = {
  scrap: { color: 'rgba(255, 255, 255, 0.65)' },
  minimal: { color: '#8a8f94' },
  film: { color: '#e8b84b' },
};

const brandStyles = {
  scrap: { color: 'rgba(255, 255, 255, 0.45)' },
  minimal: { color: '#b9bcbf' },
  film: { color: 'rgba(255, 255, 255, 0.4)' },
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasBase: {
    paddingTop: 22,
    paddingBottom: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  titleBase: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: '90%',
  },
  rangeBase: {
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
  rowFilm: {
    marginTop: 6,
    marginBottom: 2,
  },
  scrapCard: {
    width: PHOTO_W + 20,
    backgroundColor: '#fdfdf6',
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  scrapTag: {
    color: '#0f5132',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  tagEmpty: {
    color: 'transparent',
  },
  photo: {
    width: PHOTO_W,
    height: PHOTO_H,
    backgroundColor: '#dcdcd4',
  },
  scrapDate: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  minimalDate: {
    color: '#6b7177',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  filmDate: {
    color: '#e8b84b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  sprocketRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 12,
  },
  sprocket: {
    width: 18,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#f5f1e6',
    opacity: 0.92,
  },
  brandBase: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 1,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  templateChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  templateChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  templateChipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  templateChipTextActive: {
    color: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
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
    marginTop: 20,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
