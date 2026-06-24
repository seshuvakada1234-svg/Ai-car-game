/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CarState, ControlsState, Vector3D, Difficulty } from '../types';
import { TrackGeometryHelper } from '../utils/track';
import { particleSystem } from '../world/particleSystem';
import { CarCollisionSystem } from '../utils/carCollision';
import { terrainManager } from '../world/TerrainManager';
import { MemoryPool } from '../utils/memoryPool';

const MAX_SPEED = 78; // units/sec (~280 km/h)
const REVERSE_MAX_SPEED = 28; // units/sec (~100 km/h)
const ACCELERATION = 40; // responsive torque curve
const DECELERATION = 14; // mechanical engine compression drag
const BRAKING = 65; // high-efficiency carbon brakes
const STEER_SPEED = 2.85; // baseline steering rate (rad/sec)
const FRICTION = 0.988; // stable rolling tyre resistance
const DRIFT_GRIP = 0.86; // sliding slip factor
const NORMAL_GRIP = 0.984; // static tyre friction coefficient
const NITRO_BOOST_SPEED = 108; // maximum nitro speeds (~390 km/h)
const NITRO_BOOST_ACCEL = 75; // explosive rocket launch nitro charge up

export class GamePhysicsService {
  public trackHelper: TrackGeometryHelper;
  public sparkCounter = 0;
  
  private carProgressHistory = new Map<string, number>();
  private carHasPassedMidpoint = new Map<string, boolean>();

  private static readonly _vecA = new THREE.Vector3();
  private static readonly _vecB = new THREE.Vector3();

  constructor(trackHelper: TrackGeometryHelper) {
    this.trackHelper = trackHelper;
  }

  public spawnParticle(
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    color: string, size: number, decay: number,
    isNitro = false, isSpark = false
  ) {
    let type: 'nitro' | 'exhaust' | 'smoke' | 'spark' | 'dust' = 'exhaust';
    if (isNitro) {
      type = 'nitro';
    } else if (isSpark) {
      type = 'spark';
    } else if (color === '#e2e6eb' || color === 'rgba(255,255,255,0.7)') {
      type = 'smoke';
    }
    particleSystem.spawn(type, x, y, z, vx, vy, vz, color, size, decay);
  }

