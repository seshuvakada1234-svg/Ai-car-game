import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  collection,
  onSnapshot,
  getDocs,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { RoomCodeGenerator } from './RoomCodeGenerator';

export interface NormalPlayer {
  uid: string;
  playerName: string;
  photoURL: string;
  joinedAt: number;
  ready: boolean;
}

export interface NormalRoom {
  roomCode: string;
  ownerUid: string;
  ownerName: string;
  selectedCar: string;
  mapId: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  maxPlayers: number;
  currentPlayers: number;
  players: string[]; // List of player UIDs as requested in Firestore Structure definition 1
  createdAt: any;
}

export class NormalRoomService {
  /**
   * Generates a unique room code and creates a new room in Firestore rooms/ collection.
   */
  static async createRoom(
    ownerUid: string,
    ownerName: string,
    ownerPhotoURL: string,
    selectedCar: string,
    mapId: string
  ): Promise<string> {
    const code = RoomCodeGenerator.generate().toUpperCase();

    const roomData: NormalRoom = {
      roomCode: code,
      ownerUid,
      ownerName,
      selectedCar,
      mapId,
      status: 'waiting',
      maxPlayers: 3,
      currentPlayers: 1,
      players: [ownerUid],
      createdAt: serverTimestamp()
    };

    const playerObj: NormalPlayer = {
      uid: ownerUid,
      playerName: ownerName,
      photoURL: ownerPhotoURL || '',
      joinedAt: Date.now(),
      ready: true
    };

    // Use a transaction/batch to ensure atomicity
    const roomRef = doc(db, 'rooms', code);
    const playerRef = doc(db, 'rooms', code, 'players', ownerUid);

    await setDoc(roomRef, roomData);
    await setDoc(playerRef, playerObj);

    return code;
  }

  /**
   * Joins an existing room by checking constraints and updating the currentPlayers count and subcollection.
   */
  static async joinRoom(
    code: string,
    uid: string,
    playerName: string,
    photoURL: string
  ): Promise<void> {
    const upperCode = code.toUpperCase().trim();
    const roomRef = doc(db, 'rooms', upperCode);

    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error('Room ' + upperCode + ' does not exist.');
      }

      const roomData = roomSnap.data() as NormalRoom;

      if (roomData.status !== 'waiting') {
        throw new Error('This race has already started or finished.');
      }

      // Check if player is already inside the room
      const playerList = roomData.players || [];
      const isAlreadyIn = playerList.includes(uid);

      if (!isAlreadyIn) {
        if (roomData.currentPlayers >= 3) {
          throw new Error('Room is full (Maximum 3 players).');
        }

        const updatedPlayers = [...playerList, uid];
        transaction.update(roomRef, {
          currentPlayers: increment(1),
          players: updatedPlayers
        });
      }

      // Add/overwrite player document inside subcollection
      const playerRef = doc(db, 'rooms', upperCode, 'players', uid);
      const playerObj: NormalPlayer = {
        uid,
        playerName,
        photoURL: photoURL || '',
        joinedAt: Date.now(),
        ready: true
      };

      transaction.set(playerRef, playerObj);
    });
  }

  /**
   * Updates host room settings (map & car selection). Only ownerUid can change these.
   */
  static async updateRoomSettings(
    code: string,
    ownerUid: string,
    updates: Partial<Pick<NormalRoom, 'mapId' | 'selectedCar'>>
  ): Promise<void> {
    const upperCode = code.toUpperCase().trim();
    const roomRef = doc(db, 'rooms', upperCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }

    const roomData = roomSnap.data() as NormalRoom;
    if (roomData.ownerUid !== ownerUid) {
      throw new Error('Only the room owner can modify settings.');
    }

    await updateDoc(roomRef, updates);
  }

  /**
   * Start countdown of the race (triggered automatically or by owner)
   */
  static async setRoomStatus(
    code: string,
    status: NormalRoom['status']
  ): Promise<void> {
    const upperCode = code.toUpperCase().trim();
    const roomRef = doc(db, 'rooms', upperCode);
    await updateDoc(roomRef, { status });
  }

  /**
   * Leaves a room. If ownerUid leaves, we cancel (delete) the room.
   */
  static async leaveOrCancelRoom(code: string, uid: string): Promise<void> {
    const upperCode = code.toUpperCase().trim();
    const roomRef = doc(db, 'rooms', upperCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data() as NormalRoom;

    if (roomData.ownerUid === uid) {
      // Owner leaves: delete room and its subcollection
      const playersSubCollRef = collection(db, 'rooms', upperCode, 'players');
      const playersSnap = await getDocs(playersSubCollRef);
      for (const pDoc of playersSnap.docs) {
        await deleteDoc(doc(db, 'rooms', upperCode, 'players', pDoc.id));
      }
      await deleteDoc(roomRef);
    } else {
      // Normal guest leaves: decrement currentPlayers, remove from players array & delete player doc
      const playerList = roomData.players || [];
      const updatedPlayers = playerList.filter((pId) => pId !== uid);

      await updateDoc(roomRef, {
        currentPlayers: Math.max(1, roomData.currentPlayers - 1),
        players: updatedPlayers
      });

      await deleteDoc(doc(db, 'rooms', upperCode, 'players', uid));
    }
  }

  /**
   * Listen to any changes in the main room doc.
   */
  static listenToRoom(code: string, callback: (room: NormalRoom | null) => void) {
    const upperCode = code.toUpperCase().trim();
    const roomRef = doc(db, 'rooms', upperCode);
    return onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as NormalRoom);
      } else {
        callback(null);
      }
    });
  }

  /**
   * Listen to changes in the players subcollection.
   */
  static listenToPlayers(code: string, callback: (players: NormalPlayer[]) => void) {
    const upperCode = code.toUpperCase().trim();
    const playersRef = collection(db, 'rooms', upperCode, 'players');
    return onSnapshot(playersRef, (snap) => {
      const list: NormalPlayer[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as NormalPlayer);
      });
      // Sort by joinedAt to keep a consistent order
      list.sort((a, b) => a.joinedAt - b.joinedAt);
      callback(list);
    });
  }

  /**
   * Updates a single player's driving coordinates and race state fields inside the subcollection.
   */
  static async updatePlayerPosition(
    code: string,
    uid: string,
    coords: {
      position: { x: number; y: number; z: number };
      velocity: { x: number; y: number; z: number };
      angle: number;
      speed: number;
      isDrifting: boolean;
      currentLap: number;
      isFinished: boolean;
      totalDistanceTraveled: number;
    }
  ): Promise<void> {
    const upperCode = code.toUpperCase().trim();
    const playerRef = doc(db, 'rooms', upperCode, 'players', uid);
    await updateDoc(playerRef, coords);
  }
}
