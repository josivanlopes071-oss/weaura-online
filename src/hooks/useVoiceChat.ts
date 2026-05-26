import { useEffect, useRef, useState } from 'react';
import { Peer, MediaConnection } from 'peerjs';

export function useVoiceChat(
  roomId: string,
  userId: string,
  isMicOn: boolean,
  participants: string[],
  voicePeerIds?: { [userId: string]: string },
  onPeerIdReady?: (peerId: string) => void
) {
  const [remoteStreams, setRemoteStreams] = useState<{ [uid: string]: MediaStream }>({});
  const [volumes, setVolumes] = useState<{ [uid: string]: number }>({});
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [hasAnotherTabOpen, setHasAnotherTabOpen] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<{ [uid: string]: MediaConnection }>({});
  const callStreamsRef = useRef<{ [uid: string]: MediaStream | null }>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<{ [uid: string]: AnalyserNode }>({});

  const participantKeys = JSON.stringify(participants);
  const voicePeerIdKeys = JSON.stringify(voicePeerIds || {});

  const onPeerIdReadyRef = useRef(onPeerIdReady);
  useEffect(() => {
    onPeerIdReadyRef.current = onPeerIdReady;
  }, [onPeerIdReady]);

  // 1. Reset metrics and triggers on Room context swap
  useEffect(() => {
    setRetryTrigger(0);
    setHasAnotherTabOpen(false);
  }, [roomId, userId]);

  // 2. Global voice session lifecycle & media release
  useEffect(() => {
    return () => {
      console.log("[Voice] Disposing voice chat session resources...");
      
      // Stop media tracks
      localStreamRef.current?.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      localStreamRef.current = null;
      setLocalStream(null);

      // Close Peer Connections
      Object.values(callsRef.current).forEach((call: any) => {
        try { call.close(); } catch (e) {}
      });
      callsRef.current = {};
      callStreamsRef.current = {};

      // Close Audio Context
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analysersRef.current = {};
    };
  }, [roomId, userId]);

  // 3. Initialize PeerJS client with resilient auto-reconnect events
  useEffect(() => {
    if (!roomId || !userId) return;

    let active = true;
    const maxRetries = 3;
    const isMaxRetriesReached = retryTrigger >= maxRetries;
    // Add a small random string to avoid ID is taken errors when quick-switching or tab duplicating
    const currentPeerId = `${roomId}-${userId}-${Math.random().toString(36).substring(2, 6)}`;

    console.log(`[Voice] Starting resilient PeerJS connection, ID: ${currentPeerId}`);
    const peer = new Peer(currentPeerId, {
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });
    peerRef.current = peer;

    peer.on('open', () => {
      if (!active) return;
      setIsPeerReady(true);
      if (!isMaxRetriesReached) {
        setHasAnotherTabOpen(false);
      }
      console.log("[Voice] Peer server connection established successfully, ID:", currentPeerId);
      onPeerIdReadyRef.current?.(currentPeerId);
    });

    peer.on('disconnected', () => {
      console.warn("[Voice] PeerJS disconnected from server. Attempting automatic reconnection...");
      if (!peer.destroyed && active) {
        peer.reconnect();
      }
    });

    peer.on('close', () => {
      console.warn("[Voice] PeerJS connection closed.");
      if (active) {
        setIsPeerReady(false);
        // Backoff and recreate PeerJS container
        setTimeout(() => {
          if (active) {
            setRetryTrigger(prev => prev + 1);
          }
        }, 3000);
      }
    });

    peer.on('error', (err: any) => {
      if (!active) return;

      // Handle common transient cases
      if (err.type === 'peer-unavailable') {
        return;
      }

      const isIdTaken = err.type === 'unavailable-id' || 
                        (err.message && err.message.toLowerCase().includes('is taken')) || 
                        (err.toString && err.toString().toLowerCase().includes('is taken'));

      if (isIdTaken) {
        if (retryTrigger < maxRetries) {
          console.warn(`[Voice] ID is taken. Retrying with a cool-down in 2s (Attempt ${retryTrigger + 1}/${maxRetries})...`);
          setTimeout(() => {
            if (active) {
              setRetryTrigger(prev => prev + 1);
            }
          }, 2000);
        } else {
          console.error("[Voice] Max PeerJS ID retries reached. Opening fallback channel.");
          setHasAnotherTabOpen(true);
        }
        return;
      }

      console.warn('[Voice] General PeerJS client error:', err);
    });

    // Handle incoming calls resiliently (minimizing duplicates and overlap)
    peer.on('call', (call) => {
      if (!active) {
        call.close();
        return;
      }
      
      let senderUid = call.peer.replace(`${roomId}-`, '');
      if (voicePeerIds) {
        const foundUid = Object.entries(voicePeerIds).find(([_, pId]) => pId === call.peer)?.[0];
        if (foundUid) {
          senderUid = foundUid;
        }
      }
      if (senderUid.includes('-')) {
        const parts = senderUid.split('-');
        if (parts.length > 0) {
          senderUid = parts[0];
        }
      }

      console.log(`[Voice] Incoming call received from: ${senderUid} (Peer ID: ${call.peer})`);

      // If we already have a recorded call stream with this user, close old instance to prevent feedback/echo
      if (callsRef.current[senderUid]) {
        console.warn(`[Voice] Duplicate connection detected for ${senderUid}. Pruning old stream...`);
        try { callsRef.current[senderUid].close(); } catch (e) {}
      }

      // Answer incorporating current local microfone stream state
      const currentLocalStream = localStreamRef.current || undefined;
      call.answer(currentLocalStream);
      
      callsRef.current[senderUid] = call;
      callStreamsRef.current[senderUid] = localStreamRef.current;

      call.on('stream', (remoteStream) => {
        console.log(`[Voice] Dynamic audio channel open for ${senderUid}`);
        setRemoteStreams(prev => ({ ...prev, [senderUid]: remoteStream }));
        setupAudioAnalysis(senderUid, remoteStream);
      });

      call.on('close', () => {
        if (callsRef.current[senderUid] === call) {
          console.log(`[Voice] Call closed by remote peer ${senderUid}`);
          delete callsRef.current[senderUid];
          delete callStreamsRef.current[senderUid];
          setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[senderUid];
            return next;
          });
          delete analysersRef.current[senderUid];
        }
      });

      call.on('error', (err: any) => {
        if (err.type !== 'peer-unavailable') {
          console.warn(`[Voice] Incoming call error with ${senderUid}:`, err);
        }
        call.close();
      });
    });

    return () => {
      active = false;
      peer.destroy();
    };
  }, [roomId, userId, retryTrigger]);

  // Helper: setup precise real-time FFT analyzer for volume indications
  const setupAudioAnalysis = (uid: string, stream: MediaStream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analysersRef.current[uid] = analyser;
    } catch (e) {
      console.warn(`[Voice] Audio analysis binding failed for ${uid}:`, e);
    }
  };

  // 4. Local microphone acquisition and toggle state tracking
  useEffect(() => {
    let active = true;
    const isSpeaker = participants.includes(userId);

    const checkAndAcquireMic = async () => {
      if (isMicOn) {
        if (!localStreamRef.current) {
          try {
            console.log("[Voice] Capturing optimized audio track on client...");
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            });

            if (!active) {
              stream.getTracks().forEach(t => t.stop());
              return;
            }

            localStreamRef.current = stream;
            setLocalStream(stream);
            setMicError(null);
            
            if (userId) {
              setupAudioAnalysis(userId, stream);
            }
          } catch (err: any) {
            console.error("[Voice] Audio grab error:", err);
            if (active) {
              setMicError(err?.message || "Erro de permissão no microfone.");
            }
          }
        } else {
          // Enable hardware components
          localStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
          setLocalStream(localStreamRef.current);
        }
      } else {
        setMicError(null);
        // If we are on stage (speaker), keep stream open but send visual silence to avoid WebRTC renegotiations
        // If we are a standard listener, shut tracks off completely to turn off browser's mic layout icons
        if (localStreamRef.current) {
          if (isSpeaker) {
            console.log("[Voice] Muting audio tracks (keeping handle active)...");
            localStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
          } else {
            console.log("[Voice] Releasing hardware tracks (descended to listener)...");
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
            setLocalStream(null);
            if (userId && analysersRef.current[userId]) {
              delete analysersRef.current[userId];
            }
          }
        }
      }
    };

    checkAndAcquireMic();

    return () => {
      active = false;
    };
  }, [isMicOn, participantKeys, userId]);

  // 5. Dynamic mesh communication manager
  useEffect(() => {
    if (!peerRef.current || !isPeerReady || peerRef.current.destroyed) return;

    const isSpeaker = participants.includes(userId);

    // Step A: Prune outdated connections and identify stream changes
    Object.entries(callsRef.current).forEach(([pUid, call]) => {
      const activeCall = call as any;
      const isTargetSpeaker = participants.includes(pUid);
      
      // If target left the slots, sever the WebRTC connection cleanly
      if (!isTargetSpeaker || pUid === userId) {
        console.log(`[Voice] Closing link to retired speaker ${pUid}`);
        try { activeCall.close(); } catch (e) {}
        delete callsRef.current[pUid];
        delete callStreamsRef.current[pUid];
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[pUid];
          return next;
        });
        delete analysersRef.current[pUid];
        return;
      }

      // If our local stream sent to pUid doesn't match current localStream (due to toggle / hardware acquisition),
      // we need to cycle the connection to inject/delete the audio track
      const currentlySent = callStreamsRef.current[pUid];
      if (currentlySent !== localStream) {
        console.log(`[Voice] Upgrading socket media channel for speaker ${pUid}`);
        try { activeCall.close(); } catch (e) {}
        delete callsRef.current[pUid];
        delete callStreamsRef.current[pUid];
      }
    });

    // Step B: Dispatch logical call requests
    participants.forEach(pUid => {
      if (pUid === userId) return;

      // Deterministic single connection assignment:
      // 1. Two active speakers: Only the lexicographically smaller ID initiates
      // 2. Listener to Speaker: The listener always initiates because the speaker is unaware of listeners
      let shouldCall = false;
      if (isSpeaker) {
        shouldCall = userId < pUid;
      } else {
        shouldCall = true;
      }

      if (shouldCall && !callsRef.current[pUid]) {
        try {
          const targetPeerId = (voicePeerIds && voicePeerIds[pUid]) || `${roomId}-${pUid}`;
          console.log(`[Voice] Starting outgoing connection to ${pUid} using Peer ID: ${targetPeerId}`);
          
          let mediaStreamToUse: MediaStream | undefined = localStream || undefined;
          if (!mediaStreamToUse) {
            try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContextClass) {
                const ctx = new AudioContextClass();
                const dst = ctx.createMediaStreamDestination();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                gain.gain.value = 0;
                osc.connect(gain);
                gain.connect(dst);
                osc.start();
                mediaStreamToUse = dst.stream;
              }
            } catch (err) {
              console.warn("[Voice] Failed to create silent fallback audio stream for peer call:", err);
            }
          }

          if (!mediaStreamToUse) {
            console.warn("[Voice] Cannot initiate call without a valid stream.");
            return;
          }

          const call = peerRef.current!.call(targetPeerId, mediaStreamToUse);
          
          if (call) {
            callsRef.current[pUid] = call;
            callStreamsRef.current[pUid] = localStream;

            call.on('stream', (remoteStream) => {
              console.log(`[Voice] Remote audio streaming active from outgoing call to ${pUid}`);
              setRemoteStreams(prev => ({ ...prev, [pUid]: remoteStream }));
              setupAudioAnalysis(pUid, remoteStream);
            });

            call.on('close', () => {
              if (callsRef.current[pUid] === call) {
                console.log(`[Voice] Outgoing call closed by ${pUid}`);
                delete callsRef.current[pUid];
                delete callStreamsRef.current[pUid];
                setRemoteStreams(prev => {
                  const next = { ...prev };
                  delete next[pUid];
                  return next;
                });
                delete analysersRef.current[pUid];
              }
            });

            call.on('error', (err: any) => {
              if (err.type !== 'peer-unavailable') {
                console.warn(`[Voice] Call link error with ${pUid}:`, err);
              }
              call.close();
            });
          }
        } catch (e) {
          console.warn(`[Voice] Outgoing call sequence crashed for target ${pUid}:`, e);
        }
      }
    });

  }, [isPeerReady, participantKeys, voicePeerIdKeys, localStream, roomId, userId]);

  // 6. Throttled CPU/Memory friendly Volume detection
  useEffect(() => {
    let intervalId: any;
    
    const updateVolumes = () => {
      const hasAnalysers = Object.keys(analysersRef.current).length > 0;
      const hasLocalMic = isMicOn && localStreamRef.current;
      
      if (hasAnalysers || hasLocalMic) {
        const newVolumes: { [uid: string]: number } = {};
        
        Object.entries(analysersRef.current).forEach(([uid, analyser]) => {
          if (!analyser) return;
          const node = analyser as any;
          const dataArray = new Uint8Array(node.frequencyBinCount);
          node.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a: number, b: number) => a + b, 0) / dataArray.length;
          
          // Noise-gate threshold filter (filters out room hushes below 6) and bucket values in steps of 4
          const bucketed = average < 6 ? 0 : Math.round(average / 4) * 4;
          newVolumes[uid] = bucketed;
        });

        setVolumes(prev => {
          const keys1 = Object.keys(newVolumes);
          const keys2 = Object.keys(prev);
          if (keys1.length !== keys2.length) return newVolumes;
          
          // Skip updating state if the amplitude shift is irrelevant (< 4 threshold delta)
          // to dramatically lower React VDOM paint cost on low-powered processors
          const hasSignificantChange = keys1.some(uid => Math.abs(newVolumes[uid] - (prev[uid] || 0)) >= 4);
          return hasSignificantChange ? newVolumes : prev;
        });
      } else {
        setVolumes(prev => Object.keys(prev).length > 0 ? {} : prev);
      }
    };

    // 125ms intervals keeps speaking graphics completely responsive while dropping browser loop CPU loads by 80%
    intervalId = setInterval(updateVolumes, 125);
    return () => clearInterval(intervalId);
  }, [isMicOn]);

  return { remoteStreams, volumes, micError, setMicError, hasAnotherTabOpen };
}
