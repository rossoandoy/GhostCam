import React, { useState, useCallback, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSeries } from '../context/SeriesContext';
import { listSeriesPhotos, deletePhoto } from '../lib/photoLib';

const PRIVACY_POLICY_URL = 'https://rossoandoy.github.io/GhostCam/';

export default function GalleryScreen({ navigation }) {
  const { status, activeSeries } = useSeries();
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const isMountedRef = useRef(false);

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

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      if (status === 'ready' && activeSeries?.id) {
        listSeriesPhotos(activeSeries.id)
          .then(list => {
            if (!alive) return;
            setPhotos(list);
          })
          .catch(error => {
            console.error('Error loading photos:', error);
            if (!alive) return;
            Alert.alert('エラー', '写真の読み込みに失敗しました。');
          });
      } else {
        setPhotos([]);
      }

      return () => {
        alive = false;
      };
    }, [status, activeSeries?.id])
  );

  const closeViewer = () => {
    setSelectedPhoto(null);
  };

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
              if (activeSeries?.id) {
                await refreshPhotos(activeSeries.id);
              }
              closeViewer();
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert('エラー', '写真の削除に失敗しました。');
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
      <TouchableOpacity onPress={() => setSelectedPhoto(item)}>
        <Image
          source={{ uri: item.uri }}
          style={[styles.gridItem, { width: itemSize, height: itemSize }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  const isReady = status === 'ready' && !!activeSeries;

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
            <Text style={styles.privacyButtonText}>プライバシー</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isReady ? (
        <View style={styles.emptyState} />
      ) : photos.length > 0 ? (
        <FlatList
          data={photos}
          renderItem={renderItem}
          keyExtractor={(item) => item.uri}
          numColumns={3}
          contentContainerStyle={styles.gridContainer}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>このシリーズにはまだ写真がありません</Text>
          <Text style={styles.emptyStateSubtext}>カメラで1枚目を撮影してみましょう</Text>
        </View>
      )}

      <Modal
        visible={!!selectedPhoto}
        animationType="fade"
        transparent={false}
        onRequestClose={closeViewer}
      >
        <SafeAreaView style={styles.viewerContainer}>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto.uri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}

          <View style={styles.viewerActions}>
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
    paddingHorizontal: 24,
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
