import { Scene, Color3, Vector3 } from "@babylonjs/core";
import { Character, CharacterState } from "./Character";

export type AIMode = "STAND" | "CROUCH" | "BLOCK" | "DEFEND" | "OFFENSE";

export class AI extends Character {
    private target: Character | null = null;
    private attackCooldown: boolean = false;
    private behaviorMode: AIMode = "STAND";
    private actionTimer: number = 0;
    private currentDecision: "MOVE_FWD" | "MOVE_BWD" | "SIDESTEP" | "WAIT" | "ATTACK" = "WAIT";
    private sideStepDir: number = 1;

    constructor(scene: Scene) {
        super("ai", scene, new Color3(0.5, 0.5, 0.5)); // Grey cat
        this.mesh.position.x = 25;
    }

    public setTarget(target: Character): void { this.target = target; }
    public setMode(mode: AIMode): void { this.behaviorMode = mode; this.actionTimer = 0; }

    public update(deltaTime: number): void {
        if (this.state === CharacterState.KO || !this.target) return;
        const distance = Vector3.Distance(this.mesh.position, this.target.mesh.position);
        this.actionTimer -= deltaTime;
        switch (this.behaviorMode) {
            case "STAND": this.crouch(false); break;
            case "CROUCH": this.crouch(true); break;
            case "BLOCK": this.state = CharacterState.BLOCKING; break;
            case "DEFEND": this.updateDefendBehavior(distance, deltaTime); break;
            case "OFFENSE": this.updateOffenseBehavior(distance, deltaTime); break;
        }
        super.update(deltaTime);
    }

    private updateDefendBehavior(distance: number, deltaTime: number): void {
        if (distance < 4) {
            this.move(-1, 0, deltaTime);
            this.crouch(false);
        } else if (distance < 2) {
            this.crouch(true);
        } else {
            this.crouch(false);
            if (Math.random() < 0.01) this.move(0, Math.random() > 0.5 ? 1 : -1, deltaTime);
        }
    }

    private updateOffenseBehavior(distance: number, deltaTime: number): void {
        if (this.actionTimer <= 0) {
            if (distance > 3) {
                this.currentDecision = "MOVE_FWD";
                this.actionTimer = 0.5;
            } else {
                const rand = Math.random();
                if (rand < 0.4) { this.currentDecision = "ATTACK"; this.actionTimer = 0.3; }
                else if (rand < 0.6) { 
                    this.currentDecision = "SIDESTEP"; 
                    this.sideStepDir = Math.random() > 0.5 ? 1 : -1;
                    this.actionTimer = 0.6; 
                }
                else if (rand < 0.8) { this.currentDecision = "WAIT"; this.actionTimer = 0.4; }
                else { this.currentDecision = "MOVE_BWD"; this.actionTimer = 0.4; }
            }
        }
        if (this.currentDecision === "MOVE_FWD") this.move(1, 0, deltaTime);
        else if (this.currentDecision === "MOVE_BWD") this.move(-1, 0, deltaTime);
        else if (this.currentDecision === "SIDESTEP") this.move(0.1, this.sideStepDir, deltaTime);
        else if (this.currentDecision === "ATTACK" && !this.attackCooldown) this.attack();
    }

    public attack(): void {
        if (this.state === CharacterState.ATTACKING || this.state === CharacterState.JUMPING) return;
        this.state = CharacterState.ATTACKING;
        this.hasHitThisAttack = false;
        this.attackCooldown = true;
        this.playAttackAnimation();
        setTimeout(() => {
            this.state = CharacterState.IDLE;
            setTimeout(() => { this.attackCooldown = false; }, 600);
        }, 150);
    }
}
