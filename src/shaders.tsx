// Shaders

export const VS_SOURCE = `
attribute vec2 a_position;
attribute vec4 a_color;

uniform vec2 u_resolution;
uniform vec2 u_translation;
uniform float u_scale;

varying vec4 v_color;
void main() {
  vec2 position = (a_position + u_translation) * u_scale;

  vec2 zeroToOne = (position + u_resolution / 2.0) / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;

  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_color = a_color;
}`;

export const FS_SOURCE = `
precision mediump float;
varying vec4 v_color;
void main() {
  gl_FragColor = v_color;
}`;