  public initializeCars(playerName: string, difficulty: Difficulty, playerCarColor: string): CarState[] {
    const aiColors = ['#ffe105', '#00f6ff', '#ffa200'];
    const aiNames = ['Nova', 'Phantom', 'Titan'];
    const result: CarState[] = [];

    this.carProgressHistory.clear();
    this.carHasPassedMidpoint.clear();

    const wheelRadius = 0.38;
    const curveLength = this.trackHelper.curve.getLength();

    // 1. Setup Player Racer (Row 0, left side, side = -1)
    const playerProgress = (1.0 - 15.0 / curveLength) % 1.0;
    const playerPt = this.trackHelper.curve.getPointAt(playerProgress);
    const playerTangent = this.trackHelper.curve.getTangentAt(playerProgress).normalize();
    const playerNormal = new THREE.Vector3(-playerTangent.z, 0, playerTangent.x).normalize();
    const playerSpawnPos = playerPt.clone().addScaledVector(playerNormal, -2.5);
    
    const playerRoadHeightTest = terrainManager.getRoadHeight(playerSpawnPos);
    const playerSpawnY = playerRoadHeightTest + wheelRadius;
    const playerStartAngle = Math.atan2(playerTangent.x, playerTangent.z);

    result.push({
      id: 'player',
      name: playerName || 'Player',
      isAI: false,
      color: playerCarColor || '#0062ff',
      position: { x: playerSpawnPos.x, y: playerSpawnY, z: playerSpawnPos.z },
      velocity: { x: 0, y: 0, z: 0 },
      speed: 0,
      angle: playerStartAngle,
      angularVelocity: 0,
      driftFactor: 0,
      isDrifting: false,
      currentLap: 1,
      currentCheckpointIndex: 0,
      distanceToNextCheckpoint: 999,
      racePosition: 1,
      totalDistanceTraveled: -15,
      isFinished: false,
      lastActiveTime: Date.now(),
      nitroCharged: 60,
      isNitroActive: false,
      stuckTimer: 0,
      aiTargetNode: 0,
      aiSpeedFactor: 1,
      aiAggression: 0.5,
      throttle: 0,
      brake: 0,
      steering: 0,
      gear: 'D',
      awake: true,
      mass: 1450,
      engineRunning: true,
    });

    // 2. Setup exactly 3 competitive AI Competitors (8m spacing between cars)
    for (let i = 0; i < 3; i++) {
      const side = (i % 2 === 0) ? 1 : -1;
      const aiDistance = 15.0 + (i + 1) * 8.0;
      const aiProgress = ((1.0 - aiDistance / curveLength) % 1.0 + 1.0) % 1.0;
      const aiPt = this.trackHelper.curve.getPointAt(aiProgress);
      const aiTangent = this.trackHelper.curve.getTangentAt(aiProgress).normalize();
      const aiNormal = new THREE.Vector3(-aiTangent.z, 0, aiTangent.x).normalize();
      const aiOffsetValue = side * 2.5;

      const aiSpawnPos = aiPt.clone().addScaledVector(aiNormal, aiOffsetValue);
      const groundY = terrainManager.getRoadHeight(aiSpawnPos);
      const aiSpawnY = groundY + wheelRadius;
      const aiStartAngle = Math.atan2(aiTangent.x, aiTangent.z);

      let speedFactor = 0.88;
      let aggression = 0.45;
      if (difficulty === 'medium') {
        speedFactor = 0.98;
        aggression = 0.72;
      } else if (difficulty === 'hard') {
        speedFactor = 1.05;
        aggression = 0.95;
      }

      result.push({
        id: `ai_${aiNames[i].toLowerCase()}`,
        name: aiNames[i],
        isAI: true,
        color: aiColors[i],
        position: { x: aiSpawnPos.x, y: aiSpawnY, z: aiSpawnPos.z },
        velocity: { x: 0, y: 0, z: 0 },
        speed: 0,
        angle: aiStartAngle,
        angularVelocity: 0,
        driftFactor: 0,
        isDrifting: false,
        currentLap: 1,
        currentCheckpointIndex: 0,
        distanceToNextCheckpoint: 999,
        racePosition: i + 2,
        totalDistanceTraveled: -aiDistance,
        isFinished: false,
        lastActiveTime: Date.now(),
        nitroCharged: 20 + i * 15,
        isNitroActive: false,
        difficulty,
        aiTargetNode: 0,
        aiSpeedFactor: speedFactor + (Math.random() * 0.04 - 0.02),
        aiAggression: aggression,
        stuckTimer: 0,
        throttle: 0,
        brake: 0,
        steering: 0,
        gear: 'D',
        awake: true,
        mass: 1450,
        engineRunning: true,
      });
    }

    return result;
  }

  public recoverCarToNearestCheckpoint(car: CarState) {
    const now = Date.now();
    const lastRecovery = car.lastRecoveryTime || 0;
    if (now - lastRecovery < 5000) {
      return;
    }
    car.lastRecoveryTime = now;
    car.recoveryCount = (car.recoveryCount || 0) + 1;

    const chpts = this.trackHelper.checkpoints;
    const chptIndex = car.currentCheckpointIndex >= 0 && car.currentCheckpointIndex < chpts.length ? car.currentCheckpointIndex : 0;
    const chpt = chpts[chptIndex];
    if (!chpt) return;

    const wheelRadius = 0.38;
    car.position.x = chpt.position.x;
    car.position.z = chpt.position.z;
    car.position.y = chpt.position.y + wheelRadius;
    
    car.velocity.x = 0;
    car.velocity.y = 0;
    car.velocity.z = 0;
    car.speed = 0;
    car.angularVelocity = 0;
    car.driftFactor = 0;
    car.isDrifting = false;
    car.angle = Math.atan2(chpt.direction.x, chpt.direction.z);
  }

