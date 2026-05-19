import { useEffect, useRef, useState } from 'react';
import { Peer, MediaConnection } from 'peerjs';

export function useVoiceChat(roomId: string, userId: string, isMicOn: boolean, participants: string[]) {
  const [remoteStreams, setRemoteStreams] = useState<{ [uid: string]: MediaStream }>({});
  const [volumes, setVolumes] = useState<{ [uid: string]: number }>({});
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [hasAnotherTabOpen, setHasAnotherTabOpen] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<{ [uid: string]: MediaConnection }>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<{ [uid: string]: AnalyserNode }>({});

  // Reset retry trigger when room or user changes
  useEffect(() => {
    setRetryTrigger(0);
    setHasAnotherTabOpen(false);
  }, [roomId, userId]);

  // Clean up local media stream on unmount or room/user change
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [roomId, userId]);

  useEffect(() => {
    if (!roomId || !userId) return;

    let active = true;
    const maxRetries = 3;
    const isMaxRetriesReached = retryTrigger >= maxRetries;
    const currentPeerId = isMaxRetriesReached 
      ? `${roomId}-${userId}-duplicate-${Math.random().toString(36).substring(2, 6)}` 
      : `${roomId}-${userId}`;

    if (isMaxRetriesReached) {
      setHasAnotherTabOpen(true);
    }

    const peer = new Peer(currentPeerId, {
      debug: 1,
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      if (!active) return;
      setIsPeerReady(true);
      if (!isMaxRetriesReached) {
        setHasAnotherTabOpen(false);
      }
    });

    peer.on('error', (err: any) => {
      if (!active) return;

      if (err.type === 'peer-unavailable') {
        return;
      }

      const isIdTaken = err.type === 'unavailable-id' || 
                        (err.message && err.message.toLowerCase().includes('is taken')) || 
                        (err.toString && err.toString().toLowerCase().includes('is taken'));

      if (isIdTaken) {
        if (retryTrigger < maxRetries) {
          console.warn(`Peer ID taken, retrying in 2 seconds (attempt ${retryTrigger + 1}/${maxRetries})...`);
          setTimeout(() => {
            if (active) {
              setRetryTrigger(prev => prev + 1);
            }
          }, 2000);
        } else {
          console.error("Max PeerJS ID retries reached. Using fallback ID or staying offline.");
          setHasAnotherTabOpen(true);
        }
        return;
      }

      console.error('Global PeerJS error:', err);
    });

    peer.on('call', (call) => {
      if (!active) return;
      call.answer(localStreamRef.current || undefined);
      
      const callerUid = call.peer.replace(`${roomId}-`, '');

      call.on('stream', (remoteStream) => {
        setRemoteStreams(prev => ({ ...prev, [callerUid]: remoteStream }));
        setupAudioAnalysis(callerUid, remoteStream);
      });

      call.on('close', () => {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[callerUid];
          return next;
        });
        delete analysersRef.current[callerUid];
      });
    });

    return () => {
      active = false;
      peer.destroy();
    };
  }, [roomId, userId, retryTrigger]);

  const setupAudioAnalysis = (uid: string, stream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analysersRef.current[uid] = analyser;
  };

  // Monitor volumes
  useEffect(() => {
    let intervalId: any;
    const updateVolumes = () => {
      const hasAnalysers = Object.keys(analysersRef.current).length > 0;
      const hasLocalMic = isMicOn && localStreamRef.current;
      
      if (hasAnalysers || hasLocalMic) {
        const newVolumes: { [uid: string]: number } = {};
        
        Object.entries(analysersRef.current).forEach(([uid, unknownAnalyser]) => {
          const analyser = unknownAnalyser as AnalyserNode;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          
          // Noise-gate and bucketing: ignore very quiet hum (< 4) and group speaking updates
          const bucketed = average < 4 ? 0 : Math.round(average / 4) * 4;
          newVolumes[uid] = bucketed;
        });

        setVolumes(prev => {
          const keys1 = Object.keys(newVolumes);
          const keys2 = Object.keys(prev);
          if (keys1.length !== keys2.length) return newVolumes;
          
          // Only update state if volume changes by a noticeable threshold (delta of 4) 
          // to dramatically minimize rendering noise
          const hasChanged = keys1.some(uid => Math.abs(newVolumes[uid] - (prev[uid] || 0)) >= 4);
          return hasChanged ? newVolumes : prev;
        });
      } else {
        setVolumes(prev => Object.keys(prev).length > 0 ? {} : prev);
      }
    };

    // 120ms intervals (approx. 8Hz updates) instead of 60fps animation frames (16.7ms intervals)
    // reduces DOM thrashing and CPU activity enormously on lower-powered mobile devices
    intervalId = setInterval(updateVolumes, 120);
    return () => clearInterval(intervalId);
  }, [isMicOn]);

  // Handle local mic toggle and calling others
  const participantKeys = JSON.stringify(participants);

  useEffect(() => {
    const manageConnections = async () => {
      // 1. Manage local stream
      if (isMicOn) {
        if (!localStreamRef.current) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            setMicError(null);
            if (userId) setupAudioAnalysis(userId, stream);
            
            // If we just got the stream, we might need to "upgrade" existing calls
            // For PeerJS, it's often easier to restart calls if they were silent
            Object.entries(callsRef.current).forEach(([uid, call]) => {
              (call as MediaConnection).close();
              delete callsRef.current[uid];
              // They will be recreated below
            });
          } catch (err: any) {
            console.error("Mic error:", err);
            setMicError(err?.message || "Ocorreu um erro ao acessar o microfone.");
            // We can still continue to just listen
          }
        } else {
          // Ensure tracks are enabled
          localStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
        }
      } else {
        setMicError(null);
        // Just disable tracks instead of stopping everything to keep connections alive if they are already there
        // Actually, stopping tracks is better for the browser's "camera/mic in use" indicator.
        // But if we stop, we have to restart the connection to send it again.
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
        }
      }

      // 2. Ensure connections to all participants (only if we have a stream to share)
      if (peerRef.current && peerRef.current.open && !peerRef.current.destroyed && isMicOn && localStreamRef.current) {
        participants.forEach(pUid => {
          if (pUid !== userId && !callsRef.current[pUid]) {
            try {
              // Initiate call to share our stream
              const call = peerRef.current!.call(`${roomId}-${pUid}`, localStreamRef.current!);
              
              if (call) {
                callsRef.current[pUid] = call;
                
                call.on('stream', (remoteStream) => {
                  setRemoteStreams(prev => ({ ...prev, [pUid]: remoteStream }));
                  setupAudioAnalysis(pUid, remoteStream);
                });

                call.on('close', () => {
                  delete callsRef.current[pUid];
                  setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[pUid];
                    return next;
                  });
                  delete analysersRef.current[pUid];
                });
                
                call.on('error', (err) => {
                  // Only log if it's not a common/expected error during join/leave
                  if (err.type !== 'peer-unavailable') {
                    console.error("Call error with", pUid, err);
                  }
                  call.close();
                  delete callsRef.current[pUid];
                });
              }
            } catch (err) {
              console.error("Failed to initiate call to", pUid, err);
            }
          }
        });
      }
    };

    manageConnections();
  }, [isMicOn, participants, roomId, userId, participantKeys, isPeerReady]);

  return { remoteStreams, volumes, micError, setMicError, hasAnotherTabOpen };
}
