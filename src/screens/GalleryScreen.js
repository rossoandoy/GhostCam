import React, { useState, useCallback } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';

const PRIVACY_POLICY_URL = 'https://rossoandoy.github.io/GhostCam/';

export default function GalleryScreen({ navigation }) {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const loadPhotos = useCallback(async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'photos/');
      if (!dirInfo.exists) {
        return;
      }

      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory + 'photos/');
      const imageFiles = files
        .filter(file => file.endsWith('.jpg'))
        .sort()
        .reverse()
        .map(filename => FileSystem.documentDirectory + 'photos/' + filename);

      setPhotos(imageFiles);
    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert('エラー', '写真の読み込みに失敗しました。');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos])
  );

  const closeViewer = () => {
    setSelectedPhoto(null);
  };

  const handleShare = async () => {
    const photoUri = selectedPhoto;
    if (!photoUri) return;

    try {
      await Share.share({ url: photoUri });
    } catch (error) {
      console.error('Error sharing photo:', error);
      Alert.alert('エラー', '写真の共有に失敗しました。');
    }
  };

  const handleDelete = () => {
    const photoUri = selectedPhoto;
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
              await FileSystem.deleteAsync(photoUri, { idempotent: true });
              await loadPhotos();
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
          source={{ uri: item }}
          style={[styles.gridItem, { width: itemSize, height: itemSize }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>

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

      {photos.length > 0 ? (
        <FlatList
          data={photos}
          renderItem={renderItem}
          keyExtractor={(item) => item}
          numColumns={3}
          contentContainerStyle={styles.gridContainer}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>写真がありません</Text>
          <Text style={styles.emptyStateSubtext}>カメラで写真を撮影してください</Text>
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
              source={{ uri: selectedPhoto }}
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
