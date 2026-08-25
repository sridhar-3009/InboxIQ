import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { emailsApi, knowledgeApi, briefsApi, apiErrorMessage } from '../lib/api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailDetail'>;

const PRIORITY_BADGE: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#4a231c', text: '#e0a89a' },
  medium: { bg: '#78350f', text: '#fcd34d' },
  low:    { bg: '#14532d', text: '#86efac' },
};

export default function EmailDetailScreen({ route, navigation }: Props) {
  const { emailId } = route.params;
  const [email, setEmail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [extractingKnowledge, setExtractingKnowledge] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [reply, setReply] = useState('');

  useEffect(() => {
    emailsApi.getEmail(emailId)
      .then(e => {
        setEmail(e);
        if (!e.is_read) emailsApi.markRead(emailId).catch(() => {});
      })
      .catch(err => setError(apiErrorMessage(err, 'Failed to load email')))
      .finally(() => setLoading(false));
  }, [emailId]);

  const handleGenerateReply = async () => {
    setGeneratingReply(true);
    try {
      const data = await emailsApi.generateReply(emailId);
      setReply(data.reply || data.draft || '');
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to generate reply') });
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleStar = async () => {
    try {
      await emailsApi.star(emailId);
      setEmail((e: any) => e ? { ...e, is_starred: !e.is_starred } : e);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Star failed') });
    }
  };

  const handleArchive = async () => {
    Alert.alert('Archive', 'Archive this email?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', onPress: async () => {
          try {
            await emailsApi.archive(emailId);
            navigation.goBack();
          } catch (err) {
            Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Archive failed') });
          }
        },
      },
    ]);
  };

  const handleExtractKnowledge = async () => {
    setExtractingKnowledge(true);
    try {
      await knowledgeApi.extractFromEmail(emailId);
      Toast.show({ type: 'success', text1: 'Knowledge extracted' });
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Extraction failed') });
    } finally {
      setExtractingKnowledge(false);
    }
  };

  const handleGenerateBrief = async () => {
    setGeneratingBrief(true);
    try {
      await briefsApi.generateFromEmail(emailId);
      Toast.show({ type: 'success', text1: 'Brief generated — check Briefs screen' });
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Brief generation failed') });
    } finally {
      setGeneratingBrief(false);
    }
  };

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>
  );

  if (error) return (
    <View style={styles.centered}>
      <Ionicons name="wifi-outline" size={48} color="#4a4033" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.retryText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );

  if (!email) return null;

  const ai = email.ai_analysis;
  const priority = ai?.priority_level;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Subject */}
        <Text style={styles.subject}>{email.subject}</Text>

        {/* Meta */}
        <View style={styles.metaRow}>
          <TouchableOpacity
            style={styles.metaLeft}
            onPress={() => navigation.navigate('ContactDetail', {
              contactEmail: email.from_email,
              contactName: email.from_name || email.from_email,
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.from}>{email.from_name || email.from_email}</Text>
            <Text style={styles.fromEmail}>{email.from_email}</Text>
            <Text style={styles.time}>{new Date(email.received_at).toLocaleString()}</Text>
            <Text style={styles.tapHint}>Tap to view relationship</Text>
          </TouchableOpacity>
          {priority && (
            <View style={[styles.badge, { backgroundColor: PRIORITY_BADGE[priority]?.bg }]}>
              <Text style={[styles.badgeText, { color: PRIORITY_BADGE[priority]?.text }]}>{priority}</Text>
            </View>
          )}
        </View>

        {/* AI Summary */}
        {ai?.summary && (
          <View style={styles.summaryBox}>
            <View style={styles.summaryHeader}>
              <Ionicons name="sparkles" size={14} color="#818cf8" />
              <Text style={styles.summaryLabel}>AI Summary</Text>
            </View>
            <Text style={styles.summaryText}>{ai.summary}</Text>
            {ai.key_topics?.length > 0 && (
              <View style={styles.topics}>
                {ai.key_topics.map((t: string) => (
                  <View key={t} style={styles.topic}><Text style={styles.topicText}>{t}</Text></View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Body */}
        <View style={styles.bodyBox}>
          <Text style={styles.bodyText}>{email.body_text || email.snippet}</Text>
        </View>

        {/* AI Tools row */}
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={[styles.toolBtn, extractingKnowledge && styles.toolBtnDisabled]}
            onPress={handleExtractKnowledge}
            disabled={extractingKnowledge}
          >
            {extractingKnowledge
              ? <ActivityIndicator color="#b3812c" size="small" />
              : <><Ionicons name="library-outline" size={15} color="#b3812c" /><Text style={[styles.toolText, { color: '#b3812c' }]}>Extract Knowledge</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, generatingBrief && styles.toolBtnDisabled]}
            onPress={handleGenerateBrief}
            disabled={generatingBrief}
          >
            {generatingBrief
              ? <ActivityIndicator color="#93a06a" size="small" />
              : <><Ionicons name="newspaper-outline" size={15} color="#93a06a" /><Text style={[styles.toolText, { color: '#93a06a' }]}>Generate Brief</Text></>
            }
          </TouchableOpacity>
        </View>

        {/* AI Reply draft */}
        {reply ? (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>AI Draft Reply</Text>
            <Text style={styles.replyText}>{reply}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleStar}>
          <Ionicons name={email.is_starred ? 'star' : 'star-outline'} size={22} color={email.is_starred ? '#b3812c' : '#83745e'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleArchive}>
          <Ionicons name="archive-outline" size={22} color="#83745e" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.replyBtn, generatingReply && styles.replyBtnDisabled]}
          onPress={handleGenerateReply}
          disabled={generatingReply}
        >
          {generatingReply
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="sparkles" size={16} color="#fff" /><Text style={styles.replyBtnText}>AI Draft</Text></>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => navigation.navigate('ComposeReply', { emailId, subject: email.subject })}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#b5432f', marginTop: 12, marginBottom: 16, textAlign: 'center' },
  retryBtn: { backgroundColor: '#332b22', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
  scroll: { padding: 20, paddingBottom: 100 },
  subject: { color: '#f3efe8', fontSize: 18, fontWeight: '700', marginBottom: 16, lineHeight: 26 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  metaLeft: { flex: 1, paddingRight: 8 },
  from: { color: '#e7e0d4', fontWeight: '600', fontSize: 14 },
  fromEmail: { color: '#83745e', fontSize: 12, marginTop: 2 },
  time: { color: '#635646', fontSize: 12, marginTop: 4 },
  tapHint: { color: '#5e2a1a', fontSize: 10, marginTop: 3 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 4 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  summaryBox: { backgroundColor: '#1e1b4b', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#312e81' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  summaryLabel: { color: '#818cf8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryText: { color: '#c7d2fe', fontSize: 14, lineHeight: 20 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  topic: { backgroundColor: '#312e81', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topicText: { color: '#a5b4fc', fontSize: 12 },
  bodyBox: { backgroundColor: '#332b22', borderRadius: 14, padding: 16, marginBottom: 16 },
  bodyText: { color: '#a99b83', fontSize: 14, lineHeight: 22 },
  toolsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#332b22', borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#4a4033' },
  toolBtnDisabled: { opacity: 0.6 },
  toolText: { fontSize: 12, fontWeight: '600' },
  replyBox: { backgroundColor: '#0c2a1e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#166534' },
  replyLabel: { color: '#4ade80', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  replyText: { color: '#d1fae5', fontSize: 14, lineHeight: 22 },
  actions: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#221c16', borderTopWidth: 1, borderTopColor: '#332b22', gap: 8,
  },
  actionBtn: { backgroundColor: '#332b22', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#4a4033' },
  replyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#b04723', borderRadius: 12, paddingVertical: 13,
  },
  replyBtnDisabled: { opacity: 0.6 },
  replyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sendBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#134e4a' },
});
