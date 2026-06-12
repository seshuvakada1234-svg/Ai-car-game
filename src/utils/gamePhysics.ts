/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CarState, ControlsState, Checkpoint, Vector3D, Difficulty } from '../types';
import { TrackGeometryHelper } from './track';

// Arcade-optimized physics parameters matching Asphalt 8 or CarX Drift Racing styles
const MAX_SPEED = 78; // units/sec (~280 km/h)
const REVERSE_MAX_SPEED = 28; // units/sec (~100 km/h)
const ACCELERATION = 40; // snappy, smooth acceleration response
const DECELERATION = 10; // smooth rolling deceleration (engine drag)
const BRAKING = 62; // intense braking feedback
const STEER_SPEED = 2.8; // base steering speed in rad/sec
const FRICTION = 0.988; // low rolling drag friction
const DRIFT_GRIP = 0.91; // side slide factor during high angle drift
const NORMAL_GRIP = 0.982; // normal tire side friction (grips unless throwing the weight)
const NITRO_BOOST_SPEED = 108; // dynamic peak speeds (~388 km/h)
const NITRO_BOOST_ACCEL = 75; // explosive rocket launch nitro boost acceleration

export interface ParticleEffect {
  id: string;
  position: Vector3D;
  velocity: Vector3D;
  color: string;
  size: number;
  life: number; // 1 to 0
  decay: number;
}

export class GamePhysicsService {
  trackHelper: TrackGeometryHelper;
  particles: ParticleEffect[] = [];
  sparkCounter = 0;

  constructor(trackHelper: TrackGeometryHelper) {
    this.trackHelper = trackHelper;
  }

