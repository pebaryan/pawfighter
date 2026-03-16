export class InputManager {
    private keys: { [key: string]: boolean } = {};
    private prevKeys: { [key: string]: boolean } = {};
    private gamepadIndices: (number | null)[] = [null, null]; // P1, P2
    
    // Virtual inputs for touch/UI
    private virtualInputs: { [playerIndex: number]: { [action: string]: boolean } } = {
        0: {},
        1: {}
    };

    constructor() {
        window.addEventListener("keydown", (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener("keyup", (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        const handleConnected = (gp: Gamepad) => {
            console.log("Gamepad connected at index %d: %s", gp.index, gp.id);
            if (this.gamepadIndices[0] === null) {
                this.gamepadIndices[0] = gp.index;
            } else if (this.gamepadIndices[1] === null) {
                this.gamepadIndices[1] = gp.index;
            }
        };

        window.addEventListener("gamepadconnected", (e) => handleConnected(e.gamepad));

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Gamepad disconnected from index %d", e.gamepad.index);
            if (this.gamepadIndices[0] === e.gamepad.index) this.gamepadIndices[0] = null;
            if (this.gamepadIndices[1] === e.gamepad.index) this.gamepadIndices[1] = null;
        });

        // Check for already connected gamepads
        const initialGamepads = navigator.getGamepads();
        for (const gp of initialGamepads) {
            if (gp) handleConnected(gp);
        }
    }

    public setVirtualInput(action: string, isPressed: boolean, playerIndex: number = 0): void {
        this.virtualInputs[playerIndex][action] = isPressed;
    }

    private getGamepad(playerIndex: number): Gamepad | null {
        const index = this.gamepadIndices[playerIndex];
        if (index === null) return null;
        const gamepads = navigator.getGamepads();
        return gamepads[index];
    }

    public getGamepadStatus(playerIndex: number): string {
        const gp = this.getGamepad(playerIndex);
        if (!gp) return "Disconnected";
        return `${gp.id.substring(0, 15)}...`;
    }

    public isPressed(action: string, playerIndex: number = 0): boolean {
        // Virtual Input check (highest priority for touch)
        if (this.virtualInputs[playerIndex][action]) return true;

        // Keyboard mapping
        if (playerIndex === 0) {
            switch(action) {
                case "left": if (this.keys["a"]) return true; break;
                case "right": if (this.keys["d"]) return true; break;
                case "up": if (this.keys["w"]) return true; break;
                case "down": if (this.keys["s"]) return true; break;
                case "stepLeft": if (this.keys["q"]) return true; break;
                case "stepRight": if (this.keys["e"]) return true; break;
                case "attack": if (this.keys[" "]) return true; break;
                case "pause": if (this.keys["escape"]) return true; break;
                case "restart": if (this.keys["enter"] || this.keys[" "]) return true; break;
            }
        } else {
            switch(action) {
                case "left": if (this.keys["j"]) return true; break;
                case "right": if (this.keys["l"]) return true; break;
                case "up": if (this.keys["i"]) return true; break;
                case "down": if (this.keys["k"]) return true; break;
                case "stepLeft": if (this.keys["u"]) return true; break;
                case "stepRight": if (this.keys["o"]) return true; break;
                case "attack": if (this.keys["enter"]) return true; break;
                case "restart": if (this.keys["enter"]) return true; break;
            }
        }

        // Gamepad mapping
        const gp = this.getGamepad(playerIndex);
        if (!gp) return false;

        const b = gp.buttons;
        const a = gp.axes;

        switch(action) {
            case "left": return (a[0] && a[0] < -0.5) || (b[14] && b[14].pressed);
            case "right": return (a[0] && a[0] > 0.5) || (b[15] && b[15].pressed);
            case "up": return (a[1] && a[1] < -0.5) || (b[12] && b[12].pressed);
            case "down": return (a[1] && a[1] > 0.5) || (b[13] && b[13].pressed);
            case "stepLeft": return b[6] && b[6].pressed; // LT
            case "stepRight": return b[7] && b[7].pressed; // RT
            case "attack": return (b[0] && b[0].pressed) || (b[2] && b[2].pressed); // A or X
            case "pause": return b[9] && b[9].pressed; // Start
            case "restart": return (b[0] && b[0].pressed) || (b[9] && b[9].pressed); // A or Start
        }

        return false;
    }

    public isJustPressed(action: string, playerIndex: number = 0): boolean {
        const currentlyPressed = this.isPressed(action, playerIndex);
        const wasPressed = this.prevKeys[action + "_" + playerIndex] || false;
        return currentlyPressed && !wasPressed;
    }

    public postUpdate(): void {
        const actions = ["pause", "restart", "attack", "up", "down", "left", "right"];
        for (const action of actions) {
            this.prevKeys[action + "_0"] = this.isPressed(action, 0);
            this.prevKeys[action + "_1"] = this.isPressed(action, 1);
        }
    }

    public getMovementDirection(playerIndex: number = 0): { x: number, y: number } {
        let x = 0;
        let y = 0;
        if (this.isPressed("left", playerIndex)) x -= 1;
        if (this.isPressed("right", playerIndex)) x += 1;
        if (this.isPressed("up", playerIndex)) y += 1;
        if (this.isPressed("down", playerIndex)) y -= 1;
        return { x, y };
    }

    public getSideStepDirection(playerIndex: number = 0): number {
        let dir = 0;
        if (this.isPressed("stepLeft", playerIndex)) dir -= 1;
        if (this.isPressed("stepRight", playerIndex)) dir += 1;
        return dir;
    }

    public isAttacking(playerIndex: number = 0): boolean {
        return this.isPressed("attack", playerIndex);
    }

    public isRestartPressed(): boolean {
        return this.isPressed("restart", 0) || this.isPressed("restart", 1);
    }
}
