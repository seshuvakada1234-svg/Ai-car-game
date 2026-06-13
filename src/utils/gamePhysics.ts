/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CarState, ControlsState, Checkpoint, Vector3D, Difficulty } from '../types';
import { TrackGeometryHelper } from './track';
import { SpatialGrid } from './spatialGrid';
import { particleSystem } from '../world/particleSystem';

// Arcade-optimized physics parameters matching Asphalt 8 or CarX Drift Racing styles
const MAX_SPEED = 78; // units/sec (~280 km/h)
const REVERSE_MAX_SPEED = 28; // units/sec (~100 km/h)
const ACCELERATION = 40; // snappy, smooth acceleration response
const DECELERATION = 10; // smooth rolling deceleration (engine drag)
const BRAKING = 62; // intense braking feedback
const STEER_SPEED = 2.8; // base steering speed in rad/sec
const FRICTION = 0.988; // low rolling drag friction
const DRIFT_GRIP = 0.88; // side slide factor during high angle drift
const NORMAL_GRIP = 0.982; // normal tire side friction (grips unless throwing the weight)
const NITRO_BOOST_SPEED = 108; // dynamic peak speeds (~388 km/h)
const NITRO_BOOST_ACCEL = 75; // explosive rocket launch nitro boost acceleration

export interface ParticleEffect {
  id?: string;
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: string;
  size: number;
  life: number; // 1 to 0
  decay: number;
  isNitro?: boolean;
  isSpark?: boolean;
}

export class GamePhysicsService {
  trackHelper: TrackGeometryHelper;
  sparkCounter = 0;

  // Track progress history for exact lap counting without checkpoints skip
  private carProgressHistory = new Map<string, number>();
  private carHasPassedMidpoint = new Map<string, boolean>();

  // Zero-allocation static scratchpads
  private static readonly _vecA = new THREE.Vector3();
  private static readonly _vecB = new THREE.Vector3();
  private static readonly _vecC = new THREE.Vector3();

  constructor(trackHelper: TrackGeometryHelper) {
    this.trackHelper = trackHelper;
  }

