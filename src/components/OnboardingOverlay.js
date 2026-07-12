import React, { useState } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSeries } from '../context/SeriesContext';

const DEFAULT_SERIES_NAME = 'マイシリーズ';

export default function OnboardingOverlay({ onComplete }) {
  const { completeOnboarding } = useSeries();
  const [seriesName, setSeriesName] = useState(DEFAULT_SERIES_NAME);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const name = seriesName.trim() || DEFAULT_SERIES_NAME;
      await completeOnboarding({ firstSeriesName: name });
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('エラー', '設定の保存に失敗しました。もう一度お試しください。');
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.avoidingView}
      >
        <View style={styles.card}>
          <Text style={styles.appName}>ヒビカメ</Text>
          <Text style={styles.tagline}>まいにち、おなじ場所から。</Text>

          <View style={styles.bulletList}>
            <Text style={styles.bullet}>
              📷 前回の写真がうっすら重なり、同じ構図で撮れます
            </Text>
            <Text style={styles.bullet}>
              🌱 毎日1枚。続けるほど変化が見えてきます
            </Text>
            <Text style={styles.bullet}>
              📁 「子供の成長」「家庭菜園」など、シリーズを分けて記録
            </Text>
          </View>

          <Text style={styles.inputLabel}>最初のシリーズ名（あとで変更できます）</Text>
          <TextInput
            style={styles.input}
            placeholder={DEFAULT_SERIES_NAME}
            placeholderTextColor="#8e8e93"
            value={seriesName}
            onChangeText={setSeriesName}
            maxLength={30}
          />

          <TouchableOpacity
            style={[styles.startButton, isSubmitting && styles.startButtonDisabled]}
            onPress={handleStart}
            disabled={isSubmitting}
          >
            <Text style={styles.startButtonText}>はじめる</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avoidingView: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  appName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 20,
  },
  bulletList: {
    alignSelf: 'stretch',
    marginBottom: 22,
  },
  bullet: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    marginBottom: 20,
  },
  startButton: {
    alignSelf: 'stretch',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
