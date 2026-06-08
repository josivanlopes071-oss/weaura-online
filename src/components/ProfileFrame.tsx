import React, { useState, useEffect, useRef } from 'react';
import { PREMIUM_FRAMES, FrameItem, getDirectDriveUrl } from '../lib/frames';
import { getTransparentFrame } from '../lib/transparentFrameProcessor';

interface ProfileFrameProps {
  frameId?: string | null;
  frameObj?: FrameItem | null;
  staticUrl?: string | null;
  videoUrl?: string | null;
  className?: string;
  zIndex?: number;
  glowColor?: string;
  children?: React.ReactNode;
}

export default function ProfileFrame({
  frameId,
  frameObj,
  staticUrl,
  videoUrl,
  className = "",
  zIndex = 20,
  glowColor,
  children
}: ProfileFrameProps) {
  // Find frame item based on frameId or use direct frameObj
  const frame = frameObj || (frameId ? PREMIUM_FRAMES.find(f => f.id === frameId) : null);
  
  // Resolve resources falling back to direct props
  const resolvedStaticUrl = staticUrl || frame?.imageUrl || null;
  const resolvedVideoUrl = videoUrl || (frame?.isVideo && frame?.driveUrl ? getDirectDriveUrl(frame.driveUrl, true) : frame?.videoUrl) || null;
  const isVideoFrame = !!resolvedVideoUrl || !!frame?.isVideo;
  const resolvedGlowColor = glowColor || frame?.glowColor || '#6366f1';

  // Fallback CSS generator for frames without static imagery
  const getFallbackCssFrame = () => {
    if (!frame) return '';
    switch (frame.id) {
      case 'fr_celestial':
        return 'border-[3px] border-cyan-400 shadow-[0_0_20px_#00F0FF] animate-pulse';
      case 'fr_gold_royale':
        return 'border-[4px] border-double border-yellow-500 bg-gradient-to-r from-yellow-600/10 via-yellow-400/20 to-yellow-600/10 shadow-[0_0_20px_rgba(234,179,8,0.85)]';
      case 'fr_cyber':
        return 'border-[2px] border-pink-500 border-dashed animate-spin shadow-[0_0_15px_#ec4899]';
      case 'fr_vip_bronze':
        return 'border-[3px] border-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.65)] bg-amber-950/10';
      case 'fr_vip_prata':
        return 'border-[3px] border-slate-300 shadow-[0_0_15px_rgba(148,163,184,0.7)] bg-slate-800/10';
      case 'fr_vip_ouro':
        return 'border-[3.5px] border-yellow-400 shadow-[0_0_25px_rgba(234,179,8,0.95)] bg-yellow-400/10 animate-pulse';
      case 'fr_vip_diamante':
        return 'shadow-[0_0_30px_rgba(6,182,212,0.95)] animate-pulse';
      default:
        return 'border border-white/20';
    }
  };

  const [processedFrameUrl, setProcessedFrameUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playTriggeredRef = useRef(false);

  // 1. Process static transparency (acts as pristine high-resolution border overlay & fallback)
  useEffect(() => {
    let active = true;

    if (!resolvedStaticUrl) {
      setProcessedFrameUrl(null);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    
    getTransparentFrame(resolvedStaticUrl)
      .then((alphaTransparentUrl) => {
        if (!active) return;
        setProcessedFrameUrl(alphaTransparentUrl);
        setIsProcessing(false);
      })
      .catch((err) => {
        console.warn("[ProfileFrame] Falha no processamento estomático de canais alfa.", err);
        if (!active) return;
        setProcessedFrameUrl(resolvedStaticUrl);
        setIsProcessing(false);
      });

    return () => {
      active = false;
    };
  }, [resolvedStaticUrl]);

  // 2. Playback routine - ensure loops work on mobile with dual action: auto-play + guesture-triggered fallback
  useEffect(() => {
    if (!isVideoFrame || !resolvedVideoUrl) {
      setVideoLoaded(false);
      setVideoError(false);
      return;
    }

    setVideoLoaded(false);
    setVideoError(false);
    playTriggeredRef.current = false;

    const video = videoRef.current;
    if (!video) return;

    // Trigger video loading
    video.load();

    const attemptPlay = () => {
      if (playTriggeredRef.current) return;
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setVideoLoaded(true);
            playTriggeredRef.current = true;
            // Successfully playing, clean up global listeners
            cleanup();
          })
          .catch((err) => {
            console.log("[ProfileFrame] Autoplay pendente de interação do usuário:", err.message);
          });
      }
    };

    // Global interaction fallback to start muted video playback on mobile devices
    const interactionEvents = ['touchstart', 'click', 'keydown', 'mousedown', 'scroll'];
    const handleGesture = () => {
      attemptPlay();
    };

    const cleanup = () => {
      interactionEvents.forEach(event => {
        window.removeEventListener(event, handleGesture, { capture: true });
      });
    };

    // First attempt play immediately
    attemptPlay();

    // Register interaction fallback
    interactionEvents.forEach(event => {
      window.addEventListener(event, handleGesture, { passive: true, capture: true });
    });

    return () => {
      cleanup();
    };
  }, [resolvedVideoUrl, isVideoFrame]);

  if (!resolvedStaticUrl && !resolvedVideoUrl && !frame) return null;

  return (
    <div 
      id="profile-frame-container"
      className={`absolute pointer-events-none select-none flex items-center justify-center bg-transparent aspect-square ${className}`}
      style={{
        width: '132%',
        height: '132%', // PERFECT 1:1 SQUARE RATIO - Extinguishes egg-shaped vertical stretching distortion completely!
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: zIndex
      }}
    >
      {/* 
        Avatar photo wrapper container. Positioned inside the frame with matching 1:1 circles.
        Width & height computed proportionally to align exactly with standard premium border templates.
      */}
      {children && (
        <div 
          className="absolute rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 pointer-events-auto"
          style={{
            position: 'absolute',
            width: '75.5%', 
            height: '75.5%', // Perfect circular scale inside the parent 1:1 layout
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
            background: 'transparent'
          }}
        >
          {children}
        </div>
      )}

      {/* Loading state spinner */}
      {isProcessing && !processedFrameUrl && (
        <div 
          className="absolute w-[76%] h-[76%] rounded-full border border-dashed border-purple-500 animate-spin opacity-50"
          style={{ zIndex: 5 }}
        />
      )}

      {/* Frame Composition Layer */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-transparent pointer-events-none">
        
        {/*
          1. Base static crisp overlay.
          Sitting at z-index: 10, it acts as the primary layout immediately when the page loads, 
          preventing empty visual flashes before the video starts, and serves as perfect high-res border details.
        */}
        {processedFrameUrl || resolvedStaticUrl ? (
          <img 
            src={processedFrameUrl || resolvedStaticUrl} 
            className={`absolute pointer-events-none transition-opacity duration-500 bg-transparent object-contain w-full h-full`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              mixBlendMode: isVideoFrame ? 'screen' : 'normal', // Blend video frame borders smoothly
              imageRendering: 'auto',
              zIndex: 10,
              opacity: isVideoFrame && videoLoaded ? 0.8 : 1 // Gently fade static background once video takes over
            }}
            alt=""
            onError={() => {
              console.warn("[ProfileFrame] Erro ao renderizar imagem de retaguarda.");
            }}
          />
        ) : (
          frame && (
            <div 
              className={`absolute rounded-full w-[78%] h-[78%] pointer-events-none z-10 transition-all duration-500 ${getFallbackCssFrame()}`}
              style={{
                background: frame.id === 'fr_vip_diamante' 
                  ? 'linear-gradient(#0c0c0c, #0c0c0c) padding-box, linear-gradient(135deg, #22d3ee, #a855f7, #ec4899) border-box' 
                  : undefined,
                border: frame.id === 'fr_vip_diamante' ? '3.5px solid transparent' : undefined,
              }}
            />
          )
        )}

        {/* 
          2. Overlay dynamic Video loop animation.
          Sitting at z-index: 12 (layered over static backdrop/avatar) with Screen blend-mode, zero shadows,
          and optimized hardware acceleration to prevent layout jitter or browser bottlenecks.
        */}
        {isVideoFrame && resolvedVideoUrl && !videoError && (
          <video 
            ref={videoRef}
            key={resolvedVideoUrl}
            src={resolvedVideoUrl}
            className={`absolute pointer-events-none bg-transparent object-contain w-full h-full transition-opacity duration-500 ${
              videoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              mixBlendMode: 'screen', // Highly critical Screen blend-mode treating black video pixels as transparent
              zIndex: 12,
              willChange: 'transform',
              transform: 'translate3d(0, 0, 0)', // Force GPU composite rendering
              boxShadow: 'none' // STRICT MANDATE: No modern custom shadows on video layers to maximize raw FPS performance
            }}
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            preload="auto"
            onError={(e) => {
              console.warn("[ProfileFrame] Falha de streaming no sinal de vídeo:", resolvedVideoUrl);
              setVideoError(true);
            }}
          />
        )}
      </div>

      {/* Frame Pulsing Ambient Glow overlay - rendered for both static and video to unify the styling */}
      {(processedFrameUrl || resolvedStaticUrl) && (
        <div 
          className="absolute inset-[3%] rounded-full pointer-events-none opacity-40 mix-blend-screen animate-pulse scale-[1.01]"
          style={{
            boxShadow: `0 0 16px ${resolvedGlowColor}30, inset 0 0 16px ${resolvedGlowColor}20`,
            border: `1px solid ${resolvedGlowColor}10`,
            background: 'transparent',
            zIndex: 15
          }}
        />
      )}
    </div>
  );
}
