import { useState, useRef, useCallback, useEffect } from 'react';

export function useCamera() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);
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
      
      isActiveRef.current = true;
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
      isActiveRef.current = false;
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
    isActiveRef.current = false;
    setIsActive(false);
  }, []);

  /**
   * Captures the current video frame resized to 480x360 at 0.75 JPEG quality.
   * Uses isActiveRef and streamRef to completely eliminate stale React closure bugs.
   */
  const captureFrameBase64 = useCallback((quality = 0.75) => {
    if (!videoRef.current || !streamRef.current || !isActiveRef.current) {
      return null;
    }

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      return null;
    }

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const canvas = offscreenCanvasRef.current;
    
    // Scale to 480px width preserving video aspect ratio
    const targetW = 480;
    const aspect = video.videoHeight / video.videoWidth;
    const targetH = Math.round(targetW * aspect) || 360;

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', quality);
  }, []);

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
