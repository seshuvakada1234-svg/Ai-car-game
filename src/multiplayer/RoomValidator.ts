/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoomState } from './RoomState';

export class RoomValidator {
  /**
   * Validates if the room is joinable. Throws clear, user-facing error strings directly.
   * Required validation messages by specifications:
   * - "Invalid room code"
   * - "Room expired"
   * - "Room full"
   */
  public static validateRoomToJoin(room: RoomState | null): void {
    if (!room) {
      throw new Error('Invalid room code');
    }

    // Checking 30 minutes room expiration (last active check)
    let lastActiveTime = Date.now();
    const timeSource = room.updatedAt || room.createdAt;

    if (timeSource) {
      if (typeof timeSource.toMillis === 'function') {
        lastActiveTime = timeSource.toMillis();
      } else if (typeof timeSource.toDate === 'function') {
        lastActiveTime = timeSource.toDate().getTime();
      } else if (timeSource.seconds) {
        lastActiveTime = timeSource.seconds * 1000;
      } else if (typeof timeSource === 'number') {
        lastActiveTime = timeSource;
      } else if (timeSource instanceof Date) {
        lastActiveTime = timeSource.getTime();
      }
    }

    const ageInMinutes = (Date.now() - lastActiveTime) / (1000 * 60);
    if (ageInMinutes > 30) {
      throw new Error('Room expired');
    }

    // Check status
    if (room.status !== 'waiting') {
      throw new Error('Race already started');
    }

    // Capacity checking (human count limit standard configuration check)
    const humanPlayers = room.players.filter(p => !p.isAI);
    if (humanPlayers.length >= room.maxPlayers) {
      throw new Error('Room full');
    }
  }

  /**
   * Safe check for code string pattern matching ABC123, X9K7PQ, etc.
   */
  public static isValidCode(code: string | null | undefined): boolean {
    if (!code) return false;
    const clean = code.trim().toUpperCase();
    return clean.length >= 4 && clean.length <= 12 && /^[A-Z0-9]+$/.test(clean);
  }
}