  private checkAndHandleRecovery(car: CarState, dt: number) {
    const now = Date.now();
    
    // 1. Prevent: NaN, Infinity, undefined positions or velocities
    const hasNan = !Number.isFinite(car.position.x) || !Number.isFinite(car.position.y) || !Number.isFinite(car.position.z) ||
                   !Number.isFinite(car.velocity.x) || !Number.isFinite(car.velocity.y) || !Number.isFinite(car.velocity.z) ||
                   !Number.isFinite(car.speed) || !Number.isFinite(car.angle) || !Number.isFinite(car.angularVelocity);
    
    if (hasNan) {
      car.position.x = Number.isFinite(car.position.x) ? car.position.x : 0;
      car.position.y = Number.isFinite(car.position.y) ? car.position.y : 0;
      car.position.z = Number.isFinite(car.position.z) ? car.position.z : 0;
      car.velocity.x = Number.isFinite(car.velocity.x) ? car.velocity.x : 0;
      car.velocity.y = Number.isFinite(car.velocity.y) ? car.velocity.y : 0;
      car.velocity.z = Number.isFinite(car.velocity.z) ? car.velocity.z : 0;
      car.speed = Number.isFinite(car.speed) ? car.speed : 0;
      car.angle = Number.isFinite(car.angle) ? car.angle : 0;
      car.angularVelocity = Number.isFinite(car.angularVelocity) ? car.angularVelocity : 0;
      
      console.warn(`[RECOVERY] Healing vehicle ${car.id} due to NaN properties.`);
      this.recoverCarToNearestCheckpoint(car);
      return;
    }

    // 2. Map Bounds Check
    if (Math.abs(car.position.x) > 3000 || car.position.z < -3000 || car.position.z > 4500) {
      console.warn(`[RECOVERY] Healing vehicle ${car.id} because it drifted outside map bounds.`);
      this.recoverCarToNearestCheckpoint(car);
      return;
    }

    // 3. Distance from road calculation using TerrainManager
    const roadY = terrainManager.getRoadHeight(car.position, car.lastValidY);
    
    // Save lastValidY if height is reasonable
    if (Number.isFinite(roadY)) {
      car.lastValidY = roadY;
    }

    const distFromRoad = Math.abs(car.position.y - roadY);
    const isFallingOffMap = car.position.y < -50.0 || car.position.y < roadY - 15.0;
    const isFloating = distFromRoad > 5.0 || isFallingOffMap;
    
    if (isFloating) {
      if (car.floatTimer === undefined) {
        car.floatTimer = 0;
      }
      car.floatTimer += dt;
    } else {
      car.floatTimer = 0;
    }

    // DEBUG LOGS REQUIREMENT
    const lastRecTime = car.lastRecoveryTime || 0;
    const cooldownRemaining = Math.max(0, 5000 - (now - lastRecTime)) / 1000;
    
    if (isFloating && car.floatTimer && car.floatTimer > 0.5 && Math.random() < 0.05) {
      console.log(`[DEBUG LOG] Vehicle ID: ${car.id} | Pos: (${car.position.x.toFixed(1)}, ${car.position.y.toFixed(1)}, ${car.position.z.toFixed(1)}) | Road Height: ${roadY.toFixed(1)} | Dist: ${distFromRoad.toFixed(1)}m | VertVel: ${car.velocity.y.toFixed(1)} | RecCount: ${car.recoveryCount || 0} | Cooldown: ${cooldownRemaining.toFixed(1)}s`);
    }

    // Trigger Recovery only if floats > 5m for more than 2 seconds
    if (isFloating && car.floatTimer >= 2.0) {
      if (now - lastRecTime >= 5000) {
        car.floatTimer = 0;
        console.warn(`[RECOVERY] Recovering vehicle ${car.id} after floating/falling for > 2 seconds. Total recoveries: ${(car.recoveryCount || 0) + 1}`);
        this.recoverCarToNearestCheckpoint(car);
      } else {
        // Under 5s cooldown, smoothly pull Y back to road height to avoid perpetual hovering
        car.position.y = THREE.MathUtils.lerp(car.position.y, roadY, 5.0 * dt);
        car.velocity.y = 0;
      }
    }
  }

