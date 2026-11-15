import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Makes a model loader that can also open compressed (Draco) models.
export function createGLTFLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
  return loader;
}
