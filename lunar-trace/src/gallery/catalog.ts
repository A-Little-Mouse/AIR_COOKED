export type CraftCategory = 'landers-rovers' | 'probes' | 'satellites';

export interface Craft {
  id: string;
  name: string;
  category: CraftCategory;
  // Where the 3D model file is.
  model: string;
  info: string;
  // Where its video is, if it has one.
  video?: string;
}

export const CATEGORY_LABEL: Record<CraftCategory, string> = {
  'landers-rovers': 'Landers & rovers',
  probes: 'Probes & crewed craft',
  satellites: 'Earth & Sun satellites',
};

// The spacecraft that have a video.
const VIDEOS: Record<string, string> = {
  'apollo-lunar-module': '/videos/apollo-lunar-module.mp4',
  'spirit-opportunity-rover': '/videos/spirit-opportunity-rover.mp4',
  kepler: '/videos/kepler.mp4',
};

// Builds the data for one spacecraft.
const c = (category: CraftCategory, id: string, name: string, info: string, model = `/models/craft/${category}/${id}.glb`): Craft =>
  ({ id, name, category, model, info, video: VIDEOS[id] });

// Every spacecraft in the gallery.
export const CRAFT: Craft[] = [
  c('landers-rovers', 'apollo-lunar-module', 'Apollo Lunar Module', 'The two-stage craft that carried Apollo astronauts from lunar orbit to the surface and back. Its descent stage was left on the Moon.', '/models/craft/landers-rovers/apollo-lunar-module.glb'),
  c('landers-rovers', 'lunar-roving-vehicle', 'Lunar Roving Vehicle', 'The battery-powered rover driven by astronauts on Apollo 15, 16 and 17. All three were left parked on the Moon.'),
  c('landers-rovers', 'viking-lander', 'Viking Lander', 'Viking 1 and 2 touched down on Mars in 1976 and returned the first pictures from the surface, plus soil experiments.', '/models/craft/landers-rovers/viking-lander.glb'),
  c('landers-rovers', 'sojourner-rover', 'Sojourner Rover', 'The small rover of the 1997 Mars Pathfinder mission, the first wheeled vehicle to operate on Mars.'),
  c('landers-rovers', 'spirit-opportunity-rover', 'Spirit & Opportunity', 'The twin Mars Exploration Rovers that landed in January 2004 and found evidence that liquid water once shaped Mars.'),
  c('landers-rovers', 'insight-lander', 'InSight Lander', 'Landed on Mars in 2018 to listen for marsquakes and measure the planet\'s interior. The mission ended in December 2022.'),
  c('landers-rovers', 'ingenuity-helicopter', 'Ingenuity Mars Helicopter', 'Carried to Mars by Perseverance, it made the first powered, controlled flight on another planet in April 2021.'),
  c('probes', 'dawn', 'Dawn', 'Ion-propelled spacecraft that orbited the asteroid Vesta and then the dwarf planet Ceres, the first to orbit two bodies beyond Earth.'),
  c('probes', 'near-shoemaker', 'NEAR Shoemaker', 'The first spacecraft to orbit and then land on an asteroid, Eros, in 2001.'),
  c('probes', 'kepler', 'Kepler', 'Space telescope that watched for tiny dips in starlight and discovered thousands of exoplanets between 2009 and 2018.'),
  c('probes', 'apollo-soyuz', 'Apollo–Soyuz', 'The Apollo and Soyuz spacecraft that docked in orbit in 1975, the first joint US–Soviet crewed flight.'),
  c('probes', 'agena-target-vehicle', 'Agena Target Vehicle', 'The rocket stage used as a docking target in the Gemini programme to practise orbital rendezvous.'),
  c('satellites', 'ace', 'Advanced Composition Explorer', 'Launched in 1997 to sit near the Sun–Earth L1 point and sample the solar wind and cosmic particles.'),
  c('satellites', 'aim', 'Aeronomy of Ice in the Mesosphere', 'Studies noctilucent (night-shining) clouds high in the atmosphere. Launched in 2007.'),
  c('satellites', 'acrimsat-a', 'ACRIMSAT (A)', 'Active Cavity Irradiance Monitor Satellite, which measures the total energy the Sun delivers to Earth. Model variant A.'),
  c('satellites', 'acrimsat-b', 'ACRIMSAT (B)', 'Active Cavity Irradiance Monitor Satellite. Model variant B.'),
  c('satellites', 'aqua-a', 'Aqua (A)', 'Earth-observing satellite launched in 2002 that tracks the water cycle: oceans, clouds, ice and rainfall. Model variant A.'),
  c('satellites', 'aqua-b', 'Aqua (B)', 'Aqua, model variant B.'),
  c('satellites', 'aqua-c', 'Aqua (C)', 'Aqua, model variant C.'),
  c('satellites', 'aquarius-a', 'Aquarius (A)', 'Instrument that mapped sea-surface salinity from orbit on the SAC-D satellite from 2011. Model variant A.'),
  c('satellites', 'aquarius-b', 'Aquarius (B)', 'Aquarius, compact model variant B.'),
];
