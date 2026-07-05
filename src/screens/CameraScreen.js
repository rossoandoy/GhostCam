import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, Alert, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';

const GHOST_OPACITY_STEPS = [0.15, 0.3, 0.5];

export default function CameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ghostImageUri, setGhostImageUri] = useState(null);
  const [latestImageUri, setLatestImageUri] = useState(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.3);
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  const loadLatestImage = useCallback(async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'photos/');
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'photos/', { intermediates: true });
        setGhostImageUri(null);
        setLatestImageUri(null);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory + 'photos/');
      const imageFiles = files.filter(file => file.endsWith('.jpg')).sort().reverse();

      if (imageFiles.length > 0) {
        const latestImage = FileSystem.documentDirectory + 'photos/' + imageFiles[0];
        setGhostImageUri(latestImage);
        setLatestImageUri(latestImage);
      } else {
        setGhostImageUri(null);
        setLatestImageUri(null);
      }
    } catch (error) {
      console.error('Error loading latest image:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLatestImage();
    }, [loadLatestImage])
  );

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });

        // Create photos directory if it doesn't exist
        const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'photos/');
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'photos/', { intermediates: true });
        }

        // Save with timestamp filename
        const timestamp = new Date().getTime();
        const filename = `photo_${timestamp}.jpg`;
        const newPath = FileSystem.documentDirectory + 'photos/' + filename;

        await FileSystem.moveAsync({
          from: photo.uri,
          to: newPath,
        });

        // Update ghost overlay and latest image
        setGhostImageUri(newPath);
        setLatestImageUri(newPath);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('エラー', '写真の保存に失敗しました。もう一度お試しください。');
      }
    }
  };

  const cycleGhostOpacity = () => {
    setGhostOpacity(current => {
      const currentIndex = GHOST_OPACITY_STEPS.indexOf(current);
      const nextIndex = (currentIndex + 1) % GHOST_OPACITY_STEPS.length;
      return GHOST_OPACITY_STEPS[nextIndex];
    });
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    const isBlocked = permission.canAskAgain === false;

    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          {isBlocked
            ? 'カメラへのアクセスが拒否されています。設定アプリから許可してください。'
            : 'カメラへのアクセスを許可してください'}
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={
            isBlocked
              ? () =>
                  Linking.openSettings().catch(() =>
                    Alert.alert('エラー', '設定を開けませんでした。')
                  )
              : requestPermission
          }
        >
          <Text style={styles.permissionButtonText}>
            {isBlocked ? '設定を開く' : '許可する'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        ref={cameraRef}
        facing="back"
      >
        {ghostImageUri && (
          <Image
            source={{ uri: ghostImageUri }}
            style={[styles.ghostOverlay, { opacity: ghostOpacity }]}
            resizeMode="cover"
          />
        )}

        <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.buttonContainer}>
            {ghostImageUri && (
              <TouchableOpacity style={styles.opacityButton} onPress={cycleGhostOpacity}>
                <Text style={styles.opacityButtonText}>{Math.round(ghostOpacity * 100)}%</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.shutterButton} onPress={takePicture}>
              <View style={styles.shutterButtonInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => navigation.navigate('Gallery')}
            >
              {latestImageUri ? (
                <Image
                  source={{ uri: latestImageUri }}
                  style={styles.galleryThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.galleryButtonText}>📷</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  ghostOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  shutterButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  shutterButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  galleryButton: {
    position: 'absolute',
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  galleryThumbnail: {
    width: '100%',
    height: '100%',
  },
  galleryButtonText: {
    fontSize: 24,
  },
  opacityButton: {
    position: 'absolute',
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  opacityButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
