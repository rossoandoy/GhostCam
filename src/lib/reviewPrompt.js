import { File, Paths } from 'expo-file-system';
import * as StoreReview from 'expo-store-review';

const STORE_NAME = 'review-prompt.json';
// Apple caps the dialog at 3 times per 365 days; this keeps our own asks
// well under that and away from annoying the user.
const MIN_INTERVAL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

function storeFile() {
  return new File(Paths.document, STORE_NAME);
}

async function loadState() {
  try {
    const file = storeFile();
    if (!file.exists) {
      return { lastPromptAt: 0, promptCount: 0 };
    }
    const parsed = JSON.parse(await file.text());
    return {
      lastPromptAt: Number(parsed.lastPromptAt) || 0,
      promptCount: Number(parsed.promptCount) || 0,
    };
  } catch (error) {
    console.error('Error loading review prompt state:', error);
    return { lastPromptAt: 0, promptCount: 0 };
  }
}

// Fire-and-forget, called right after a Hibikasane is saved (a happy
// moment). Never throws; never blocks the save flow.
export async function maybeRequestReview() {
  try {
    const state = await loadState();
    const now = Date.now();
    // A negative delta (clock rolled back) counts as "interval satisfied"
    // so a future lastPromptAt can never block prompts forever.
    const sinceLast = now - state.lastPromptAt;
    if (state.lastPromptAt && sinceLast >= 0 && sinceLast < MIN_INTERVAL_MS) {
      return;
    }
    if (!(await StoreReview.isAvailableAsync())) {
      return;
    }

    // Record before asking: the OS may silently skip the dialog and we
    // must not end up re-asking on every save. promptCount is kept for
    // future tuning (e.g. stop after N lifetime asks).
    storeFile().write(
      JSON.stringify({ lastPromptAt: now, promptCount: state.promptCount + 1 })
    );
    await StoreReview.requestReview();
  } catch (error) {
    console.error('Error requesting store review:', error);
  }
}