  spawnParticle(
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

  // Create starting lineup arrangement with realistic spacing
  initializeCars(playerName: string, difficulty: Difficulty, playerCarColor: string): CarState[] {
    const aiColors = ['#ff003c', '#00f6ff', '#e100ff', '#ffac00', '#00ff3c'];
    const aiNames = ['Apex', 'Phantom', 'Nova', 'Blaze', 'Titan'];
    const result: CarState[] = [];

    // Clear progress histories on re-init
    this.carProgressHistory.clear();
    this.carHasPassedMidpoint.clear();

    // 1. Setup Player
    const playerSpawnX = -6;
    const playerSpawnZ = -15;
    const tempP3 = new THREE.Vector3(playerSpawnX, 0, playerSpawnZ);
    const pTrackInfo = this.trackHelper.getNearestTrackInfo(tempP3);
    const pRoadHeight = pTrackInfo ? pTrackInfo.nearestPoint.y : 0;
    const playerSpawnY = pRoadHeight + 0.05;

    result.push({
      id: 'player',
      name: playerName || 'Player',
      isAI: false,
      color: playerCarColor || '#0062ff',
      position: { x: playerSpawnX, y: playerSpawnY, z: playerSpawnZ }, // starting node lane grid offset
      velocity: { x: 0, y: 0, z: 0 },
      speed: 0,
      angle: 0.15,
      angularVelocity: 0,
      driftFactor: 0,
      isDrifting: false,
      currentLap: 1,
      currentCheckpointIndex: 0,
      distanceToNextCheckpoint: 999,
      racePosition: 6,
      totalDistanceTraveled: -15,
      isFinished: false,
      lastActiveTime: Date.now(),
      nitroCharged: 60,
      isNitroActive: false,
      stuckTimer: 0,
      aiTargetNode: 0,
      aiSpeedFactor: 1,
      aiAggression: 0.5,
    });

    // 2. Setup 5 AI Challengers
    for (let i = 0; i < 5; i++) {
      const row = Math.floor(i / 2) + 1;
      const side = i % 2 === 0 ? 1 : -1;
      
      const offsetX = side * 7.5;
      const offsetZ = -row * 16 - 8;

      const tempR3 = new THREE.Vector3(offsetX, 0, offsetZ);
      const aiTrackInfo = this.trackHelper.getNearestTrackInfo(tempR3);
      const aiRoadHeight = aiTrackInfo ? aiTrackInfo.nearestPoint.y : 0;
      const aiSpawnY = aiRoadHeight + 0.05;

      let speedFactor = 0.88;
      let aggression = 0.45;
      if (difficulty === 'medium') {
        speedFactor = 0.98;
        aggression = 0.75;
      } else if (difficulty === 'hard') {
        speedFactor = 1.08;
        aggression = 0.98;
      }

      result.push({
        id: `ai_${aiNames[i].toLowerCase()}`,
        name: aiNames[i],
        isAI: true,
        color: aiColors[i],
        position: { x: offsetX, y: aiSpawnY, z: offsetZ },
        velocity: { x: 0, y: 0, z: 0 },
        speed: 0,
        angle: 0.15,
        angularVelocity: 0,
        driftFactor: 0,
        isDrifting: false,
        currentLap: 1,
        currentCheckpointIndex: 0,
        distanceToNextCheckpoint: 999,
        racePosition: i + 1,
        totalDistanceTraveled: offsetZ,
        isFinished: false,
        lastActiveTime: Date.now(),
        nitroCharged: 20 + i * 15,
        isNitroActive: false,
        difficulty,
        aiTargetNode: 0,
        aiSpeedFactor: speedFactor + (Math.random() * 0.05 - 0.025),
        aiAggression: aggression,
        stuckTimer: 0,
      });
    }

    // 3. Setup 4 Slower Traffic Obstacles (to preserve Asphalt 9 style near misses at 300+ km/h)
    const trafficColors = ['#f3f4f6', '#fbbf24', '#9ca3af', '#93c5fd']; // Silver, Yellow Taxi, Gray, Sky Blue
    const trafficNames = ['Commuter', 'Cab', 'Sedan', 'Commuter'];
    const trackLength = this.trackHelper.length || 4150.0;
    
    for (let t = 0; t < 4; t++) {
      const progress = 0.18 + t * 0.22;
      const pt = this.trackHelper.curve ? this.trackHelper.curve.getPointAt(progress) : new THREE.Vector3();
      const tangent = this.trackHelper.curve ? this.trackHelper.curve.getTangentAt(progress).normalize() : new THREE.Vector3(0, 0, 1);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      
      // Steady lane offsets
      const laneSide = t % 2 === 0 ? -4.5 : 4.5;
      const spawnPos = pt.clone().addScaledVector(normal, laneSide);
      const angle = Math.atan2(tangent.x, tangent.z);

      const trafficPos3 = new THREE.Vector3(spawnPos.x, 0, spawnPos.z);
      const trafficTrackInfo = this.trackHelper.getNearestTrackInfo(trafficPos3);
      const trafficRoadHeight = trafficTrackInfo ? trafficTrackInfo.nearestPoint.y : 0;
      const trafficSpawnY = trafficRoadHeight + 0.05;
      
      result.push({
        id: `traffic_${t}`,
        name: trafficNames[t],
        isAI: true,
        color: trafficColors[t],
        position: { x: spawnPos.x, y: trafficSpawnY, z: spawnPos.z },
        velocity: { x: tangent.x * 6, y: 0, z: tangent.z * 6 },
        speed: 22,
        angle: angle,
        angularVelocity: 0,
        driftFactor: 0,
        isDrifting: false,
        currentLap: 1,
        currentCheckpointIndex: 0,
        distanceToNextCheckpoint: 999,
        racePosition: 99,
        totalDistanceTraveled: progress * trackLength,
        isFinished: false,
        lastActiveTime: Date.now(),
        nitroCharged: 0,
        isNitroActive: false,
        aiTargetNode: Math.floor(progress * this.trackHelper.cachedPoints.length),
        aiSpeedFactor: 0.32,
        aiAggression: 0.1,
        stuckTimer: 0,
      });
    }

    return result;
  }

  // Master update tick for a vehicle
  updateCar(car: CarState, dt: number, controls: ControlsState, isLocked: boolean) {
    if (car.isFinished) {
      // decelerate elegantly
      car.speed *= 0.94;
      car.isNitroActive = false;
      car.velocity.x *= 0.94;
      car.velocity.z *= 0.94;
      return;
    }

    if (isLocked) {
      // hold cars on starting line
      car.speed = 0;
      car.velocity = { x: 0, y: 0, z: 0 };
      car.isNitroActive = false;
      return;
    }

    const currentGear = controls.gear || 'D';

    // 1. Process gears & smooth acceleration / braking curves
    const topSpeed = car.isNitroActive ? NITRO_BOOST_SPEED : MAX_SPEED;
    const accelRate = car.isNitroActive ? NITRO_BOOST_ACCEL : ACCELERATION;
    const speedRatio = Math.abs(car.speed) / topSpeed;

    if (currentGear === 'P') {
      // Locking park gear (immediate friction lock)
      car.speed = THREE.MathUtils.lerp(car.speed, 0, 16.0 * dt);
      if (Math.abs(car.speed) < 0.1) car.speed = 0;
    } 
    else if (currentGear === 'N') {
      // Free rolling neutral gear, only gradual friction decay
      if (car.speed > 0) {
        car.speed = Math.max(0, car.speed - DECELERATION * 0.6 * dt);
      } else if (car.speed < 0) {
        car.speed = Math.min(0, car.speed + DECELERATION * 0.6 * dt);
      }
    } 
    else if (currentGear === 'D') {
      // Drive mode
      if (controls.forward) {
        // Torque curve: higher gear pulls less at peak extremes, imitating mechanical cylinders
        const torqueRatio = Math.max(0.3, Math.pow(1.0 - speedRatio, 0.72));
        car.speed += accelRate * torqueRatio * dt;
        if (car.speed > topSpeed) car.speed = topSpeed;
      } else if (controls.backward) {
        // Pressing brake pedal decelerates strongly, with extra force at high speeds
        const brakeEfficiency = 1.0 + speedRatio * 0.45;
        car.speed -= BRAKING * brakeEfficiency * dt;
        if (car.speed < 0) car.speed = 0; // driving gear prevents reversing
      } else {
        // gradual rolling deceleration when throttle is released
        car.speed = Math.max(0, car.speed - DECELERATION * dt);
      }
    } 
    else if (currentGear === 'R') {
      // Reverse mode
      if (controls.forward) {
        // Under Gas Pedal in R gear (mapped to controls.forward), accelerate backward!
        const reverseRatio = Math.max(0.4, 1.0 - (Math.abs(car.speed) / REVERSE_MAX_SPEED) * 0.4);
        car.speed -= ACCELERATION * 0.7 * reverseRatio * dt;
        if (car.speed < -REVERSE_MAX_SPEED) car.speed = -REVERSE_MAX_SPEED;
      } else if (controls.backward) {
        // Under Brake pedal in R, stop the rear crawl
        const brakeEfficiency = 1.0 + (Math.abs(car.speed) / REVERSE_MAX_SPEED) * 0.4;
        car.speed += BRAKING * brakeEfficiency * dt;
        if (car.speed > 0) car.speed = 0; // reverse gear stops at zero
      } else {
        // gradual deceleration backwards
        car.speed = Math.min(0, car.speed + DECELERATION * dt);
      }
    }

    // Apply handbrake braking decay
    if (controls.handbrake) {
      if (car.speed > 0) {
        car.speed = Math.max(0, car.speed - BRAKING * 0.9 * dt);
      } else if (car.speed < 0) {
        car.speed = Math.min(0, car.speed + BRAKING * 0.9 * dt);
      }
    }

    // Aerodynamic and Rolling Resistance drag (fluid physical deceleration damping)
    if (car.speed > 0) {
      car.speed = Math.max(0, car.speed - (0.0018 * car.speed * car.speed + 0.12) * dt);
    } else if (car.speed < 0) {
      car.speed = Math.min(0, car.speed + (0.0018 * car.speed * car.speed + 0.12) * dt);
    }

    // Nitro charges slowly over time, fast charges during drifting
    if (!car.isNitroActive) {
      const isDriftBonus = (car.isDrifting && Math.abs(car.speed) > 22) ? 26 : 4;
      car.nitroCharged = Math.min(100, car.nitroCharged + isDriftBonus * dt);

      // Strategic AI boost trigger
      if (car.isAI && car.nitroCharged > 92 && Math.abs(car.speed) > topSpeed * 0.6 && Math.random() < 0.05) {
        car.isNitroActive = true;
      } else if (!car.isAI && controls.nitro && car.nitroCharged > 15) {
        car.isNitroActive = true;
      }
    }

    if (car.isNitroActive) {
      car.nitroCharged -= 28 * dt; // consume nitro
      if (car.nitroCharged <= 0) {
        car.nitroCharged = 0;
        car.isNitroActive = false;
      }
    }

    // 2. Speed-Sensitive Steering with realistic damping and return force
    const RawSteer = controls.steerValue !== undefined ? controls.steerValue : (controls.left ? 1 : (controls.right ? -1 : 0));
    const steerSmoothingRate = Math.abs(RawSteer) > 0.01 ? 11.5 : 14.5;
    car.steerValue = THREE.MathUtils.lerp(car.steerValue || 0, RawSteer, steerSmoothingRate * dt);

    // Steering sensitivity decays at hyper speed to prevent sudden high-frequency direct oscillation
    const speedRatioPhys = Math.min(1.0, Math.abs(car.speed) / MAX_SPEED);
    const steerCorrection = Math.max(0.35, 1.0 - (speedRatioPhys * 0.48));
    
    // Drifting boosts yaw rate (controlled oversteer slide angles)
    const driftSteerMultiplier = car.isDrifting ? 1.75 : 1.1;
    car.angularVelocity = STEER_SPEED * steerCorrection * driftSteerMultiplier * (car.steerValue || 0);

    // Only steer when vehicle is moving
    const driveMovementFactor = Math.min(1.0, Math.abs(car.speed) / 3.5);
    car.angle += car.angularVelocity * dt * (car.speed < 0 ? -driveMovementFactor : driveMovementFactor);

    // 3. Realistic Drift & Slip Mechanics (Slip Angles, Dynamic Side Grip)
    const turningSharpness = Math.abs(car.steerValue || 0) > 0.48;
    const speedThreshold = car.isAI ? 18 : 22;
    const wantsDrift = controls.handbrake || (turningSharpness && Math.abs(car.speed) > speedThreshold);
    car.isDrifting = wantsDrift && Math.abs(car.speed) > speedThreshold && currentGear !== 'P';

    // Linear slip interpolation
    const baseGrip = car.isDrifting ? DRIFT_GRIP : NORMAL_GRIP;
    const currentGrip = controls.handbrake ? baseGrip * 0.92 : baseGrip;

    car.driftFactor = THREE.MathUtils.lerp(car.driftFactor || 0, car.isDrifting ? 1 : 0, 8 * dt);
    const activeGrip = THREE.MathUtils.lerp(NORMAL_GRIP, currentGrip, car.driftFactor);

    // Facing directional components
    const forwardX = Math.sin(car.angle);
    const forwardZ = Math.cos(car.angle);

    const targetVelX = forwardX * car.speed;
    const targetVelZ = forwardZ * car.speed;

    // Weight Transfer G-Force: Inertia slides the car sideways relative to tire side friction
    car.velocity.x = car.velocity.x * activeGrip + targetVelX * (1 - activeGrip);
    car.velocity.z = car.velocity.z * activeGrip + targetVelZ * (1 - activeGrip);

    // Lateral drag
    car.velocity.x *= FRICTION;
    car.velocity.z *= FRICTION;

    // Apply Counter-Steering Assistance: Assist drift control to stabilize extreme slides (CarX style)
    if (car.isDrifting) {
      const velocityAngle = Math.atan2(car.velocity.x, car.velocity.z);
      let slipAngle = velocityAngle - car.angle;
      while (slipAngle < -Math.PI) slipAngle += Math.PI * 2;
      while (slipAngle > Math.PI) slipAngle -= Math.PI * 2;

      // Front wheels steer into the drift automatically to guide G-force direction
      const assistFactor = car.isAI ? 0.4 : 0.88;
      car.angle += slipAngle * assistFactor * dt;
    }

    // Update 3D positional integrals
    car.position.x += car.velocity.x * dt;
    car.position.z += car.velocity.z * dt;

    // Keep car securely on track (terrain clamping + bridge transitions)
    const pos3 = GamePhysicsService._vecA.set(car.position.x, car.position.y, car.position.z);
    const trackInfo = this.trackHelper.getNearestTrackInfo(pos3, car.id);

    // Exact spline altitude mapping
    const roadHeight = trackInfo.nearestPoint.y;
    let roadY = roadHeight + 0.05;

    // Advanced Vertical Suspension Engine (Gravity when airborne, spring-damper when grounded)
    if (car.position.y <= roadY + 0.05) {
      const depth = roadY - car.position.y;
      if (depth > 0) {
        car.position.y = roadY;
        if (car.velocity.y < 0) car.velocity.y = 0;
      }
      // Grounded suspension force tracking
      car.velocity.y += (roadY - car.position.y) * 18.0;
      car.velocity.y *= 0.82; // damping force
    } else {
      // Airborne gravity tracking
      car.velocity.y -= 22.0 * dt;
      if (car.velocity.y < -40) car.velocity.y = -40; // terminal velocity
    }

    car.position.y += car.velocity.y * dt;

    // Prevent sinking
    if (car.position.y < roadHeight + 0.05) {
      car.position.y = roadHeight + 0.05;
      car.velocity.y = 0;
    }

    // ANTI-FLOATING SAFETY
    if (car.position.y > roadHeight + 0.2) {
      car.position.y = roadHeight + 0.05;
    }

    // 4. Absolute Solid Guardrail Barrier Constraint (Ricochet Bouncing)
    const allowedOffset = trackInfo.width / 2 - 1.5;
    if (Math.abs(trackInfo.sideOffset) > allowedOffset) {
      const sign = Math.sign(trackInfo.sideOffset);

      // Instantly position back on boundary margin to avoid clipping or going off-world
      car.position.x = trackInfo.nearestPoint.x + trackInfo.normal.x * allowedOffset * sign;
      car.position.z = trackInfo.nearestPoint.z + trackInfo.normal.z * allowedOffset * sign;

      // Soft Elastic Ricochet Rebound opposite to boundary plane
      const velVec = GamePhysicsService._vecB.set(car.velocity.x, 0, car.velocity.z);
      const normalVec = GamePhysicsService._vecC.set(trackInfo.normal.x, 0, trackInfo.normal.z).multiplyScalar(sign);

      const vNormalDot = velVec.dot(normalVec);
      if (vNormalDot > 0) { // moving into the rail
        const restitution = 0.38; // Satisfying springy rebound
        velVec.addScaledVector(normalVec, -(1 + restitution) * vNormalDot);

        // Instant speed reduction from side contact
        car.speed *= Math.max(0.4, 1.0 - (vNormalDot / MAX_SPEED) * 0.42);

        car.velocity.x = velVec.x;
        car.velocity.z = velVec.z;
      }

      // Spark feedback
      this.generateBoundarySparks(car.position, trackInfo.normal, sign);
    }

    // 5. Track Progression & Checkpoint register
    this.updateRaceChecking(car, trackInfo.progress, pos3);
  }

  // Generates sparks when hitting barriers
  private generateBoundarySparks(carPos: Vector3D, normal: THREE.Vector3, pushSign: number) {
    this.sparkCounter++;
    if (this.sparkCounter % 2 !== 0) return;

    for (let i = 0; i < 3; i++) {
      const vx = normal.x * -pushSign * (4 + Math.random() * 8) + (Math.random() * 3 - 1.5);
      const vy = 2 + Math.random() * 5;
      const vz = normal.z * -pushSign * (4 + Math.random() * 8) + (Math.random() * 3 - 1.5);

      this.spawnParticle(
        carPos.x, carPos.y + 0.3, carPos.z,
        vx, vy, vz,
        Math.random() > 0.4 ? '#ff7c00' : '#ffa600',
        0.18 + Math.random() * 0.16,
        1.8 + Math.random() * 2.2,
        false, true
      );
    }
  }

  // Generates collision sparkles between cars
  private generateContactSparks(x: number, y: number, z: number, nx: number, nz: number) {
    for (let i = 0; i < 4; i++) {
      const vx = nx * (5 + Math.random() * 10) + (Math.random() * 4 - 2);
      const vy = 1.5 + Math.random() * 6;
      const vz = nz * (5 + Math.random() * 10) + (Math.random() * 4 - 2);

      this.spawnParticle(
        x, y, z,
        vx, vy, vz,
        Math.random() > 0.5 ? '#ffff00' : '#ffa200',
        0.2 + Math.random() * 0.2,
        1.5 + Math.random() * 2.0,
        false, true
      );
    }
  }

  // Continuous visual particles tick generator
  generateExhaustParticles(car: CarState, dt: number) {
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

    // 1. Hot Blue Rocket Nitro Flares particle simulation
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

    // 2. Thick Drift Tire Smoke and Dust Particles
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

  // Update physical positions of sparks / smoke with air friction and gravity
  updateParticles(dt: number) {
    particleSystem.update(dt);
  }

  // Bulletproof Continuous progress checkpoint and lap tracking
  private updateRaceChecking(car: CarState, progress: number, pos3: THREE.Vector3) {
    let prevProgress = this.carProgressHistory.get(car.id);
    if (prevProgress === undefined) {
      prevProgress = progress;
    }
    this.carProgressHistory.set(car.id, progress);

    const chpts = this.trackHelper.checkpoints;
    const numCheckpoints = chpts.length;
    car.currentCheckpointIndex = Math.min(numCheckpoints - 1, Math.floor(progress * numCheckpoints));

    // Tracks if vehicle has passed the midpoint region of the track (Checkpoints 10 to 20 out of 30)
    if (car.currentCheckpointIndex > 10 && car.currentCheckpointIndex < 20) {
      this.carHasPassedMidpoint.set(car.id, true);
    }

    // Watch for Start/Finish line crossing (forward direction checks)
    if (prevProgress > 0.82 && progress < 0.18) {
      const hasPassedMid = this.carHasPassedMidpoint.get(car.id) || false;
      if (hasPassedMid) {
        if (!car.isFinished) {
          if (car.currentLap === 3) {
            car.isFinished = true;
          } else {
            car.currentLap += 1;
            this.carHasPassedMidpoint.set(car.id, false); // reset for subsequent lap
          }
        }
      }
    }

    // Decollect checkpoint indexes on active progression mapping
    const nextChptIndex = (car.currentCheckpointIndex + 1) % numCheckpoints;
    const nextChpt = chpts[nextChptIndex];

    if (nextChpt && nextChpt.position) {
      const chptPos = GamePhysicsService._vecB.set(nextChpt.position.x, nextChpt.position.y, nextChpt.position.z);
      if (pos3 && typeof pos3.distanceTo === 'function') {
        car.distanceToNextCheckpoint = pos3.distanceTo(chptPos);
      } else {
        car.distanceToNextCheckpoint = 999;
      }
    } else {
      car.distanceToNextCheckpoint = 999;
    }

    // Continuous distance traveled matching actual spline length
    const trackLength = this.trackHelper.length || 4150.0;
    let displayProgress = progress;
    if (car.currentLap === 1 && progress > 0.82) {
      // Car is on the starting grid behind the start/finish line on lap 1
      displayProgress = progress - 1.0;
    }
    car.totalDistanceTraveled = (car.currentLap - 1) * trackLength + displayProgress * trackLength;
  }

  // Pairwise soft body vehicle on vehicle elastic collisions resolver
  resolveCarCollisions(cars: CarState[]) {
    const size = cars.length;
    const collisionRadius = 3.6; // bumper bounds overlap padding
    const radiusSq = collisionRadius * collisionRadius;

    // 1. Build spatial hash grid
    const grid = new SpatialGrid(22); // cell size 22m (around 6x car length)
    for (let i = 0; i < size; i++) {
      const a = cars[i];
      if (a && a.position && !a.isFinished) {
        grid.insert(a);
      }
    }

    // Track resolved pairs to avoid double-processing
    const resolvedPairs = new Set<string>();

    for (let i = 0; i < size; i++) {
      const a = cars[i];
      if (!a || !a.position || !a.velocity || a.isFinished) continue;

      const nearby = grid.getNearby(a);
      for (const b of nearby) {
        if (!b || !b.position || !b.velocity || b.isFinished) continue;

        // Order IDs consistently to prevent duplicate pair processing
        const pairId = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (resolvedPairs.has(pairId)) continue;
        resolvedPairs.add(pairId);

        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < radiusSq && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const overlap = collisionRadius - dist;

          // Unit direction vectors
          const nx = dx / dist;
          const nz = dz / dist;

          // Resolve overlap instantly dividing half-push to avoid sticking together
          const pushX = nx * overlap * 0.505;
          const pushZ = nz * overlap * 0.505;

          a.position.x -= pushX;
          a.position.z -= pushZ;
          b.position.x += pushX;
          b.position.z += pushZ;

          // Relative velocity difference components
          const rvx = b.velocity.x - a.velocity.x;
          const rvz = b.velocity.z - a.velocity.z;

          // Dot product along direction normal
          const velAlongNormal = rvx * nx + rvz * nz;

          if (velAlongNormal < 0) { // they are approaching each other
            const restitution = 0.55; // Satisfying spring bounce response
            const impulseScalar = -(1 + restitution) * velAlongNormal * 0.5;

            a.velocity.x -= impulseScalar * nx;
            a.velocity.z -= impulseScalar * nz;
            b.velocity.x += impulseScalar * nx;
            b.velocity.z += impulseScalar * nz;

            // Re-sync physical speeds matching impulse momentum transfers
            a.speed = Math.sign(a.speed) * Math.sqrt(a.velocity.x * a.velocity.x + a.velocity.z * a.velocity.z);
            b.speed = Math.sign(b.speed) * Math.sqrt(b.velocity.x * b.velocity.x + b.velocity.z * b.velocity.z);

            // Momentum friction loss
            a.speed *= 0.95;
            b.speed *= 0.95;

            // Spawn bright collision sparkles exactly at the contact midpoint
            const contactX = a.position.x + nx * (collisionRadius * 0.5);
            const contactY = (a.position.y + b.position.y) * 0.5 + 0.3;
            const contactZ = a.position.z + nz * (collisionRadius * 0.5);
            this.generateContactSparks(contactX, contactY, contactZ, nx, nz);
          }
        }
      }
    }
  }

  // Advanced AI Autopilot Logic (Overtaking, Racing Apex Line, Rubber-banding, Collision Dodge)
  updateAICar(car: CarState, dt: number, otherCars: CarState[]) {
    const pos3 = GamePhysicsService._vecA.set(car.position.x, car.position.y, car.position.z);
    const trackInfo = this.trackHelper.getNearestTrackInfo(pos3, car.id);

    // 1. Dynamic Lookahead Distance (Linked to speed: small on hairpins, far on straights)
    const speedKmh = Math.abs(car.speed) * 3.6;
    const lookaheadU = 0.016 + Math.min(0.045, (speedKmh / 300) * 0.04);
    const targetU = (trackInfo.progress + lookaheadU) % 1.0;

    const targetSplinePt = this.trackHelper.curve.getPointAt(targetU);
    const tangentAhead = this.trackHelper.curve.getTangentAt(targetU).normalize();
    const normalAhead = GamePhysicsService._vecC.set(-tangentAhead.z, 0, tangentAhead.x).normalize();

    // Curve sharpness (bend factor)
    const currentTangent = trackInfo.tangent;
    const bendFactor = currentTangent.cross(tangentAhead).y;

    // 2. Apex Seeking (Racing target offsets: seek curve inside shortcut)
    const isTraffic = car.id.startsWith('traffic');
    let racingLineOffset = 0;
    
    if (isTraffic) {
      // Traffic cars stay stable in their designated lanes (alternating sides based on ID)
      const laneIndex = parseInt(car.id.split('_')[1] || '0');
      racingLineOffset = laneIndex % 2 === 0 ? -4.5 : 4.5;
    } else {
      racingLineOffset = -bendFactor * (trackInfo.width * 0.35);
      racingLineOffset = THREE.MathUtils.clamp(racingLineOffset, -trackInfo.width * 0.38, trackInfo.width * 0.38);
    }

    // 3. Collision avoidance & Active Overtaking Lane shift
    let evasionSideOffset = 0;
    let decelerationWarning = false;

    otherCars.forEach(other => {
      if (other.id === car.id) return;

      const relX = other.position.x - car.position.x;
      const relY = other.position.y - car.position.y;
      const relZ = other.position.z - car.position.z;
      const distSq = relX * relX + relZ * relZ;

      if (distSq < 576) { // inside 24m hazard detection zone
        // Express in car's local coordinates
        const cosAngle = Math.cos(-car.angle);
        const sinAngle = Math.sin(-car.angle);
        const localX = relX * cosAngle - relZ * sinAngle;
        const localZ = relX * sinAngle + relZ * cosAngle;

        if (localZ > 0 && localZ < 18.0) { // directly in front obstacle
          if (Math.abs(localX) < 3.2) { // very narrow block path
            // Select dodge offset opposite to obstacle
            const dodgeSign = localX >= 0 ? -1 : 1;
            evasionSideOffset += dodgeSign * 4.8 * car.aiAggression;

            if (localZ < 7.5) { // danger zone deceleration trigger
              decelerationWarning = true;
            }
          }
        }
      }
    });

    // Combine racing line with dynamic evasive offsets
    const targetApexPoint = GamePhysicsService._vecB.copy(targetSplinePt);
    const finalOffset = racingLineOffset + (isTraffic ? 0 : evasionSideOffset); // traffic doesn't weave aggressively
    targetApexPoint.addScaledVector(normalAhead, finalOffset);

    // Dynamic autopilot steering angle target
    const toApexX = targetApexPoint.x - car.position.x;
    const toApexZ = targetApexPoint.z - car.position.z;
    const targetAngle = Math.atan2(toApexX, toApexZ);

    let angleDiff = targetAngle - car.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    const thresholdSteer = 0.055;
    const aiControls: ControlsState = {
      forward: !decelerationWarning,
      backward: decelerationWarning,
      left: angleDiff > thresholdSteer,
      right: angleDiff < -thresholdSteer,
      nitro: false,
      gear: 'D',
    };

    // 4. Rubber-banding Limits [0.90 to 1.15] (Match requested competitive pacing)
    const player = otherCars.find(c => c.id === 'player');
    let rubberBandFactor = 1.0;
    
    if (player && !isTraffic) {
      const distanceDelta = car.totalDistanceTraveled - player.totalDistanceTraveled;
      
      if (distanceDelta > 150) {
        // AI is dominating -> pull back
        rubberBandFactor = 0.90;
      } else if (distanceDelta > 60) {
        // AI is slightly leading
        rubberBandFactor = 0.94;
      } else if (distanceDelta < -150) {
        // Player leading far -> speed up AI
        rubberBandFactor = 1.15;
      } else if (distanceDelta < -60) {
        // Player leading
        rubberBandFactor = 1.11;
      }
    }

    // Dynamic hairpin / corner deceleration limits
    const rType = this.trackHelper.getRoadTypeAt(trackInfo.progress);
    let targetCruiseSpeed = MAX_SPEED * car.aiSpeedFactor * rubberBandFactor;

    if (isTraffic) {
      // Slower passive cruising target speed
      targetCruiseSpeed = 19.5 + (parseInt(car.id.split('_')[1] || '0') % 3) * 3.0; // Cruise steady (70-100 km/h)
    }

    if (rType === 'hairpin') {
      targetCruiseSpeed = isTraffic ? 15.0 : MAX_SPEED * 0.35; // Heavy braking for tight curves
      if (Math.abs(angleDiff) > 0.38) {
        aiControls.forward = false;
        aiControls.backward = true; // physical brake application
      }
    } else if (rType === 'normal' && Math.abs(bendFactor) > 0.08) {
      targetCruiseSpeed = isTraffic ? 18.0 : MAX_SPEED * 0.70; // Throttle release
    }

    // Strategic straightaway Nitro activation
    if (!isTraffic && Math.abs(angleDiff) < 0.12 && rType === 'straight' && car.speed > 35 && car.nitroCharged > 30) {
      aiControls.nitro = true;
    }

    if (car.speed > targetCruiseSpeed) {
      aiControls.forward = false;
    }

    // 5. STUCK / Respawn Recovery intelligence (Respawn after 5 seconds)
    if (Math.abs(car.speed) < 1.0) {
      car.stuckTimer += dt;
    } else {
      car.stuckTimer = 0;
    }

    if (car.stuckTimer > 1.5) {
      // Stuck: Shifting to reverse and steering away
      aiControls.forward = false;
      aiControls.backward = true;
      aiControls.gear = 'R';
      aiControls.left = angleDiff < 0;
      aiControls.right = angleDiff > 0;

      // Forced respawn on track center facing correct heading
      if (car.stuckTimer > 5.0) {
        car.speed = 15;
        car.angle = Math.atan2(trackInfo.tangent.x, trackInfo.tangent.z);
        car.position.x = trackInfo.nearestPoint.x;
        car.position.y = trackInfo.nearestPoint.y;
        car.position.z = trackInfo.nearestPoint.z;
        car.velocity.x = trackInfo.tangent.x * 5;
        car.velocity.z = trackInfo.tangent.z * 5;
        car.stuckTimer = 0;
      }
    }

    this.updateCar(car, dt, aiControls, false);
  }

  // Live standings leaderboard evaluator
  evaluatePositionsRanks(cars: CarState[]) {
    // Resolve pairwise car-to-car elastic responses first
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
