import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  Alert,
  Linking,
  Animated,
  AppState,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSeries } from '../context/SeriesContext';
import {
  listSeriesPhotos,
  saveCameraPhoto,
  formatCapturedAt,
  daysBetweenLocal,
  computeStreak,
} from '../lib/photoLib';
import SeriesPickerModal from '../components/SeriesPickerModal';
import OnboardingOverlay from '../components/OnboardingOverlay';

const GHOST_OPACITY_STEPS = [0.15, 0.3, 0.5];

// Before/after flash timeline (ms).
const FLASH_HOLD_FROM = 250;
const FLASH_CROSSFADE = 550;
const FLASH_HOLD_TO = 650;
const FLASH_FADE_OUT = 300;
// Start even if the new photo's onLoad never fires (e.g. slow decode).
const FLASH_LOAD_TIMEOUT = 800;

export default function CameraScreen({ navigation }) {
  const { status, onboardingCompleted, activeSeries } = useSeries();
  const [permission, requestPermission] = useCameraPermissions();
  const [ghostPhoto, setGhostPhoto] = useState(null);
  const [latestPhoto, setLatestPhoto] = useState(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.3);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [streak, setStreak] = useState(0);

  // "Days since last shot" must refresh when the app comes back to the
  // foreground (e.g. reopened the next morning); render-time Date.now()
  // alone would stay stale because nothing re-renders on resume.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNowTick(Date.now());
      }
    });
    return () => subscription.remove();
  }, []);
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Before/after flash shown right after a shot (2nd photo onwards).
  // flashSeqRef invalidates stale callbacks when a new flash starts
  // (rapid shots) or the screen loses focus. The running sequence is
  // kept in flashAnimRef so it can be hard-stopped: stopAnimation() on
  // the Values would not interrupt Animated.delay() steps.
  const [flash, setFlash] = useState(null);
  const flashSeqRef = useRef(0);
  const flashAnimRef = useRef(null);
  const flashStartedForRef = useRef(0);
  const flashLoadTimerRef = useRef(null);
  const flashCrossfade = useRef(new Animated.Value(0)).current;
  const flashOverlayOpacity = useRef(new Animated.Value(1)).current;

  const cancelFlash = useCallback(() => {
    flashSeqRef.current += 1;
    if (flashLoadTimerRef.current) {
      clearTimeout(flashLoadTimerRef.current);
      flashLoadTimerRef.current = null;
    }
    if (flashAnimRef.current) {
      flashAnimRef.current.stop();
      flashAnimRef.current = null;
    }
    setFlash(null);
  }, []);

  const beginFlashAnimation = useCallback(
    id => {
      if (flashSeqRef.current !== id || flashStartedForRef.current === id) {
        return;
      }
      flashStartedForRef.current = id;
      if (flashLoadTimerRef.current) {
        clearTimeout(flashLoadTimerRef.current);
        flashLoadTimerRef.current = null;
      }

      const animation = Animated.sequence([
        Animated.delay(FLASH_HOLD_FROM),
        Animated.timing(flashCrossfade, {
          toValue: 1,
          duration: FLASH_CROSSFADE,
          useNativeDriver: true,
        }),
        Animated.delay(FLASH_HOLD_TO),
        Animated.timing(flashOverlayOpacity, {
          toValue: 0,
          duration: FLASH_FADE_OUT,
          useNativeDriver: true,
        }),
      ]);
      flashAnimRef.current = animation;
      animation.start(({ finished }) => {
        if (finished && flashSeqRef.current === id) {
          flashAnimRef.current = null;
          setFlash(null);
        }
      });
    },
    [flashCrossfade, flashOverlayOpacity]
  );

  const startFlash = useCallback(
    (fromUri, toUri) => {
      cancelFlash();
      const id = flashSeqRef.current;
      flashCrossfade.setValue(0);
      flashOverlayOpacity.setValue(1);
      setFlash({ id, fromUri, toUri });

      // The timeline begins once the new photo is decoded (onLoad on the
      // "to" image), with a timeout fallback, so the crossfade never
      // reveals a still-loading image.
      flashLoadTimerRef.current = setTimeout(
        () => beginFlashAnimation(id),
        FLASH_LOAD_TIMEOUT
      );
    },
    [cancelFlash, beginFlashAnimation, flashCrossfade, flashOverlayOpacity]
  );

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
      setStreak(0);
      setNowTick(Date.now());

      // A pending flash belongs to the previous focus/series.
      cancelFlash();

      if (status === 'ready' && seriesId) {
        listSeriesPhotos(seriesId)
          .then(photoList => {
            if (!alive || activeSeriesIdRef.current !== seriesId) return;
            const photo = photoList.length > 0 ? photoList[0] : null;
            setGhostPhoto(photo);
            setLatestPhoto(photo);
            setStreak(computeStreak(photoList));
          })
          .catch(error => {
            if (!alive || activeSeriesIdRef.current !== seriesId) return;
            console.error('Error loading latest image:', error);
          });
      }

      return () => {
        alive = false;
        cancelFlash();
      };
    }, [status, activeSeries?.id, cancelFlash])
  );

  const capturingRef = useRef(false);

  const takePicture = async () => {
    if (!cameraRef.current || !activeSeries?.id || capturingRef.current) {
      return;
    }
    capturingRef.current = true;

    // Restore the live preview immediately if a flash is still showing.
    cancelFlash();

    const seriesId = activeSeries.id;
    const previousPhoto = ghostPhoto;

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

        if (previousPhoto) {
          startFlash(previousPhoto.uri, savedPhoto.uri);
        }

        // Recompute from disk so the streak can never drift from
        // computeStreak()'s definition (a failure here is non-fatal).
        try {
          const photoList = await listSeriesPhotos(seriesId);
          if (activeSeriesIdRef.current === seriesId) {
            setStreak(computeStreak(photoList));
          }
        } catch (streakError) {
          console.error('Error refreshing streak:', streakError);
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('エラー', '写真の保存に失敗しました。もう一度お試しください。');
    } finally {
      capturingRef.current = false;
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

  const daysSinceLast = ghostPhoto
    ? daysBetweenLocal(ghostPhoto.capturedAt, nowTick)
    : null;

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

      {flash && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flashOverlay, { opacity: flashOverlayOpacity }]}
        >
          <Image
            source={{ uri: flash.fromUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <Animated.Image
            source={{ uri: flash.toUri }}
            style={[StyleSheet.absoluteFill, { opacity: flashCrossfade }]}
            resizeMode="cover"
            onLoad={() => beginFlashAnimation(flash.id)}
            onError={cancelFlash}
          />
          {/* 120 clears the shutter row (70px buttons + 24px padding + margin) */}
          <View style={[styles.flashLabelWrap, { bottom: insets.bottom + 120 }]}>
            <Text style={styles.flashLabel}>前回 → いま</Text>
          </View>
        </Animated.View>
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

        {daysSinceLast !== null && daysSinceLast >= 1 && (
          <Text pointerEvents="none" style={styles.daysSince}>
            {`前回から ${daysSinceLast}日`}
          </Text>
        )}

        {/* Only a live run (last shot today or yesterday) reads as a streak;
            an old run next to "前回から N日" would contradict it. */}
        {streak >= 2 && daysSinceLast !== null && daysSinceLast <= 1 && (
          <Text pointerEvents="none" style={styles.streakBadge}>
            {`${streak}日連続`}
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
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: '#000',
  },
  flashLabelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  flashLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
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
  daysSince: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  streakBadge: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#ffd977',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
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
