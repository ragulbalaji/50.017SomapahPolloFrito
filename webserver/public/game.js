/// ////////////////////////////////////////////////////////////////////////////
// Constants

const PARAMETERS = {
  world_seed: Math.round(Math.random() * 4206969),
  chunk_size: 96,
  max_num_chunks: 128,
  gen_depth: 2,
  chunk_material: 'Phong Material',
  gravity: 70
}

const MATERIAL_PARAMETERS = {
  'Phong Material': {
    color: 0xfdfbd3,
    shininess: 10,
    map: 'Biome Texture'
  },
  'Wireframe Material': {
    color: 0x000000
  }
}

const HUD = {
  camera_position: '(0.0, 0.0, 0.0)',
  num_of_loaded_chunks: 0,
  mode: 'CREATIVE',
  current_score: 0
}

const CHUNK_SCALE = 1
const STEPS_PER_FRAME = 3
const POINTER_SPEED = 2
const _PI_2 = Math.PI / 2
const PLAYER_INIT_HEIGHT = 64
const PLAYER_HEIGHT = 2
const PLAYER_SPEED_GROUND = 60
const PLAYER_SPEED_AIR = 30
const CREATIVE_SPEED_FACTOR = 20
const [LOWER_Y, UPPER_Y] = [0, 250] // vertical world bounds
const [LOWER_X, UPPER_X] = [-1e14, 1e14] // x-axis world bounds
const [LOWER_Z, UPPER_Z] = [-1e14, 1e14] // z-axis world bounds

const clock = new THREE.Clock()
const playerVelocity = new THREE.Vector3()
const playerDirection = new THREE.Vector3()
const playerPosition = new THREE.Vector3(0, PLAYER_INIT_HEIGHT, 0)
const eulerAngle = new THREE.Euler(0, 0, 0, 'YXZ')
let pointerLocked = false
let playerOnFloor = true
let CREATIVE_MODE = true
const keyStates = new Map() // to store key presses
const loadedChunks = new Map() // to store currently loaded chunks

// References
const blocker = document.getElementById('blocker')
const instructions = document.getElementById('instructions')
const currScore = 0

let loadedAssets = 0
const ALL_LOADED_COUNT = 0

/// ////////////////////////////////////////////////////////////////////////////
// Set up renderer, scene and camera

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  precision: 'lowp'
})
renderer.outputEncoding = THREE.sRGBEncoding
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const scene = new THREE.Scene()
const SKY_COLOR = 0x79a6ff
scene.background = new THREE.Color(SKY_COLOR)
// scene.fog = new THREE.Fog(SKY_COLOR, 0, 400)
scene.fog = new THREE.FogExp2(SKY_COLOR, 0.001)
// scene.background = TEXTURES["Sky Texture"]

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
const rayCaster = new THREE.Raycaster()

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
  let speedDelta =
    deltaTime * (playerOnFloor ? PLAYER_SPEED_GROUND : PLAYER_SPEED_AIR)
  speedDelta *= CREATIVE_MODE ? CREATIVE_SPEED_FACTOR : 1
  // if shift is pressed then move at one-third speed
  if (keyStates.ShiftLeft || keyStates.ShiftRight) speedDelta /= 3
  // move forward
  if (keyStates.KeyW || keyStates.ArrowUp) { playerVelocity.add(getForwardVector().multiplyScalar(speedDelta)) }
  // move backward
  if (keyStates.KeyS || keyStates.ArrowDown) { playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta)) }
  // move left
  if (keyStates.KeyA || keyStates.ArrowLeft) { playerVelocity.add(getSideVector().multiplyScalar(-speedDelta)) }
  // move right
  if (keyStates.KeyD || keyStates.ArrowRight) { playerVelocity.add(getSideVector().multiplyScalar(speedDelta)) }
  // fly up
  if (keyStates.KeyQ || keyStates.KeyZ) playerVelocity.y += speedDelta
  // fly down
  if (keyStates.KeyE || keyStates.KeyX) playerVelocity.y -= speedDelta
  // jump if player on floor
  if (playerOnFloor && keyStates.Space) playerVelocity.y = 30
}

function updatePlayer (deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1

  if (!playerOnFloor) {
    playerVelocity.y -= PARAMETERS.gravity * deltaTime
    // small air resistance
    damping *= 0.1
  }

  playerVelocity.addScaledVector(playerVelocity, damping)
  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime)
  playerPosition.add(deltaPosition)
  playerCollisions()
  boundPlayerPosition()
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

function toggleCreativeMode () {
  if (!CREATIVE_MODE) {
    CREATIVE_MODE = true
    playerOnFloor = true
    playerVelocity.y = 0
    playerPosition.y = PLAYER_INIT_HEIGHT
    HUD.mode = 'CREATIVE'
  } else {
    CREATIVE_MODE = false
    HUD.mode = 'SURVIVAL'
  }
}

