// WebRTC peer connection management using Google's free STUN servers

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

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStreamCallback: ((stream: MediaStream) => void) | null = null;

export function setRemoteStreamCallback(cb: (stream: MediaStream) => void): void {
  remoteStreamCallback = cb;
}

export async function getLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Camera access requires HTTPS or localhost. If opening on mobile over IP, use HTTPS or enable the Chrome flag.');
  }
  localStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  return localStream;
}


export function stopLocalStream(): void {
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
}

export async function createPeerConnection(
  roomId: string,
  participantId: string,
  isInitiator: boolean,
): Promise<RTCPeerConnection> {
  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Add local tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection!.addTrack(track, localStream!);
    });
  }

  // Handle remote tracks
  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    if (remoteStream && remoteStreamCallback) {
      remoteStreamCallback(remoteStream);
    }
  };

  // ICE candidate relay via socket
  const socket = getSocket();
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc:signal', {
        roomId,
        fromParticipantId: participantId,
        signal: event.candidate.toJSON(),
      });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('[WebRTC] Connection state:', peerConnection?.connectionState);
  };

  if (isInitiator) {
    // Create and send offer
    const offer = await peerConnection.createOffer({ offerToReceiveVideo: true });
    await peerConnection.setLocalDescription(offer);
    socket.emit('webrtc:signal', {
      roomId,
      fromParticipantId: participantId,
      signal: offer,
    });
  }

  return peerConnection;
}

export async function handleWebRTCSignal(
  roomId: string,
  participantId: string,
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit,
): Promise<void> {
  if (!peerConnection) {
    // Late joiner: create connection without initiating
    await createPeerConnection(roomId, participantId, false);
  }

  const pc = peerConnection!;
  const socket = getSocket();

  if ('type' in signal) {
    // Session description (offer or answer)
    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc:signal', {
        roomId,
        fromParticipantId: participantId,
        signal: answer,
      });
    } else if (signal.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
    }
  } else {
    // ICE candidate
    try {
      await pc.addIceCandidate(new RTCIceCandidate(signal));
    } catch (e) {
      console.warn('[WebRTC] Failed to add ICE candidate:', e);
    }
  }
}

export function closePeerConnection(): void {
  peerConnection?.close();
  peerConnection = null;
}

export function getPeerConnection(): RTCPeerConnection | null {
  return peerConnection;
}
