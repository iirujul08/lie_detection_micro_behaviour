import { useState, useRef, useCallback, useEffect } from 'react';

export function useCamera() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const offscreenCanvasRef = useRef(null);

  const startCamera = useCallback(async () => {
    setError(null);
    setIsPermissionDenied(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam mediaDevices API not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.warn('Video play warning:', e));
      }
      setIsActive(true);
      return true;
    } catch (err) {
      console.warn('[TruthLens Camera] Access error:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setIsPermissionDenied(isDenied);
      setError(
        isDenied
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : (err.message || 'Camera not detected or in use by another application.')
      );
      setIsActive(false);
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  /**
   * Resizes to 320x240 and encodes as JPEG at quality 0.6
   * For optimal 8-10 FPS WebSocket telemetry without network buffer bloat.
   */
  const captureFrameBase64 = useCallback((quality = 0.6) => {
    if (!videoRef.current || !isActive) return null;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const canvas = offscreenCanvasRef.current;
    // Exactly 320x240 resolution for frame compression
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 320, 240);

    return canvas.toDataURL('image/jpeg', quality);
  }, [isActive]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    isActive,
    error,
    isPermissionDenied,
    startCamera,
    stopCamera,
    captureFrameBase64
  };
}
