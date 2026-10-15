import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';

const STORE_NAME = 'reminder.json';
const DEFAULT_SETTINGS = { enabled: false, hour: 20, minute: 0 };

// While the app is in the foreground the user is already looking at the
// camera, so the daily reminder stays silent there.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// File/Directory instances mutate their `uri` when moved, so always build a
// fresh instance per operation.
function storeFile() {
  return new File(Paths.document, STORE_NAME);
}

function clampInt(value, min, max, fallback) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export async function loadReminderSettings() {
  try {
    const file = storeFile();
    if (!file.exists) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(await file.text());
    return {
      enabled: parsed.enabled === true,
      hour: clampInt(parsed.hour, 0, 23, DEFAULT_SETTINGS.hour),
      minute: clampInt(parsed.minute, 0, 59, DEFAULT_SETTINGS.minute),
    };
  } catch (error) {
    console.error('Error loading reminder settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveReminderSettings(settings) {
  storeFile().write(JSON.stringify(settings));
}

export async function hasNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  return current.granted === true;
}

// 'granted' | 'denied' (can ask again later) | 'blocked' (needs Settings).
export async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return 'granted';
  }
  if (current.canAskAgain === false) {
    return 'blocked';
  }
  const next = await Notifications.requestPermissionsAsync();
  if (next.granted) {
    return 'granted';
  }
  return next.canAskAgain === false ? 'blocked' : 'denied';
}

const REMINDER_ID = 'daily-reminder';

// A fixed identifier scopes cancel/replace to the reminder alone, so any
// future notification kinds won't be swept away.
export async function applyReminderSchedule(settings) {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  if (!settings.enabled) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'きょうの1枚を撮りましょう',
      body: '前回と同じ場所・同じ角度で、今日の変化を記録しませんか。',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.hour,
      minute: settings.minute,
    },
  });
}
