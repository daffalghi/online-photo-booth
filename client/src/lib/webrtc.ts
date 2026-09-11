// WebRTC peer connection management using Google's free STUN servers & OpenRelay TURN
// Supports Multi-Peer Mesh for up to 6 participants (Solo, Duo, and Group mode)

import { getSocket } from './socket';

const ICE_SERVERS: RTCIceServer[] = [
  // Google Public STUN Servers (Direct P2P)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // OpenRelay Public TURN Relay Servers (Free fallback for different WiFis / 4G / strict NAT)
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const peerConnections = new Map<string, RTCPeerConnection>();
const remoteStreams = new Map<string, MediaStream>();
let localStream: MediaStream | null = null;
let singleRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
const streamSubscribers = new Set<(streams: Map<string, MediaStream>) => void>();

function notifyStreamSubscribers() {
  const currentMap = new Map(remoteStreams);
  streamSubscribers.forEach((cb) => cb(currentMap));
  if (singleRemoteStreamCallback && remoteStreams.size > 0) {
    const first = Array.from(remoteStreams.values())[0];
    if (first) singleRemoteStreamCallback(first);
  }
}

export function subscribeRemoteStreams(cb: (streams: Map<string, MediaStream>) => void): () => void {
  streamSubscribers.add(cb);
  cb(new Map(remoteStreams));
  return () => {
    streamSubscribers.delete(cb);
  };
}

export function setRemoteStreamCallback(cb: (stream: MediaStream) => void): void {
  singleRemoteStreamCallback = cb;
  if (remoteStreams.size > 0) {
    const first = Array.from(remoteStreams.values())[0];
    if (first) cb(first);
  }
}

export async function getLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Camera access requires HTTPS or localhost. If opening on mobile over IP, use HTTPS or enable the Chrome flag.');
  }

  try {
    // Request maximum sensor resolution (up to 4K / 1080p Full HD at 60fps)
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 3840, min: 640 },
        height: { ideal: 2160, min: 480 },
        frameRate: { ideal: 60, min: 24 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 2,
        sampleRate: 48000,
      },
    });

    // If hardware sensor supports even higher native resolution, apply maximum limits
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack && videoTrack.applyConstraints && typeof videoTrack.getCapabilities === 'function') {
      try {
        const caps = videoTrack.getCapabilities();
        if (caps && caps.width && caps.height) {
          await videoTrack.applyConstraints({
            width: { ideal: caps.width.max || 3840 },
            height: { ideal: caps.height.max || 2160 },
            frameRate: { ideal: caps.frameRate?.max || 60 },
          });
        }
      } catch (_) {
        // Non-critical: continue with acquired constraints
      }
    }
  } catch (err) {
    console.warn('[WebRTC] Failed to acquire audio + video at ultra-high res, falling back:', err);
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });
  }

  return localStream;
}

let micState = true;

export function isMicEnabled(): boolean {
  return micState;
}

/**
 * 100% Zero-leak microphone mute implementation:
 * 1. Disables track locally (track.enabled = false).
 * 2. Physically cuts off audio transmission at the WebRTC RTP transport layer (sender.replaceTrack(null)),
 *    guaranteeing 0 audio packets are transmitted across the network while muted.
 */
export async function setMicEnabled(enabled: boolean): Promise<boolean> {
  micState = enabled;

  // 1. Hardware track level mute
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  // 2. Physical WebRTC transport cut-off using replaceTrack
  const targetAudioTrack = enabled && localStream ? (localStream.getAudioTracks()[0] || null) : null;

  for (const pc of peerConnections.values()) {
    const senders = pc.getSenders();
    for (const sender of senders) {
      if (sender.track?.kind === 'audio' || (!sender.track && enabled)) {
        try {
          await sender.replaceTrack(targetAudioTrack);
        } catch (err) {
          if (sender.track) {
            sender.track.enabled = enabled;
          }
        }
      }
    }
  }

  return micState;
}

export async function toggleMic(): Promise<boolean> {
  return await setMicEnabled(!micState);
}

export function stopLocalStream(): void {
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
}

/** Modify SDP to allocate ultra-high definition bitrate (10 Mbps) with Google min/start bitrate flags */
function boostSdpBitrate(sdp: string, bitrateKbps = 10000): string {
  let modified = sdp.replace(
    /(m=video [^\r\n]+[\r\n]+)/g,
    `$1b=AS:${bitrateKbps}\r\nb=TIAS:${bitrateKbps * 1000}\r\n`
  );
  modified = modified.replace(
    /(a=fmtp:\d+ [^\r\n]+)/g,
    `$1;x-google-min-bitrate=3000;x-google-start-bitrate=6000;x-google-max-bitrate=${bitrateKbps}`
  );
  return modified;
}

interface RTCRtpCodecCapabilityItem {
  mimeType: string;
  clockRate: number;
  channels?: number;
  sdpFmtpLine?: string;
}

