/// ////////////////////////////////////////////////////////////////////////////
// Constants

const PARAMETERS = {
  world_seed: Math.round(Math.random() * 4206969),
  chunk_size: 96,
  max_num_chunks: 150,
  gen_depth: 3,
  chunk_material: 'Phong Material',
  gravity: 70,
  day_night_speed: 0.01,
  sky_color: 0x79a6ff,
  fog_density: 0.001,
  chunk_noise_x_offset: 6969,
  chunk_noise_z_offset: 6969,
  temp_divisor: 512,
  rain_divisor: 256,
  mountain_divisor: 512,
  mountain_threshold: 24,
  troty_multiplier: 123,
  tree_choice_x_multiplier: 4242,
  tree_choice_z_multiplier: 6969,
  tree_a_threshold: 0,
  tree_b_threshold: 0.4,
  ambient_light_color: 0x404040,
  ambient_light_intensity: 0.5,
  directional_light_color: 0xfdfbd3,
  directional_light_intensity: 0.8,
  directional_light_angle: 90,
  moon_light_intensity: 0.15
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
const NIGHT_TIME_FACTOR = 2500
const [LOWER_Y, UPPER_Y] = [0, 250] // vertical world bounds
const [LOWER_X, UPPER_X] = [-1e14, 1e14] // x-axis world bounds
const [LOWER_Z, UPPER_Z] = [-1e14, 1e14] // z-axis world bounds

const clock = new THREE.Clock()
const playerVelocity = new THREE.Vector3()
const playerDirection = new THREE.Vector3()
const playerPosition = new THREE.Vector3(0, PLAYER_INIT_HEIGHT, 0)
const eulerAngle = new THREE.Euler(0, 0, 0, 'YXZ')
let nightTime = false
let pointerLocked = false
let playerOnFloor = true
let CREATIVE_MODE = true
const keyStates = new Map() // to store key presses
const loadedChunks = new Map() // to store currently loaded chunks
const loadedDecorations = new Map() // to store decorations on loaded chunks

// References
const blocker = document.getElementById('blocker')
const instructions = document.getElementById('instructions')
const currScore = 0

const ALL_INSTANCED_MODELS = []
const loader = new THREE.GLTFLoader()
function loadInstancesOf (idx, GLTFpath, count) {
  loader.load(GLTFpath,
    function (gltf) {
      ALL_INSTANCED_MODELS[idx] = []
      gltf.scene.traverse(function (child) {
        if (child.isMesh) {
          const mat = child.material
          mat.flatShading = true
          const instancedMesh = new THREE.InstancedMesh(child.geometry, mat, count)
          instancedMesh.scale.set(8, 8, 8)
          instancedMesh.castShadow = true
          instancedMesh.receiveShadow = true
          scene.add(instancedMesh)
          ALL_INSTANCED_MODELS[idx].push(instancedMesh)
        }
      })
      loadedAssets++
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total * 100) + '% loaded --> ' + GLTFpath)
    },
    function (error) {
      console.log('GLTFLoader error ' + error)
    }
  )
}

const MODELS = {
  TREEA: [0, 'assets/models/gltf/detail_treeA.gltf.glb', 15000],
  TREEB: [1, 'assets/models/gltf/detail_treeB.gltf.glb', 15000],
  TREEC: [2, 'assets/models/gltf/detail_treeC.gltf.glb', 15000],
  WELLS: [3, 'assets/models/gltf/well.gltf.glb', 200],
  HOUSE: [4, 'assets/models/gltf/house.gltf.glb', 200]
}

let loadedAssets = 0
const ALL_LOADED_COUNT = 4

