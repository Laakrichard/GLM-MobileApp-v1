import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotifications, setupNotificationListeners } from './src/utils/notifications';
import * as ExpoSplashScreen from 'expo-splash-screen';

ExpoSplashScreen.preventAutoHideAsync();
ExpoSplashScreen.hideAsync();

import SplashScreen      from './src/screens/SplashScreen';
import OnboardingScreen  from './src/screens/OnboardingScreen';
import LoginScreen       from './src/screens/LoginScreen';
import RegisterScreen    from './src/screens/RegisterScreen';
import HomeScreen        from './src/screens/HomeScreen';
import MarkersScreen     from './src/screens/MarkersScreen';
import DesignerScreen    from './src/screens/DesignerScreen';
import OrdersScreen      from './src/screens/OrdersScreen';
import VideosScreen      from './src/screens/VideosScreen';
import ProfileScreen     from './src/screens/ProfileScreen';
import AdminScreen       from './src/screens/AdminScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const ADMIN_ROLES = ['administrator', 'editor', 'shop_manager'];

function TabIcon({ name, focused }) {
  const icons = {
    Home:    { on: '⌂',  off: '⌂'  },
    Markers: { on: '◉',  off: '◎'  },
    Design:  { on: '✦',  off: '✧'  },
    Orders:  { on: '📋', off: '📋' },
    Videos:  { on: '▶',  off: '▷'  },
    Profile: { on: '◉',  off: '○'  },
    Admin:   { on: '⚙',  off: '⚙'  },
  };
  const icon = icons[name] || { on: '●', off: '○' };
  return (
    <Text style={{ fontSize: 17, color: focused ? '#B87333' : '#555' }}>
      {focused ? icon.on : icon.off}
    </Text>
  );
}

function MainTabs({ isAdmin }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: 'rgba(12,12,18,0.95)', borderTopColor: 'rgba(255,255,255,0.07)', borderTopWidth: 1, paddingBottom: 8, paddingTop: 8, height: 68 },
        tabBarActiveTintColor: '#B87333',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.2)',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen} />
      <Tab.Screen name="Markers" component={MarkersScreen} />
      <Tab.Screen name="Design"  component={DesignerScreen} />
      <Tab.Screen name="Videos"  component={VideosScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {isAdmin && <Tab.Screen name="Admin" component={AdminScreen} />}
    </Tab.Navigator>
  );
}

export default function App() {
  const [appState, setAppState] = useState('loading');
  const [isAdmin,  setIsAdmin]  = useState(false);

  useEffect(() => {
    (async () => {
      const role = await AsyncStorage.getItem('glm_role');
      setIsAdmin(ADMIN_ROLES.includes(role));
      setAppState('splash');
      // Register for push notifications
      registerForPushNotifications();
      // Listen for notifications
      setupNotificationListeners((notification, data) => {
        console.log('Notification received:', notification);
      });
    })();
  }, []);

  if (appState === 'loading') return null;

  if (appState === 'splash') {
    return <SplashScreen onDone={() => setAppState('onboarding')} />;
  }

  if (appState === 'onboarding') {
    return <OnboardingScreen onDone={() => setAppState('auth')} />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
        <Stack.Screen name="Login"       component={LoginScreen} />
        <Stack.Screen name="Register"    component={RegisterScreen} />
        <Stack.Screen name="Orders"      component={OrdersScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main"        children={({ navigation }) => {
          // Re-check role every time Main is navigated to
          const [adminState, setAdminState] = React.useState(isAdmin);
          React.useEffect(() => {
            const unsubscribe = navigation.addListener('focus', async () => {
              const role = await AsyncStorage.getItem('glm_role');
              setAdminState(ADMIN_ROLES.includes(role));
            });
            return unsubscribe;
          }, [navigation]);
          return <MainTabs isAdmin={adminState} />;
        }} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