function playerCollisions () {
  if (CREATIVE_MODE) return

  rayCaster.set(playerPosition, new THREE.Vector3(0, -1, 0))
  const intersects = rayCaster.intersectObjects(scene.children)
  if (intersects.length > 0) {
    if (intersects[0].distance < PLAYER_HEIGHT) {
      const normal = intersects[0].face.normal
      playerOnFloor = true
      playerVelocity.addScaledVector(normal, -normal.dot(playerVelocity))
    } else {
      playerOnFloor = false
    }
  }
}

function boundPlayerPosition () {
  // limit player position to be within world bounds
  playerPosition.y = Math.min(playerPosition.y, UPPER_Y)
  playerPosition.y = Math.max(playerPosition.y, LOWER_Y)
  playerPosition.x = Math.min(playerPosition.x, UPPER_X)
  playerPosition.x = Math.max(playerPosition.x, LOWER_X)
  playerPosition.z = Math.min(playerPosition.z, UPPER_Z)
  playerPosition.z = Math.max(playerPosition.z, LOWER_Z)
}

/// ////////////////////////////////////////////////////////////////////////////
// Initialize

init()

function init () {
  stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
  HUD.mode = CREATIVE_MODE ? 'CREATIVE' : 'SURVIVAL'
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
    if (e.code === 'KeyC') toggleCreativeMode()
  })
  document.addEventListener('keyup', (e) => {
    keyStates[e.code] = false
  })
}

/// ////////////////////////////////////////////////////////////////////////////
// Geometry

const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
scene.add(ambientLight)
const directionalLight = new THREE.DirectionalLight(0xfdfbd3, 0.8)
directionalLight.castShadow = true
directionalLight.position.set(100, 100, 0)
scene.add(directionalLight)

