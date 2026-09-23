import * as THREE from 'three';

/**
 * The one material behind every model. Colour, emissive strength, roughness
 * and metalness come from vertex attributes (see builder.ts), flat shading
 * gives the faceted look, and a few uniforms let each unit flash when hit,
 * tint when stunned or hacked, and dissolve when it dies.
 */

export interface ModelUniforms {
  uFlash: { value: number };
  uFlashColor: { value: THREE.Color };
  uTint: { value: THREE.Color };
  uTintAmount: { value: number };
  uDissolve: { value: number };
  uDissolveColor: { value: THREE.Color };
}

export type ModelMaterial = THREE.MeshStandardMaterial & { userData: { uniforms: ModelUniforms } };

const VERT_HEAD = /* glsl */ `
attribute vec3 surf;
varying vec3 vSurf;
varying vec3 vWorldPos;
`;

const VERT_BODY = /* glsl */ `
vSurf = surf;
#ifdef USE_INSTANCING
  vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`;

const FRAG_HEAD = /* glsl */ `
varying vec3 vSurf;
varying vec3 vWorldPos;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform vec3 uTint;
uniform float uTintAmount;
uniform float uDissolve;
uniform vec3 uDissolveColor;

float mw_hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float mw_noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mw_hash(i + vec3(0,0,0)), mw_hash(i + vec3(1,0,0)), f.x),
                 mix(mw_hash(i + vec3(0,1,0)), mw_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(mw_hash(i + vec3(0,0,1)), mw_hash(i + vec3(1,0,1)), f.x),
                 mix(mw_hash(i + vec3(0,1,1)), mw_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

function patch(material: THREE.MeshStandardMaterial, uniforms: ModelUniforms): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float mwDissolveNoise = 1.0;
        if (uDissolve > 0.0) {
          mwDissolveNoise = mw_noise(vWorldPos * 3.1) * 0.75 + mw_noise(vWorldPos * 11.0) * 0.25;
          if (mwDissolveNoise < uDissolve) discard;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint, uTintAmount);`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurf.z;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vSurf.x * 1.5;
        totalEmissiveRadiance += uFlashColor * uFlash;
        if (uDissolve > 0.0 && mwDissolveNoise < uDissolve + 0.07) totalEmissiveRadiance += uDissolveColor * 2.5;`,
      );
  };
  material.customProgramCacheKey = () => 'epoch-model-v1';
}

function makeUniforms(): ModelUniforms {
  return {
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.95, 0.85) },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uTintAmount: { value: 0 },
    uDissolve: { value: 0 },
    uDissolveColor: { value: new THREE.Color(1, 0.55, 0.2) },
  };
}

/** A fresh material with its own uniforms — one per unit, so each can flash independently. */
export function createModelMaterial(): ModelMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 1,
  }) as ModelMaterial;
  const uniforms = makeUniforms();
  material.userData.uniforms = uniforms;
  patch(material, uniforms);
  return material;
}

/** The shared material for static things: bases, props, turrets. */
export const staticMaterial: ModelMaterial = createModelMaterial();

/** Additive glow for beams, tracers, muzzle flashes, rings. */
export function glowMaterial(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
