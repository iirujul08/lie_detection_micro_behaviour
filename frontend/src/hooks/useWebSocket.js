import { useState, useEffect, useRef, useCallback } from 'react';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live';

export function useWebSocket(onMessageReceived) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastTelemetry, setLastTelemetry] = useState(null);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const backoffDelayRef = useRef(1000);
  const shouldReconnectRef = useRef(false);
  const pingIntervalRef = useRef(null);
  const onMessageReceivedRef = useRef(onMessageReceived);

  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const cleanupSocket = useCallback(() => {
    clearInterval(pingIntervalRef.current);
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    shouldReconnectRef.current = true;
    clearTimeout(reconnectTimeoutRef.current);

    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(WS_BASE_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsReconnecting(false);
        backoffDelayRef.current = 1000; // Reset backoff on successful connection

        // Heartbeat ping
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 8000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;

          setLastTelemetry(data);
          if (onMessageReceivedRef.current) {
            onMessageReceivedRef.current(data);
          }
        } catch (err) {
          console.error('[TruthLens WS] Parse error:', err);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        clearInterval(pingIntervalRef.current);

        // Auto-reconnect with exponential backoff if not closed voluntarily
        if (shouldReconnectRef.current) {
          setIsReconnecting(true);
          const nextDelay = Math.min(10000, backoffDelayRef.current * 1.8);
          backoffDelayRef.current = nextDelay;
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current) {
              connect();
            }
          }, nextDelay);
        }
      };

      ws.onerror = (err) => {
        console.warn('[TruthLens WS] Socket encountered error:', err);
      };
    } catch (e) {
      console.warn('[TruthLens WS] Init error:', e);
      setIsConnected(false);
      if (shouldReconnectRef.current) {
        setIsReconnecting(true);
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearTimeout(reconnectTimeoutRef.current);
    cleanupSocket();
    setIsConnected(false);
    setIsReconnecting(false);
  }, [cleanupSocket]);

  const sendFrame = useCallback((base64Data, timestamp = '00:00') => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'frame',
        data: base64Data,
        timestamp: timestamp
      }));
      return true;
    }
    return false;
  }, []);

  const sendReset = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'reset' }));
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isReconnecting,
    connect,
    disconnect,
    sendFrame,
    sendReset,
    lastTelemetry
  };
}
