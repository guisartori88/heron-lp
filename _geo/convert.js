const fs = require('fs');

const WIDTH = 500;
const HEIGHT = 540;
const PADDING = 15;

const br = JSON.parse(fs.readFileSync('./_geo/br.json', 'utf8'));

let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;

function walkCoords(geojson, fn) {
  const features = geojson.features || [geojson];
  for (const f of features) {
    const geom = f.geometry || f;
    const coords = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    for (const poly of coords) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          fn(lon, lat);
        }
      }
    }
  }
}

walkCoords(br, (lon, lat) => {
  if (lon < minLon) minLon = lon;
  if (lon > maxLon) maxLon = lon;
  if (lat < minLat) minLat = lat;
  if (lat > maxLat) maxLat = lat;
});

const lonRange = maxLon - minLon;
const latRange = maxLat - minLat;
const scaleX = (WIDTH - PADDING * 2) / lonRange;
const scaleY = (HEIGHT - PADDING * 2) / latRange;
const scale = Math.min(scaleX, scaleY);

const offsetX = PADDING + ((WIDTH - PADDING * 2) - lonRange * scale) / 2;
const offsetY = PADDING + ((HEIGHT - PADDING * 2) - latRange * scale) / 2;

function project(lon, lat) {
  const x = (lon - minLon) * scale + offsetX;
  const y = (maxLat - lat) * scale + offsetY;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function geojsonToPath(geojson) {
  const features = geojson.features || [geojson];
  const parts = [];
  for (const f of features) {
    const geom = f.geometry || f;
    const coords = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    for (const poly of coords) {
      for (const ring of poly) {
        const pts = ring.map(([lon, lat]) => project(lon, lat));
        parts.push('M' + pts.map(p => p.join(',')).join(' L') + ' Z');
      }
    }
  }
  return parts.join(' ');
}

function centroid(geojson) {
  let sumX = 0, sumY = 0, count = 0;
  walkCoords(geojson, (lon, lat) => {
    const [x, y] = project(lon, lat);
    sumX += x; sumY += y; count++;
  });
  return [Math.round(sumX / count), Math.round(sumY / count)];
}

const brPath = geojsonToPath(br);

const states = ['ba', 'es', 'pr', 'sc', 'rs'];
const labels = { ba: 'BA', es: 'ES', pr: 'PR', sc: 'SC', rs: 'RS' };

let statesSvg = '';
let dotsSvg = '';
let labelsSvg = '';

for (const st of states) {
  const geo = JSON.parse(fs.readFileSync(`./_geo/${st}.json`, 'utf8'));
  const path = geojsonToPath(geo);
  const [cx, cy] = centroid(geo);

  statesSvg += `              <!-- ${labels[st]} -->\n`;
  statesSvg += `              <path d="${path}" fill="rgba(237,202,101,0.15)" stroke="url(#map-gold)" stroke-width="1" stroke-linejoin="round"/>\n`;

  dotsSvg += `              <circle cx="${cx}" cy="${cy}" r="18" fill="url(#dot-glow)"/>\n`;
  dotsSvg += `              <circle cx="${cx}" cy="${cy}" r="4.5" fill="#EDCA65"/>\n`;

  labelsSvg += `              <text x="${cx + 12}" y="${cy + 5}" fill="#EDCA65" font-size="13" font-weight="600" font-family="Inter,sans-serif">${labels[st]}</text>\n`;
}

const svg = `            <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa do Brasil com 5 estados atendidos em destaque">
              <defs>
                <linearGradient id="map-gold" x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}">
                  <stop stop-color="#EDCA65"/><stop offset="1" stop-color="#B3832F"/>
                </linearGradient>
                <radialGradient id="dot-glow">
                  <stop offset="0%" stop-color="#EDCA65" stop-opacity="0.5"/>
                  <stop offset="100%" stop-color="#EDCA65" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <!-- Brasil -->
              <path d="${brPath}" fill="rgba(237,202,101,0.03)" stroke="rgba(237,202,101,0.2)" stroke-width="1" stroke-linejoin="round"/>
${statesSvg}${dotsSvg}${labelsSvg}            </svg>`;

fs.writeFileSync('./_geo/brazil-map.svg.txt', svg, 'utf8');
console.log('SVG gerado em _geo/brazil-map.svg.txt');
console.log(`Bounds: lon [${minLon}, ${maxLon}] lat [${minLat}, ${maxLat}]`);