for (const MODEL of Object.keys(MODELS)) {
  const toload = MODELS[MODEL]
  loadInstancesOf(...toload)
}

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
scene.background = new THREE.Color(PARAMETERS.sky_color)
// scene.fog = new THREE.Fog(PARAMETERS.sky_color, 0, 400)
scene.fog = new THREE.FogExp2(PARAMETERS.sky_color, PARAMETERS.fog_density)
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
camera.lookAt(128, 0, 0)

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
  if (keyStates.KeyW || keyStates.ArrowUp) {
    playerVelocity.add(getForwardVector().multiplyScalar(speedDelta))
  }
  // move backward
  if (keyStates.KeyS || keyStates.ArrowDown) {
    playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta))
  }
  // move left
  if (keyStates.KeyA || keyStates.ArrowLeft) {
    playerVelocity.add(getSideVector().multiplyScalar(-speedDelta))
  }
  // move right
  if (keyStates.KeyD || keyStates.ArrowRight) {
    playerVelocity.add(getSideVector().multiplyScalar(speedDelta))
  }
  // fly up
  if (keyStates.KeyQ || keyStates.KeyZ) playerVelocity.y += speedDelta
  // fly down
  if (keyStates.KeyE || keyStates.KeyX) playerVelocity.y -= speedDelta
  // jump if player on floor
  if (playerOnFloor && keyStates.Space && !CREATIVE_MODE) playerVelocity.y = 30
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
    if (!gui._closed) {
      controlsFolder.close()
      materialSpecificParamsFolder.close()
      lightsFolder.close()
      noiseFolder.close()
    }
  } else {
    pointerLocked = false
    blocker.style.display = 'block'
    instructions.style.display = ''
    if (!gui._closed) {
      controlsFolder.open()
      materialSpecificParamsFolder.open()
      lightsFolder.open()
      noiseFolder.open()
    }
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
  // const intersects = rayCaster.intersectObjects(scene.children) // Too slow
  const chunkX = Math.floor(camera.position.x / PARAMETERS.chunk_size + 0.5)
  const chunkZ = Math.floor(camera.position.z / PARAMETERS.chunk_size + 0.5)
  const chunkName = `${chunkX}$$${chunkZ}`
  const intersects = rayCaster.intersectObjects([loadedChunks.get(chunkName)])
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

  renderer.setPixelRatio(window.devicePixelRatio || 1)
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

const ambientLight = new THREE.AmbientLight(PARAMETERS.ambient_light_color, PARAMETERS.ambient_light_intensity)
scene.add(ambientLight)
const moonLight = new THREE.DirectionalLight(PARAMETERS.directional_light_color, PARAMETERS.moon_light_intensity)
moonLight.castShadow = true
moonLight.position.set(100, 100, 0)
scene.add(moonLight)
const directionalLight = new THREE.DirectionalLight(PARAMETERS.directional_light_color, PARAMETERS.directional_light_intensity)
directionalLight.castShadow = true
directionalLight.position.set(100, 100, -100 / Math.tan((PARAMETERS.directional_light_angle * Math.PI) / 180))
directionalLight.shadow.camera.left = -15
directionalLight.shadow.camera.right = 15
directionalLight.shadow.camera.top = 15
directionalLight.shadow.camera.bottom = -15

directionalLight.shadow.camera.near = 2
directionalLight.shadow.camera.far = 50

directionalLight.shadow.mapSize.x = 1024
directionalLight.shadow.mapSize.y = 1024
scene.add(directionalLight)

function makeChunk (chunkName, chunk, x0, z0) {
  x0 += PARAMETERS.chunk_noise_x_offset
  z0 += PARAMETERS.chunk_noise_z_offset
  const vertices = chunk.geometry.attributes.position.array
  const uv = chunk.geometry.attributes.uv.array
  const decorations = {}
  decorations[MODELS.TREEA[0]] = []
  decorations[MODELS.TREEB[0]] = []
  decorations[MODELS.TREEC[0]] = []
  decorations[MODELS.WELLS[0]] = []
  decorations[MODELS.HOUSE[0]] = []
  noise.seed(PARAMETERS.world_seed)
  for (let y = 0; y < PARAMETERS.chunk_size; y++) {
    for (let x = 0; x < PARAMETERS.chunk_size; x++) {
      const j = 2 * (y * PARAMETERS.chunk_size + x)
      const temp = (noise.simplex2((x0 + x) / PARAMETERS.temp_divisor, (z0 + y) / PARAMETERS.temp_divisor) + 1) / 2
      let rain = (noise.simplex2((x0 + x) / PARAMETERS.rain_divisor, (z0 + y) / PARAMETERS.rain_divisor) + 1) / 2
      rain = Math.min(rain, 0.99 - temp)
      uv[j] = temp
      uv[j + 1] = rain

      const i = 3 * (y * PARAMETERS.chunk_size + x)
      let h =
        noise.simplex2((x0 + x) / 8, (z0 + y) / 8) * (rain + 0.3) +
        noise.simplex2((x0 + x) / 128, (z0 + y) / 128) * 4 +
        Math.min(32, noise.simplex2((x0 + x) / 768, (z0 + y) / 768) * 32 + 16)

      const m = Math.abs(noise.perlin2((x0 + x) / PARAMETERS.mountain_divisor, (z0 + y) / PARAMETERS.mountain_divisor))
      const mt = Math.abs(noise.simplex2((x0 + x) / PARAMETERS.mountain_divisor, (z0 + y) / PARAMETERS.mountain_divisor) * 0.2)
      if (m < mt && h > PARAMETERS.mountain_threshold) {
        h *= 1 + ((mt - m) * h) / 5
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

      if (vertices[i + 1] > 3 && temp < 0.15 && noise.perlin2(x0 + x, z0 + y) > 0.88) {
        const tx = (vertices[i] + chunk.position.x) / 8
        const ty = vertices[i + 1] / 8
        const tz = (vertices[i + 2] + chunk.position.z) / 8
        const troty = noise.perlin2((x0 + x) * PARAMETERS.troty_multiplier, (z0 + y) * PARAMETERS.troty_multiplier) * Math.PI * 2
        decorations[MODELS.WELLS[0]].push([tx, ty, tz, troty])
      }

      if (vertices[i + 1] > 3 && vertices[i + 1] < 30 && temp < 0.6 && temp > 0.2 && noise.perlin2(x0 + x, z0 + y) > 0.95) {
        const tx = (vertices[i] + chunk.position.x) / 8
        const ty = (vertices[i + 1] + 1) / 8
        const tz = (vertices[i + 2] + chunk.position.z) / 8
        const troty = noise.perlin2((x0 + x) * PARAMETERS.troty_multiplier, (z0 + y) * PARAMETERS.troty_multiplier) * Math.PI * 2
        decorations[MODELS.HOUSE[0]].push([tx, ty, tz, troty])
      } else if (vertices[i + 1] > 5 && vertices[i + 1] < 40 && temp > 0.34 && rain < 0.67 && noise.perlin2(x0 + x, z0 + y) > 0.7) {
        const treechoice = noise.perlin2((x0 + x) * PARAMETERS.tree_choice_x_multiplier, (z0 + y) * PARAMETERS.tree_choice_z_multiplier)
        const tx = (vertices[i] + chunk.position.x) / 8
        const ty = vertices[i + 1] / 8
        const tz = (vertices[i + 2] + chunk.position.z) / 8
        const troty = noise.perlin2((x0 + x) * PARAMETERS.troty_multiplier, (z0 + y) * PARAMETERS.troty_multiplier) * Math.PI * 2
        if (treechoice < PARAMETERS.tree_a_threshold) {
          decorations[MODELS.TREEA[0]].push([tx, ty, tz, troty])
        } else if (treechoice > PARAMETERS.tree_b_threshold) {
          decorations[MODELS.TREEB[0]].push([tx, ty, tz, troty])
        } else {
          decorations[MODELS.TREEC[0]].push([tx, ty, tz, troty])
        }
      }
    }
  }
  loadedDecorations.set(chunkName, decorations)

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

const gui = new lil.GUI({ width: 390 })

gui.title('Somapah Worldscapes Debug Menu')
gui.close() // Default closed to save screen space

const controlsFolder = gui.addFolder('Controls')

let materialSpecificParamsFolder

function handleMaterialSpecificControllers (materialName) {
  for (const materialParams in MATERIAL_PARAMETERS[materialName]) {
    if (materialParams === 'color') {
      materialSpecificParamsFolder
        .addColor(MATERIAL_PARAMETERS[materialName], materialParams)
        .name('Color')
        .onChange(function (value) {
          MATERIALS[materialName].color.setHex(value)
        })
    } else if (materialParams === 'shininess') {
      materialSpecificParamsFolder
        .add(MATERIAL_PARAMETERS[materialName], materialParams, 0, 100, 0.1)
        .name('Shininess')
        .onChange(function (value) {
          MATERIALS[materialName].shininess = value
        })
    } else if (materialParams === 'map') {
      materialSpecificParamsFolder
        .add(MATERIAL_PARAMETERS[materialName], materialParams, Object.keys(TEXTURES))
        .name('Texture Map')
        .onChange(function (value) {
          MATERIALS[materialName].map = TEXTURES[value]
        })
    }
  }
}

controlsFolder
  .add(PARAMETERS, 'world_seed', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1)
  .name('World Seed')
  .onFinishChange(unloadAllLoadedChunks)
controlsFolder
  .add(PARAMETERS, 'chunk_size', 16, 256, 1)
  .name('Chunk Size')
  .onFinishChange(unloadAllLoadedChunks)
controlsFolder
  .add(PARAMETERS, 'max_num_chunks', 81, 512, 1)
  .name('Max. Number of Chunks')
  .onFinishChange(unloadAllLoadedChunks)
controlsFolder
  .add(PARAMETERS, 'gen_depth', 1, 4, 1)
  .name('Generation Depth')
  .onFinishChange(unloadAllLoadedChunks)
controlsFolder
  .add(PARAMETERS, 'chunk_material', Object.keys(MATERIALS))
  .name('Chunk Material')
  .onFinishChange(function (materialName) {
    unloadAllLoadedChunks()
    if (materialSpecificParamsFolder != null) {
      materialSpecificParamsFolder.destroy()
    }
    materialSpecificParamsFolder = gui.addFolder('Material Parameters')
    handleMaterialSpecificControllers(materialName)
  })
controlsFolder.add(PARAMETERS, 'gravity', 1, 100, 1).name('Gravity')
controlsFolder
  .add(PARAMETERS, 'day_night_speed', 0, 1, 0.01)
  .name('Day-Night Cycle Speed')
controlsFolder
  .addColor(PARAMETERS, 'sky_color')
  .name('Base Sky Color')
  .onChange(function (value) {
    scene.background = new THREE.Color(value)
    scene.fog = new THREE.FogExp2(value, PARAMETERS.fog_density)
  })
controlsFolder
  .add(PARAMETERS, 'fog_density', 0, 0.1, 0.0001)
  .name('Fog Density')
  .onChange(function (value) {
    scene.fog = new THREE.FogExp2(PARAMETERS.sky_color, value)
  })

const noiseFolder = gui.addFolder('Noise')

noiseFolder
  .add(PARAMETERS, 'chunk_noise_x_offset', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1)
  .name('Chunk X Offset')
  .onFinishChange(unloadAllLoadedChunks)

noiseFolder
  .add(PARAMETERS, 'chunk_noise_z_offset', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1)
  .name('Chunk Z Offset')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'temp_divisor', 1, 1024, 1)
  .name('Temperature Divisor')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'rain_divisor', 1, 1024, 1)
  .name('Rain Divisor')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'mountain_divisor', 1, 1024, 1)
  .name('Mountain Divisor')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'mountain_threshold', 1, 1024, 1)
  .name('Mountain Threshold')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'troty_multiplier', 1, Number.MAX_SAFE_INTEGER, 1)
  .name('Troty Multiplier')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'tree_choice_x_multiplier', 1, Number.MAX_SAFE_INTEGER, 1)
  .name('Tree Choice X Multiplier')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'tree_choice_z_multiplier', 1, Number.MAX_SAFE_INTEGER, 1)
  .name('Tree Choice Z Multiplier')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'tree_a_threshold', 0, 0.4, 0.01)
  .name('Tree A Threshold')
  .onFinishChange(unloadAllLoadedChunks)
