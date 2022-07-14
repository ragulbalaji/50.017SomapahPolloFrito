/// ////////////////////////////////////////////////////////////////////////////
// Constants

const WORLD_SEED = Math.round(Math.random() * 4206969)
const CHUNK_SIZE = 128
const CHUNK_SCALE = 1
const STEPS_PER_FRAME = 5
const GRAVITY = 30
const POINTER_SPEED = 2
const _PI_2 = Math.PI / 2
const PLAYER_SPEED_GROUND = 400
const PLAYER_SPEED_AIR = 200

const clock = new THREE.Clock()
const keyStates = {} // to store key presses
const playerOnFloor = true
const playerVelocity = new THREE.Vector3()
const playerDirection = new THREE.Vector3()
const playerPosition = new THREE.Vector3(0, 32, 0)
const eulerAngle = new THREE.Euler(0, 0, 0, 'YXZ')
let pointerLocked = false

// references
const blocker = document.getElementById('blocker')
const instructions = document.getElementById('instructions')

/// ////////////////////////////////////////////////////////////////////////////
// Set up renderer, scene and camera

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  precision: 'lowp'
})
const scene = new THREE.Scene()
const SKY_COLOR = 0x79a6ff
scene.background = new THREE.Color(SKY_COLOR)
// scene.fog = new THREE.Fog(SKY_COLOR, 0, 100)

const camera = new THREE.PerspectiveCamera(
  90,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.rotation.order = 'YXZ'
camera.position.x = playerPosition.x
camera.position.y = playerPosition.y
camera.position.z = playerPosition.z
camera.lookAt(16, 0, 0)

const stats = new Stats()

/// ////////////////////////////////////////////////////////////////////////////
// Controls

function getForwardVector () {
  camera.getWorldDirection(playerDirection)
  playerDirection.y = 0
  playerDirection.normalize()
  return playerDirection
}

function getSideVector () {
  camera.getWorldDirection(playerDirection)
  playerDirection.y = 0
  playerDirection.normalize()
  playerDirection.cross(camera.up)
  return playerDirection
}

function controls (deltaTime) {
  let speedDelta = deltaTime * (playerOnFloor ? PLAYER_SPEED_GROUND : PLAYER_SPEED_AIR)
  // if shift is pressed then move at triple speed
  if (keyStates.ShiftLeft || keyStates.ShiftRight) speedDelta *= 3
  // move forward
  if (keyStates.KeyW || keyStates.ArrowUp) playerVelocity.add(getForwardVector().multiplyScalar(speedDelta))
  // move backward
  if (keyStates.KeyS || keyStates.ArrowDown) playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta))
  // move left
  if (keyStates.KeyA || keyStates.ArrowLeft) playerVelocity.add(getSideVector().multiplyScalar(-speedDelta))
  // move right
  if (keyStates.KeyD || keyStates.ArrowRight) playerVelocity.add(getSideVector().multiplyScalar(speedDelta))
  // fly up
  if (keyStates.KeyQ || keyStates.KeyZ) playerVelocity.y += speedDelta
  // fly down
  if (keyStates.KeyE || keyStates.KeyX) playerVelocity.y -= speedDelta
  // jump if player on floor
  if (playerOnFloor && keyStates.Space) playerVelocity.y = 15
}

function updatePlayer (deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime
    // small air resistance
    damping *= 0.1
  }

  playerVelocity.addScaledVector(playerVelocity, damping)
  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime)
  playerPosition.add(deltaPosition)
  camera.position.copy(playerPosition)
}

function onPointerLockChange () {
  if (document.pointerLockElement === document.body) {
    instructions.style.display = 'none'
    blocker.style.display = 'none'
    pointerLocked = true
  } else {
    pointerLocked = false
    blocker.style.display = 'block'
    instructions.style.display = ''
  }
}

function onMouseMovement (e) {
  if (!pointerLocked) return

  const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0
  const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0

  eulerAngle.setFromQuaternion(camera.quaternion)

  eulerAngle.y -= movementX * 0.002 * POINTER_SPEED
  eulerAngle.x -= movementY * 0.002 * POINTER_SPEED

  const minPolarAngle = 0
  const maxPolarAngle = Math.PI

  eulerAngle.x = Math.max(
    _PI_2 - maxPolarAngle,
    Math.min(_PI_2 - minPolarAngle, eulerAngle.x)
  )

  camera.quaternion.setFromEuler(eulerAngle)
}

/// ////////////////////////////////////////////////////////////////////////////
// Helpers

function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

/// ////////////////////////////////////////////////////////////////////////////
// Initialize

