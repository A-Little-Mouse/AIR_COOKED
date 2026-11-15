import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/** A GLTFLoader that can read Draco-compressed models (several NASA craft use it). Decoder files live in public/draco/. */
export function createGLTFLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
  return loader;
}