noiseFolder
  .add(PARAMETERS, 'tree_b_threshold', 0.4, 1, 0.01)
  .name('Tree B Threshold')
  .onFinishChange(unloadAllLoadedChunks)

const lightsFolder = gui.addFolder('Lights')

lightsFolder
  .addColor(PARAMETERS, 'ambient_light_color')
  .name('Ambient Color')
  .onChange(function (value) {
    ambientLight.color.setHex(value)
  })
lightsFolder
  .add(PARAMETERS, 'ambient_light_intensity', 0, 1, 0.01)
  .name('Ambient Intensity')
  .onChange(function (value) {
    ambientLight.intensity = value
  })
lightsFolder
  .addColor(PARAMETERS, 'directional_light_color')
  .name('Directional Color')
  .onChange(function (value) {
    directionalLight.color.setHex(value)
  })
lightsFolder
  .add(PARAMETERS, 'directional_light_intensity', 0, 1, 0.01)
  .name('Directional Intensity')
  .onChange(function (value) {
    directionalLight.intensity = value
  })
lightsFolder
  .add(PARAMETERS, 'directional_light_angle', 0, 180, 0.01)
  .name('Directional Angle')
  .listen()
  .onChange(function (value) {
    directionalLight.position.set(100, 100, -100 / Math.tan((value * Math.PI) / 180))
  })
