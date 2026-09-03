// ═══ STATE ═══
let routes=[], drivers={}, viagens={}, posicoes={};
let currentDriver=null, currentTrip=null, currentRouteIdx=-1, _justEndedTripId=null;
let geoWatchId=null, tripTimerInterval=null, tripStartTs=null;
let driverMap=null, driverMarker=null, stopMarkers=[];
let monitorMap=null, monitorMarkers={}, monitorMapInit=false;
// Mapbox specific
let _mbTruckMarker=null, _mbStopMarkers=[], _mbMap=null;
let _routeGeometry=[], _routeLayerDone=null, _routeLayerRest=null;
let db=null, storage=null, firebaseReady=false, isEditing=false, editingIndex=-1, editData={};
let notifications=[], notifPanelOpen=false;
let adminMode=false, _cryptoKey=null;
