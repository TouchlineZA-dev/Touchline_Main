import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1E8E4F', // Exact green from Figma
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.75)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'NEWS',
          tabBarIcon: ({ color }) => (
            <Ionicons name="newspaper-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          title: 'MY SQUAD',
          tabBarIcon: ({ color }) => (
            <Ionicons name="people-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'LEAGUES',
          tabBarIcon: ({ color }) => (
            <Ionicons name="trophy-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="table"
        options={{
          title: 'PSL TABLE',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="table-large" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'LIVE GAMES',
          tabBarIcon: ({ color }) => (
            <Ionicons name="football-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
