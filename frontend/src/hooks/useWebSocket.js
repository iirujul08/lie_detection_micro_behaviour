import { useState, useEffect, useRef, useCallback } from 'react';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live';

export function useWebSocket(onMessageReceived) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastTelemetry, setLastTelemetry] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);

  const connect = useCallback(() => {
    try {
      if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const ws = new WebSocket(WS_BASE_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start ping heartbeat
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;

          setLastTelemetry(data);
          if (onMessageReceived) {
            onMessageReceived(data);
          }
        } catch (err) {
          console.error('[TruthLens WS] Parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        clearInterval(pingIntervalRef.current);
      };

      ws.onerror = (err) => {
        console.warn('[TruthLens WS] Connection error:', err);
        setIsConnected(false);
      };
    } catch (e) {
      console.warn('[TruthLens WS] Init error:', e);
      setIsConnected(false);
    }
  }, [onMessageReceived]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimeoutRef.current);
    clearInterval(pingIntervalRef.current);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendFrame = useCallback((base64Data, timestamp = '00:00') => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'frame',
        data: base64Data,
        timestamp: timestamp
      }));
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { isConnected, connect, disconnect, sendFrame, lastTelemetry };
}