let maxh = 0
function makeChunk (chunk, x0, z0) {
  x0 += 6969
  z0 += 6969
  const vertices = chunk.geometry.attributes.position.array
  const uv = chunk.geometry.attributes.uv.array
  maxh = 8
  noise.seed(PARAMETERS.world_seed)
  for (let y = 0; y < PARAMETERS.chunk_size; y++) {
    for (let x = 0; x < PARAMETERS.chunk_size; x++) {
      const j = 2 * (y * PARAMETERS.chunk_size + x)
      const temp = (noise.simplex2((x0 + x) / 512, (z0 + y) / 512) + 1) / 2
      let rain = (noise.simplex2((x0 + x) / 256, (z0 + y) / 256) + 1) / 2
      rain = Math.min(rain, 0.99 - temp)
      uv[j] = temp
      uv[j + 1] = rain

      const i = 3 * (y * PARAMETERS.chunk_size + x)
      let h =
        noise.simplex2((x0 + x) / 8, (z0 + y) / 8) * (rain + 0.3) +
        noise.simplex2((x0 + x) / 128, (z0 + y) / 128) * 4 +
        Math.min(32, noise.simplex2((x0 + x) / 768, (z0 + y) / 768) * 32 + 16)

      const m = Math.abs(noise.perlin2((x0 + x) / 512, (z0 + y) / 512))
      const mt = Math.abs(noise.simplex2((x0 + x) / 512, (z0 + y) / 512) * 0.2)
      if (m < mt && h > 24) {
        h *= (1 + (mt - m) * h / 5)
      }

      vertices[i + 1] = Math.max(0, h)

      const r =
        Math.abs(noise.simplex2((x0 + x) / 96, (z0 + y) / 96)) <
        Math.min(0.2, Math.abs((3 - h) / 8))

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

function unloadChunk (chunkName) {
  const chunk = loadedChunks.get(chunkName)
  chunk.geometry.dispose()
  scene.remove(chunk)
  loadedChunks.delete(chunkName)
}

function unloadAllLoadedChunks () {
  for (const chunkName of loadedChunks.keys()) {
    unloadChunk(chunkName)
  }
}

/// ////////////////////////////////////////////////////////////////////////////
// GUI

const gui = new lil.GUI({ width: 400 })

gui.title('Terrain Game Tech Test')

const controlsFolder = gui.addFolder('Controls')

let materialSpecificParamsFolder

function handleMaterialSpecificControllers (materialName) {
  for (const materialParams in MATERIAL_PARAMETERS[materialName]) {
    if (materialParams === 'color') {
      materialSpecificParamsFolder.addColor(MATERIAL_PARAMETERS[materialName], materialParams).name('Color').onFinishChange(function (value) {
        unloadAllLoadedChunks()
        MATERIALS[materialName].color.setHex(value)
      })
    } else if (materialParams === 'shininess') {
      materialSpecificParamsFolder.add(MATERIAL_PARAMETERS[materialName], materialParams, 0, 100, 0.1).name('Shininess').onFinishChange(function (value) {
        unloadAllLoadedChunks()
        MATERIALS[materialName].shininess = value
      })
    } else if (materialParams === 'map') {
      materialSpecificParamsFolder.add(MATERIAL_PARAMETERS[materialName], materialParams, Object.keys(TEXTURES)).name('Texture Map').onFinishChange(function (value) {
        unloadAllLoadedChunks()
        MATERIALS[materialName].map = TEXTURES[value]
      })
    }
  }
}

controlsFolder.add(PARAMETERS, 'world_seed', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1).name('World Seed').onFinishChange(unloadAllLoadedChunks)
controlsFolder.add(PARAMETERS, 'chunk_size', 16, 256, 1).name('Chunk Size').onFinishChange(unloadAllLoadedChunks)
controlsFolder.add(PARAMETERS, 'max_num_chunks', 81, 512, 1).name('Maximum Number of Chunks').onFinishChange(unloadAllLoadedChunks)
controlsFolder.add(PARAMETERS, 'gen_depth', 1, 4, 1).name('Generate Depth').onFinishChange(unloadAllLoadedChunks)
controlsFolder.add(PARAMETERS, 'chunk_material', Object.keys(MATERIALS)).name('Chunk Material').onFinishChange(
  function (materialName) {
    unloadAllLoadedChunks()
    if (materialSpecificParamsFolder != null) {
      materialSpecificParamsFolder.destroy()
    }
    materialSpecificParamsFolder = gui.addFolder('Material Parameters')
    handleMaterialSpecificControllers(materialName)
  }
)
controlsFolder.add(PARAMETERS, 'gravity', 1, 100, 1).name('Gravity')

const hudFolder = gui.addFolder('HUD')

hudFolder.add(HUD, 'camera_position').name('Camera Position').listen().disable()
hudFolder.add(HUD, 'num_of_loaded_chunks').name('Number of Loaded Chunks').listen().disable()
hudFolder.add(HUD, 'mode').name('Mode').listen().disable()
hudFolder.add(HUD, 'current_score').name('Current Score').listen().disable()

materialSpecificParamsFolder = gui.addFolder('Material Parameters')
handleMaterialSpecificControllers(PARAMETERS.chunk_material)

/// ////////////////////////////////////////////////////////////////////////////
// Animate

function animate () {
  // Prevent user from moving when the pointer is not locked
  if (pointerLocked) {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      controls(deltaTime)
      updatePlayer(deltaTime)

      // update position on FE
      HUD.camera_position = `(${playerPosition.x.toFixed(1)}, ${playerPosition.y.toFixed(1)}, ${playerPosition.z.toFixed(1)})`

      // update score board on FE
      HUD.current_score = currScore
    }

    HUD.num_of_loaded_chunks = loadedChunks.size
  }

  const chunkX = Math.floor(camera.position.x / PARAMETERS.chunk_size + 0.5)
  const chunkZ = Math.floor(camera.position.z / PARAMETERS.chunk_size + 0.5)
  // For incremental rendering
  let gencount = 0
  for (let xoffset = -PARAMETERS.gen_depth; xoffset <= PARAMETERS.gen_depth && gencount < 1; xoffset++) {
    for (let zoffset = -PARAMETERS.gen_depth; zoffset <= PARAMETERS.gen_depth && gencount < 1; zoffset++) {
      const chunkXX = chunkX + xoffset
      const chunkZZ = chunkZ + zoffset
      const chunkName = `${chunkXX}$$${chunkZZ}`

      if (!loadedChunks.has(chunkName)) {
        const geometry = new THREE.PlaneGeometry(
          PARAMETERS.chunk_size * CHUNK_SCALE,
          PARAMETERS.chunk_size * CHUNK_SCALE,
          PARAMETERS.chunk_size - 1,
          PARAMETERS.chunk_size - 1
        )
        geometry.rotateX(-Math.PI / 2)

        const chunk = new THREE.Mesh(geometry, MATERIALS[PARAMETERS.chunk_material])
        chunk.receiveShadow = true
        scene.add(chunk)

        chunk.position.x = chunkXX * PARAMETERS.chunk_size
        chunk.position.z = chunkZZ * PARAMETERS.chunk_size
        makeChunk(
          chunk,
          (chunkXX - 0.5) * (PARAMETERS.chunk_size - 1),
          (chunkZZ - 0.5) * (PARAMETERS.chunk_size - 1)
        )

        loadedChunks.set(chunkName, chunk)
        gencount++
      }
    }
  }

  // Unload chunks
  if (loadedChunks.size > PARAMETERS.max_num_chunks) {
    const chunkNames = Array.from(loadedChunks.keys())
    chunkNames.sort((a, b) => {
      const aDist = loadedChunks.get(a).position.distanceTo(playerPosition)
      const bDist = loadedChunks.get(b).position.distanceTo(playerPosition)
      return bDist - aDist
    })
    for (let i = 0; i < chunkNames.length - PARAMETERS.max_num_chunks * 0.8; i++) {
      const chunkName = chunkNames[i]
      unloadChunk(chunkName)
    }
  }

  renderer.render(scene, camera)

  stats.update()

  requestAnimationFrame(animate)
}

function wait_for_takeoff () {
  if (loadedAssets == ALL_LOADED_COUNT) {
    animate()
  } else {
    console.log('Still waiting for resources to load...')
    setTimeout(wait_for_takeoff, 200)
  }
}
wait_for_takeoff()
