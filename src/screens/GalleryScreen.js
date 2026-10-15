import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Dimensions,
  Modal,
  Share,
  Alert,
  Linking,
  Animated,
  PanResponder,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSeries } from '../context/SeriesContext';
import {
  listSeriesPhotos,
  deletePhoto,
  formatCapturedAt,
  formatCapturedDate,
} from '../lib/photoLib';
import { listHibikasane } from '../lib/hibikasane';
import HibikasaneModal from '../components/HibikasaneModal';

const PRIVACY_POLICY_URL = 'https://rossoandoy.github.io/GhostCam/';

export default function GalleryScreen({ navigation }) {
  const { status, activeSeries } = useSeries();
  const [photos, setPhotos] = useState([]);
  const [hibikasaneList, setHibikasaneList] = useState([]);
  const [activeTab, setActiveTab] = useState('photos'); // 'photos' | 'hibikasane'
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [hibikasaneVisible, setHibikasaneVisible] = useState(false);
  const closeHibikasane = useCallback(() => setHibikasaneVisible(false), []);
  const isMountedRef = useRef(false);

  // Before/after compare slider inside the viewer.
  const [compareMode, setCompareMode] = useState(false);
  const [compareWidth, setCompareWidth] = useState(0);
  const compareWidthRef = useRef(0);
  const dividerPosRef = useRef(0);
  const dividerX = useRef(new Animated.Value(0)).current;

  const moveDivider = useCallback(
    x => {
      const width = compareWidthRef.current;
      if (!width) return;
      const clamped = Math.max(16, Math.min(width - 16, x));
      dividerPosRef.current = clamped;
      dividerX.setValue(clamped);
    },
    [dividerX]
  );

  const comparePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => moveDivider(evt.nativeEvent.locationX),
      onPanResponderMove: evt => moveDivider(evt.nativeEvent.locationX),
    })
  ).current;

  const onCompareLayout = useCallback(
    evt => {
      const { width } = evt.nativeEvent.layout;
      const isFirstMeasure = compareWidthRef.current === 0;
      compareWidthRef.current = width;
      setCompareWidth(width);
      if (isFirstMeasure) {
        dividerPosRef.current = width / 2;
        dividerX.setValue(width / 2);
      } else {
        // Re-clamp after rotation or layout changes.
        moveDivider(dividerPosRef.current);
      }
    },
    [dividerX, moveDivider]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshPhotos = useCallback(async seriesId => {
    const list = await listSeriesPhotos(seriesId);
    if (!isMountedRef.current) return;
    setPhotos(list);
  }, []);

  const refreshHibikasane = useCallback(async seriesId => {
    const list = await listHibikasane(seriesId);
    if (!isMountedRef.current) return;
    setHibikasaneList(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      if (status === 'ready' && activeSeries?.id) {
        Promise.all([
          listSeriesPhotos(activeSeries.id),
          listHibikasane(activeSeries.id),
        ])
          .then(([photoList, hibikasane]) => {
            if (!alive) return;
            setPhotos(photoList);
            setHibikasaneList(hibikasane);
          })
          .catch(error => {
            console.error('Error loading photos:', error);
            if (!alive) return;
            Alert.alert('エラー', '写真の読み込みに失敗しました。');
          });
      } else {
        setPhotos([]);
        setHibikasaneList([]);
      }

      return () => {
        alive = false;
      };
    }, [status, activeSeries?.id])
  );

  const handleHibikasaneSaved = useCallback(() => {
    setActiveTab('hibikasane');
    if (activeSeries?.id) {
      refreshHibikasane(activeSeries.id).catch(error => {
        console.error('Error refreshing hibikasane:', error);
      });
    }
  }, [activeSeries?.id, refreshHibikasane]);

  const handleHibikasanePress = () => {
    if (photos.length < 2) {
      Alert.alert(
        'ヒビカサネ',
        '写真が2枚以上たまると、時系列を1枚にまとめた「ヒビカサネ」を作れます。まずはもう1枚撮ってみましょう。'
      );
      return;
    }
    setHibikasaneVisible(true);
  };

  const openViewer = photo => {
    setCompareMode(false);
    setSelectedPhoto(photo);
  };

  const closeViewer = () => {
    setCompareMode(false);
    setSelectedPhoto(null);
  };

  // The photo taken just before the selected one (photos is newest-first).
  // Hibikasane items are not in `photos`, so they never get a partner.
  const comparePartner = useMemo(() => {
    if (!selectedPhoto) return null;
    const index = photos.findIndex(photo => photo.uri === selectedPhoto.uri);
    if (index < 0 || index + 1 >= photos.length) return null;
    return photos[index + 1];
  }, [photos, selectedPhoto]);

  const handleShare = async () => {
    const photoUri = selectedPhoto?.uri;
    if (!photoUri) return;

    try {
      await Share.share({ url: photoUri });
    } catch (error) {
      console.error('Error sharing photo:', error);
      Alert.alert('エラー', '写真の共有に失敗しました。');
    }
  };

  const handleDelete = () => {
    const photoUri = selectedPhoto?.uri;
    if (!photoUri) return;

    Alert.alert(
      '削除確認',
      'この写真を削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePhoto(photoUri);
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert('エラー', '写真の削除に失敗しました。');
              return;
            }
            closeViewer();
            if (activeSeries?.id) {
              // Refresh failures must not read as a failed delete.
              await Promise.allSettled([
                refreshPhotos(activeSeries.id),
                refreshHibikasane(activeSeries.id),
              ]);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const screenWidth = Dimensions.get('window').width;
    const itemSize = screenWidth / 3;

    return (
      <TouchableOpacity onPress={() => openViewer(item)}>
        <Image
          source={{ uri: item.uri }}
          style={[styles.gridItem, { width: itemSize, height: itemSize }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  const isReady = status === 'ready' && !!activeSeries;

  const viewerCaption = selectedPhoto
    ? [formatCapturedAt(selectedPhoto.capturedAt), activeSeries?.locationLabel]
        .filter(Boolean)
        .join(' ・ ')
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← 戻る</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerCenter}>
          {isReady && (
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeSeries.name}（{photos.length}枚）
            </Text>
          )}
        </View>

        <View style={[styles.headerSide, styles.headerSideRight]}>
          <TouchableOpacity
            style={styles.privacyButton}
            onPress={() =>
              Linking.openURL(PRIVACY_POLICY_URL).catch(() =>
                Alert.alert('エラー', 'ページを開けませんでした。')
              )
            }
          >
            <Text
              style={styles.privacyButtonText}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              プライバシー
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isReady && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'photos' && styles.tabButtonActive]}
            onPress={() => setActiveTab('photos')}
          >
            <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>
              写真
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'hibikasane' && styles.tabButtonActive]}
            onPress={() => setActiveTab('hibikasane')}
          >
            <Text
              style={[styles.tabText, activeTab === 'hibikasane' && styles.tabTextActive]}
            >
              ヒビカサネ{hibikasaneList.length > 0 ? `（${hibikasaneList.length}）` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!isReady ? (
        <View style={styles.emptyState} />
      ) : (activeTab === 'photos' ? photos : hibikasaneList).length > 0 ? (
        <FlatList
          key={activeTab}
          data={activeTab === 'photos' ? photos : hibikasaneList}
          renderItem={renderItem}
          keyExtractor={(item) => item.uri}
          numColumns={3}
          contentContainerStyle={[styles.gridContainer, styles.gridContainerWithButton]}
        />
      ) : activeTab === 'photos' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>このシリーズにはまだ写真がありません</Text>
          <Text style={styles.emptyStateSubtext}>カメラで1枚目を撮影してみましょう</Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>まだヒビカサネがありません</Text>
          <Text style={styles.emptyStateSubtext}>
            写真が2枚以上たまったら、下のボタンから作れます
          </Text>
        </View>
      )}

      {isReady && (
        <TouchableOpacity
          style={[
            styles.hibikasaneButton,
            photos.length < 2 && styles.hibikasaneButtonDisabled,
          ]}
          onPress={handleHibikasanePress}
        >
          <Text style={styles.hibikasaneButtonText}>ヒビカサネをつくる</Text>
        </TouchableOpacity>
      )}

      <HibikasaneModal
        visible={hibikasaneVisible}
        onClose={closeHibikasane}
        onSaved={handleHibikasaneSaved}
        photos={photos}
        seriesId={activeSeries?.id ?? ''}
        seriesName={activeSeries?.name ?? ''}
      />

      <Modal
        visible={!!selectedPhoto}
        animationType="fade"
        transparent={false}
        onRequestClose={closeViewer}
      >
        <SafeAreaView style={styles.viewerContainer}>
          {selectedPhoto && compareMode && comparePartner ? (
            <View
              style={styles.compareArea}
              onLayout={onCompareLayout}
              {...comparePanResponder.panHandlers}
            >
              <Image
                source={{ uri: selectedPhoto.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
              <Animated.View style={[styles.compareClip, { width: dividerX }]}>
                {compareWidth > 0 && (
                  <Image
                    source={{ uri: comparePartner.uri }}
                    style={[styles.compareInnerImage, { width: compareWidth }]}
                    resizeMode="contain"
                  />
                )}
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[styles.compareDivider, { transform: [{ translateX: dividerX }] }]}
              >
                <View style={styles.compareHandle}>
                  <Text style={styles.compareHandleText}>◂ ▸</Text>
                </View>
              </Animated.View>
              <Text style={[styles.compareLabel, styles.compareLabelLeft]}>
                {`前回 ${formatCapturedDate(comparePartner.capturedAt)}`}
              </Text>
              <Text style={[styles.compareLabel, styles.compareLabelRight]}>
                {`いま ${formatCapturedDate(selectedPhoto.capturedAt)}`}
              </Text>
            </View>
          ) : (
            selectedPhoto && (
              <>
                {!!viewerCaption && (
                  <Text style={styles.viewerCaption} numberOfLines={1}>
                    {viewerCaption}
                  </Text>
                )}
                <Image
                  source={{ uri: selectedPhoto.uri }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </>
            )
          )}

          <View style={styles.viewerActions}>
            {!!comparePartner && (
              <TouchableOpacity
                style={styles.viewerButton}
                onPress={() => setCompareMode(current => !current)}
              >
                <Text
                  style={[
                    styles.viewerButtonText,
                    compareMode && styles.viewerButtonTextActive,
                  ]}
                >
                  くらべる
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.viewerButton} onPress={handleShare}>
              <Text style={styles.viewerButtonText}>共有</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.viewerButton} onPress={handleDelete}>
              <Text style={styles.viewerButtonTextDanger}>削除</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.viewerButton} onPress={closeViewer}>
              <Text style={styles.viewerButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  privacyButtonText: {
    color: '#999',
    fontSize: 14,
  },
  gridContainer: {
    flexGrow: 1,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  gridContainerWithButton: {
    paddingBottom: 96,
  },
  hibikasaneButton: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    backgroundColor: '#0f5132',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  hibikasaneButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  hibikasaneButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  gridItem: {
    margin: 0,
    borderWidth: 0.5,
    borderColor: '#333',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  viewerCaption: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  viewerImage: {
    flex: 1,
    width: '100%',
  },
  viewerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  viewerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  viewerButtonTextActive: {
    color: '#4fa98a',
  },
  compareArea: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  compareClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  compareInnerImage: {
    height: '100%',
  },
  compareDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -1,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compareHandle: {
    width: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compareHandleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  compareLabel: {
    position: 'absolute',
    top: 12,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  compareLabelLeft: {
    left: 12,
  },
  compareLabelRight: {
    right: 12,
  },
  viewerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewerButtonTextDanger: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});
