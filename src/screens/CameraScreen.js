import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, Alert, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSeries } from '../context/SeriesContext';
import { getLatestSeriesPhoto, saveCameraPhoto, formatCapturedAt } from '../lib/photoLib';
import SeriesPickerModal from '../components/SeriesPickerModal';
import OnboardingOverlay from '../components/OnboardingOverlay';

const GHOST_OPACITY_STEPS = [0.15, 0.3, 0.5];

export default function CameraScreen({ navigation }) {
  const { status, onboardingCompleted, activeSeries } = useSeries();
  const [permission, requestPermission] = useCameraPermissions();
  const [ghostPhoto, setGhostPhoto] = useState(null);
  const [latestPhoto, setLatestPhoto] = useState(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.3);
  const [pickerVisible, setPickerVisible] = useState(false);
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Tracks the series the user has selected "right now" so async work
  // started for a previous series can detect it's stale and bail out
  // instead of writing that series' photo into the current view.
  const activeSeriesIdRef = useRef(null);
  activeSeriesIdRef.current = activeSeries?.id;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const seriesId = activeSeries?.id;

      // Clear immediately so a series switch never shows the previous
      // series' ghost/thumbnail while the new one is loading.
      setGhostPhoto(null);
      setLatestPhoto(null);

      if (status === 'ready' && seriesId) {
        getLatestSeriesPhoto(seriesId)
          .then(photo => {
            if (!alive || activeSeriesIdRef.current !== seriesId) return;
            setGhostPhoto(photo);
            setLatestPhoto(photo);
          })
          .catch(error => {
            if (!alive || activeSeriesIdRef.current !== seriesId) return;
            console.error('Error loading latest image:', error);
          });
      }

      return () => {
        alive = false;
      };
    }, [status, activeSeries?.id])
  );

  const takePicture = async () => {
    if (!cameraRef.current || !activeSeries?.id) {
      return;
    }

    const seriesId = activeSeries.id;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      const savedPhoto = await saveCameraPhoto(seriesId, photo.uri);

      // If the user switched series while the photo was being saved, don't
      // let it appear as the ghost/thumbnail for the now-current series.
      if (activeSeriesIdRef.current === seriesId) {
        setGhostPhoto(savedPhoto);
        setLatestPhoto(savedPhoto);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('エラー', '写真の保存に失敗しました。もう一度お試しください。');
    }
  };

  const cycleGhostOpacity = () => {
    setGhostOpacity(current => {
      const currentIndex = GHOST_OPACITY_STEPS.indexOf(current);
      const nextIndex = (currentIndex + 1) % GHOST_OPACITY_STEPS.length;
      return GHOST_OPACITY_STEPS[nextIndex];
    });
  };

  // Context not loaded yet: nothing meaningful to render.
  if (status !== 'ready') {
    return <View style={styles.cameraContainer} />;
  }

  // Onboarding takes priority over the camera permission flow so the
  // value proposition is explained before we ask for anything.
  if (!onboardingCompleted) {
    return (
      <View style={styles.cameraContainer}>
        <OnboardingOverlay onComplete={requestPermission} />
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.permissionContainer} />;
  }

  if (!permission.granted) {
    const isBlocked = permission.canAskAgain === false;

    return (
      <View style={styles.permissionContainer}>
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

  // CameraView must not have children (officially unsupported; may crash).
  // Overlay and controls are absolutely-positioned siblings instead.
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={styles.camera}
        ref={cameraRef}
        facing="back"
      />

      {ghostPhoto && (
        <Image
          pointerEvents="none"
          source={{ uri: ghostPhoto.uri }}
          style={[styles.ghostOverlay, { opacity: ghostOpacity }]}
          resizeMode="cover"
        />
      )}

      <View
        pointerEvents="box-none"
        style={[styles.seriesHeader, { top: insets.top + 8 }]}
      >
        <TouchableOpacity style={styles.seriesChip} onPress={() => setPickerVisible(true)}>
          <Text style={styles.seriesChipText}>{activeSeries.name} ▾</Text>
        </TouchableOpacity>

        {ghostPhoto && (
          <Text pointerEvents="none" style={styles.infoRow}>
            {`前回 ${formatCapturedAt(ghostPhoto.capturedAt)}`}
            {activeSeries.locationLabel ? ` ・${activeSeries.locationLabel}` : ''}
          </Text>
        )}
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}
      >
        <View pointerEvents="box-none" style={styles.buttonContainer}>
          {ghostPhoto && (
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
            {latestPhoto ? (
              <Image
                source={{ uri: latestPhoto.uri }}
                style={styles.galleryThumbnail}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.galleryButtonText}>📷</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <SeriesPickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
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
  seriesHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
  },
  seriesChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  seriesChipText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoRow: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
