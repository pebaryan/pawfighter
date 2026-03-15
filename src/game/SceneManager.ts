import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, DirectionalLight, StandardMaterial, Color3, Color4, ShadowGenerator } from "@babylonjs/core";
import { GameLoop } from "./GameLoop";

export class SceneManager {
    private engine: Engine;
    private scene: Scene;
    private gameLoop: GameLoop | null = null;
    private camera: ArcRotateCamera | null = null;
    private shadowGenerator: ShadowGenerator | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, true);
        this.scene = new Scene(this.engine);
        this.setupScene();
        this.gameLoop = new GameLoop(this.scene);
        this.setupShadows();
    }

    private setupScene(): void {
        // Camera setup - Side view for 2.5D
        this.camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 18, new Vector3(0, 1.5, 0), this.scene);
        this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
        
        this.camera.lowerRadiusLimit = 15;
        this.camera.upperRadiusLimit = 25;
        this.camera.lowerBetaLimit = Math.PI / 2.2;
        this.camera.upperBetaLimit = Math.PI / 1.8;

        const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this.scene);
        hemiLight.intensity = 0.5;

        const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), this.scene);
        dirLight.position = new Vector3(20, 40, 20);
        dirLight.intensity = 0.8;

        // Create a large Terrain
        const ground = MeshBuilder.CreateGround("terrain", { width: 100, height: 100, subdivisions: 20 }, this.scene);
        const groundMat = new StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new Color3(0.2, 0.5, 0.2); // Grass green
        groundMat.specularColor = new Color3(0, 0, 0);
        ground.material = groundMat;
        ground.position.y = -0.1;
        ground.receiveShadows = true;

        // Add some "terrain" flavor with small hills (procedural)
        const vertices = ground.getVerticesData("position");
        if (vertices) {
            for (let i = 0; i < vertices.length; i += 3) {
                const x = vertices[i];
                const z = vertices[i + 2];
                const dist = Math.sqrt(x * x + z * z);
                if (dist > 15) {
                    vertices[i + 1] = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 2.0;
                }
            }
            ground.setVerticesData("position", vertices);
            ground.createNormals(true);
        }

        // Skybox/Background color
        const skyColor = new Color3(0.5, 0.8, 1);
        this.scene.clearColor = skyColor.toColor4(1);

        // Fog
        this.scene.fogMode = Scene.FOGMODE_EXP;
        this.scene.fogDensity = 0.015;
        this.scene.fogColor = skyColor;

        this.engine.runRenderLoop(() => {
            this.updateCamera();
            this.scene.render();
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private setupShadows(): void {
        const dirLight = this.scene.getLightByName("dirLight") as DirectionalLight;
        if (dirLight) {
            this.shadowGenerator = new ShadowGenerator(1024, dirLight);
            this.shadowGenerator.useBlurExponentialShadowMap = true;
            this.shadowGenerator.blurKernel = 32;

            // Add existing characters to shadow caster list
            this.scene.meshes.forEach(mesh => {
                if (mesh.name !== "terrain") {
                    this.shadowGenerator?.addShadowCaster(mesh);
                }
            });

            // Listen for new meshes (like if cats were re-spawned)
            this.scene.onNewMeshAddedObservable.add((mesh) => {
                if (mesh.name !== "terrain") {
                    this.shadowGenerator?.addShadowCaster(mesh);
                }
            });
        }
    }
    private updateCamera(): void {
        if (!this.gameLoop || !this.camera) return;

        const pData = this.gameLoop.getPlayerData();
        const aData = this.gameLoop.getAIData();

        const midPoint = Vector3.Center(pData.pos, aData.pos);
        this.camera.setTarget(new Vector3(midPoint.x, 1.2, midPoint.z));

        // Vector from Player to AI
        const fightLine = aData.pos.subtract(pData.pos).normalize();
        
        // Perpendicular vector (Camera position offset)
        // Using (z, 0, -x) ensures we stay on one consistent side of the fight
        const sideDir = new Vector3(fightLine.z, 0, -fightLine.x);
        
        // Convert the position offset vector to an alpha angle for ArcRotateCamera
        const targetAlpha = Math.atan2(sideDir.z, sideDir.x);
        
        // Snap snappier lerp to keep 2D view during circular rotation
        const lerpSpeed = 0.5;
        let angleDiff = targetAlpha - this.camera.alpha;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        
        this.camera.alpha += angleDiff * lerpSpeed;
        if (Math.abs(angleDiff) < 0.001) this.camera.alpha = targetAlpha;
        
        this.camera.beta = Math.PI / 2.5; 
    }

    public getScene(): Scene { return this.scene; }
    public getGameLoop(): GameLoop | null { return this.gameLoop; }
    public dispose(): void { this.engine.dispose(); }
}