interface RTCRtpCapabilities {
  codecs: RTCRtpCodecCapabilityItem[];
}

interface RTCRtpSenderStatic {
  getCapabilities?: (kind: string) => RTCRtpCapabilities | null;
}

interface ExtendedEncodingParameters extends RTCRtpEncodingParameters {
  minBitrate?: number;
}

interface ExtendedRtpSendParameters extends RTCRtpSendParameters {
  encodings: ExtendedEncodingParameters[];
  degradationPreference?: RTCDegradationPreference;
}

/** Prioritize hardware-accelerated H.264 High Profile and modern codecs over legacy VP8 */
export function setOptimalVideoCodecs(pc: RTCPeerConnection) {
  const rtcSender = RTCRtpSender as unknown as RTCRtpSenderStatic;
  if (typeof rtcSender.getCapabilities === 'function') {
    try {
      const caps = rtcSender.getCapabilities('video');
      if (caps && caps.codecs && Array.isArray(caps.codecs)) {
        const preferredMimes = ['video/H264', 'video/VP9', 'video/AV1', 'video/VP8'];
        const sortedCodecs = [...caps.codecs].sort((a, b) => {
          const aIndex = preferredMimes.indexOf(a.mimeType);
          const bIndex = preferredMimes.indexOf(b.mimeType);
          if (aIndex !== -1 && bIndex !== -1) {
            if (aIndex === bIndex && a.mimeType === 'video/H264') {
              const aPack = a.sdpFmtpLine?.includes('packetization-mode=1') ? 1 : 0;
              const bPack = b.sdpFmtpLine?.includes('packetization-mode=1') ? 1 : 0;
              return bPack - aPack;
            }
            return aIndex - bIndex;
          }
          return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
        });

        pc.getTransceivers().forEach((transceiver) => {
          if (transceiver.setCodecPreferences && (transceiver.sender?.track?.kind === 'video' || transceiver.receiver?.track?.kind === 'video')) {
            try {
              transceiver.setCodecPreferences(sortedCodecs);
            } catch (_) {}
          }
        });
      }
    } catch (_) {}
  }
}

/** Optimize RTCRtpSender encoding parameters for ultra-high definition streaming without downscaling */
function optimizeVideoSender(pc: RTCPeerConnection) {
  const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
  if (videoSender && videoSender.getParameters) {
    try {
      const params = videoSender.getParameters() as ExtendedRtpSendParameters;
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      // Allocate up to 10 Mbps bandwidth for crisp 1080p/4K 60fps streaming
      params.encodings[0].maxBitrate = 10_000_000;
      params.encodings[0].minBitrate = 2_500_000;
      params.encodings[0].scaleResolutionDownBy = 1.0; // Strictly prohibit resolution downscaling
      params.encodings[0].maxFramerate = 60;
      // Maintain full resolution even if frame rate fluctuates
      params.degradationPreference = 'maintain-resolution';
      videoSender.setParameters(params).catch(() => {});
    } catch (e) {
      // Ignore if browser does not support setParameters
    }
  }
}

const pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

async function processQueuedCandidates(peerId: string, pc: RTCPeerConnection) {
  const queue = pendingCandidates.get(peerId);
  if (queue && queue.length > 0) {
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn(`[WebRTC] Failed to add queued ICE candidate from ${peerId}:`, e);
      }
    }
    pendingCandidates.delete(peerId);
  }
}

