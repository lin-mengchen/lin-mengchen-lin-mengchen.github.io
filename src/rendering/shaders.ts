export const glyphVertexShader = /* glsl */ `
  uniform float uProgress;
  uniform float uHalfWidth;

  attribute vec3 iStart;
  attribute vec3 iTarget;
  attribute vec4 iTargetQ;
  attribute vec4 iUvRect;
  attribute vec3 iTint;
  attribute vec2 iScale;

  varying vec2 vGlyphUv;
  varying vec3 vTint;

  float smoother(float value) {
    float t = clamp(value, 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  vec4 nlerpShortest(vec4 fromQ, vec4 toQ, float amount) {
    vec4 adjusted = dot(fromQ, toQ) < 0.0 ? -toQ : toQ;
    return normalize(mix(fromQ, adjusted, amount));
  }

  vec3 rotateByQuaternion(vec4 q, vec3 value) {
    return value + 2.0 * cross(q.xyz, cross(q.xyz, value) + q.w * value);
  }

  void main() {
    float curlT = smoother((uProgress - 0.1666667) / 0.25);
    float foldT = smoother((uProgress - 0.4166667) / 0.3333333);
    float angle = (iStart.x / max(uHalfWidth, 0.001)) * 2.0106193;
    float radius = max(uHalfWidth, 0.001) / 2.0106193;
    vec3 curlPosition = vec3(
      sin(angle) * radius,
      iStart.y,
      radius * (1.0 - cos(angle))
    );
    vec4 identityQ = vec4(0.0, 0.0, 0.0, 1.0);
    vec4 curlQ = vec4(0.0, sin(angle * 0.5), 0.0, cos(angle * 0.5));

    vec3 center = mix(iStart, curlPosition, curlT);
    center = mix(center, iTarget, foldT);
    vec4 orientation = nlerpShortest(identityQ, curlQ, curlT);
    orientation = nlerpShortest(orientation, iTargetQ, foldT);
    float glyphScale = mix(iScale.x, iScale.y, foldT);
    vec3 local = rotateByQuaternion(orientation, vec3(position.xy * glyphScale, 0.0));

    vGlyphUv = iUvRect.xy + uv * iUvRect.zw;
    vTint = iTint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(center + local, 1.0);
  }
`

export const glyphFragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uOpacity;

  varying vec2 vGlyphUv;
  varying vec3 vTint;

  void main() {
    float atlasAlpha = texture2D(uAtlas, vGlyphUv).a;
    if (atlasAlpha < 0.06) discard;
    float alpha = smoothstep(0.06, 0.62, atlasAlpha) * uOpacity;
    gl_FragColor = vec4(vTint, alpha);
  }
`

export const lineVertexShader = /* glsl */ `
  uniform float uProgress;
  uniform float uHalfWidth;

  attribute vec3 aTarget;
  attribute float aKeep;

  varying float vKeep;
  varying float vFold;

  float smoother(float value) {
    float t = clamp(value, 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  void main() {
    float curlT = smoother((uProgress - 0.1666667) / 0.25);
    float foldT = smoother((uProgress - 0.4166667) / 0.3333333);
    float angle = (position.x / max(uHalfWidth, 0.001)) * 2.0106193;
    float radius = max(uHalfWidth, 0.001) / 2.0106193;
    vec3 curlPosition = vec3(
      sin(angle) * radius,
      position.y,
      radius * (1.0 - cos(angle))
    );
    vec3 current = mix(position, curlPosition, curlT);
    current = mix(current, aTarget, foldT);

    vKeep = aKeep;
    vFold = foldT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(current, 1.0);
  }
`

export const lineFragmentShader = /* glsl */ `
  uniform vec3 uLineColor;

  varying float vKeep;
  varying float vFold;

  void main() {
    float finalStrength = mix(1.0, vKeep, vFold);
    gl_FragColor = vec4(uLineColor, 0.15 * finalStrength);
  }
`