lightsFolder
  .add(PARAMETERS, 'moon_light_intensity', 0, 1, 0.01)
  .name('Moon Intensity')
  .onChange(function (value) {
    if (nightTime || PARAMETERS.day_night_speed === 0) {
      moonLight.intensity = value
    }
  })

const hudFolder = gui.addFolder('HUD')

hudFolder
  .add(HUD, 'camera_position')
  .name('Camera Position')
  .listen()
  .disable()
hudFolder
  .add(HUD, 'num_of_loaded_chunks')
  .name('Number of Loaded Chunks')
  .listen()
  .disable()
hudFolder.add(HUD, 'mode').name('Mode').listen().disable()
hudFolder.add(HUD, 'current_score').name('Current Score').listen().disable()

materialSpecificParamsFolder = gui.addFolder('Material Parameters')
handleMaterialSpecificControllers(PARAMETERS.chunk_material)

/// ////////////////////////////////////////////////////////////////////////////
// Animate

function itsDayTime () {
  nightTime = false
  moonLight.intensity = 0
}

function updateDayNight () {
  PARAMETERS.directional_light_angle += PARAMETERS.day_night_speed
  if (PARAMETERS.directional_light_angle >= 180) {
    PARAMETERS.directional_light_angle = 0
    nightTime = true
    moonLight.intensity = PARAMETERS.moon_light_intensity
    setTimeout(itsDayTime, NIGHT_TIME_FACTOR / PARAMETERS.day_night_speed)
  }
  PARAMETERS.directional_light_angle %= 180
  directionalLight.position.set(100, 100, -100 / Math.tan((PARAMETERS.directional_light_angle * Math.PI) / 180))
}

