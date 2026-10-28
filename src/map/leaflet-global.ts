import L from 'leaflet'
// leaflet.markercluster expects a global `L`.
;(window as unknown as { L: typeof L }).L = L
export default L
