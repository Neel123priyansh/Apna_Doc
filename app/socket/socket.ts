import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket: Socket | null = null;

// ── Connect (idempotent) ───────────────────────────────────────────────────────
// Safe to call multiple times: returns the existing connected socket if one
// already exists instead of hanging on a 'connect' event that will never fire.
export async function connectWithSocket(): Promise<Socket> {
    const API_BASE = 'https://ezzmed-app-ids9.onrender.com';
    const token = await AsyncStorage.getItem('token');

    if (!token) {
        throw new Error('No token found — login required');
    }

    // If socket exists and is already connected, reuse it
    if (socket && socket.connected) {
        console.log('[Socket] Already connected:', socket.id);
        return socket;
    }

    // If socket exists but is disconnected (e.g. network blip), reconnect with fresh token
    if (socket) {
        socket.auth = { token };
        socket.connect();
    } else {
        socket = io(API_BASE, {
            transports: ['websocket', 'polling'],
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });
    }

    // Wait for the connection to be established (with a timeout safeguard)
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('[Socket] Connection timeout after 10s'));
        }, 10_000);

        socket!.once('connect', () => {
            clearTimeout(timeout);
            console.log('[Socket] Connected:', socket!.id);
            resolve();
        });

        socket!.once('connect_error', (err) => {
            clearTimeout(timeout);
            console.error('[Socket] Connection error:', err.message);
            reject(err);
        });
    });

    socket!.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
    });

    return socket!;
}

// ── Disconnect ─────────────────────────────────────────────────────────────────
export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        console.log('[Socket] Disconnected by client');
        socket = null;
    }
}

// ── Get current socket (null if not connected) ─────────────────────────────────
export function getSocket(): Socket | null {
    return socket;
}