  public updateCar(car: CarState, dt: number, controls: ControlsState, isLocked: boolean) {
    dt = Math.min(dt, 0.05);
    if (!Number.isFinite(dt) || dt <= 0) {
      dt = 0.0166;
    }

    this.checkAndHandleRecovery(car, dt);

    if (car.isFinished) {
      car.speed *= 0.94;
      car.isNitroActive = false;
      car.velocity.x *= 0.94;
      car.velocity.z *= 0.94;
      return;
    }

    if (isLocked) {
      car.speed = 0;
      car.velocity = { x: 0, y: 0, z: 0 };
      car.isNitroActive = false;
      return;
    }

    // Failsafe mechanism for stalled/stuck cars (speed stays 0 for 3 seconds under throttle)
    if (controls.forward && Math.abs(car.speed) < 0.1) {
      if ((car as any).stuckSpeedZeroTimer === undefined) {
        (car as any).stuckSpeedZeroTimer = 0;
      }
      (car as any).stuckSpeedZeroTimer += dt;
      if ((car as any).stuckSpeedZeroTimer >= 3.0) {
        car.awake = true;
        car.mass = 1450;
        car.engineRunning = true;
        car.gear = 'D';
        controls.gear = 'D';
        controls.forward = true;
        controls.backward = false;
        
        // Immediate physical kick to reset constraints
        car.speed = 12.0;
        const forwardX = Math.sin(car.angle);
        const forwardZ = Math.cos(car.angle);
        car.velocity.x = forwardX * car.speed;
        car.velocity.z = forwardZ * car.speed;
        
        (car as any).stuckSpeedZeroTimer = 0;
      }
    } else {
      (car as any).stuckSpeedZeroTimer = 0;
    }

    const currentGear = controls.gear || 'D';
    
    // Write out live telemetry onto vehicle object for debug overlay and displays
    car.gear = currentGear;
    car.throttle = controls.forward ? 1.0 : 0.0;
    car.brake = controls.backward ? 1.0 : 0.0;
    car.steering = car.steerValue || 0;
    car.awake = true; // vehicle is active/awake
    car.mass = car.mass || 1450;
    car.engineRunning = true;

    const topSpeed = car.isNitroActive ? NITRO_BOOST_SPEED : MAX_SPEED;
    const accelRate = car.isNitroActive ? NITRO_BOOST_ACCEL : ACCELERATION;
    const speedRatio = Math.abs(car.speed) / topSpeed;

    // --- 1. TRANSMISSION TORQUE ENGINE & ACCELERATION ---
    if (currentGear === 'P') {
      car.speed = THREE.MathUtils.lerp(car.speed, 0, 15.0 * dt);
      if (Math.abs(car.speed) < 0.1) car.speed = 0;
    } 
    else if (currentGear === 'N') {
      if (car.speed > 0) {
        car.speed = Math.max(0, car.speed - DECELERATION * 0.5 * dt);
      } else if (car.speed < 0) {
        car.speed = Math.min(0, car.speed + DECELERATION * 0.5 * dt);
      }
    } 
    else if (currentGear === 'D') {
      if (controls.forward) {
        const torqueRatio = Math.max(0.35, Math.pow(1.0 - speedRatio, 0.7));
        car.speed += accelRate * torqueRatio * dt;
        if (car.speed > topSpeed) car.speed = topSpeed;
      } else if (controls.backward) {
        const brakeEfficiency = 1.0 + speedRatio * 0.5;
        car.speed -= BRAKING * brakeEfficiency * dt;
        if (car.speed < 0) car.speed = 0;
      } else {
        car.speed = Math.max(0, car.speed - DECELERATION * dt);
      }
    } 
    else if (currentGear === 'R') {
      if (controls.forward) {
        const reverseRatio = Math.max(0.4, 1.0 - (Math.abs(car.speed) / REVERSE_MAX_SPEED) * 0.45);
        car.speed -= ACCELERATION * 0.7 * reverseRatio * dt;
        if (car.speed < -REVERSE_MAX_SPEED) car.speed = -REVERSE_MAX_SPEED;
      } else if (controls.backward) {
        const brakeEfficiency = 1.0 + (Math.abs(car.speed) / REVERSE_MAX_SPEED) * 0.45;
        car.speed += BRAKING * brakeEfficiency * dt;
        if (car.speed > 0) car.speed = 0;
      } else {
        car.speed = Math.min(0, car.speed + DECELERATION * dt);
      }
    }

    if (controls.handbrake) {
      if (car.speed > 0) {
        car.speed = Math.max(0, car.speed - BRAKING * 0.85 * dt);
      } else if (car.speed < 0) {
        car.speed = Math.min(0, car.speed + BRAKING * 0.85 * dt);
      }
    }

    // --- 2. AERODYNAMIC AIR RESISTANCE ---
    const dragCoeff = 0.0016;
    const dragForce = (dragCoeff * car.speed * car.speed + 0.1) * dt;
    if (car.speed > 0) {
      car.speed = Math.max(0, car.speed - dragForce);
    } else if (car.speed < 0) {
      car.speed = Math.min(0, car.speed + dragForce);
    }

    // --- 3. NITRO ACCUMULATION ---
    if (!car.isNitroActive) {
      const isDriftBonus = (car.isDrifting && Math.abs(car.speed) > 22) ? 28 : 5;
      car.nitroCharged = Math.min(100, car.nitroCharged + isDriftBonus * dt);

      if (car.isAI && car.nitroCharged > 90 && Math.abs(car.speed) > topSpeed * 0.65 && Math.random() < 0.04) {
        car.isNitroActive = true;
      } else if (!car.isAI && controls.nitro && car.nitroCharged > 15) {
        car.isNitroActive = true;
      }
    }

    if (car.isNitroActive) {
      car.nitroCharged -= 28 * dt;
      if (car.nitroCharged <= 0) {
        car.nitroCharged = 0;
        car.isNitroActive = false;
      }
    }

    // --- 4. SPEED-SENSITIVE ANALOG STEERING & YAW ---
    const rawSteerInput = controls.steerValue !== undefined ? controls.steerValue : (controls.left ? 1 : (controls.right ? -1 : 0));
    const smoothFactor = Math.abs(rawSteerInput) > 0.01 ? 12.0 : 15.0;
    car.steerValue = THREE.MathUtils.lerp(car.steerValue || 0, rawSteerInput, smoothFactor * dt);

    const speedKmh = Math.abs(car.speed) * 3.6;
    const steerSpeedScale = 1.25 - Math.min(0.98, (speedKmh / 280) * 0.98);
    const driftSteerMultiplier = car.isDrifting ? 1.62 : 1.12;

    car.angularVelocity = STEER_SPEED * steerSpeedScale * driftSteerMultiplier * (car.steerValue || 0);

    const movementGripFactor = Math.min(1.0, Math.abs(car.speed) / 3.0);
    car.angle += car.angularVelocity * dt * (car.speed < 0 ? -movementGripFactor : movementGripFactor);

    // --- 5. PROGRESSIVE DRIFT CONTROLS, WEIGHT TRANSFER & GRIP ---
    const prevSpeedVal = (car as any)._prevSpeed !== undefined ? (car as any)._prevSpeed : car.speed;
    const longitudinalAccel = (car.speed - prevSpeedVal) / Math.max(0.001, dt);
    (car as any)._prevSpeed = car.speed;
    const weightTransferFrontRear = longitudinalAccel * 0.015;

    const isSteeringHard = Math.abs(car.steerValue || 0) > 0.25;
    const isBraking = controls.backward && car.speed > 12.0;
    const isSharpTurn = Math.abs(car.steerValue || 0) > 0.45;
    const minDriftThreshold = car.id.startsWith('traffic') ? 25 : 18;

    const wantsDrifting = controls.handbrake || (isSteeringHard && isBraking) || (isSharpTurn && Math.abs(car.speed) > minDriftThreshold);
    car.isDrifting = wantsDrifting && Math.abs(car.speed) > minDriftThreshold && currentGear !== 'P';

    car.driftFactor = THREE.MathUtils.lerp(car.driftFactor || 0, car.isDrifting ? 1 : 0, 7.5 * dt);

    let gripLoadFactor = 1.0;
    if (weightTransferFrontRear < -0.15) {
      gripLoadFactor *= 0.88;
    }
    const currentGrip = car.isDrifting ? DRIFT_GRIP : NORMAL_GRIP;
    const gripFactor = controls.handbrake ? currentGrip * 0.82 : currentGrip * gripLoadFactor;
    
    let activeGrip = THREE.MathUtils.lerp(NORMAL_GRIP, gripFactor, car.driftFactor);

    const fowardX = Math.sin(car.angle);
    const forwardZ = Math.cos(car.angle);

    const targetVelX = fowardX * car.speed;
    const targetVelZ = forwardZ * car.speed;

    car.velocity.x = car.velocity.x * activeGrip + targetVelX * (1 - activeGrip);
    car.velocity.z = car.velocity.z * activeGrip + targetVelZ * (1 - activeGrip);

    car.velocity.x *= FRICTION;
    car.velocity.z *= FRICTION;

    if (car.isDrifting) {
      const velHeading = Math.atan2(car.velocity.x, car.velocity.z);
      let slipAngle = velHeading - car.angle;
      while (slipAngle < -Math.PI) slipAngle += Math.PI * 2;
      while (slipAngle > Math.PI) slipAngle -= Math.PI * 2;

      const assistFactor = car.isAI ? 0.45 : 0.85;
      car.angle += slipAngle * assistFactor * dt;
    }

    car.position.x += car.velocity.x * dt;
    car.position.z += car.velocity.z * dt;

    // --- 5.1 ROAD GEOMETRY CHECKS & LIMITS ---
    const posCheckVal = GamePhysicsService._vecA.set(car.position.x, car.position.y, car.position.z);
    const checkTrackInfo = this.trackHelper.getNearestTrackInfo(posCheckVal, car.id);
    const currentRoadWidth = checkTrackInfo.width;

    const absoluteLimit = currentRoadWidth / 2 - 0.45;
    const sideSign = Math.sign(checkTrackInfo.sideOffset);

    const offRoadFactor = terrainManager.getOffRoadFactor(posCheckVal);
    if (offRoadFactor > 0.0) {
      
      car.speed *= (1.0 - 0.08 * offRoadFactor * dt * 60); 
      activeGrip *= (1.0 - offRoadFactor * 0.35); 
      car.angularVelocity *= (1.0 - offRoadFactor * 0.48); 

      if (Math.random() < 0.45 && Math.abs(car.speed) > 10) {
        this.spawnParticle(
          car.position.x, car.position.y + 0.1, car.position.z,
          (Math.random() * 4 - 2), 1 + Math.random() * 3, (Math.random() * 4 - 2),
          '#d2b48c',
          0.6 + Math.random() * 0.6,
          0.8 + Math.random() * 0.8
        );
      }

      const roadHeading = Math.atan2(checkTrackInfo.tangent.x, checkTrackInfo.tangent.z);
      const inwardsOffsetAngle = 0.42 * -sideSign; 
      let targetHeading = roadHeading + inwardsOffsetAngle;
      
      let headingDiff = targetHeading - car.angle;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      
      const steerBackStrength = car.isAI ? 5.5 : 3.2;
      car.angle += headingDiff * steerBackStrength * offRoadFactor * dt;
      
      const inwardImpulse = (car.isAI ? 18.0 : 12.0) * offRoadFactor * dt;
      car.velocity.x += -checkTrackInfo.normal.x * sideSign * inwardImpulse;
      car.velocity.z += -checkTrackInfo.normal.z * sideSign * inwardImpulse;
    }

    if (Math.abs(checkTrackInfo.sideOffset) > absoluteLimit) {
      car.position.x = checkTrackInfo.nearestPoint.x + checkTrackInfo.normal.x * absoluteLimit * sideSign;
      car.position.z = checkTrackInfo.nearestPoint.z + checkTrackInfo.normal.z * absoluteLimit * sideSign;
      
      const velVec = MemoryPool.getVector().set(car.velocity.x, 0, car.velocity.z);
      const boundaryNormal = MemoryPool.getVector().set(checkTrackInfo.normal.x, 0, checkTrackInfo.normal.z).multiplyScalar(sideSign);
      
      const speedAlongBnyNormal = velVec.dot(boundaryNormal);
      if (speedAlongBnyNormal > 0) {
        velVec.addScaledVector(boundaryNormal, -1.25 * speedAlongBnyNormal);
        car.velocity.x = velVec.x;
        car.velocity.z = velVec.z;
        car.speed *= 0.82;
      }

      if (Math.random() < 0.40 && Math.abs(car.speed) > 15) {
        this.spawnParticle(
          car.position.x, car.position.y + 0.2, car.position.z,
          -checkTrackInfo.normal.x * sideSign * (4 + Math.random() * 8), 2 + Math.random() * 5, -checkTrackInfo.normal.z * sideSign * (4 + Math.random() * 8),
          '#ffa200', 0.18, 1.6, false, true
        );
      }
    }

    const crashLimit = currentRoadWidth / 2 + 1.6;
    if (Math.abs(checkTrackInfo.sideOffset) > crashLimit) {
      this.recoverCarToNearestCheckpoint(car);
    }

    // --- 6. VERTICAL SUSPENSION, DOWNFORCE & GRAVITY CLIENT ---
    const pos3 = GamePhysicsService._vecA.set(car.position.x, car.position.y, car.position.z);
    const trackInfo = this.trackHelper.getNearestTrackInfo(pos3, car.id);
    
    // TerrainManager is the ONLY owner of road height
    const targetRoadY = terrainManager.getRoadHeight(pos3, car.lastValidY);
    if (Number.isFinite(targetRoadY)) {
      car.lastValidY = targetRoadY;
    }

    // Use smooth interpolation to avoid sudden Y jumps or teleportation,
    // and keep wheels firmly attached and glued to the road
    const smoothLerpYFactor = car.isAI ? 35.0 : 25.0;
    car.position.y = THREE.MathUtils.lerp(car.position.y, targetRoadY, smoothLerpYFactor * dt);

    const downforceY = -0.022 * car.speed * car.speed;

    if (car.position.y <= targetRoadY + 0.15) {
      const springK = 250.0;
      const dampC = 20.0;
      const accelY = (targetRoadY - car.position.y) * springK - dampC * car.velocity.y + downforceY;
      car.velocity.y += accelY * dt;
    } else {
      const gravity = 28.0;
      car.velocity.y += (-gravity + downforceY * 0.5) * dt;
    }

    // Clamp vertical velocity to prevent insane launching, floating or hovering
    car.velocity.y = THREE.MathUtils.clamp(car.velocity.y, -25.0, 25.0);
    car.position.y += car.velocity.y * dt;

    if (car.position.y < targetRoadY) {
      car.position.y = targetRoadY;
      car.velocity.y = Math.max(0, car.velocity.y);
    }

    const currentMaxSpeedCap = car.isNitroActive ? NITRO_BOOST_SPEED : MAX_SPEED;
    car.speed = THREE.MathUtils.clamp(car.speed, -REVERSE_MAX_SPEED, currentMaxSpeedCap);

    const speedMag = Math.sqrt(car.velocity.x * car.velocity.x + car.velocity.z * car.velocity.z);
    if (speedMag > currentMaxSpeedCap) {
      const scale = currentMaxSpeedCap / speedMag;
      car.velocity.x *= scale;
      car.velocity.z *= scale;
    }
    
    car.angularVelocity = THREE.MathUtils.clamp(car.angularVelocity, -STEER_SPEED * 1.5, STEER_SPEED * 1.5);

    CarCollisionSystem.resolveWallCollision(
      car,
      trackInfo,
      this.spawnParticle.bind(this),
      dt
    );

    this.updateRaceChecking(car, trackInfo.progress, pos3);
  }

