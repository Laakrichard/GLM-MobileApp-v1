import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('glm-orders', {
        name: 'Order Updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#B87333',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData?.data;
    if (token) {
      await savePushToken(token);
      await AsyncStorage.setItem('glm_push_token', token);
    }
    return token;
  } catch (e) {
    console.log('Push registration error:', e);
    return null;
  }
}

async function savePushToken(pushToken) {
  try {
    const authToken = await AsyncStorage.getItem('glm_token');
    if (!authToken) return;
    await fetch(`${API_BASE}/wp-json/glm/v1/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_token: pushToken }),
    });
  } catch (e) {
    console.log('Save push token error:', e);
  }
}

export function setupNotificationListeners(onNotification) {
  const sub1 = Notifications.addNotificationReceivedListener(notification => {
    if (onNotification) onNotification(notification);
  });
  const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (onNotification) onNotification(response.notification, data);
  });
  return () => { sub1.remove(); sub2.remove(); };
}
