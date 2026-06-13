/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CarState, ControlsState, Checkpoint, Vector3D, Difficulty } from '../types';
import { TrackGeometryHelper } from './track';
import { particleSystem } from '../world/particleSystem';
import { SuspensionSystem, SuspensionState } from './suspension';
import { CarCollisionSystem } from './carCollision';
import { TrafficAIService } from './trafficAI';

// Constant physical constraints matching hypercar simulator performance
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
  
  // Traffic management service delegation
  private trafficAIService: TrafficAIService;

  // Track progress history for exact lap counting
  private carProgressHistory = new Map<string, number>();
  private carHasPassedMidpoint = new Map<string, boolean>();

  // Zero-allocation vector caches
  private static readonly _vecA = new THREE.Vector3();
  private static readonly _vecB = new THREE.Vector3();
  private static readonly _vecC = new THREE.Vector3();

  constructor(trackHelper: TrackGeometryHelper) {
    this.trackHelper = trackHelper;
    this.trafficAIService = new TrafficAIService(trackHelper);
  }

  /**
   * Spawns physical particles into the world environment
   */
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

  /**
   * Initialises the active lineup of opponents, the player, and dense commuter traffic
   */
  public initializeCars(playerName: string, difficulty: Difficulty, playerCarColor: string): CarState[] {
    const aiColors = ['#ff003c', '#00f6ff', '#e100ff', '#ffac00', '#00ff3c'];
    const aiNames = ['Apex', 'Phantom', 'Nova', 'Blaze', 'Titan'];
    const result: CarState[] = [];

    this.carProgressHistory.clear();
    this.carHasPassedMidpoint.clear();

    // 1. Setup Player Racer
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
      position: { x: playerSpawnX, y: playerSpawnY, z: playerSpawnZ },
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

    // 2. Setup 5 Grid AI Competitors
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
        aggression = 0.72;
      } else if (difficulty === 'hard') {
        speedFactor = 1.06;
        aggression = 0.95;
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
        aiSpeedFactor: speedFactor + (Math.random() * 0.04 - 0.02),
        aiAggression: aggression,
        stuckTimer: 0,
      });
    }

    // 3. Delegate dense commute traffic spawning to TrafficAIService (Spawns 32 coherent vehicles)
    const trafficLineup = this.trafficAIService.generateTrafficLineup();
    result.push(...trafficLineup);

    console.log(`Successfully initialized a total of ${result.length} vehicles (1 player, 5 AI rivals, 32 traffic cars).`);
    return result;
  }

  /**
   * Evaluates the physical dynamics (acceleration, brakes, drift, downforce, gravity) for a vehicle state
   */
  public updateCar(car: CarState, dt: number, controls: ControlsState, isLocked: boolean) {
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

    const currentGear = controls.gear || 'D';
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
        // Torque curve imitating mechanical transmission ratios (less pull at top extremes)
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
      if (controls.forward) { // under accelerator in Reverse
        const reverseRatio = Math.max(0.4, 1.0 - (Math.abs(car.speed) / REVERSE_MAX_SPEED) * 0.45);
        car.speed -= ACCELERATION * 0.7 * reverseRatio * dt;
        if (car.speed < -REVERSE_MAX_SPEED) car.speed = -REVERSE_MAX_SPEED;
      } else if (controls.backward) { // under brake in Reverse
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
    // Quad-drag fluid resistance (acts heavily above 200 km/h)
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

    // Steering speed decays at higher velocities to prevent spinouts on minor triggers
    const speedRatioPhys = Math.min(1.0, Math.abs(car.speed) / MAX_SPEED);
    const steerDamp = Math.max(0.32, 1.0 - (speedRatioPhys * 0.48));
    const driftSteerMultiplier = car.isDrifting ? 1.72 : 1.08;

    car.angularVelocity = STEER_SPEED * steerDamp * driftSteerMultiplier * (car.steerValue || 0);

    // Turn yaw angle only when vehicle is in motion
    const movementGripFactor = Math.min(1.0, Math.abs(car.speed) / 3.0);
    car.angle += car.angularVelocity * dt * (car.speed < 0 ? -movementGripFactor : movementGripFactor);

    // --- 5. DRIFT CONTROLS AND COUNTER-STEER STABILIZATION ---
    const isSharpTurn = Math.abs(car.steerValue || 0) > 0.45;
    const minDriftThreshold = car.id.startsWith('traffic') ? 25 : 18;
    const wantsDrifting = controls.handbrake || (isSharpTurn && Math.abs(car.speed) > minDriftThreshold);
    car.isDrifting = wantsDrifting && Math.abs(car.speed) > minDriftThreshold && currentGear !== 'P';

    car.driftFactor = THREE.MathUtils.lerp(car.driftFactor || 0, car.isDrifting ? 1 : 0, 7.5 * dt);
    const currentGrip = car.isDrifting ? DRIFT_GRIP : NORMAL_GRIP;
    const gripFactor = controls.handbrake ? currentGrip * 0.90 : currentGrip;
    
    const activeGrip = THREE.MathUtils.lerp(NORMAL_GRIP, gripFactor, car.driftFactor);

    // Facing angles
    const fowardX = Math.sin(car.angle);
    const forwardZ = Math.cos(car.angle);

    const targetVelX = fowardX * car.speed;
    const targetVelZ = forwardZ * car.speed;

    // Settle lateral slipping forces based on tire grip friction coefficients
    car.velocity.x = car.velocity.x * activeGrip + targetVelX * (1 - activeGrip);
    car.velocity.z = car.velocity.z * activeGrip + targetVelZ * (1 - activeGrip);

    car.velocity.x *= FRICTION;
    car.velocity.z *= FRICTION;

    // counter-steering assistance (helps maintain drift control, preventing random spins)
    if (car.isDrifting) {
      const velHeading = Math.atan2(car.velocity.x, car.velocity.z);
      let slipAngle = velHeading - car.angle;
      while (slipAngle < -Math.PI) slipAngle += Math.PI * 2;
      while (slipAngle > Math.PI) slipAngle -= Math.PI * 2;

      const assistFactor = car.isAI ? 0.45 : 0.85;
      car.angle += slipAngle * assistFactor * dt;
    }

    // Integrate positions
    car.position.x += car.velocity.x * dt;
    car.position.z += car.velocity.z * dt;

    // --- 6. VERTICAL SUSPENSION, DOWNFORCE & GRAVITY CLAMPING ---
    const pos3 = GamePhysicsService._vecA.set(car.position.x, car.position.y, car.position.z);
    const trackInfo = this.trackHelper.getNearestTrackInfo(pos3, car.id);
    const groundHeight = trackInfo.nearestPoint.y;
    const roadY = groundHeight + 0.05;

    // Realistic Downforce keeps cars grounded at high velocity (eliminates bouncing/air logs)
    // F_downforce = 1.2 * v^2
    const downforceY = car.speed > 25 ? -Math.min(30, 0.006 * car.speed * car.speed) : 0;

    // Vertical physics integration
    if (car.position.y <= roadY + 0.08) {
      const compressionDepth = roadY - car.position.y;
      if (compressionDepth > 0) {
        car.position.y = roadY;
        if (car.velocity.y < 0) car.velocity.y = 0;
      }
      
      // Spring elastic force (Hooke's spring-damper representation)
      const springK = 22.0;
      car.velocity.y += (roadY - car.position.y) * springK + downforceY * dt;
      car.velocity.y *= 0.78; // critical dampening friction factor
    } else {
      // Airborne gravity
      const gravity = 24.0;
      car.velocity.y += (-gravity + downforceY) * dt;
      if (car.velocity.y < -45) car.velocity.y = -45; // terminal velocity limit
    }

    car.position.y += car.velocity.y * dt;

    // Secure bottom constraints to absolutely prevent sinking under bridges
    if (car.position.y < roadY) {
      car.position.y = roadY;
      car.velocity.y = 0;
    }

    // Strict ceiling constraint: eliminates extreme bounces or cars flying away
    if (car.position.y > roadY + 2.5) {
      car.position.y = roadY + 0.05;
      car.velocity.y = 0;
    }

    // --- 7. SOLID GUARDRAIL CONTACT RESOLUTONS ---
    CarCollisionSystem.resolveWallCollision(
      car,
      trackInfo,
      this.spawnParticle.bind(this),
      dt
    );

    // Progress updates
    this.updateRaceChecking(car, trackInfo.progress, pos3);
  }

  /**
   * Tracks progression, registring checkpoints and counting lap loops
   */
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

    // Crossing start/finish line checks
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

    // Calculate checkpoint distance
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

  /**
   * Generates exhaust emission smoke, tire smoke during drift and blue nitro trails
   */
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

  /**
   * Continuous particles update tick
   */
  public updateParticles(dt: number) {
    particleSystem.update(dt);
  }

  /**
   * Resolves vehicle-to-vehicle soft impact overrides
   */
  public resolveCarCollisions(cars: CarState[]) {
    CarCollisionSystem.resolveVehicleCollisions(cars, this.spawnParticle.bind(this));
  }

  /**
   * Process autopilot guidance for competitive AI rivals and commuter traffic vehicles
   */
  public updateAICar(car: CarState, dt: number, otherCars: CarState[]) {
    const isTraffic = car.id.startsWith('traffic');

    if (isTraffic) {
      // 1. COMMUTER TRAFFIC PILOT DIRECTION (Smooth lanes driving + braking safety controls)
      const commuterControls = this.trafficAIService.updateTrafficControl(car, dt, otherCars);
      this.updateCar(car, dt, commuterControls, false);
    } else {
      // 2. RIVALS COMPETITIVE AI autonavigation routine
      const pos3 = GamePhysicsService._vecA.set(car.position.x, car.position.y, car.position.z);
      const trackInfo = this.trackHelper.getNearestTrackInfo(pos3, car.id);

      // Speed sensitive target lookahead progress index
      const speedKmh = Math.abs(car.speed) * 3.6;
      const lookaheadU = 0.016 + Math.min(0.045, (speedKmh / 300) * 0.04);
      const targetU = (trackInfo.progress + lookaheadU) % 1.0;

      const targetSplinePt = this.trackHelper.curve.getPointAt(targetU);
      const tangentAhead = this.trackHelper.curve.getTangentAt(targetU).normalize();
      const normalAhead = GamePhysicsService._vecC.set(-tangentAhead.z, 0, tangentAhead.x).normalize();

      const currentTangent = trackInfo.tangent;
      const bendFactor = currentTangent.cross(tangentAhead).y;

      // Inside apex shortcuts targeting
      let racingLineOffset = -bendFactor * (trackInfo.width * 0.35);
      racingLineOffset = THREE.MathUtils.clamp(racingLineOffset, -trackInfo.width * 0.38, trackInfo.width * 0.38);

      // Collision avoiding & active overtaking swerving shifts
      let evasionSideOffset = 0;
      let decelerationWarning = false;

      otherCars.forEach(other => {
        if (other.id === car.id) return;

        const relX = other.position.x - car.position.x;
        const relZ = other.position.z - car.position.z;
        const distSq = relX * relX + relZ * relZ;

        if (distSq < 576) { // 24m proximity check
          const cosAngle = Math.cos(-car.angle);
          const sinAngle = Math.sin(-car.angle);
          const localX = relX * cosAngle - relZ * sinAngle;
          const localZ = relX * sinAngle + relZ * cosAngle;

          if (localZ > 0 && localZ < 18.0) { // threat block path
            if (Math.abs(localX) < 3.2) {
              const dodgeSign = localX >= 0 ? -1 : 1;
              evasionSideOffset += dodgeSign * 4.8 * car.aiAggression;
              if (localZ < 7.5) {
                decelerationWarning = true;
              }
            }
          }
        }
      });

      const targetApexPoint = GamePhysicsService._vecB.copy(targetSplinePt);
      const finalOffset = racingLineOffset + evasionSideOffset;
      targetApexPoint.addScaledVector(normalAhead, finalOffset);

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

      // Competitive rubber-banding targets
      const player = otherCars.find(c => c.id === 'player');
      let rubberBandFactor = 1.0;
      
      if (player) {
        const distanceDelta = car.totalDistanceTraveled - player.totalDistanceTraveled;
        if (distanceDelta > 150) {
          rubberBandFactor = 0.90;
        } else if (distanceDelta > 60) {
          rubberBandFactor = 0.94;
        } else if (distanceDelta < -150) {
          rubberBandFactor = 1.15;
        } else if (distanceDelta < -60) {
          rubberBandFactor = 1.11;
        }
      }

      const roadType = this.trackHelper.getRoadTypeAt(trackInfo.progress);
      let targetCruiseSpeed = MAX_SPEED * car.aiSpeedFactor * rubberBandFactor;

      if (roadType === 'hairpin') {
        targetCruiseSpeed = MAX_SPEED * 0.35;
        if (Math.abs(angleDiff) > 0.38) {
          aiControls.forward = false;
          aiControls.backward = true;
        }
      } else if (roadType === 'normal' && Math.abs(bendFactor) > 0.08) {
        targetCruiseSpeed = MAX_SPEED * 0.70;
      }

      // Straight speedway nitro activates
      if (Math.abs(angleDiff) < 0.12 && roadType === 'straight' && car.speed > 35 && car.nitroCharged > 32) {
        aiControls.nitro = true;
      }

      if (car.speed > targetCruiseSpeed) {
        aiControls.forward = false;
      }

      // Stuck recovery triggers
      if (Math.abs(car.speed) < 1.0) {
        car.stuckTimer += dt;
      } else {
        car.stuckTimer = 0;
      }

      if (car.stuckTimer > 1.5) {
        aiControls.forward = false;
        aiControls.backward = true;
        aiControls.gear = 'R';
        aiControls.left = angleDiff < 0;
        aiControls.right = angleDiff > 0;

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
  }

  /**
   * Sorts stand-by leaderboards mapping
   */
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
