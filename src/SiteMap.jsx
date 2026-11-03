import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TOPO = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/** Satellite / terrain / 3D map with the plot outline and a pin. `onMap` hands the map to the video step. */
export default function SiteMap({ rings, center, exact, mode, setMode, onMap, labels }) {
  const el = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current,
      center: [center[1], center[0]], zoom: exact ? 17 : 13, maxPitch: 78, preserveDrawingBuffer: true,
      style: {
        version: 8,
        sources: {
          sat: { type: 'raster', tiles: [IMG], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
          topo: { type: 'raster', tiles: [TOPO], tileSize: 256, maxzoom: 19, attribution: 'Topo © Esri' },
          dem: { type: 'raster-dem', tiles: [DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Terrain: Mapzen/AWS' },
        },
        layers: [
          { id: 'sat', type: 'raster', source: 'sat' },
          { id: 'topo', type: 'raster', source: 'topo', layout: { visibility: 'none' } },
          { id: 'hill', type: 'hillshade', source: 'dem', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.5 } },
        ],
      },
      attributionControl: { compact: true },
    });
    ref.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    if (onMap) onMap(map);

    map.on('load', () => {
      if (rings && rings.length) {
        map.addSource('plot', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [rings[0].map(([la, lo]) => [lo, la])] } } });
        map.addLayer({ id: 'plot-fill', type: 'fill', source: 'plot', paint: { 'fill-color': '#f2b84b', 'fill-opacity': 0.28 } });
        map.addLayer({ id: 'plot-line', type: 'line', source: 'plot', paint: { 'line-color': '#ffd166', 'line-width': 3 } });
        let a = 90, b = 180, c = -90, d = -180;
        rings[0].forEach(([la, lo]) => { a = Math.min(a, la); c = Math.max(c, la); b = Math.min(b, lo); d = Math.max(d, lo); });
        map.fitBounds([[b, a], [d, c]], { padding: 70, maxZoom: 18, duration: 0 });
      }
    });

    const pin = document.createElement('div');
    pin.className = 'dev-pin';
    pin.innerHTML = '<span></span>';
    new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([center[1], center[0]]).addTo(map);
    return () => { map.remove(); ref.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = ref.current;
    if (!map) return;
    const apply = () => {
      const topo = mode === 'terrain';
      map.setLayoutProperty('sat', 'visibility', topo ? 'none' : 'visible');
      map.setLayoutProperty('topo', 'visibility', topo ? 'visible' : 'none');
      map.setLayoutProperty('hill', 'visibility', topo ? 'visible' : 'none');
      if (mode === '3d') { map.setTerrain({ source: 'dem', exaggeration: 1.6 }); map.easeTo({ pitch: 62, bearing: -25, duration: 900 }); }
      else { map.setTerrain(null); map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); }
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [mode]);

  return (
    <div className="mapwrap">
      <div ref={el} className="mapcanvas" />
      <div className="mapmodes" role="group" aria-label="Map type">
        {[['sat', labels.sat], ['terrain', labels.terrain], ['3d', '3D']].map(([k, l]) => (
          <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
    </div>
  );
}