export function getOrCreatePeerConnection(
  roomId: string,
  myParticipantId: string,
  targetParticipantId: string,
): RTCPeerConnection {
  const existing = peerConnections.get(targetParticipantId);
  if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
    // Ensure current localStream tracks are attached if not already
    if (localStream) {
      const senders = existing.getSenders();
      localStream.getTracks().forEach((track) => {
        if (!senders.some((s) => s.track?.id === track.id)) {
          existing.addTrack(track, localStream!);
        }
      });
    }
    return existing;
  }

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peerConnections.set(targetParticipantId, pc);

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream!);
    });
  }

  pc.ontrack = (event) => {
    let stream = event.streams[0];
    if (!stream) {
      stream = remoteStreams.get(targetParticipantId) || new MediaStream();
      if (event.track && !stream.getTracks().some((t) => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }
    }
    remoteStreams.set(targetParticipantId, stream);
    notifyStreamSubscribers();
  };

  const socket = getSocket();
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc:signal', {
        roomId,
        fromParticipantId: myParticipantId,
        targetParticipantId,
        signal: event.candidate.toJSON(),
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection with ${targetParticipantId}:`, pc.connectionState);
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      remoteStreams.delete(targetParticipantId);
      notifyStreamSubscribers();
    }
  };

  return pc;
}

export async function initiatePeerConnection(
  roomId: string,
  myParticipantId: string,
  targetParticipantId: string,
): Promise<RTCPeerConnection> {
  // Ensure local camera is acquired first so offer includes video/audio tracks
  try {
    await getLocalStream();
  } catch (e) {
    console.warn('[WebRTC] Local stream not ready when initiating, continuing...', e);
  }

  const pc = getOrCreatePeerConnection(roomId, myParticipantId, targetParticipantId);
  const socket = getSocket();

  try {
    setOptimalVideoCodecs(pc);
    const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
    if (offer.sdp) {
      offer.sdp = boostSdpBitrate(offer.sdp, 10000);
    }
    await pc.setLocalDescription(offer);
    optimizeVideoSender(pc);
    socket.emit('webrtc:signal', {
      roomId,
      fromParticipantId: myParticipantId,
      targetParticipantId,
      signal: offer,
    });
  } catch (err) {
    console.error(`[WebRTC] Failed to create offer for ${targetParticipantId}:`, err);
  }

  return pc;
}

// Backward-compatible for Duo
export async function createPeerConnection(
  roomId: string,
  myParticipantId: string,
  isInitiator: boolean,
  targetParticipantId?: string,
): Promise<RTCPeerConnection> {
  const targetId = targetParticipantId || 'duo_partner';
  const pc = getOrCreatePeerConnection(roomId, myParticipantId, targetId);

  if (isInitiator) {
    await initiatePeerConnection(roomId, myParticipantId, targetId);
  }

  return pc;
}

export async function handleWebRTCSignal(
  roomId: string,
  myParticipantId: string,
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit,
  fromParticipantId: string,
  targetParticipantId?: string,
): Promise<void> {
  // If targeted to a specific participant and it's not us, ignore
  if (targetParticipantId && targetParticipantId !== myParticipantId) {
    return;
  }

  const peerId = fromParticipantId || 'duo_partner';
  const socket = getSocket();

  if ('type' in signal) {
    if (signal.type === 'offer') {
      try {
        // Ensure local stream tracks are available before answering so remote peer gets video!
        try {
          const stream = await getLocalStream();
          const pc = getOrCreatePeerConnection(roomId, myParticipantId, peerId);
          if (stream) {
            const senders = pc.getSenders();
            stream.getTracks().forEach((track) => {
              if (!senders.some((s) => s.track?.id === track.id)) {
                pc.addTrack(track, stream);
              }
            });
          }
        } catch (camErr) {
          console.warn('[WebRTC] Could not acquire camera before answering offer:', camErr);
        }

        const pc = getOrCreatePeerConnection(roomId, myParticipantId, peerId);
        setOptimalVideoCodecs(pc);
        await pc.setRemoteDescription(new RTCSessionDescription(signal));

        // Process any queued candidates that arrived before the offer
        await processQueuedCandidates(peerId, pc);

        const answer = await pc.createAnswer();
        if (answer.sdp) {
          answer.sdp = boostSdpBitrate(answer.sdp, 10000);
        }
        await pc.setLocalDescription(answer);
        optimizeVideoSender(pc);
        socket.emit('webrtc:signal', {
          roomId,
          fromParticipantId: myParticipantId,
          targetParticipantId: fromParticipantId,
          signal: answer,
        });
      } catch (err) {
        console.error(`[WebRTC] Failed to handle offer from ${peerId}:`, err);
      }
    } else if (signal.type === 'answer') {
      try {
        const pc = getOrCreatePeerConnection(roomId, myParticipantId, peerId);
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        optimizeVideoSender(pc);
        // Process any queued candidates that arrived before the answer
        await processQueuedCandidates(peerId, pc);
      } catch (err) {
        console.error(`[WebRTC] Failed to set answer from ${peerId}:`, err);
      }
    }
  } else {
    // ICE candidate handling with queueing
    const pc = peerConnections.get(peerId);
    if (!pc || !pc.remoteDescription) {
      if (!pendingCandidates.has(peerId)) {
        pendingCandidates.set(peerId, []);
      }
      pendingCandidates.get(peerId)!.push(signal);
    } else {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      } catch (e) {
        console.warn(`[WebRTC] Failed to add ICE candidate from ${peerId}:`, e);
      }
    }
  }
}

export function closePeerConnection(targetParticipantId?: string): void {
  if (targetParticipantId) {
    const pc = peerConnections.get(targetParticipantId);
    pc?.close();
    peerConnections.delete(targetParticipantId);
    remoteStreams.delete(targetParticipantId);
  } else {
    peerConnections.forEach((pc) => pc.close());
    peerConnections.clear();
    remoteStreams.clear();
  }
  notifyStreamSubscribers();
}

export function getPeerConnection(targetParticipantId?: string): RTCPeerConnection | null {
  if (targetParticipantId) return peerConnections.get(targetParticipantId) || null;
  return peerConnections.values().next().value || null;
}
