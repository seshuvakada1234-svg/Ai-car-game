import { db } from '../lib/firebase';
import {
  doc, setDoc, getDoc, updateDoc,
  deleteDoc, onSnapshot, collection, query, where,
  serverTimestamp, Firestore, Unsubscribe
} from 'firebase/firestore';
import { RoomCodeGenerator } from './RoomCodeGenerator';


export type RoomStatus = 'waiting' | 'countdown' | 'racing' | 'finished';

export interface RoomPlayer {
  id: string;
  nickname: string;
  carId: string;
  isHost: boolean;
  isReady: boolean;
  isAI: boolean;
  joinedAt: number;
  carColor?: string;

  // Real-time synchronization properties
  position?: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  angle?: number;
  speed?: number;
  isDrifting?: boolean;
  currentLap?: number;
  isFinished?: boolean;
  totalDistanceTraveled?: number;
}

export interface RoomData {
  roomCode: string;
  code?: string; // alias for compatibility
  id?: string; // alias for compatibility
  isLiveMode?: boolean; // compatibility field
  hostId: string;
  map: string;
  difficulty: 'easy' | 'medium' | 'hard';
  laps: number;
  weather: string;
  players: RoomPlayer[];
  status: RoomStatus;
  phase?: RoomStatus; // compatibility field
  countdown: number;
  createdAt: any;
  maxPlayers: number;
}

function getDB(): Firestore {
  return db;
}

export class RoomManager {
  private static currentRoomCode: string | null = null;
  private static currentPlayerId: string | null = null;
  private static unsubscribe: Unsubscribe | null = null;

  // ── Create ────────────────────────────────────────────────────────────────

  static async createRoom(
    hostNickname: string,
    hostCarId: string,
    carColor?: string,
    isLiveMode = false,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    map = 'map1',
    laps = 3,
    weather = 'clear'
  ): Promise<string> {
    const db = getDB();
    const code = RoomCodeGenerator.generate();
    const hostId = RoomManager.getOrCreatePlayerId();

    const host: RoomPlayer = {
      id: hostId,
      nickname: hostNickname,
      carId: hostCarId,
      carColor,
      isHost: true,
      isReady: true,
      isAI: false,
      joinedAt: Date.now()
    };

    const roomData: RoomData = {
      roomCode: code,
      code, // alias
      isLiveMode,
      hostId,
      map,
      difficulty,
      laps,
      weather,
      players: [host],
      status: 'waiting',
      countdown: 30,
      createdAt: serverTimestamp(),
      maxPlayers: 6
    };

    await setDoc(doc(db, 'rooms', code), roomData);
    RoomManager.currentRoomCode = code;
    RoomManager.currentPlayerId = hostId;
    return code;
  }

  // ── Join ──────────────────────────────────────────────────────────────────

  static async joinRoom(
    code: string,
    nickname: string,
    carId: string,
    carColor?: string
  ): Promise<RoomData> {
    const db = getDB();
    const upper = code.toUpperCase();
    const ref = doc(db, 'rooms', upper);
    const snap = await getDoc(ref);

    if (!snap.exists()) throw new Error('Room not found');

    const room = snap.data() as RoomData;
    if (room.status !== 'waiting') throw new Error('Race already started');

    const humans = room.players.filter(p => !p.isAI);
    if (humans.length >= room.maxPlayers) throw new Error('Room is full');

    const playerId = RoomManager.getOrCreatePlayerId();
    const already = room.players.find(p => p.id === playerId);
    if (already) {
      RoomManager.currentRoomCode = upper;
      RoomManager.currentPlayerId = playerId;
      return { ...room, code: upper };
    }

    const newPlayer: RoomPlayer = {
      id: playerId,
      nickname,
      carId,
      carColor,
      isHost: false,
      isReady: false,
      isAI: false,
      joinedAt: Date.now()
    };

    const updatedPlayers = [...room.players, newPlayer];

    await updateDoc(ref, {
      players: updatedPlayers
    });

    RoomManager.currentRoomCode = upper;
    RoomManager.currentPlayerId = playerId;
    return { ...room, code: upper, players: updatedPlayers };
  }

