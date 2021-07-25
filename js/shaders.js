export const vertexShader = `

uniform sampler2D bumpMap;
uniform float bumpScale;

// passing the height to frag to determine shading
varying float vAmount;
// for uv mapping
varying vec2 vUV;

void main()
{
    vUV = uv;
    vec4 bumpData = texture2D(bumpMap, uv);
    vAmount = bumpData.r;

    vec3 newPosition = position - normal * bumpScale * vAmount;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

export const fragmentShader = `

uniform sampler2D uvTexture;

varying vec2 vUV;
varying float vAmount;

void main()
{
    gl_FragColor = texture2D(uvTexture, vUV);
    gl_FragColor.a = 0.2;
}
`;
