import { Scene, Color3, Vector3 } from "@babylonjs/core";
import { Character, CharacterState } from "./Character";

export type AIMode = "STAND" | "CROUCH" | "BLOCK" | "DEFEND" | "OFFENSE";

export class AI extends Character {
    private target: Character | null = null;
    private attackCooldown: boolean = false;
    private behaviorMode: AIMode = "OFFENSE";
    private actionTimer: number = 0;
    private currentDecision: "MOVE_FWD" | "MOVE_BWD" | "SIDESTEP" | "WAIT" | "ATTACK" | "BLOCK" | "ESCAPE_WATER" = "WAIT";
    private sideStepDir: number = 1;

    constructor(scene: Scene) {
        super("ai", scene, new Color3(0.5, 0.5, 0.5)); // Grey cat
        this.mesh.position.x = 25;
    }

    public setTarget(target: Character): void { this.target = target; }
    public setMode(mode: AIMode): void { this.behaviorMode = mode; this.actionTimer = 0; }

    public update(deltaTime: number): void {
        if (this.state === CharacterState.KO || !this.target) return;
        
        // Basic physics/state updates
        if (this.state === CharacterState.HIT || this.state === CharacterState.STUNNED || this.state === CharacterState.ROLLING) {
            super.update(deltaTime);
            return;
        }

        const distance = Vector3.Distance(this.mesh.position, this.target.mesh.position);
        this.actionTimer -= deltaTime;

        // 1. HIGH PRIORITY: Water Awareness
        const distFromCenter = Math.sqrt(this.mesh.position.x ** 2 + this.mesh.position.z ** 2);
        if (distFromCenter < 16 && this.mesh.position.y < -0.3) {
            this.currentDecision = "ESCAPE_WATER";
            this.actionTimer = 0.5;
        }

        // 2. HIGH PRIORITY: Counter-Attack Logic
        // If we just blocked and have a counter window, STRIKE!
        if (this.counterTimer > 0 && distance < 2.5 && !this.attackCooldown) {
            this.attack();
        }

        // 3. Reactive Blocking (Simulate reaction time)
        if (this.target.state === CharacterState.ATTACKING && distance < 3.5 && this.state !== CharacterState.ATTACKING) {
            if (Math.random() < 0.8) { // 80% block rate on reaction
                this.state = CharacterState.BLOCKING;
            }
        } else if (this.state === CharacterState.BLOCKING && this.target.state !== CharacterState.ATTACKING && this.behaviorMode !== "BLOCK") {
            this.state = CharacterState.IDLE;
        }

        // 4. Mode-based Behavior
        if (this.currentDecision === "ESCAPE_WATER") {
            this.handleEscapeWater(deltaTime);
        } else {
            switch (this.behaviorMode) {
                case "STAND": this.crouch(false); break;
                case "CROUCH": this.crouch(true); break;
                case "BLOCK": this.state = CharacterState.BLOCKING; break;
                case "DEFEND": this.updateDefendBehavior(distance, deltaTime); break;
                case "OFFENSE": this.updateOffenseBehavior(distance, deltaTime); break;
            }
        }

        super.update(deltaTime);
    }

    private handleEscapeWater(deltaTime: number): void {
        // Move directly away from center (0,0,0)
        const escapeDir = new Vector3(this.mesh.position.x, 0, this.mesh.position.z).normalize();
        this.mesh.position.addInPlace(escapeDir.scale(8 * deltaTime));
        if (this.isGrounded && Math.random() < 0.02) this.jump();
    }

    private updateDefendBehavior(distance: number, deltaTime: number): void {
        if (distance < 4) {
            // Circle and keep distance
            if (this.actionTimer <= 0) {
                this.sideStepDir = Math.random() > 0.5 ? 1 : -1;
                this.actionTimer = 0.8;
            }
            this.move(-0.5, this.sideStepDir * 0.8, deltaTime);
        } else if (distance > 8) {
            this.move(0.4, 0, deltaTime); // Close in slowly
        } else {
            // Idle/Tease
            if (this.actionTimer <= 0) {
                this.sideStepDir = Math.random() > 0.5 ? 1 : -1;
                this.actionTimer = 1.2;
            }
            this.move(0, this.sideStepDir * 0.4, deltaTime);
        }
    }

    private updateOffenseBehavior(distance: number, deltaTime: number): void {
        if (this.actionTimer <= 0) {
            if (distance > 5) {
                this.currentDecision = "MOVE_FWD";
                this.actionTimer = 1.0;
            } else if (distance < 2.0) {
                const rand = Math.random();
                if (rand < 0.7) {
                    this.currentDecision = "ATTACK";
                    this.actionTimer = 0.3;
                } else if (rand < 0.9) {
                    this.currentDecision = "SIDESTEP";
                    this.sideStepDir = Math.random() > 0.5 ? 1 : -1;
                    this.actionTimer = 0.4;
                } else {
                    this.currentDecision = "BLOCK"; // Baiting
                    this.actionTimer = 0.5;
                }
            } else {
                // Footsies range
                const rand = Math.random();
                if (rand < 0.5) {
                    this.currentDecision = "MOVE_FWD";
                    this.actionTimer = 0.4;
                } else if (rand < 0.8) {
                    this.currentDecision = "SIDESTEP";
                    this.sideStepDir = Math.random() > 0.5 ? 1 : -1;
                    this.actionTimer = 0.6;
                } else {
                    this.currentDecision = "MOVE_BWD"; // Bait
                    this.actionTimer = 0.3;
                }
            }
        }

        if (this.currentDecision === "MOVE_FWD") this.move(1, 0, deltaTime);
        else if (this.currentDecision === "MOVE_BWD") this.move(-1, 0, deltaTime);
        else if (this.currentDecision === "SIDESTEP") this.move(0.3, this.sideStepDir, deltaTime);
        else if (this.currentDecision === "BLOCK") this.state = CharacterState.BLOCKING;
        else if (this.currentDecision === "ATTACK" && !this.attackCooldown) this.attack();
    }

    public attack(): void {
        if (this.state === CharacterState.KO || this.state === CharacterState.ROLLING) return;
        
        this.state = CharacterState.ATTACKING;
        this.hasHitThisAttack = false;
        this.attackCooldown = true;
        this.playAttackAnimation();
        
        setTimeout(() => {
            if (this.state === CharacterState.ATTACKING) this.state = CharacterState.IDLE;
            // Shorter cooldown if it was a counter
            const cooldown = this.counterTimer > 0 ? 300 : (400 + Math.random() * 400);
            setTimeout(() => { this.attackCooldown = false; }, cooldown);
        }, 150);
    }
}
