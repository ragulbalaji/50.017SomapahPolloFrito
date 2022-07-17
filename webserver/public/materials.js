const material = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vPosition;
  varying vec2 vUV;
  void main() {
    vPosition = position;
    vUV = uv;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,
  fragmentShader: `varying vec3 vPosition;
  varying vec2 vUV;
  uniform sampler2D uTexture;

  void main() {
    if (vUV.x > 0.8 && vUV.y > 0.8) {
      gl_FragColor = vec4(0.1, 0.2, 0.7 - vPosition.y, 1.0);
    } else {
      vec3 color = texture2D(uTexture, vUV).rgb;
      gl_FragColor = vec4(color, 1.0);
      // gl_FragColor = vec4(vUV.x, vUV.y, 0.0, 1.0);
    }
    
  }`,
  uniforms: {
    uTexture: {
      value: TEXTURES.tex_grass
    }
  }
})

const phong_material = new THREE.MeshPhongMaterial({
  specular: 0xffffff,
  shininess: 5,
  flatShading: true,
  map: TEXTURES.tex_grass
})

phong_material.onBeforeCompile = function (materialInfo) {
  materialInfo.vertexUvs = true
  materialInfo.uvsVertexOnly = false
  materialInfo.vertexShader = materialInfo.vertexShader.replace(
    'varying vec3 vViewPosition;',
    `
    varying vec3 vViewPosition;
    varying vec3 vPosition;
    `
  )
  materialInfo.fragmentShader = materialInfo.fragmentShader.replace(
    'uniform float opacity;',
    `
    uniform float opacity;
    varying vec3 vPosition;
    `
  ).replace(
    '#include <map_fragment>',
    `
    if (vUv.x > 0.8 && vUv.y > 0.8) {
      vec4 sampledDiffuseColor = vec4(0.1, 0.2, 0.7 - vPosition.y, 1.0);
      diffuseColor *= sampledDiffuseColor;
    } else {
      vec4 sampledDiffuseColor = texture2D( map, vUv );
      diffuseColor *= sampledDiffuseColor;
    }
    `
  )
}

const MATERIALS = {
  material,
  phong_material,
  normal_material: new THREE.MeshNormalMaterial({ flatShading: true })
}
