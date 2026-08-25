import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  RTCPeerConnection, RTCView, mediaDevices,
  RTCIceCandidate, RTCSessionDescription, MediaStream,
} from 'react-native-webrtc';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/config';

interface RemotePeer {
  peerId: string;
  name: string;
  stream: MediaStream | null;
}

function wsUrl(path: string): string {
  return API_URL.replace(/^http/, 'ws') + path;
}

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export default function CallPanel({ channelId }: { channelId: string }) {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setPeers({});
    setInCall(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const makePeerConnection = useCallback((peerId: string, name: string, ws: WebSocket) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current[peerId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // @ts-expect-error react-native-webrtc's onicecandidate event shape
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: 'ice-candidate', target: peerId, candidate: e.candidate }));
      }
    };

    // @ts-expect-error react-native-webrtc's ontrack event shape
    pc.ontrack = (e) => {
      setPeers((prev) => ({
        ...prev,
        [peerId]: { peerId, name, stream: e.streams[0] || null },
      }));
    };

    return pc;
  }, []);

  const startCall = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Toast.show({ type: 'error', text1: 'Sign in required to start a call' });
        setConnecting(false);
        return;
      }

      const stream = (await mediaDevices.getUserMedia({ audio: true, video: true })) as unknown as MediaStream;
      localStreamRef.current = stream;
      setLocalStream(stream);

      const ws = new WebSocket(wsUrl(`/api/ws/calls/${channelId}?token=${encodeURIComponent(session.access_token)}`));
      wsRef.current = ws;

      ws.onopen = () => {
        setInCall(true);
        setConnecting(false);
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'room-joined') {
          for (const p of msg.peers || []) {
            const pc = makePeerConnection(p.peer_id, p.name, ws);
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', target: p.peer_id, sdp: offer }));
          }
        } else if (msg.type === 'peer-joined') {
          setPeers((prev) => ({ ...prev, [msg.peer_id]: { peerId: msg.peer_id, name: msg.name, stream: null } }));
        } else if (msg.type === 'offer') {
          const pc = makePeerConnection(msg.from, msg.name, ws);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', target: msg.from, sdp: answer }));
        } else if (msg.type === 'answer') {
          const pc = pcsRef.current[msg.from];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        } else if (msg.type === 'ice-candidate') {
          const pc = pcsRef.current[msg.from];
          if (pc && msg.candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch { /* ignore */ }
          }
        } else if (msg.type === 'peer-left') {
          pcsRef.current[msg.peer_id]?.close();
          delete pcsRef.current[msg.peer_id];
          setPeers((prev) => {
            const next = { ...prev };
            delete next[msg.peer_id];
            return next;
          });
        }
      };

      ws.onclose = () => cleanup();
      ws.onerror = () => {
        Toast.show({ type: 'error', text1: 'Call connection failed' });
        cleanup();
      };
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not access camera/microphone' });
      setConnecting(false);
      cleanup();
    }
  };

  const leaveCall = () => cleanup();

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCameraOff(!track.enabled); }
  };

  const peerList = Object.values(peers);

  if (!inCall) {
    return (
      <TouchableOpacity style={styles.startBtn} onPress={startCall} disabled={connecting}>
        {connecting ? <ActivityIndicator size="small" color="#e17c4e" /> : <Ionicons name="call-outline" size={16} color="#e17c4e" />}
        <Text style={styles.startBtnText}>{connecting ? 'Connecting...' : 'Start call'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.callCard}>
      <View style={styles.callHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="people-outline" size={14} color="#83745e" />
          <Text style={styles.callCount}>{peerList.length + 1} in call</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.ctrlBtn, muted && styles.ctrlBtnActive]} onPress={toggleMute}>
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={16} color={muted ? '#e0a89a' : '#a99b83'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ctrlBtn, cameraOff && styles.ctrlBtnActive]} onPress={toggleCamera}>
            <Ionicons name={cameraOff ? 'videocam-off' : 'videocam'} size={16} color={cameraOff ? '#e0a89a' : '#a99b83'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveBtn} onPress={leaveCall}>
            <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.grid}>
        <View style={styles.tile}>
          {localStream && <RTCView streamURL={localStream.toURL()} style={styles.video} objectFit="cover" mirror />}
          <Text style={styles.tileLabel}>You</Text>
        </View>
        {peerList.map((p) => (
          <View key={p.peerId} style={styles.tile}>
            {p.stream ? (
              <RTCView streamURL={p.stream.toURL()} style={styles.video} objectFit="cover" />
            ) : (
              <ActivityIndicator size="small" color="#635646" />
            )}
            <Text style={styles.tileLabel}>{p.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8 },
  startBtnText: { color: '#e17c4e', fontWeight: '600', fontSize: 13 },
  callCard: { borderWidth: 1, borderColor: '#4a4033', borderRadius: 14, padding: 10, marginHorizontal: 16, marginTop: 10, backgroundColor: '#332b22' },
  callHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  callCount: { color: '#83745e', fontSize: 11, fontWeight: '600' },
  ctrlBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#4a4033', justifyContent: 'center', alignItems: 'center' },
  ctrlBtnActive: { backgroundColor: '#4a231c' },
  leaveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#b5432f', justifyContent: 'center', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { width: '48%', aspectRatio: 16 / 10, backgroundColor: '#14100c', borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  tileLabel: { position: 'absolute', bottom: 4, left: 6, color: 'rgba(255,255,255,0.8)', fontSize: 10, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
});
