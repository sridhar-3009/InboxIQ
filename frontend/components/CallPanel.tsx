import { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface CallPanelProps {
  channelId: string;
}

interface RemotePeer {
  peerId: string;
  name: string;
  stream: MediaStream | null;
}

function wsUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return base.replace(/^http/, 'ws') + path;
}

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export default function CallPanel({ channelId }: CallPanelProps) {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
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

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: 'ice-candidate', target: peerId, candidate: e.candidate }));
      }
    };

    pc.ontrack = (e) => {
      setPeers((prev) => ({
        ...prev,
        [peerId]: { peerId, name, stream: e.streams[0] || null },
      }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setPeers((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    };

    return pc;
  }, []);

  const startCall = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('You need to be signed in to start a call.');
        setConnecting(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

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
            const offer = await pc.createOffer();
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
        toast.error('Call connection failed.');
        cleanup();
      };
    } catch (err) {
      toast.error('Could not access camera/microphone.');
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
      <button
        onClick={startCall}
        disabled={connecting}
        className="flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300 hover:text-primary-800 disabled:opacity-50"
      >
        <Phone className="h-4 w-4" />
        {connecting ? 'Connecting...' : 'Start call'}
      </button>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-3 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Users className="h-3.5 w-3.5" />
          {peerList.length + 1} in call
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleMute} className={`p-1.5 rounded-lg ${muted ? 'bg-urgent/10 text-urgent' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button onClick={toggleCamera} className={`p-1.5 rounded-lg ${cameraOff ? 'bg-urgent/10 text-urgent' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
            {cameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </button>
          <button onClick={leaveCall} className="p-1.5 rounded-lg bg-urgent text-white hover:bg-urgent/90">
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <span className="absolute bottom-1 left-1.5 text-[10px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded">You</span>
        </div>
        {peerList.map((p) => (
          <RemoteTile key={p.peerId} peer={p} />
        ))}
      </div>
    </div>
  );
}

function RemoteTile({ peer }: { peer: RemotePeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && peer.stream) videoRef.current.srcObject = peer.stream;
  }, [peer.stream]);

  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
      {peer.stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">Connecting...</div>
      )}
      <span className="absolute bottom-1 left-1.5 text-[10px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded">{peer.name}</span>
    </div>
  );
}