  // Create starting lineup arrangement with realistic spacing
  initializeCars(playerName: string, difficulty: Difficulty, playerCarColor: string): CarState[] {
    const aiColors = ['#ff003c', '#00f6ff', '#e100ff', '#ffac00', '#00ff3c'];
    const aiNames = ['Apex', 'Phantom', 'Nova', 'Blaze', 'Titan'];
    const result: CarState[] = [];

    // 1. Setup Player
    result.push({
      id: 'player',
      name: playerName || 'Player',
      isAI: false,
      color: playerCarColor || '#0062ff',
      position: { x: -6, y: 0.1, z: -15 }, // starting node lane grid offset
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
        position: { x: offsetX, y: 0.1, z: offsetZ },
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
        // Power curve: slightly less acceleration at higher speeds due to air resistance
        const powerRatio = Math.max(0.3, 1.0 - (Math.abs(car.speed) / topSpeed) * 0.5);
        car.speed += accelRate * powerRatio * dt;
        if (car.speed > topSpeed) car.speed = topSpeed;
      } else if (controls.backward) {
        // Pressing brake pedal decelerates strongly, with extra force at high speeds
        const speedFactorForBrake = 1.0 + (Math.abs(car.speed) / MAX_SPEED) * 0.5;
        car.speed -= BRAKING * speedFactorForBrake * dt;
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
        const powerRatio = Math.max(0.4, 1.0 - (Math.abs(car.speed) / REVERSE_MAX_SPEED) * 0.4);
        car.speed -= ACCELERATION * 0.7 * powerRatio * dt;
        if (car.speed < -REVERSE_MAX_SPEED) car.speed = -REVERSE_MAX_SPEED;
      } else if (controls.backward) {
        // Under Brake Pedal in R (mapped to controls.backward), brake backwards
        const speedFactorForBrake = 1.0 + (Math.abs(car.speed) / REVERSE_MAX_SPEED) * 0.4;
        car.speed += BRAKING * speedFactorForBrake * dt;
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

    // 2. Realistic Speed-Sensitive Steering with smooth damping and return-to-center force
    const RawSteer = controls.steerValue !== undefined ? controls.steerValue : (controls.left ? 1 : (controls.right ? -1 : 0));
    
    // Smoothly interpolate car's steering state (damping + return force)
    const steerSmoothingRate = Math.abs(RawSteer) > 0.01 ? 11.5 : 14.5;
    car.steerValue = THREE.MathUtils.lerp(car.steerValue || 0, RawSteer, steerSmoothingRate * dt);

    // Steering sensitivity decays nicely at extreme hyper speeds to simulate realistic understeer/high-speed heavy steering wheel
    const speedRatioPhys = Math.min(1.0, Math.abs(car.speed) / MAX_SPEED);
    const steerCorrection = Math.max(0.35, 1.0 - (speedRatioPhys * 0.45));
    
    // Drifting boosts steering rate and turns the car sharper (oversteer)
    const driftSteerMultiplier = car.isDrifting ? 1.65 : 1.1;

    car.angularVelocity = STEER_SPEED * steerCorrection * driftSteerMultiplier * (car.steerValue || 0);

    // Only allow steering when car is actually moving
    const driveMovementFactor = Math.min(1.0, Math.abs(car.speed) / 3.5);
    car.angle += car.angularVelocity * dt * (car.speed < 0 ? -driveMovementFactor : driveMovementFactor);

    // 3. Realistic Drift & Grip mechanics (Slip, Understeer vs Oversteer)
    // Drift is triggered by pressing Handbrake (DRIFT button) or aggressive steering at speed > 22
    const turningSharpness = Math.abs(car.steerValue || 0) > 0.58;
    car.isDrifting = (controls.handbrake !== undefined ? !!controls.handbrake : turningSharpness) && Math.abs(car.speed) > 22 && currentGear !== 'P';

    // Handbrake drift reduces side grip (rear tires slip) to create magnificent oversteer drift angles
    const baseGrip = car.isDrifting ? DRIFT_GRIP : NORMAL_GRIP;
    const currentGrip = controls.handbrake ? baseGrip * 0.94 : baseGrip;

    const forwardX = Math.sin(car.angle);
    const forwardZ = Math.cos(car.angle);

    const targetVelX = forwardX * car.speed;
    const targetVelZ = forwardZ * car.speed;

    // Weight Transfer & Inertia:
    // Blend current direct velocity components with steering vector using grip
    car.velocity.x = car.velocity.x * currentGrip + targetVelX * (1 - currentGrip);
    car.velocity.z = car.velocity.z * currentGrip + targetVelZ * (1 - currentGrip);

    // Lateral friction clamp
    car.velocity.x *= FRICTION;
    car.velocity.z *= FRICTION;

    // Move 3D coordinates based on integrated velocity calculations
    car.position.x += car.velocity.x * dt;
    car.position.z += car.velocity.z * dt;

    // Keep car securely on track (terrain clamping + bridge elevator)
    const pos3 = new THREE.Vector3(car.position.x, car.position.y, car.position.z);
    const trackInfo = this.trackHelper.getNearestTrackInfo(pos3);

    // Smooth climb heights aligned with spline path
    let roadY = trackInfo.nearestPoint.y + 0.12;
    const rType = this.trackHelper.getRoadTypeAt(trackInfo.progress);
    if (rType === 'bridge') {
      roadY += 0.22;
    }

    car.position.y += (roadY - car.position.y) * 14 * dt;

    // 4. Absolute Bulletproof ROAD BARRIER Constraints (Cannot clip or fall through cliffs!)
    const allowedOffset = trackInfo.width / 2 - 1.5; // car envelope safety padding
    if (Math.abs(trackInfo.sideOffset) > allowedOffset) {
      // Snap position perfectly back to guardrail boundary limit, making it physically impossible to clip out
      const sign = Math.sign(trackInfo.sideOffset);
      car.position.x = trackInfo.nearestPoint.x + trackInfo.normal.x * allowedOffset * sign;
      car.position.z = trackInfo.nearestPoint.z + trackInfo.normal.z * allowedOffset * sign;

      // Apply barrier collision elastic impact rebound
      car.speed *= 0.5; // sudden momentum loss
      car.velocity.x *= 0.5;
      car.velocity.z *= 0.5;

      // Spark feedback
      this.generateBoundarySparks(car.position, trackInfo.normal, sign);
    }

    // 5. Track Progression & Checkpoint registry
    this.updateRaceChecking(car, trackInfo.progress, pos3);
  }

  // Generates sparks when hitting barriers
  private generateBoundarySparks(carPos: Vector3D, normal: THREE.Vector3, pushSign: number) {
    this.sparkCounter++;
    if (this.sparkCounter % 2 !== 0) return;

    for (let i = 0; i < 3; i++) {
      const sparkVel = new THREE.Vector3(
        normal.x * -pushSign * (4 + Math.random() * 8) + (Math.random() * 3 - 1.5),
        2 + Math.random() * 5,
        normal.z * -pushSign * (4 + Math.random() * 8) + (Math.random() * 3 - 1.5)
      );

      this.particles.push({
        id: `spark_${Date.now()}_${Math.random()}`,
        position: { x: carPos.x, y: carPos.y + 0.3, z: carPos.z },
        velocity: { x: sparkVel.x, y: sparkVel.y, z: sparkVel.z },
        color: Math.random() > 0.4 ? '#ff7c00' : '#ffa600',
        size: 0.18 + Math.random() * 0.16,
        life: 1.0,
        decay: 1.8 + Math.random() * 2.2
      });
    }
  }

  // Continuous visual particles tick generator
  generateExhaustParticles(car: CarState, dt: number) {
    if (car.speed === 0) return;

    const angleBack = car.angle + Math.PI;
    const backOffsetX = Math.sin(angleBack) * 2.2;
    const backOffsetZ = Math.cos(angleBack) * 2.2;
    const exhaustL = new THREE.Vector3(car.position.x + backOffsetX, car.position.y + 0.12, car.position.z + backOffsetZ);

    const normalDir = new THREE.Vector3(-backOffsetZ, 0, backOffsetX).normalize();
    exhaustL.addScaledVector(normalDir, 0.72);
    const exhaustR = exhaustL.clone().addScaledVector(normalDir, -1.44);

    // 1. Hot Blue Rocket Nitro Flares particle simulation
    if (car.isNitroActive) {
      for (let i = 0; i < 2; i++) {
        const vel = new THREE.Vector3(
          -Math.sin(car.angle) * 16 + (Math.random() * 2.5 - 1.25),
          0.2 + Math.random() * 1.5,
          -Math.cos(car.angle) * 16 + (Math.random() * 2.5 - 1.25)
        );

        const source = i === 0 ? exhaustL : exhaustR;
        this.particles.push({
          id: `nitro_${Date.now()}_${Math.random()}`,
          position: { x: source.x, y: source.y, z: source.z },
          velocity: { x: vel.x, y: vel.y, z: vel.z },
          color: Math.random() > 0.55 ? '#00eeff' : '#0048ff',
          size: 0.38 + Math.random() * 0.22,
          life: 1.0,
          decay: 4.8
        });
      }
    }

    // 2. Thick Drift Tire Smoke and Dust Particles
    if (car.isDrifting && Math.abs(car.speed) > 18) {
      for (let i = 0; i < 5; i++) {
        const vel = new THREE.Vector3(
          Math.random() * 4.2 - 2.1,
          1.0 + Math.random() * 2.5,
          Math.random() * 4.2 - 2.1
        );

        const tirePos = new THREE.Vector3(car.position.x, car.position.y + 0.1, car.position.z);
        tirePos.addScaledVector(normalDir, (Math.random() > 0.5 ? 0.95 : -0.95));

        this.particles.push({
          id: `smoke_${Date.now()}_${Math.random()}`,
          position: { x: tirePos.x, y: tirePos.y, z: tirePos.z },
          velocity: { x: vel.x, y: vel.y, z: vel.z },
          color: '#e2e6eb', // thick white rubber smoke
          size: 0.72 + Math.random() * 0.68,
          life: 1.0,
          decay: 0.75 + Math.random() * 0.65
        });
      }
    }
  }

  // Update physical positions of sparks / smoke with air friction and gravity
  updateParticles(dt: number) {
    this.particles = this.particles.filter(p => {
      p.life -= p.decay * dt;
      if (p.life <= 0) return false;

      // apply air drag dampening
      p.velocity.x *= 0.95;
      p.velocity.y *= 0.95;
      p.velocity.z *= 0.95;

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;

      // apply falling weight gravity to metal spark embers
      if (p.color.includes('ff') && !p.id.includes('nitro')) {
        p.velocity.y -= 11.2 * dt;
      }
      return true;
    });
  }

  // Tracks checkpoints and computes integrated lap runs
  private updateRaceChecking(car: CarState, progress: number, pos3: THREE.Vector3) {
    const chpts = this.trackHelper.checkpoints;
    const targetIdx = car.currentCheckpointIndex;
    const currentTarget = chpts[targetIdx];
    
    const targetPos = new THREE.Vector3(
      currentTarget.position.x,
      currentTarget.position.y,
      currentTarget.position.z
    );

    const distToChpt = pos3.distanceTo(targetPos);
    car.distanceToNextCheckpoint = distToChpt;

    const crossDistance = currentTarget.width * 0.92;

    if (distToChpt < crossDistance) {
      car.currentCheckpointIndex = (targetIdx + 1) % chpts.length;
      
      // Lap complete
      if (car.currentCheckpointIndex === 0) {
        if (car.currentLap === 3) {
          car.isFinished = true;
          car.racePosition = 1; 
        } else {
          car.currentLap += 1;
        }
      }
    }

    // Precise continuous track analytical distance traveled
    const completedLaps = car.currentLap - 1;
    const completedCheckpoints = car.currentCheckpointIndex;
    car.totalDistanceTraveled = (completedLaps * chpts.length * 333) + (completedCheckpoints * 333) - distToChpt;
  }

  // Advanced AI Autopilot Logic (Overtaking, Racing Apex Line, Rubber-banding, Collision Dodge)
  updateAICar(car: CarState, dt: number, otherCars: CarState[]) {
    const pos3 = new THREE.Vector3(car.position.x, car.position.y, car.position.z);
    const trackInfo = this.trackHelper.getNearestTrackInfo(pos3);

    // 1. Dynamic Racing Line (Apex Seeking):
    // Normal curves have an optimal shortcut or "apex".
    // We scan track curve tangent offset shifts to guide the AI towards curve insides
    const uAhead = (trackInfo.progress + 0.046) % 1.0;
    const targetSplinePt = this.trackHelper.curve.getPointAt(uAhead);
    const tangentAhead = this.trackHelper.curve.getTangentAt(uAhead).normalize();
    const normalAhead = new THREE.Vector3(-tangentAhead.z, 0, tangentAhead.x).normalize();

    // Look ahead to evaluate curve sharp bends
    const currentTangent = trackInfo.tangent;
    const bendFactor = currentTangent.cross(tangentAhead).y; // measures curvature rate
    
    // Target lateral offset relative to road center to hit the racing apex
    // Bend pointing right (positive) -> seek inside left. Bend pointing left -> seek inside right.
    let racingLineOffset = -bendFactor * (trackInfo.width * 0.32);

    // 2. Obstacle Evasion & COLLISION AVOIDANCE:
    // Cast a cone to check if we are directly behind anyone of our peers
    let evasionSideOffset = 0;
    let decelerationWarning = false;

    for (const other of otherCars) {
      if (other.id === car.id) continue;

      const relativeVec = new THREE.Vector3(
        other.position.x - car.position.x,
        0,
        other.position.z - car.position.z
      );
      const distSq = relativeVec.lengthSq();

      if (distSq < 484) { // within 22 meters
        const forwardVector = new THREE.Vector3(Math.sin(car.angle), 0, Math.cos(car.angle));
        const sideVector = new THREE.Vector3(-Math.cos(car.angle), 0, Math.sin(car.angle));

        const forwardProjection = relativeVec.dot(forwardVector);
        if (forwardProjection > 0) { // standard front warning range
          const lateralProjection = relativeVec.dot(sideVector);
          if (Math.abs(lateralProjection) < 3.2) { // very narrow block path
            // Steer sideways out of their tail (Dynamic OVERTAKING maneuver)
            const dodgeSign = lateralProjection >= 0 ? -1 : 1;
            evasionSideOffset += dodgeSign * 4.5 * car.aiAggression;
            
            // if too close, brake to avoid crashing rear end
            if (distSq < 121) {
              decelerationWarning = true;
            }
          }
        }
      }
    }

    // Combine racing apex line with dynamic overtaking evasions
    const targetApexPoint = new THREE.Vector3().copy(targetSplinePt);
    const finalOffset = racingLineOffset + evasionSideOffset;
    targetApexPoint.addScaledVector(normalAhead, finalOffset);

    // 3. Autopilot Heading steering calculations
    const toApex = new THREE.Vector3().subVectors(targetApexPoint, pos3);
    const targetAngle = Math.atan2(toApex.x, toApex.z);

    let angleDiff = targetAngle - car.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    const thresholdSteer = 0.05;
    const aiControls: ControlsState = {
      forward: !decelerationWarning,
      backward: decelerationWarning,
      left: angleDiff > thresholdSteer,
      right: angleDiff < -thresholdSteer,
      nitro: false,
      gear: 'D',
    };

    // 4. RUBBER-BAND logic to guarantee competitive pacing
    const player = otherCars.find(c => c.id === 'player');
    let rubberBandFactor = 1.0;
    
    if (player) {
      const distanceDelta = car.totalDistanceTraveled - player.totalDistanceTraveled;
      
      if (distanceDelta > 150) {
        // AI is dominating, throttle down significantly to let player catch up
        rubberBandFactor = 0.82;
      } else if (distanceDelta > 60) {
        // AI is slightly leading
        rubberBandFactor = 0.90;
      } else if (distanceDelta < -150) {
        // AI is lagging far trailing player, boost its engine performance snappily
        rubberBandFactor = 1.25;
      } else if (distanceDelta < -60) {
        // AI is trailing
        rubberBandFactor = 1.12;
      }
    }

    // Curvature deceleration rules
    const rType = this.trackHelper.getRoadTypeAt(trackInfo.progress);
    let targetCruiseSpeed = MAX_SPEED * car.aiSpeedFactor * rubberBandFactor;

    if (rType === 'hairpin') {
      targetCruiseSpeed = MAX_SPEED * 0.42; // brake heavily on hairpin bends
      if (Math.abs(angleDiff) > 0.45) {
        aiControls.forward = false;
        aiControls.backward = true; // heavy physical brakes
      }
    } else if (rType === 'normal' && Math.abs(bendFactor) > 0.08) {
      targetCruiseSpeed = MAX_SPEED * 0.72; // light throttle release
    }

    // Activate AI nitro strategically
    if (Math.abs(angleDiff) < 0.12 && rType === 'straight' && car.speed > 35 && car.nitroCharged > 30) {
      aiControls.nitro = true;
    }

    if (car.speed > targetCruiseSpeed) {
      aiControls.forward = false;
    }

    // 5. STUCK / RECOVERY intelligence after crash blocks
    if (Math.abs(car.speed) < 1.2) {
      car.stuckTimer += dt;
    } else {
      car.stuckTimer = 0;
    }

    if (car.stuckTimer > 2.0) {
      // Stuck autopilot: shifting gears to R, reversing and steering clear
      aiControls.forward = false;
      aiControls.backward = true;
      aiControls.left = angleDiff < 0;
      aiControls.right = angleDiff > 0;
      aiControls.gear = 'R';

      // Respawn fallback if wedged hard off-track
      if (car.stuckTimer > 4.5) {
        car.speed = 12;
        const trackAngle = Math.atan2(trackInfo.tangent.x, trackInfo.tangent.z);
        car.angle = trackAngle;
        car.position.x = trackInfo.nearestPoint.x;
        car.position.y = trackInfo.nearestPoint.y;
        car.position.z = trackInfo.nearestPoint.z;
        car.velocity = { x: trackInfo.tangent.x * 6, y: 0, z: trackInfo.tangent.z * 6 };
        car.stuckTimer = 0;
      }
    }

    this.updateCar(car, dt, aiControls, false);
  }

  // Live standings leaderboard evaluator
  evaluatePositionsRanks(cars: CarState[]) {
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
