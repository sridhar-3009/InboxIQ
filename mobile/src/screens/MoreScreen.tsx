import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenName = keyof RootStackParamList;

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  sub: string;
  onPress: () => void;
}

function MenuItem({ icon, color, label, sub, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#4a4033" />
    </TouchableOpacity>
  );
}

interface Section {
  title: string;
  items: {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    sub: string;
    screen: ScreenName;
  }[];
}

export default function MoreScreen() {
  const navigation = useNavigation<NavProp>();

  const sections: Section[] = [
    {
      title: 'Business Intelligence',
      items: [
        { icon: 'trending-up-outline', color: '#5c7a4a', label: 'Revenue',       sub: 'Track payments & pipeline',    screen: 'Revenue' },
        { icon: 'people-outline',       color: '#e17c4e', label: 'Relationships', sub: 'Contact scores & sentiment',   screen: 'Relationships' },
        { icon: 'document-text-outline',color: '#93a06a', label: 'Quotes',        sub: 'Proposals & pricing',          screen: 'Quotes' },
        { icon: 'timer-outline',        color: '#f97316', label: 'SLA Tracker',   sub: 'Response compliance & breaches',screen: 'SLA' },
      ],
    },
    {
      title: 'Team',
      items: [
        { icon: 'grid-outline',         color: '#e17c4e', label: 'Workspace', sub: 'Docs, files, chat & settings', screen: 'Workspace' },
      ],
    },
    {
      title: 'Productivity',
      items: [
        { icon: 'git-branch-outline',   color: '#f97316', label: 'Sequences',  sub: 'Email automation flows',       screen: 'Sequences' },
        { icon: 'newspaper-outline',    color: '#93a06a', label: 'Briefs',     sub: 'Meeting prep summaries',       screen: 'Briefs' },
        { icon: 'library-outline',      color: '#b3812c', label: 'Knowledge',  sub: 'Extracted email insights',     screen: 'Knowledge' },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: 'card-outline',         color: '#5c7a4a', label: 'Billing',    sub: 'Plan, usage & invoices',       screen: 'Billing' },
        { icon: 'person-circle-outline',color: '#a99b83', label: 'Settings',   sub: 'Profile & sign out',           screen: 'Settings' },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.group}>
            {section.items.map((item, i) => (
              <React.Fragment key={item.label}>
                <MenuItem
                  icon={item.icon}
                  color={item.color}
                  label={item.label}
                  sub={item.sub}
                  onPress={() => navigation.navigate(item.screen as any)}
                />
                {i < section.items.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#83745e', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: '#332b22', borderRadius: 16, borderWidth: 1, borderColor: '#4a4033', overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  itemBody: { flex: 1 },
  label: { color: '#e7e0d4', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sub: { color: '#83745e', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#4a4033', marginLeft: 70 },
});
