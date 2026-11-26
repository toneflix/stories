import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

// The "real but sketched" finish for the realistic look, after the painted key art of
// open-world games: real lighting underneath, then ink on the silhouettes and creases,
// colour gently flattened into painted bands, a little extra saturation and paper grain.
const frag = /* glsl */ `
uniform float uInk, uBands, uSat;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float lz(vec2 uv) { return -getViewZ(readDepth(uv)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 px = texelSize * 1.25;
  // silhouettes: jumps in distance, relative to how far away the surface is
  float z = lz(uv);
  float dz = abs(lz(uv + vec2(px.x, 0.)) - z) + abs(lz(uv - vec2(px.x, 0.)) - z)
           + abs(lz(uv + vec2(0., px.y)) - z) + abs(lz(uv - vec2(0., px.y)) - z);
  float sil = smoothstep(0.035, 0.09, dz / max(z, 0.5));
  // creases and detail: a Sobel on brightness, weaker
  float tl = lum(texture2D(inputBuffer, uv + vec2(-px.x, px.y)).rgb), t = lum(texture2D(inputBuffer, uv + vec2(0., px.y)).rgb), tr = lum(texture2D(inputBuffer, uv + px).rgb);
  float l = lum(texture2D(inputBuffer, uv - vec2(px.x, 0.)).rgb), r = lum(texture2D(inputBuffer, uv + vec2(px.x, 0.)).rgb);
  float bl = lum(texture2D(inputBuffer, uv - px).rgb), b = lum(texture2D(inputBuffer, uv - vec2(0., px.y)).rgb), br = lum(texture2D(inputBuffer, uv + vec2(px.x, -px.y)).rgb);
  float gx = (tr + 2. * r + br) - (tl + 2. * l + bl), gy = (tl + 2. * t + tr) - (bl + 2. * b + br);
  float crease = smoothstep(0.22, 0.6, length(vec2(gx, gy)));
  // fade the ink into the haze so the distance stays soft
  float near = 1. - smoothstep(60., 220., z);
  float ink = clamp(max(sil, crease * 0.55) * near, 0., 1.) * uInk;
  // painted bands: pull brightness towards a few levels, keep the hue
  vec3 c = inputColor.rgb;
  float L = lum(c), Lb = floor(L * uBands + 0.5) / uBands;
  c *= mix(1., Lb / max(L, 1e-3), 0.35);
  c = mix(vec3(lum(c)), c, uSat);
  // paper grain
  float n = fract(sin(dot(floor(uv / texelSize), vec2(12.9898, 78.233))) * 43758.5453);
  c *= 0.985 + n * 0.03;
  outputColor = vec4(mix(c, c * vec3(0.08, 0.07, 0.09), ink), inputColor.a);
}`;

export class SketchEffect extends Effect {
  constructor({ ink = 0.85, bands = 7, saturation = 1.15 } = {}) {
    super('SketchEffect', frag, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([['uInk', new Uniform(ink)], ['uBands', new Uniform(bands)], ['uSat', new Uniform(saturation)]]),
    });
  }
}
