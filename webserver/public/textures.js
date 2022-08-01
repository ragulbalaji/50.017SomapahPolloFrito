const textureLoader = new THREE.TextureLoader()

const TEXTURES = {
  'Grass Texture': textureLoader.load('assets/tex/grass.png'),
  'Biome Texture': textureLoader.load('assets/tex/biome-lookup-discrete.png'),
  'Sky Texture': textureLoader.load('assets/tex/sky.jpg'),
  'Reference Test Texture': textureLoader.load('assets/tex/texmap.png')
}
