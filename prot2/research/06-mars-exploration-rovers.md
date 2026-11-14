# NASA Mars Exploration Rovers: Spirit and Opportunity

## Mission identity

- **Official name:** Mars Exploration Rovers (MER): Spirit and Opportunity.
- **Primary NASA source:** NASA Science, “Mars Exploration Rovers: Spirit and Opportunity” [1]. The page was opened and verified on 2026-11-14; it identifies the mission as a rover pair whose objective was to look for signs of past water on Mars.
- **Agency/program:** NASA’s Mars Exploration Program; the mission was operated by NASA/JPL, with the mission page crediting NASA/JPL-Caltech and the 3D model crediting NASA Visualization Technology Applications and Development (VTAD). JPL is a federally funded R&D center managed for NASA by Caltech [1] [5].
- **Mission type:** Robotic rover pair (two identical twin mobile planetary geologists).
- **Destination:** Mars.
- **Launch dates:** Spirit launched June 10, 2003; Opportunity launched July 7, 2003 [4] [5].

## Objective and science

The central objective was to look for evidence of past water on Mars. The two rovers were sent to landing sites selected because surface geology suggested ancient liquid-water activity: Spirit landed in Gusev Crater, a possible former lake, while Opportunity landed at Meridiani Planum, where mineral deposits indicated a wet history [1]. NASA states that, by studying the rock record, the twins confirmed that water was long-standing on the Martian surface in ancient times [1].

## Key achievements

- The rovers helped rewrite understanding of Mars’s early history and confirmed evidence of persistent ancient surface water [1].
- Spirit completed about 4.8 miles (7.7 km) of driving on Mars [1].
- Opportunity drove 28.06 miles (45.16 km), at the time the off-Earth roving-distance record; NASA’s current mission page notes that Perseverance passed that mark on October 11, 2026 [1].
- The pair operated for roughly 14 years in aggregate, far beyond the planned 90-day rover missions, and returned more than 300,000 raw images [1].
- Opportunity produced evidence that at least one region of Mars remained wet for an extended period and that conditions could have been suitable for sustaining microbial life [5].

## Key specifications available from the checked sources

- **Landing dates:** Spirit — January 3, 2004; Opportunity — January 24, 2004 [1].
- **Landing sites:** Gusev Crater (Spirit) and Meridiani Planum (Opportunity) [1].
- **Instrument suite (listed by JPL):** Panoramic Camera (Pancam), Microscopic Imager (MI), Miniature Thermal Emission Spectrometer (Mini-TES), Mössbauer Spectrometer (MB), Alpha Particle X-ray Spectrometer (APXS), Rock Abrasion Tool (RAT), magnet arrays, Hazard Avoidance Cameras (Hazcams), and Navigation Cameras (Navcams) [4] [5].
- **Driving distance:** Spirit 4.8 miles (7.7 km); Opportunity 28.06 miles (45.16 km) [1].
- **Images:** More than 300,000 raw images across the mission pair [1].
- **Physical dimensions, mass, power, communications, and data rates:** Not stated on the checked NASA mission page or the checked JPL mission pages; therefore not supplied here.

## Status

The mission is **past/completed**. NASA’s mission page says Spirit concluded its mission in 2010. Opportunity’s last communication was received June 10, 2018, after a planet-wide dust storm blanketed the rover’s location; JPL lists Opportunity’s status as Past and records that NASA/JPL made a final recovery attempt on February 13, 2019 [1] [4].

## Interesting facts

1. Spirit and Opportunity were identical twin robots, but they landed on opposite sides of Mars at sites chosen for different geological evidence of ancient water [1].
2. Opportunity’s 28.06-mile traverse record lasted until Perseverance exceeded it in October 2026 [1].
3. Opportunity’s “Eagle Crater” panorama comprised 558 images and more than 75 MB of data, according to the NASA mission page [1].

## Official downloadable 3D model

A suitable official asset exists in NASA’s 3D Resources collection, so `model_status` is **available**. NASA’s dedicated resource page provides a glTF and a USDZ file for the Spirit and Opportunity rover model [2]. NASA’s 3D Resources hub states that its assets are free to download and use and points users to NASA’s Images and Media Usage Guidelines [3]. Those guidelines specifically cover files used in the rendition of 3D models, including texture maps and polygon data: NASA content is generally not subject to U.S. copyright and may be used for educational or informational purposes, with NASA credited and no implied NASA endorsement. The guidelines warn that third-party copyrighted material, when identified, remains subject to its owner’s terms [6].

### Candidate 1 — GLB

- **Exact filename:** `24883_MER_static.glb`
- **Source URL:** https://science.nasa.gov/resource/spirit-and-opportunity-rover-3d-model/
- **Direct download URL:** https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24883_MER_static.glb
- **Format:** Binary glTF 2.0 (`.glb`)
- **License terms:** NASA 3D Resources asset; free to download and use under NASA Images and Media Usage Guidelines. Generally usable for educational/informational purposes with NASA attribution; do not imply NASA endorsement; check separately for any identified third-party material [3] [6].
- **File size:** 11.36 MB as displayed by NASA’s resource page [2]. A direct download in this verification measured 11,910,084 bytes (about 11.36 MiB).
- **Polygon count:** 31,450 indexed triangles, computed from the downloaded GLB’s nine glTF primitives. NASA does not publish this count on the resource page. The same parse found 44,117 summed POSITION vertices; because this is a sum across primitive accessors, it should not be treated as a deduplicated vertex count.
- **Confidence:** High for file identity, official provenance, format, URL, and NASA-displayed size; medium-high for polygon count because it is a reproducible local parse rather than a NASA-published metadata field.

### Candidate 2 — USDZ

- **Exact filename:** `24883_MER_static.usdz`
- **Source URL:** https://science.nasa.gov/resource/spirit-and-opportunity-rover-3d-model/
- **Direct download URL:** https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/usdz_files/24883_MER_static.usdz
- **Format:** USDZ (`.usdz`)
- **License terms:** Same NASA Images and Media Usage Guidelines described above [3] [6].
- **File size:** 3.01 MB as displayed by NASA’s resource page [2].
- **Polygon count:** Not published by NASA and not independently verified here; `not verifiable from checked source`.
- **Confidence:** High for file identity, official provenance, format, URL, and NASA-displayed size; lower for geometry metadata because polygon count is not exposed.

The GLB is the preferred candidate for downstream use because it is directly downloadable, its size is listed by NASA, and its triangle count can be independently reproduced from the embedded glTF accessors. No separate, clearly licensed JPL-hosted downloadable rover model was identified in the checked JPL mission pages; NASA’s official model is therefore the recommended asset.

## References

[1]: https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/ "NASA Science: Mars Exploration Rovers: Spirit and Opportunity"
[2]: https://science.nasa.gov/resource/spirit-and-opportunity-rover-3d-model/ "NASA Science: Spirit and Opportunity Rover, 3D Model"
[3]: https://science.nasa.gov/3d-resources/ "NASA Science: 3D Resources"
[4]: https://www.jpl.nasa.gov/missions/mars-exploration-rover-spirit-mer-spirit "NASA JPL: Spirit Rover"
[5]: https://www.jpl.nasa.gov/missions/mars-exploration-rover-opportunity-mer/ "NASA JPL: Opportunity Rover"
[6]: https://www.nasa.gov/nasa-brand-center/images-and-media/ "NASA Images and Media Usage Guidelines"
