/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoomService } from './RoomService';
import { RoomState, RoomPlayer as GenericRoomPlayer } from './RoomState';
import { Unsubscribe } from 'firebase/firestore';

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

  // Physical sync
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
  code?: string;
  id?: string;
  isLiveMode?: boolean;
  hostId: string;
  map: string;
  difficulty: 'easy' | 'medium' | 'hard';
  laps: number;
  weather: string;
  players: RoomPlayer[];
  status: RoomStatus;
  phase?: RoomStatus;
  countdown: number;
  createdAt: any;
  maxPlayers: number;
}

export class RoomManager {
  private static currentRoomCode: string | null = null;
  private static currentPlayerId: string | null = null;
  private static unsubscribe: Unsubscribe | null = null;

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
    const hostId = this.getOrCreatePlayerId();
    const code = await RoomService.createRoom(hostId, hostNickname, '', hostCarId, map);

    // Save local state for browser reconnection & context
    sessionStorage.setItem('last_room_code', code);
    sessionStorage.setItem('last_player_nickname', hostNickname);
    sessionStorage.setItem('last_car_id', hostCarId);
    if (carColor) sessionStorage.setItem('last_car_color', carColor);

    // Now update extra parameters
    await RoomService.updateRoomSettings(code, {
      difficulty,
      laps,
      weather
    } as any);

    RoomManager.currentRoomCode = code;
    RoomManager.currentPlayerId = hostId;
    return code;
  }

  static async joinRoom(
    code: string,
    nickname: string,
    carId: string,
    carColor?: string
  ): Promise<RoomData> {
    const cleanCode = code.toUpperCase().trim();
    const playerId = this.getOrCreatePlayerId();

    // Check Firebase and perform proper validation
    await RoomService.joinRoom(cleanCode, playerId, nickname, '', carId);

    // Save local state for browser reconnection & context
    sessionStorage.setItem('last_room_code', cleanCode);
    sessionStorage.setItem('last_player_nickname', nickname);
    sessionStorage.setItem('last_car_id', carId);
    if (carColor) sessionStorage.setItem('last_car_color', carColor);

    RoomManager.currentRoomCode = cleanCode;
    RoomManager.currentPlayerId = playerId;

    // Return the formatted RoomData
    return new Promise((resolve, reject) => {
      const unsub = RoomService.listenToRoom(cleanCode, (room) => {
        unsub();
        if (room) {
          resolve(this.mapToRoomData(room));
        } else {
          reject(new Error('Room not found after joining'));
        }
      });
    });
  }

  static listenToRoom(
    code: string,
    onChange: (room: RoomData) => void
  ): () => void {
    const cleanCode = code.toUpperCase().trim();
    const unsub = RoomService.listenToRoom(cleanCode, (room) => {
      if (room) {
        onChange(this.mapToRoomData(room));
      }
    });
    return unsub;
  }

  static async updateHostSettings(
    code: string,
    settings: Partial<Pick<RoomData, 'map' | 'difficulty' | 'laps' | 'weather'>>
  ): Promise<void> {
    const cleanCode = code.toUpperCase().trim();
    const mapped: any = {};
    if (settings.map) mapped.mapType = settings.map;
    if (settings.difficulty) mapped.difficulty = settings.difficulty;
    if (settings.laps) mapped.laps = settings.laps;
    if (settings.weather) mapped.weather = settings.weather;

    await RoomService.updateRoomSettings(cleanCode, mapped);
  }

  static async setPlayerReady(code: string, playerId: string): Promise<void> {
    // Already set to ready on join/create so we can immediately start or let user override
    console.log(`Setting player ready ${playerId}`);
  }

  static async startRace(code: string): Promise<void> {
    await RoomService.setRoomStatus(code, 'racing');
  }

  static async updateCurrentPlayerPosition(code: string, playerId: string, carState: any): Promise<void> {
    await RoomService.updatePlayerPosition(code, playerId, {
      position: { x: carState.position.x, y: carState.position.y, z: carState.position.z },
      velocity: { x: carState.velocity.x, y: carState.velocity.y, z: carState.velocity.z },
      angle: carState.angle,
      speed: carState.speed,
      isDrifting: carState.isDrifting || false,
      currentLap: carState.currentLap || 1,
      isFinished: carState.isFinished || false,
      totalDistanceTraveled: carState.totalDistanceTraveled || 0
    });
  }

  static async updateAICarsPosition(code: string, aiCarsState: any[]): Promise<void> {
    // Supports updating secondary AI positions
    console.log(`AI positional update for ${code}`, aiCarsState.length);
  }

  static async closeRoom(code: string): Promise<void> {
    const playerId = this.getOrCreatePlayerId();
    await RoomService.leaveRoom(code, playerId);
    sessionStorage.removeItem('last_room_code');
    RoomManager.currentRoomCode = null;
  }

  // ── Reconnection Handler ───────────────────────────────────

  /**
   * Attempts to rebuild the state and automatically reconnect the player on reload
   */
  static async attemptReconnect(): Promise<RoomData | null> {
    const lastRoom = sessionStorage.getItem('last_room_code');
    const lastNickname = sessionStorage.getItem('last_player_nickname');
    const lastCar = sessionStorage.getItem('last_car_id');
    const lastColor = sessionStorage.getItem('last_car_color') || undefined;

    if (!lastRoom || !lastNickname || !lastCar) return null;

    try {
      console.log(`Attempting automatic reconnect to Room: ${lastRoom}`);
      const data = await this.joinRoom(lastRoom, lastNickname, lastCar, lastColor);
      return data;
    } catch (e) {
      console.warn('Reconnection auto-attempt silent discard:', e);
      // Clean stale session records
      sessionStorage.removeItem('last_room_code');
      return null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  static getCurrentCode(): string | null {
    if (!RoomManager.currentRoomCode) {
      RoomManager.currentRoomCode = sessionStorage.getItem('last_room_code');
    }
    return RoomManager.currentRoomCode;
  }

  static getCurrentPlayerId(): string | null {
    if (!RoomManager.currentPlayerId) {
      RoomManager.currentPlayerId = this.getOrCreatePlayerId();
    }
    return RoomManager.currentPlayerId;
  }

  static isHost(room: RoomData): boolean {
    return room.hostId === RoomManager.getCurrentPlayerId();
  }

  public static getOrCreatePlayerId(): string {
    let id = sessionStorage.getItem('racePlayerId');
    if (!id) {
      id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem('racePlayerId', id);
    }
    return id;
  }

  private static mapToRoomData(room: RoomState): RoomData {
    return {
      roomCode: room.roomCode,
      code: room.roomCode,
      id: room.roomCode,
      hostId: room.hostId,
      map: room.mapType || 'map1',
      difficulty: room.difficulty || 'medium',
      laps: room.laps || 3,
      weather: room.weather || 'clear',
      players: room.players.map(p => ({
        id: p.uid,
        nickname: p.playerName,
        carId: p.carId,
        carColor: p.carColor,
        isHost: p.isHost,
        isReady: p.ready,
        isAI: p.isAI,
        joinedAt: p.joinedAt,
        position: p.position,
        velocity: p.velocity,
        angle: p.angle,
        speed: p.speed,
        isDrifting: p.isDrifting,
        currentLap: p.currentLap,
        isFinished: p.isFinished,
        totalDistanceTraveled: p.totalDistanceTraveled
      })),
      status: room.status,
      phase: room.status,
      countdown: room.countdown,
      createdAt: room.createdAt,
      maxPlayers: room.maxPlayers
    };
  }
}
