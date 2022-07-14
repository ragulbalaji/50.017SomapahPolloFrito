const MATERIALS = {
  material: new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vPosition;
    varying vec2 vUV;
    varying float sea;
    void main() {
      vPosition = position;
      vUV = uv;
      // if (position.y < 0.1) {
      //   sea = 1.0;
      // } else {
      //   sea = 0.0;
      // }
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    fragmentShader: `varying vec3 vPosition;
    varying vec2 vUV;
    varying float sea;
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
  }),
  normal_material: new THREE.MeshNormalMaterial({ flatShading: true })
}
