import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert, Modal, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { workspaceApi, apiErrorMessage } from '../lib/api';
import CallPanel from '../components/CallPanel';

type Tab = 'docs' | 'files' | 'chat' | 'settings';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Docs ───────────────────────────────────────────────────────────────────

function DocsTab() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editorDoc, setEditorDoc] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { docs } = await workspaceApi.listDocs();
      setDocs(docs || []);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to load docs') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDoc = async (id: string) => {
    try {
      const doc = await workspaceApi.getDoc(id);
      setEditorDoc(doc);
      setTitle(doc.title);
      setContent(doc.content || '');
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to open doc') });
    }
  };

  const createDoc = async () => {
    try {
      const doc = await workspaceApi.createDoc('Untitled');
      await load();
      openDoc(doc.id);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to create doc') });
    }
  };

  const save = async () => {
    if (!editorDoc) return;
    setSaving(true);
    try {
      await workspaceApi.updateDoc(editorDoc.id, { title, content });
      await load();
      Toast.show({ type: 'success', text1: 'Saved' });
      setEditorDoc(null);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to save') });
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert('Delete doc', 'This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await workspaceApi.deleteDoc(id);
            await load();
          } catch (err) {
            Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Delete failed') });
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabHeaderText}>Shared pages for your team</Text>
        <TouchableOpacity style={styles.addBtn} onPress={createDoc}>
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#e17c4e" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openDoc(item.id)}>
            <Ionicons name="document-text-outline" size={18} color="#e17c4e" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
              {item.folder ? <Text style={styles.rowSub}>{item.folder}</Text> : null}
            </View>
            <Text style={styles.rowDate}>{fmtDate(item.updated_at)}</Text>
            <TouchableOpacity onPress={() => remove(item.id)} style={{ marginLeft: 10, padding: 4 }}>
              <Ionicons name="trash-outline" size={16} color="#635646" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="document-text-outline" size={48} color="#4a4033" />
            <Text style={styles.emptyText}>No docs yet</Text>
          </View>
        }
      />

      <Modal visible={!!editorDoc} animationType="slide" onRequestClose={() => setEditorDoc(null)}>
        <View style={styles.editorContainer}>
          <View style={styles.editorHeader}>
            <TouchableOpacity onPress={() => setEditorDoc(null)}><Ionicons name="close" size={24} color="#e7e0d4" /></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
          <TextInput style={styles.editorTitle} value={title} onChangeText={setTitle} placeholder="Untitled" placeholderTextColor="#635646" />
          <TextInput
            style={styles.editorBody}
            value={content}
            onChangeText={setContent}
            placeholder="Start writing..."
            placeholderTextColor="#635646"
            multiline
            textAlignVertical="top"
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Files ──────────────────────────────────────────────────────────────────

function FilesTab() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { files } = await workspaceApi.listFiles();
      setFiles(files || []);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to load files') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    setUploading(true);
    try {
      await workspaceApi.uploadFile(file.uri, file.name, file.mimeType || 'application/octet-stream');
      await load();
      Toast.show({ type: 'success', text1: 'Uploaded' });
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Upload failed') });
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (id: string) => {
    try {
      const { url } = await workspaceApi.downloadFile(id);
      Linking.openURL(url);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to open file') });
    }
  };

  const remove = (id: string) => {
    Alert.alert('Delete file', 'This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await workspaceApi.deleteFile(id);
            await load();
          } catch (err) {
            Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Delete failed') });
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabHeaderText}>Shared with your whole team &middot; 25MB limit</Text>
        <TouchableOpacity style={styles.addBtn} onPress={upload} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
      <FlatList
        data={files}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#e17c4e" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openFile(item.id)}>
            <Ionicons name="attach-outline" size={18} color="#a99b83" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.filename}</Text>
              <Text style={styles.rowSub}>{fmtSize(item.size_bytes)} &middot; {fmtDate(item.created_at)}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(item.id)} style={{ marginLeft: 10, padding: 4 }}>
              <Ionicons name="trash-outline" size={16} color="#635646" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="attach-outline" size={48} color="#4a4033" />
            <Text style={styles.emptyText}>No files yet</Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Chat ───────────────────────────────────────────────────────────────────

function ChatTab() {
  const [channels, setChannels] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      const { channels } = await workspaceApi.listChannels();
      setChannels(channels || []);
      if (!activeChannel && channels?.length) setActiveChannel(channels[0].id);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to load channels') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const loadMessages = useCallback(async (channelId: string) => {
    try {
      const { messages } = await workspaceApi.listMessages(channelId);
      setMessages(messages || []);
    } catch { /* silent on poll */ }
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(activeChannel), 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChannel, loadMessages]);

  const send = async () => {
    if (!input.trim() || !activeChannel) return;
    const text = input;
    setInput('');
    try {
      await workspaceApi.sendMessage(activeChannel, text);
      await loadMessages(activeChannel);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to send') });
      setInput(text);
    }
  };

  const confirmCreateChannel = async () => {
    const name = newChannelName.trim();
    if (!name) return;
    try {
      const ch = await workspaceApi.createChannel(name);
      await loadChannels();
      setActiveChannel(ch.id);
      setNewChannelOpen(false);
      setNewChannelName('');
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to create channel') });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {activeChannel && <CallPanel key={activeChannel} channelId={activeChannel} />}
      <View style={styles.channelBar}>
        <FlatList
          horizontal
          data={channels}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.channelChip, activeChannel === item.id && styles.channelChipActive]}
              onPress={() => setActiveChannel(item.id)}
            >
              <Text style={[styles.channelChipText, activeChannel === item.id && styles.channelChipTextActive]}>#{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.rowSub}>No channels yet</Text>}
        />
        <TouchableOpacity style={styles.addBtnSmall} onPress={() => setNewChannelOpen(true)}>
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        renderItem={({ item }) => (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={styles.msgAuthor}>{item.author_name}</Text>
              <Text style={styles.rowDate}>{fmtDate(item.created_at)}</Text>
            </View>
            <Text style={styles.msgBody}>{item.content}</Text>
          </View>
        )}
        ListEmptyComponent={activeChannel ? <Text style={[styles.rowSub, { padding: 16 }]}>No messages yet — say hi.</Text> : null}
      />

      {activeChannel && (
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            value={input}
            onChangeText={setInput}
            placeholder="Message the team..."
            placeholderTextColor="#635646"
            onSubmitEditing={send}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={newChannelOpen} transparent animationType="fade" onRequestClose={() => setNewChannelOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New channel</Text>
            <TextInput
              style={styles.modalInput}
              value={newChannelName}
              onChangeText={setNewChannelName}
              placeholder="e.g. general"
              placeholderTextColor="#635646"
              autoFocus
              onSubmitEditing={confirmCreateChannel}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setNewChannelOpen(false); setNewChannelName(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmCreateChannel}>
                <Text style={styles.saveBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

function WorkspaceSettingsTab() {
  const [domains, setDomains] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    workspaceApi.getSettings()
      .then((s) => setDomains((s.allowed_email_domains || []).join(', ')))
      .catch((err) => Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to load settings') }))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const list = domains.split(',').map((d) => d.trim()).filter(Boolean);
      await workspaceApi.updateSettings({ allowed_email_domains: list });
      Toast.show({ type: 'success', text1: 'Saved' });
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to save') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  return (
    <View style={{ padding: 16 }}>
      <Text style={styles.settingsLabel}>Allowed email domains</Text>
      <TextInput
        style={styles.settingsInput}
        value={domains}
        onChangeText={setDomains}
        placeholder="yourcompany.com, partner.com"
        placeholderTextColor="#635646"
      />
      <Text style={styles.settingsHint}>Comma-separated. Leave blank to allow any email domain when inviting teammates.</Text>
      <TouchableOpacity style={styles.saveBtnWide} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'docs', label: 'Docs', icon: 'document-text-outline' },
  { id: 'files', label: 'Files', icon: 'attach-outline' },
  { id: 'chat', label: 'Chat', icon: 'chatbubble-outline' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' },
];

export default function WorkspaceScreen() {
  const [tab, setTab] = useState<Tab>('docs');

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]} onPress={() => setTab(t.id)}>
            <Ionicons name={t.icon} size={16} color={tab === t.id ? '#fff' : '#83745e'} />
            <Text style={[styles.tabBtnText, tab === t.id && styles.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'docs' && <DocsTab />}
      {tab === 'files' && <FilesTab />}
      {tab === 'chat' && <ChatTab />}
      {tab === 'settings' && <WorkspaceSettingsTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#635646', marginTop: 12, fontSize: 15 },

  tabBar: { flexDirection: 'row', padding: 4, margin: 12, backgroundColor: '#332b22', borderRadius: 12, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9 },
  tabBtnActive: { backgroundColor: '#b04723' },
  tabBtnText: { color: '#83745e', fontSize: 12, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },

  tabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  tabHeaderText: { color: '#83745e', fontSize: 12, flex: 1 },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#b04723', justifyContent: 'center', alignItems: 'center' },
  addBtnSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#b04723', justifyContent: 'center', alignItems: 'center', marginRight: 12 },

  row: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 16, marginVertical: 5, backgroundColor: '#332b22', borderRadius: 14, borderWidth: 1, borderColor: '#4a4033' },
  rowTitle: { color: '#e7e0d4', fontSize: 14, fontWeight: '600' },
  rowSub: { color: '#635646', fontSize: 12, marginTop: 2 },
  rowDate: { color: '#83745e', fontSize: 11 },

  editorContainer: { flex: 1, backgroundColor: '#221c16', paddingTop: 60 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  saveBtn: { backgroundColor: '#b04723', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnWide: { backgroundColor: '#b04723', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editorTitle: { color: '#e7e0d4', fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 },
  editorBody: { flex: 1, color: '#e7e0d4', fontSize: 15, lineHeight: 22, paddingHorizontal: 16 },

  channelBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#332b22' },
  channelChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#332b22', borderWidth: 1, borderColor: '#4a4033' },
  channelChipActive: { backgroundColor: '#4a231c', borderColor: '#b04723' },
  channelChipText: { color: '#83745e', fontSize: 13, fontWeight: '600' },
  channelChipTextActive: { color: '#e17c4e' },

  msgAuthor: { color: '#e7e0d4', fontSize: 13, fontWeight: '700' },
  msgBody: { color: '#a99b83', fontSize: 14, marginTop: 2 },

  chatInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#332b22', gap: 8 },
  chatInput: { flex: 1, backgroundColor: '#332b22', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#e7e0d4', borderWidth: 1, borderColor: '#4a4033' },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#b04723', justifyContent: 'center', alignItems: 'center' },

  settingsLabel: { color: '#e7e0d4', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  settingsInput: { backgroundColor: '#332b22', borderRadius: 12, borderWidth: 1, borderColor: '#4a4033', color: '#e7e0d4', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  settingsHint: { color: '#635646', fontSize: 12, marginTop: 8, lineHeight: 17 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#332b22', borderRadius: 16, borderWidth: 1, borderColor: '#4a4033', padding: 20 },
  modalTitle: { color: '#e7e0d4', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  modalInput: { backgroundColor: '#221c16', borderRadius: 10, borderWidth: 1, borderColor: '#4a4033', color: '#e7e0d4', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalCancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  modalCancelText: { color: '#83745e', fontWeight: '600', fontSize: 14 },
  modalConfirmBtn: { backgroundColor: '#b04723', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
});
