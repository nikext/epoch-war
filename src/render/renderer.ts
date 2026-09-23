import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CameraRig } from './camera';
import { Sky } from './env/sky';
import { Terrain } from './env/terrain';
import { Scenery } from './env/scenery';
import { THEMES, type Theme } from './env/themes';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface Quality {
  level: QualityLevel;
  pixelRatio: number;
  shadowSize: number;
  msaa: number;
  bloom: boolean;
}

export function qualityPreset(level: QualityLevel): Quality {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  switch (level) {
    case 'low':
      return { level, pixelRatio: Math.min(dpr, 1), shadowSize: 0, msaa: 0, bloom: false };
    case 'medium':
      return { level, pixelRatio: Math.min(dpr, 1.5), shadowSize: 1024, msaa: 2, bloom: true };
    case 'high':
      return { level, pixelRatio: Math.min(dpr, 2), shadowSize: 2048, msaa: 4, bloom: true };
  }
}

/** Vignette and a touch of colour grading, applied in linear HDR before tone mapping. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uSaturation: { value: 1.08 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
      c.rgb += uFlashColor * uFlash;
      gl_FragColor = c;
    }
  `,
};

/**
 * Owns the WebGL renderer, scene, lights, sky, terrain and post-processing.
 * Game-specific views (units, bases, effects) add themselves to `scene`.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  readonly sky: Sky;
  readonly terrain: Terrain;
  readonly scenery: Scenery;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  private quality: Quality;
  private themeFrom: Theme = THEMES[0]!;
  private themeTo: Theme = THEMES[0]!;
  private themeT = 1;
  private readonly fog: THREE.FogExp2;
  private flash = 0;
  private readonly flashColor = new THREE.Color();

  constructor(readonly canvas: HTMLCanvasElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.msaa === 0,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = quality.shadowSize > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.rig = new CameraRig(canvas.clientWidth / Math.max(1, canvas.clientHeight));

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.fog = new THREE.FogExp2(0xcccccc, 0.005);
    this.scene.fog = this.fog;

    this.sky = new Sky();
    this.scene.add(this.sky.mesh);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality.shadowSize > 0;
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const cam = this.sun.shadow.camera;
      cam.left = -46;
      cam.right = 46;
      cam.top = 30;
      cam.bottom = -30;
      cam.near = 1;
      cam.far = 160;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.04;
      this.sun.shadow.radius = 2.5;
    }
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.terrain = new Terrain(THEMES[0]!);
    this.scene.add(this.terrain.group);
    this.scenery = new Scenery();
    this.scene.add(this.scenery.group);

    this.buildComposer();
    this.applyTheme();
  }

  private buildComposer(): void {
    this.composer?.dispose();
    const size = this.renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x * this.quality.pixelRatio, size.y * this.quality.pixelRatio, {
      type: THREE.HalfFloatType,
      samples: this.quality.msaa,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.rig.camera));
    if (this.quality.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.5, 0.42, 1.4);
      composer.addPass(this.bloom);
    } else {
      this.bloom = null;
    }
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.renderer.setPixelRatio(q.pixelRatio);
    this.renderer.shadowMap.enabled = q.shadowSize > 0;
    this.sun.castShadow = q.shadowSize > 0;
    if (q.shadowSize > 0) {
      this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.buildComposer();
    this.resize();
  }

  /** Crossfade the sky and light to the player's new age. */
  setPlayerAge(age: number, instant = false): void {
    const next = THEMES[age]!;
    if (instant) {
      this.themeFrom = next;
      this.themeT = 1;
    } else {
      this.themeFrom = this.currentBlend();
      this.themeT = 0;
    }
    this.themeTo = next;
    this.applyTheme();
  }

  setSideAge(side: 0 | 1, age: number, instant = false): void {
    this.terrain.setSideTheme(side, THEMES[age]!, instant);
    this.scenery.setAge(side, age, instant);
  }

  private currentBlend(): Theme {
    return this.themeT >= 1 ? this.themeTo : this.themeTo;
  }

  /** A full-screen flash, e.g. for a thunderbolt or an EMP. */
  flashScreen(color: THREE.ColorRepresentation, amount: number): void {
    this.flashColor.set(color);
    this.flash = Math.max(this.flash, amount);
  }

  private applyTheme(): void {
    const a = this.themeFrom;
    const b = this.themeTo;
    const t = this.themeT * this.themeT * (3 - 2 * this.themeT);
    const lerp = (x: number, y: number): number => x + (y - x) * t;
    const col = (x: string, y: string): THREE.Color => new THREE.Color(x).lerp(new THREE.Color(y), t);
    this.sky.apply(a, b, t);
    this.sun.color.copy(col(a.sun.color, b.sun.color));
    this.sun.intensity = lerp(a.sun.intensity, b.sun.intensity);
    this.hemi.color.copy(col(a.hemi.sky, b.hemi.sky));
    this.hemi.groundColor.copy(col(a.hemi.ground, b.hemi.ground));
    this.hemi.intensity = lerp(a.hemi.intensity, b.hemi.intensity);
    this.fog.color.copy(col(a.fog.color, b.fog.color));
    this.fog.density = lerp(a.fog.density, b.fog.density);
    this.renderer.toneMappingExposure = lerp(a.exposure, b.exposure);
    this.scene.environmentIntensity = lerp(a.env, b.env);
    if (this.bloom) this.bloom.strength = lerp(a.bloom, b.bloom);
  }

  /** Smoke brightness for the current sky, for the effects layer. */
  get smokeLight(): number {
    const t = this.themeT * this.themeT * (3 - 2 * this.themeT);
    return this.themeFrom.smokeLight + (this.themeTo.smokeLight - this.themeFrom.smokeLight) * t;
  }

  get theme(): Theme {
    return this.themeTo;
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w, h);
    this.rig.camera.aspect = w / h;
    this.rig.camera.updateProjectionMatrix();
  }

  render(dt: number, time: number): void {
    if (this.themeT < 1) {
      this.themeT = Math.min(1, this.themeT + dt / 3);
      this.applyTheme();
    }
    this.rig.update(dt, time);
    this.sky.update(time, this.rig.camera);
    this.terrain.update(dt);
    this.scenery.update(dt);

    // Keep the shadow frustum centred on what the camera sees, snapped to texels.
    const fx = this.rig.focusX;
    const dir = this.sky.sunDir;
    const step = 92 / Math.max(1, this.quality.shadowSize);
    const cx = Math.round(fx / step) * step;
    // The key light comes from the camera's side of the field (so faces read),
    // leaning the same way as the painted sun.
    this.sun.target.position.set(cx, 0, -4);
    this.sun.position.set(cx + dir.x * 55, 42 + dir.y * 25, 50);

    if (this.grade) {
      this.flash *= Math.exp(-dt * 7);
      this.grade.uniforms.uFlash!.value = this.flash;
      this.grade.uniforms.uFlashColor!.value = this.flashColor;
    }
    this.composer!.render(dt);
  }
}
