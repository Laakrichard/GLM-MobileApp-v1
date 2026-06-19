// Push notifications disabled for IPA testing build
// Will be re-enabled when paid Apple Developer account is active
// Revert to tag: STABLE-v1.2-SHIP-READY to restore push notifications

export async function registerForPushNotifications() {
  console.log('Push notifications disabled in this build');
  return null;
}

export function setupNotificationListeners(onNotification) {
  return () => {};
}