  // ── Listen ────────────────────────────────────────────────────────────────

  static listenToRoom(
    code: string,
    onChange: (room: RoomData) => void
  ): () => void {
    const db = getDB();
    const upper = code.toUpperCase();
    const ref = doc(db, 'rooms', upper);
    RoomManager.unsubscribe?.();
    RoomManager.unsubscribe = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data() as RoomData;
        onChange({
          ...data,
          code: upper,
          id: upper,
          phase: data.status
        });
      }
    });
    return () => RoomManager.unsubscribe?.();
  }

  // ── Host updates ──────────────────────────────────────────────────────────

  static async updateHostSettings(
    code: string,
    settings: Partial<Pick<RoomData, 'map' | 'difficulty' | 'laps' | 'weather'>>
  ): Promise<void> {
    const db = getDB();
    await updateDoc(doc(db, 'rooms', code.toUpperCase()), settings);
  }

  static async setPlayerReady(code: string, playerId: string): Promise<void> {
    const db = getDB();
    const ref = doc(db, 'rooms', code.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const room = snap.data() as RoomData;
    const updated = room.players.map(p =>
      p.id === playerId ? { ...p, isReady: true } : p
    );
    await updateDoc(ref, { players: updated });
  }

  static async startRace(code: string): Promise<void> {
    const db = getDB();
    await updateDoc(doc(db, 'rooms', code.toUpperCase()), {
      status: 'racing'
    });
  }

  static async updateCurrentPlayerPosition(code: string, playerId: string, carState: any): Promise<void> {
    const db = getDB();
    const ref = doc(db, 'rooms', code.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const room = snap.data() as RoomData;
    const updated = room.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          position: { x: carState.position.x, y: carState.position.y, z: carState.position.z },
          velocity: { x: carState.velocity.x, y: carState.velocity.y, z: carState.velocity.z },
          angle: carState.angle,
          speed: carState.speed,
          isDrifting: carState.isDrifting || false,
          currentLap: carState.currentLap || 1,
          isFinished: carState.isFinished || false,
          totalDistanceTraveled: carState.totalDistanceTraveled || 0
        };
      }
      return p;
    });
    await updateDoc(ref, { players: updated });
  }

  static async updateAICarsPosition(code: string, aiCarsState: any[]): Promise<void> {
    const db = getDB();
    const ref = doc(db, 'rooms', code.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const room = snap.data() as RoomData;
    const updated = room.players.map(p => {
      if (p.isAI) {
        const matchingCar = aiCarsState.find(c => c.id === p.id);
        if (matchingCar) {
          return {
            ...p,
            position: { x: matchingCar.position.x, y: matchingCar.position.y, z: matchingCar.position.z },
            velocity: { x: matchingCar.velocity.x, y: matchingCar.velocity.y, z: matchingCar.velocity.z },
            angle: matchingCar.angle,
            speed: matchingCar.speed,
            isDrifting: matchingCar.isDrifting || false,
            currentLap: matchingCar.currentLap || 1,
            isFinished: matchingCar.isFinished || false,
            totalDistanceTraveled: matchingCar.totalDistanceTraveled || 0
          };
        }
      }
      return p;
    });
    await updateDoc(ref, { players: updated });
  }

  static async closeRoom(code: string): Promise<void> {
    const db = getDB();
    RoomCodeGenerator.release(code);
    RoomManager.unsubscribe?.();
    await deleteDoc(doc(db, 'rooms', code.toUpperCase()));
    RoomManager.currentRoomCode = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  static getCurrentCode(): string | null {
    return RoomManager.currentRoomCode;
  }

  static getCurrentPlayerId(): string | null {
    return RoomManager.currentPlayerId;
  }

  static isHost(room: RoomData): boolean {
    return room.hostId === RoomManager.currentPlayerId;
  }

  private static getOrCreatePlayerId(): string {
    let id = sessionStorage.getItem('racePlayerId');
    if (!id) {
      id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem('racePlayerId', id);
    }
    return id;
  }
}