  private updateRaceChecking(car: CarState, progress: number, pos3: THREE.Vector3) {
    let prevProgress = this.carProgressHistory.get(car.id);
    if (prevProgress === undefined) {
      prevProgress = progress;
    }
    this.carProgressHistory.set(car.id, progress);

    const chpts = this.trackHelper.checkpoints;
    const numCheckpoints = chpts.length;
    car.currentCheckpointIndex = Math.min(numCheckpoints - 1, Math.floor(progress * numCheckpoints));

    if (car.currentCheckpointIndex > 10 && car.currentCheckpointIndex < 20) {
      this.carHasPassedMidpoint.set(car.id, true);
    }

    if (prevProgress > 0.82 && progress < 0.18) {
      const hasPassedMid = this.carHasPassedMidpoint.get(car.id) || false;
      if (hasPassedMid) {
        if (!car.isFinished) {
          if (car.currentLap === 3) {
            car.isFinished = true;
          } else {
            car.currentLap += 1;
            this.carHasPassedMidpoint.set(car.id, false);
          }
        }
      }
    }

    const nextChptIndex = (car.currentCheckpointIndex + 1) % numCheckpoints;
    const nextChpt = chpts[nextChptIndex];

    if (nextChpt && nextChpt.position) {
      const chptPos = GamePhysicsService._vecB.set(nextChpt.position.x, nextChpt.position.y, nextChpt.position.z);
      if (pos3 && typeof pos3.distanceTo === 'function' && chptPos && typeof chptPos.distanceToSquared === 'function') {
        car.distanceToNextCheckpoint = pos3.distanceTo(chptPos);
      } else {
        car.distanceToNextCheckpoint = 999;
      }
    } else {
      car.distanceToNextCheckpoint = 999;
    }

    const trackLength = this.trackHelper.length || 4150.0;
    let displayProgress = progress;
    if (car.currentLap === 1 && progress > 0.82) {
      displayProgress = progress - 1.0;
    }
    car.totalDistanceTraveled = (car.currentLap - 1) * trackLength + displayProgress * trackLength;
  }