init()

function init () {
  stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom)

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  window.addEventListener('resize', onWindowResize)

  instructions.addEventListener('click', function () {
    document.body.requestPointerLock =
      document.body.requestPointerLock ||
      document.body.mozRequestPointerLock ||
      document.body.webkitRequestPointerLock
    document.body.requestPointerLock()
  })

  document.body.addEventListener('mousemove', onMouseMovement)
  document.addEventListener('pointerlockchange', onPointerLockChange)

  document.addEventListener('keydown', (e) => {
    keyStates[e.code] = true
  })
  document.addEventListener('keyup', (e) => {
    keyStates[e.code] = false
  })
}

/// ////////////////////////////////////////////////////////////////////////////
// Geometry

const tex_grass = new THREE.TextureLoader().load('assets/tex/grass.png')
const tex_sky = new THREE.TextureLoader().load('assets/tex/sky.jpg')
scene.background = tex_sky

const material = new THREE.ShaderMaterial({
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
      value: tex_grass
    }
  }
})

const normal_material = new THREE.MeshNormalMaterial({ flatShading: true })

let maxh = 0
function makeChunk (chunk, x0, z0) {
  x0 += 6969
  z0 += 6969
  const vertices = chunk.geometry.attributes.position.array
  const uv = chunk.geometry.attributes.uv.array
  maxh = 8
  noise.seed(WORLD_SEED)
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const j = 2 * (y * CHUNK_SIZE + x)
      const temp =
                (noise.simplex2((x0 + x) / 512, (z0 + y) / 512) + 1) / 2
      let rain = (noise.simplex2((x0 + x) / 256, (z0 + y) / 256) + 1) / 2
      rain = Math.min(rain, 0.99 - temp)
      uv[j] = temp
      uv[j + 1] = rain

      const i = 3 * (y * CHUNK_SIZE + x)
      const h =
                noise.simplex2((x0 + x) / 4, (z0 + y) / 4) * (rain + 0.3) +
                noise.simplex2((x0 + x) / 128, (z0 + y) / 128) * 4 +
                Math.max(
                  0,
                  noise.simplex2((x0 + x) / 768, (z0 + y) / 768) * 32
                )
      const r =
                Math.abs(noise.simplex2((x0 + x) / 96, (z0 + y) / 96)) <
                Math.min(0.2, Math.abs((3 - h) / 8))
      vertices[i + 1] = Math.max(0, h)
      if (h < 0) {
        uv[j] = 1
        uv[j + 1] = 1
      }
      if (r && vertices[i + 1] < 3) {
        vertices[i + 1] *= 0.2
        uv[j] = 1
        uv[j + 1] = 1
      }
      maxh = Math.max(maxh, vertices[i + 1])
    }
  }

  chunk.geometry.attributes.position.needsUpdate = true
  chunk.geometry.attributes.uv.needsUpdate = true
}

/// ////////////////////////////////////////////////////////////////////////////
// Animate

const loadedChunks = new Map()
function animate () {
  // Prevent user from moving when the pointer is not locked
  if (pointerLocked) {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      controls(deltaTime)
      updatePlayer(deltaTime)
    }
  }

  const chunkX = Math.floor(camera.position.x / CHUNK_SIZE + 0.5)
  const chunkZ = Math.floor(camera.position.z / CHUNK_SIZE + 0.5)
  for (let xoffset = -2; xoffset <= 2; xoffset++) {
    for (let zoffset = -2; zoffset <= 2; zoffset++) {
      const chunkXX = chunkX + xoffset
      const chunkZZ = chunkZ + zoffset
      const chunkName = `${chunkXX}$$${chunkZZ}`

      if (!loadedChunks.has(chunkName)) {
        const geometry = new THREE.PlaneGeometry(
          CHUNK_SIZE * CHUNK_SCALE,
          CHUNK_SIZE * CHUNK_SCALE,
          CHUNK_SIZE - 1,
          CHUNK_SIZE - 1
        )
        geometry.rotateX(-Math.PI / 2)

        const chunk = new THREE.Mesh(geometry, material)
        scene.add(chunk)

        chunk.position.x = chunkXX * CHUNK_SIZE
        chunk.position.z = chunkZZ * CHUNK_SIZE
        makeChunk(chunk, (chunkXX - 0.5) * CHUNK_SIZE, (chunkZZ - 0.5) * CHUNK_SIZE)

        loadedChunks.set(chunkName, chunk)
      }
    }
  }

  renderer.render(scene, camera)

  stats.update()

  requestAnimationFrame(animate)
}

animate()
