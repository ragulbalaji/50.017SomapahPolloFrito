const material = new THREE.MeshPhongMaterial({
  color: 0xfdfbd3,
  shininess: 10,
  flatShading: true,
  map: TEXTURES.tex_HandM
})

material.onBeforeCompile = function (materialInfo) {
  materialInfo.vertexUvs = true
  materialInfo.uvsVertexOnly = false
  materialInfo.vertexShader = materialInfo.vertexShader.replace(
    'varying vec3 vViewPosition;',
    `
    varying vec3 vViewPosition;
    varying vec3 vPosition;
    `
  ).replace(
    '}',
    `vPosition = position;
     }`
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
      vec4 sampledDiffuseColor = texture2D( map, vec2(vUv.x, vPosition.y / 64.0));
      diffuseColor *= sampledDiffuseColor;
    }
    `
  )
}

const MATERIALS = {
  material,
  normal_material: new THREE.MeshNormalMaterial({ flatShading: true })
}
