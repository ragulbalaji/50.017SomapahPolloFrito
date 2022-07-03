const stats = new Stats()
const renderer = new THREE.WebGLRenderer({ antialias: true, precision: 'lowp' })
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000)

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
scene.background = new THREE.Color(0x79A6FF)

const geometry = new THREE.PlaneGeometry(128, 128, 128 - 1, 128 - 1)
geometry.rotateX(-Math.PI / 2)

const material = new THREE.MeshNormalMaterial({ flatShading: true })
const chunk = new THREE.Mesh(geometry, material)
scene.add(chunk)

makeChunk(0, 0)
function makeChunk (x0, y0) {
  const vertices = chunk.geometry.attributes.position.array
  noise.seed(42)
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = 3 * (y * 128 + x)
      vertices[i + 1] = noise.simplex2((x0 + x) / 8, (y0 + y) / 8) + noise.simplex2((x0 + x) / 128, (y0 + y) / 128) * 8
    }
  }
  chunk.geometry.attributes.position.needsUpdate = true
}

camera.position.y = 8
camera.position.z = -16
camera.lookAt(0, 0, 0)

let xxx = 0

function animate () {
  requestAnimationFrame(animate)

  makeChunk(0, xxx)
  xxx += 1
  renderer.render(scene, camera)

  stats.update()
}

animate()

function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}
