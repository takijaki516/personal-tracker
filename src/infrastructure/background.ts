import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { getConnectionInfo, maintenance, syncNow } from './services';
const TASK = 'exercise-backup-and-sync';
TaskManager.defineTask(TASK, async () => {
  try {
    await maintenance();
    // A sleeping/unreachable Mac must not prevent the local daily backup.
    if ((await getConnectionInfo()).connected) {
      try {
        await syncNow();
      } catch {
        /* retry when foreground/network returns */
      }
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
export async function registerBackground() {
  if (!(await TaskManager.isAvailableAsync())) {
    return false;
  }
  if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  }
  return true;
}
