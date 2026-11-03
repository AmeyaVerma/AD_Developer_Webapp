import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { parcels, parcelFeatureCollection } from './data';
import { useT } from './i18n';

const IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TOPO = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

const BOUNDS = (() => {
  let a = 90, b = 180, c = -90, d = -180;
  parcels.filter((x) => x.ha < 50).forEach((x) => x.p.forEach((r) => r.forEach(([la, lo]) => {
    a = Math.min(a, la); c = Math.max(c, la); b = Math.min(b, lo); d = Math.max(d, lo);
  })));
  return [[b, a], [d, c]];
})();

const KEY_MATCH = (sel, hot, listed, other) => ['match', ['get', 'k'], 'sel', sel, 'hot', hot, 'listed', listed, other];

/**
 * Real-imagery map: Esri satellite, Esri topographic + hillshade, and a true 3D terrain mode
 * (AWS Terrarium elevation tiles). Parcel polygons come from the client's KML.
 */
export default function ParcelMap({ list, focus, hot, onPick, mode, setMode, className = '' }) {
  const { t, n } = useT();
  const el = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const popupRef = useRef(null);
  const latest = useRef({});
  latest.current = { list, focus, hot, onPick, mode, t, n };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current,
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
          { id: 'hill', type: 'hillshade', source: 'dem', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': '#3d3a2c', 'hillshade-highlight-color': '#ffffff' } },
        ],
      },
      bounds: BOUNDS, fitBoundsOptions: { padding: 30 }, maxPitch: 78, attributionControl: { compact: true },
    });
    mapRef.current = map;
    window.__maps = (window.__maps || []).concat(map);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      map.addSource('parcels', { type: 'geojson', data: parcelFeatureCollection([]) });
      map.addLayer({ id: 'p-fill', type: 'fill', source: 'parcels', paint: {
        'fill-color': KEY_MATCH('#f2b84b', '#f2b84b', '#2fbf85', '#ffffff'),
        'fill-opacity': KEY_MATCH(0.3, 0.32, 0.22, 0.02) } });
      map.addLayer({ id: 'p-line', type: 'line', source: 'parcels', paint: {
        'line-color': KEY_MATCH('#ffd166', '#ffd166', '#6cf0b5', 'rgba(255,255,255,0.7)'),
        'line-width': KEY_MATCH(3.2, 3, 2, 0.8) } });
      map.on('mousemove', 'p-fill', (e) => {
        const f = e.features[0];
        const L = latest.current;
        map.getCanvas().style.cursor = f.properties.listed ? 'pointer' : '';
        if (!popupRef.current) popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: 'dev-pop' });
        popupRef.current.setLngLat(e.lngLat)
          .setHTML(`<b>${L.t('Gat')} ${L.n(f.properties.gat)}</b> · ${L.n(Number(f.properties.ha).toFixed(2))} ${L.t('ha')}${f.properties.listed ? '' : ` · <i>${L.t('not listed')}</i>`}`)
          .addTo(map);
      });
      map.on('mouseleave', 'p-fill', () => { map.getCanvas().style.cursor = ''; popupRef.current && popupRef.current.remove(); });
      map.on('click', 'p-fill', (e) => {
        const f = e.features[0];
        if (f.properties.listed && latest.current.onPick) latest.current.onPick(f.properties.gat);
      });
      map.fire('dev-ready');
      apply();
    });

    function apply() {
      if (!map.getSource('parcels')) return;
      const { list, focus, hot, mode } = latest.current;
      map.getSource('parcels').setData(parcelFeatureCollection(list, { focus, hot }));
      const topo = mode === 'terrain';
      map.setLayoutProperty('sat', 'visibility', topo ? 'none' : 'visible');
      map.setLayoutProperty('topo', 'visibility', topo ? 'visible' : 'none');
      map.setLayoutProperty('hill', 'visibility', topo ? 'visible' : 'none');
      map.setPaintProperty('p-line', 'line-color', KEY_MATCH('#ffd166', '#ffd166', topo ? '#0b7a50' : '#6cf0b5', topo ? 'rgba(90,70,40,0.7)' : 'rgba(255,255,255,0.7)'));
      if (mode === '3d') {
        map.setTerrain({ source: 'dem', exaggeration: 1.6 });
        map.easeTo({ pitch: 62, bearing: -25, duration: 900 });
      } else {
        map.setTerrain(null);
        map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      }
    }
    map.__apply = apply;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Data / mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.loaded()) map.__apply();
    else if (map) map.once('dev-ready', () => map.__apply());
  }, [list, focus, hot, mode]);

  // Focus: pin + fit
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    if (!focus) { map.fitBounds(BOUNDS, { padding: 30, duration: 0 }); return; }
    const p = list.find((x) => x.id === focus);
    if (!p) return;
    if (!p.parcel) { map.jumpTo({ center: [73.5, 18.9], zoom: 8 }); return; } // no location known yet
    const pin = document.createElement('div');
    pin.className = 'dev-pin';
    pin.innerHTML = '<span></span>';
    markerRef.current = new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([p.parcel.c[1], p.parcel.c[0]]).addTo(map);
    let a = 90, b = 180, c = -90, d = -180;
    (p.parcel.p || []).forEach((r) => r.forEach(([la, lo]) => { a = Math.min(a, la); c = Math.max(c, la); b = Math.min(b, lo); d = Math.max(d, lo); }));
    if (a > c) map.jumpTo({ center: [p.parcel.c[1], p.parcel.c[0]], zoom: 16 }); // pin only: no outline to fit
    else map.fitBounds([[b, a], [d, c]], { padding: 50, maxZoom: 18, duration: 0 });
  }, [focus, list]);

  return (
    <div className={`mapwrap ${className}`}>
      <div ref={el} className="mapcanvas" />
      <div className="mapmodes" role="group" aria-label="Map type">
        {[['sat', 'Satellite'], ['terrain', 'Terrain'], ['3d', '3D']].map(([k, label]) => (
          <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{t(label)}</button>
        ))}
      </div>
    </div>
  );
}
