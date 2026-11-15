/**
 * Environment configuration for API and WebSocket endpoints.
 * Supports local dev, local network (multiplayer on same Wi-Fi), and production deployment.
 */

export const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    // If running on localhost or standard local network IP
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://localhost:8000`;
    }
    // If accessed via local network IP or deployed domain
    return `${protocol}//${hostname}:8000`;
  }
  return "http://localhost:8000";
};

export const getWsBaseUrl = (roomId: string, clientId: string): string => {
  const cleanRoomId = encodeURIComponent(roomId.trim().toLowerCase());
  const cleanClientId = encodeURIComponent(clientId.trim());

  if (process.env.NEXT_PUBLIC_WS_URL) {
    const base = process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, "");
    return `${base}/ws/${cleanRoomId}/${cleanClientId}`;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const wsProto = protocol === "https:" ? "wss:" : "ws:";
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `ws://localhost:8000/ws/${cleanRoomId}/${cleanClientId}`;
    }
    return `${wsProto}//${hostname}:8000/ws/${cleanRoomId}/${cleanClientId}`;
  }

  return `ws://localhost:8000/ws/${cleanRoomId}/${cleanClientId}`;
};
