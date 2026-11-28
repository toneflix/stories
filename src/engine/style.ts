import * as THREE from 'three';
import { Effect, EffectAttribute } from 'postprocessing';
import { lens } from './lens';

// The house look for lit stories: graded like painted key art and comic-book film,
// on top of smooth, physically lit renders. Never banded, never sketchy.

/** Smears the frame along the camera's own motion while the shutter is open. */
const blurFrag = /* glsl */ `
uniform mat4 uInvProj, uCamWorld, uPrevViewProj;
uniform float uOn;
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  if (uOn < 0.5) { outputColor = inputColor; return; }
  vec4 view = uInvProj * vec4(uv * 2. - 1., depth * 2. - 1., 1.);
  vec4 world = uCamWorld * vec4(view.xyz / view.w, 1.);
  vec4 prev = uPrevViewProj * world;
  vec2 vel = uv - (prev.xy / prev.w * .5 + .5);
  // a fast whip still reads, but never more than a few percent of the frame
  float len = length(vel);
  if (len > .04) vel *= .04 / len;
  if (len < .0006) { outputColor = inputColor; return; }
  vec3 sum = vec3(0.);
  for (int i = 0; i < 8; i++) sum += texture2D(inputBuffer, uv - vel * (float(i) / 7. - .5)).rgb;
  outputColor = vec4(sum / 8., inputColor.a);
}`;

export class CameraBlurEffect extends Effect {
  constructor(private camera: THREE.PerspectiveCamera) {
    super('CameraBlurEffect', blurFrag, {
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['uInvProj', new THREE.Uniform(new THREE.Matrix4())], ['uCamWorld', new THREE.Uniform(new THREE.Matrix4())],
        ['uPrevViewProj', new THREE.Uniform(new THREE.Matrix4())], ['uOn', new THREE.Uniform(0)],
      ]),
    });
  }
  update() {
    const c = this.camera, u = this.uniforms;
    u.get('uInvProj')!.value.copy(c.projectionMatrixInverse);
    u.get('uCamWorld')!.value.copy(c.matrixWorld);
    u.get('uPrevViewProj')!.value.copy(lens.prevViewProj);
    u.get('uOn')!.value = lens.hasPrev ? 1 : 0;
  }
}

const styleFrag = /* glsl */ `
uniform float uInk, uTone, uContrast, uSat, uHalftone, uGrain, uTime;
uniform vec3 uShadow, uLight;
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float lz(vec2 uv) { return -getViewZ(readDepth(uv)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 res = 1. / texelSize;
  // lens: colour fringes and softness grow towards the edges of the frame
  vec2 fromC = uv - .5;
  float edge = dot(fromC, fromC);
  vec2 ca = fromC * edge * .012;
  vec3 c = vec3(texture2D(inputBuffer, uv - ca).r, inputColor.g, texture2D(inputBuffer, uv + ca).b);
  vec3 soft = (texture2D(inputBuffer, uv + vec2(texelSize.x, 0.)).rgb + texture2D(inputBuffer, uv - vec2(texelSize.x, 0.)).rgb
             + texture2D(inputBuffer, uv + vec2(0., texelSize.y)).rgb + texture2D(inputBuffer, uv - vec2(0., texelSize.y)).rgb) * .25;
  c = mix(c, soft, smoothstep(.05, .3, edge) * .6);

  // ink only where a form ends against what's behind it, thin and fading with distance
  vec2 px = texelSize * max(1., res.y / 1280.);
  float z = lz(uv);
  float dz = max(max(lz(uv + vec2(px.x, 0.)), lz(uv - vec2(px.x, 0.))), max(lz(uv + vec2(0., px.y)), lz(uv - vec2(0., px.y)))) - z;
  float ink = smoothstep(.06, .16, dz / max(z, .3)) * (1. - smoothstep(8., 40., z)) * uInk;

  // grade, in display space: cool shadows, warm lights, an S-curve, richer mids
  vec3 s = pow(max(c, 0.), vec3(1. / 2.2));
  float L = lum(s);
  s = mix(s, s * uShadow / lum(uShadow), (1. - smoothstep(0., .45, L)) * uTone);
  s = mix(s, s * uLight / lum(uLight), smoothstep(.45, 1., L) * uTone);
  s = clamp(s, 0., 1.);
  s = mix(s, s * s * (3. - 2. * s), uContrast);
  float L2 = lum(s);
  s = clamp(mix(vec3(L2), s, 1. + uSat * (1. - abs(L2 * 2. - 1.))), 0., 1.);
  c = pow(s, vec3(2.2));

  // print: a fine halftone screen in the shadows, like ink on paper
  float cell = max(3., res.y / 300.);
  vec2 g = mat2(.7071, -.7071, .7071, .7071) * (uv * res) / cell;
  float d = length(fract(g) - .5);
  float dark = 1. - smoothstep(.02, .3, L2);
  float hd = 1. - smoothstep(.35 * sqrt(dark) - .05, .35 * sqrt(dark) + .05, d);
  c *= 1. - hd * uHalftone * dark;

  // vignette and film grain
  c *= 1. - smoothstep(.12, .7, edge) * .45;
  vec2 gp = floor(uv * res) + fract(uTime * 7.31) * 113.;
  float n = fract(sin(dot(gp, vec2(12.9898, 78.233))) * 43758.5453) - .5;
  c += n * uGrain * (.4 + .6 * (1. - smoothstep(0., .6, L2)));

  outputColor = vec4(mix(c, c * vec3(.05, .05, .09), ink), inputColor.a);
}`;

export interface StyleOptions {
  /** Strength of the silhouette lines (0 for none). */
  ink?: number;
  /** How far shadows and lights are pushed towards their tints. */
  tone?: number;
  shadow?: THREE.ColorRepresentation;
  light?: THREE.ColorRepresentation;
  /** Strength of the S-curve (0 flat, 1 strong). */
  contrast?: number;
  /** Extra saturation in the mid tones. */
  saturation?: number;
  /** Darkening of the halftone dots in the shadows. */
  halftone?: number;
  grain?: number;
}

export class StyleEffect extends Effect {
  constructor({ ink = 0.6, tone = 0.45, shadow = '#8aa3c6', light = '#ffe6c4', contrast = 0.28, saturation = 0.12, halftone = 0.25, grain = 0.022 }: StyleOptions = {}) {
    super('StyleEffect', styleFrag, {
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['uInk', new THREE.Uniform(ink)], ['uTone', new THREE.Uniform(tone)], ['uContrast', new THREE.Uniform(contrast)], ['uSat', new THREE.Uniform(saturation)], ['uHalftone', new THREE.Uniform(halftone)],
        ['uGrain', new THREE.Uniform(grain)], ['uTime', new THREE.Uniform(0)],
        ['uShadow', new THREE.Uniform(new THREE.Color(shadow))], ['uLight', new THREE.Uniform(new THREE.Color(light))],
      ]),
    });
  }
  /** Story time, so the grain moves frame to frame but renders the same every export. */
  set time(t: number) { this.uniforms.get('uTime')!.value = t; }
}
