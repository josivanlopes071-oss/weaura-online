import { useEffect, useRef, useState } from 'react';
import { Peer, MediaConnection } from 'peerjs';

export function useVoiceChat(roomId: string, userId: string, isMicOn: boolean, participants: string[]) {
  const [remoteStreams, setRemoteStreams] = useState<{ [uid: string]: MediaStream }>({});
  const [volumes, setVolumes] = useState<{ [uid: string]: number }>({});
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<{ [uid: string]: MediaConnection }>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<{ [uid: string]: AnalyserNode }>({});

  useEffect(() => {
    const peer = new Peer(`${roomId}-${userId}`, {
      debug: 1,
      // Increase reliability with STUN/TURN if needed, but for now just handle errors
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      // console.log('Peer connected with ID:', id);
      setIsPeerReady(true);
    });

    peer.on('error', (err) => {
      // Handle the case where the peer we are calling doesn't exist (yet)
      if (err.type === 'peer-unavailable') {
        // console.warn('Peer unavailable, common when users are joining/leaving:', err.message);
        return;
      }
      console.error('Global PeerJS error:', err);
    });

    peer.on('call', (call) => {
      // console.log('Incoming call from:', call.peer);
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
      peer.destroy();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      audioContextRef.current?.close();
    };
  }, [roomId, userId]);

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
    let rafId: number;
    const updateVolumes = () => {
      if (Object.keys(analysersRef.current).length > 0 || (isMicOn && localStreamRef.current)) {
        const newVolumes: { [uid: string]: number } = {};
        
        Object.entries(analysersRef.current).forEach(([uid, unknownAnalyser]) => {
          const analyser = unknownAnalyser as AnalyserNode;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          newVolumes[uid] = average;
        });

        setVolumes(newVolumes);
      }
      rafId = requestAnimationFrame(updateVolumes);
    };

    rafId = requestAnimationFrame(updateVolumes);
    return () => cancelAnimationFrame(rafId);
  }, [isMicOn, userId]);

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

  return { remoteStreams, volumes, micError, setMicError };
}