  public generateExhaustParticles(car: CarState, dt: number) {
    if (car.speed === 0) return;

    const angleBack = car.angle + Math.PI;
    const backOffsetX = Math.sin(angleBack) * 2.2;
    const backOffsetZ = Math.cos(angleBack) * 2.2;
    const exLY = car.position.y + 0.12;

    const nx = -backOffsetZ;
    const nz = backOffsetX;
    const nLen = Math.sqrt(nx*nx + nz*nz);
    const ux = nLen > 0 ? nx/nLen : 0;
    const uz = nLen > 0 ? nz/nLen : 0;

    const exLX = car.position.x + backOffsetX + ux * 0.72;
    const exLZ = car.position.z + backOffsetZ + uz * 0.72;
    const exRX = car.position.x + backOffsetX - ux * 0.72;
    const exRZ = car.position.z + backOffsetZ - uz * 0.72;

    if (car.isNitroActive) {
      for (let i = 0; i < 2; i++) {
        const vx = -Math.sin(car.angle) * 16 + (Math.random() * 2.5 - 1.25);
        const vy = 0.2 + Math.random() * 1.5;
        const vz = -Math.cos(car.angle) * 16 + (Math.random() * 2.5 - 1.25);

        const px = i === 0 ? exLX : exRX;
        const pz = i === 0 ? exLZ : exRZ;

        this.spawnParticle(
          px, exLY, pz,
          vx, vy, vz,
          Math.random() > 0.55 ? '#00eeff' : '#0048ff',
          0.38 + Math.random() * 0.22,
          4.8,
          true, false
        );
      }
    }

    if (car.isDrifting && Math.abs(car.speed) > 18) {
      for (let i = 0; i < 3; i++) {
        const vx = Math.random() * 4.2 - 2.1;
        const vy = 1.0 + Math.random() * 2.5;
        const vz = Math.random() * 4.2 - 2.1;

        const side = Math.random() > 0.5 ? 0.95 : -0.95;
        const px = car.position.x + ux * side;
        const pz = car.position.z + uz * side;

        this.spawnParticle(
          px, car.position.y + 0.1, pz,
          vx, vy, vz,
          '#e2e6eb',
          0.72 + Math.random() * 0.68,
          0.75 + Math.random() * 0.65,
          false, false
        );
      }
    }
  }

  public updateParticles(dt: number) {
    particleSystem.update(dt);
  }

  public resolveCarCollisions(cars: CarState[]) {
    CarCollisionSystem.resolveVehicleCollisions(cars, this.spawnParticle.bind(this));
  }

  public evaluatePositionsRanks(cars: CarState[]) {
    this.resolveCarCollisions(cars);

    const sorted = [...cars].sort((a, b) => {
      if (a.isFinished && !b.isFinished) return -1;
      if (!a.isFinished && b.isFinished) return 1;
      return b.totalDistanceTraveled - a.totalDistanceTraveled;
    });

    for (let i = 0; i < sorted.length; i++) {
      const idx = cars.findIndex(c => c.id === sorted[i].id);
      if (idx !== -1) {
        cars[idx].racePosition = i + 1;
      }
    }
  }
}

export const GamePhysics = GamePhysicsService;
