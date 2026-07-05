import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity, Text, SafeAreaView, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system';

export default function GalleryScreen({ navigation }) {
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
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
    }
  };

  const renderItem = ({ item }) => {
    const screenWidth = Dimensions.get('window').width;
    const itemSize = screenWidth / 3;

    return (
      <Image
        source={{ uri: item }}
        style={[styles.gridItem, { width: itemSize, height: itemSize }]}
        resizeMode="cover"
      />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
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
});
