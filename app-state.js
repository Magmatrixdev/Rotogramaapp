// ═══ STATE ═══
let routes=[], drivers={};
let currentDriver=null, currentRouteIdx=-1;
let db=null, storage=null, firebaseReady=false, isEditing=false, editingIndex=-1, editData={};
let notifications=[], notifPanelOpen=false;
let adminMode=false, _cryptoKey=null;
