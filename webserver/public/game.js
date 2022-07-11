const stats = new Stats()
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  precision: 'lowp'
})
const camera = new THREE.PerspectiveCamera(
  90,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

const orbitControls = new THREE.OrbitControls(camera, renderer.domElement)

init()

function init () {
  stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom)

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  window.addEventListener('resize', onWindowResize)
}

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x79a6ff)

const geometry = new THREE.PlaneGeometry(128, 128, 128 - 1, 128 - 1)
geometry.rotateX(-Math.PI / 2)

const material = new THREE.ShaderMaterial({
  vertexShader: `
  varying vec3 vPosition;
  void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  fragmentShader: `
  varying vec3 vPosition;
  float remap( float minval, float maxval, float curval )
  {
    return ( curval - minval ) / ( maxval - minval );
  }

  void main() {
    float depth = vPosition.y / 16.0 + 0.1;
    vec3 green = vec3(0.0, 0.0, 1.0);
    vec3 blue = vec3(0.0, 1.0, 0.0);
    vec3 white = vec3(1.0, 1.0, 1.0);

    depth = clamp(depth, 0.0, 1.0);
    if (depth < 0.5) {
      vec3 mixedColour = mix(green, blue, remap(0.0, 0.5, depth));
      gl_FragColor = vec4(mixedColour, 1.0);
    } else {
      vec3 mixedColour = mix(blue, white, remap(0.5, 1.0, depth));
      gl_FragColor = vec4(mixedColour, 1.0);
    }
  }
  `
})

const phongmaterial = new THREE.ShaderMaterial({
  uniforms: {
    Ka: { value: new THREE.Vector3(0.4, 0.9, 0.3) },
    Kd: { value: new THREE.Vector3(0.4, 0.9, 0.3) },
    Ks: { value: new THREE.Vector3(0.8, 0.8, 0.8) },
    LightIntensity: { value: new THREE.Vector4(0.5, 0.5, 0.5, 1.0) },
    LightPosition: { value: new THREE.Vector4(0.0, 2000.0, 0.0, 1.0) },
    Shininess: { value: 10.0 }
  },
  vertexShader: `
    varying vec3 Normal;
    varying vec3 Position;

    void main() {
      Normal = normalize(normalMatrix * normal);
      Position = vec3(modelViewMatrix * vec4(position, 1.0));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 Normal;
    varying vec3 Position;

    uniform vec3 Ka;
    uniform vec3 Kd;
    uniform vec3 Ks;
    uniform vec4 LightPosition;
    uniform vec3 LightIntensity;
    uniform float Shininess;

    vec3 phong() {
      vec3 n = normalize(Normal);
      vec3 s = normalize(vec3(LightPosition) - Position);
      vec3 v = normalize(vec3(-Position));
      vec3 r = reflect(-s, n);

      vec3 ambient = Ka;
      vec3 diffuse = Kd * max(dot(s, n), 0.0);
      vec3 specular = Ks * pow(max(dot(r, v), 0.0), Shininess);

      return LightIntensity * (ambient + diffuse + specular);
    }

    void main() {
      gl_FragColor = vec4(phong(), 1.0);
    }
  `
})

const material2 = new THREE.MeshNormalMaterial({ flatShading: true })
const chunk = new THREE.Mesh(geometry, material)
scene.add(chunk)

let maxh = 0
makeChunk(0, 0)
function makeChunk (x0, y0) {
  const vertices = chunk.geometry.attributes.position.array
  maxh = 8
  noise.seed(0)
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = 3 * (y * 128 + x)
      const r = Math.abs(noise.simplex2((x0 + x) / 48, (y0 + y) / 48)) < 0.2
      const h =
        noise.simplex2((x0 + x) / 4, (y0 + y) / 4) +
        noise.simplex2((x0 + x) / 128, (y0 + y) / 128) * 4 +
        Math.max(0, noise.simplex2((x0 + x) / 1024, (y0 + y) / 1024) * 32)
      vertices[i + 1] = Math.max(0, h)
      if (r && vertices[i + 1] < 3) {
        vertices[i + 1] *= 0.2
      }
      maxh = Math.max(maxh, vertices[i + 1])
    }
  }
  chunk.geometry.attributes.position.needsUpdate = true
}

camera.position.y = 8
camera.position.z = -64
camera.lookAt(0, 0, 0)
orbitControls.update()

let xxx = 0

function animate () {
  requestAnimationFrame(animate)

  makeChunk(0, xxx)
  xxx += 3
  // camera.position.y = Math.ceil(maxh + 1)
  // camera.lookAt(0, 0, 0);
  orbitControls.update()
  renderer.render(scene, camera)

  stats.update()
}

animate()

function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}
