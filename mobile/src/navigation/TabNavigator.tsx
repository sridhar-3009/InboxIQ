import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import InboxScreen from '../screens/InboxScreen';
import ActionsScreen from '../screens/ActionsScreen';
import MoreScreen from '../screens/MoreScreen';
import { notificationsApi } from '../lib/api';
import type { TabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      notificationsApi.list()
        .then(({ unread_count }) => { if (active) setUnread(unread_count || 0); })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );

  return (
    <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
      <Ionicons name="notifications-outline" size={22} color="#f3efe8" />
      {unread > 0 && (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#221c16' },
        headerTintColor: '#f3efe8',
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: '#221c16', borderTopColor: '#332b22' },
        tabBarActiveTintColor: '#e17c4e',
        tabBarInactiveTintColor: '#635646',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          headerRight: () => <NotificationBell />,
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => <Ionicons name="mail-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Actions"
        component={ActionsScreen}
        options={{
          title: 'Actions',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bellBtn: { marginRight: 16, padding: 2 },
  bellBadge: { position: 'absolute', top: -3, right: -5, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#b04723', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