function updateNightSky () {
  const darkeningFactor = (-Math.sin((PARAMETERS.directional_light_angle * Math.PI) / 180) + 1) * 100
  const currentSkyColor = tinycolor('#' + PARAMETERS.sky_color.toString(16))
  const newSkyColor = parseInt(currentSkyColor.darken(darkeningFactor).toString().substring(1), 16)
  scene.background = new THREE.Color(newSkyColor)
  scene.fog = new THREE.FogExp2(newSkyColor, PARAMETERS.fog_density)
}

function animate () {
  if (PARAMETERS.day_night_speed !== 0) {
    if (!nightTime) {
      updateDayNight()
    }
    updateNightSky()
  }

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
  let newChunksAdded = false
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
        chunk.castShadow = true
        scene.add(chunk)

        chunk.position.x = chunkXX * PARAMETERS.chunk_size
        chunk.position.z = chunkZZ * PARAMETERS.chunk_size
        makeChunk(
          chunkName,
          chunk,
          (chunkXX - 0.5) * (PARAMETERS.chunk_size - 1),
          (chunkZZ - 0.5) * (PARAMETERS.chunk_size - 1)
        )

        loadedChunks.set(chunkName, chunk)
        newChunksAdded = true
        gencount++
      }
    }
  }

  if (newChunksAdded) {
    // rebuild all instances meshes
    const dummy = new THREE.Object3D()
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    for (const chunkName of loadedChunks.keys()) {
      // look through decoration
      const chunkDecoration = loadedDecorations.get(chunkName)
      for (const MODELID of Object.keys(chunkDecoration)) {
        for (const PosAndRot of chunkDecoration[MODELID]) {
          dummy.position.set(PosAndRot[0], PosAndRot[1], PosAndRot[2])
          dummy.rotation.set(0, PosAndRot[3], 0)
          dummy.updateMatrix()
          for (let i = 0; i < ALL_INSTANCED_MODELS[MODELID].length; i++) {
            if (MODELID == MODELS.HOUSE[0] && i == 5) { // Fucking disgusting but ok for today
              dummy.position.set(PosAndRot[0], PosAndRot[1] - 0.5, PosAndRot[2])
              dummy.updateMatrix()
            }
            ALL_INSTANCED_MODELS[MODELID][i].setMatrixAt(counts[MODELID], dummy.matrix)
          }
          counts[MODELID]++
        }
      }
    }
    console.log(counts)

    for (const MODELID of Object.keys(ALL_INSTANCED_MODELS)) {
      for (let i = 0; i < ALL_INSTANCED_MODELS[MODELID].length; i++) {
        ALL_INSTANCED_MODELS[MODELID][i].count = counts[MODELID]
        ALL_INSTANCED_MODELS[MODELID][i].instanceMatrix.needsUpdate = true
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

function waitForTakeoff () {
  if (loadedAssets >= ALL_LOADED_COUNT) {
    document.getElementById('title').innerText = 'Click to Focus!'
    animate()
  } else {
    console.log('Still waiting for resources to load...')
    setTimeout(waitForTakeoff, 200)
  }
}
waitForTakeoff()
