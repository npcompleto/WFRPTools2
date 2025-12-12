
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Map
    const map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: 0
    });

    let currentMapId = null;
    let currentMapPPI = 96;
    let currentLayer = null;
    let poiLayerGroup = L.layerGroup().addTo(map);
    let segmentLayerGroup = L.layerGroup().addTo(map);


    let isAddingPoi = false;
    let isAddingGroupPoi = false;
    let isAddingSegment = false;
    let routePoints = []; // Array of points {latlng, type, id, name}
    let tempPolyline = null; // Dashed line to cursor
    let finishedPolyline = null; // Solid line for established segments
    let startMarker = null;
    let currentRouteMarkers = [];
    let currentPois = []; // Store POIs for easy access
    let quill = null; // Quill instance for POI
    let eventQuill = null; // Quill instance for Events
    let isPlacingEvent = false; // Flag for placing event on map
    let eventToPlace = null; // {title, content} explicit object for placement
    let savedEventsCache = []; // Cache for saved events
    let currentSegments = []; // Store Segments
    let editingSegmentId = null; // Track if we are editing a segment

    // --- Modal Logic ---
    const uploadModal = document.getElementById("uploadModal");
    const poiModal = document.getElementById("poiModal");
    const segmentModal = document.getElementById("segmentModal");
    const btn = document.getElementById("uploadBtn");
    const span = document.getElementsByClassName("close")[0];

    btn.onclick = function () {
        uploadModal.style.display = "block";
    }

    span.onclick = function () {
        uploadModal.style.display = "none";
    }

    const closePoiModal = document.getElementById("closePoiModal");
    if (closePoiModal) {
        closePoiModal.onclick = () => poiModal.style.display = "none";
    }

    const closeSegmentModal = document.getElementById("closeSegmentModal");
    if (closeSegmentModal) {
        closeSegmentModal.onclick = () => segmentModal.style.display = "none";
    }

    window.onclick = function (event) {
        if (event.target == uploadModal) uploadModal.style.display = "none";
        if (event.target == poiModal) poiModal.style.display = "none";
        if (event.target == segmentModal) segmentModal.style.display = "none";
    }

    // --- API Logic ---
    // ... existing loadMaps ... (omitted from start of file for brevity in this replace, but needed context)
    // Wait, I cannot omit context unless I match exactly.
    // Let's just fix the variables at top.


    // --- API Logic ---

    // Load Maps
    async function loadMaps() {
        try {
            const response = await fetch('/api/maps');
            const data = await response.json();

            if (data.success) {
                renderMapList(data.maps);
                // Automatically select first map if available and none selected
                if (data.maps.length > 0 && !currentMapId) {
                    loadMap(data.maps[0]);
                }
            }
        } catch (error) {
            console.error('Error loading maps:', error);
        }
    }

    function renderMapList(maps) {
        const list = document.getElementById('mapList');
        list.innerHTML = '';

        maps.forEach(mapData => {
            const div = document.createElement('div');
            div.className = 'map-list-item';
            div.textContent = mapData.name;
            if (mapData.id === currentMapId) {
                div.classList.add('active');
            }

            div.onclick = () => loadMap(mapData);

            // Delete button (small)
            const delBtn = document.createElement('span');
            delBtn.innerHTML = ' &times;';
            delBtn.style.color = 'red';
            delBtn.style.float = 'right';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Eliminare questa mappa?')) {
                    deleteMap(mapData.id);
                }
            };

            div.appendChild(delBtn);
            list.appendChild(div);
        });
    }

    // Load specific map
    function loadMap(mapData) {
        currentMapId = mapData.id;
        currentMapPPI = mapData.pixels_per_inch || 96;

        // Remove existing layer
        if (currentLayer) {
            map.removeLayer(currentLayer);
        }

        // Render list again to update active state
        // (Optimization: just update classes instead of full render)
        const items = document.querySelectorAll('.map-list-item');
        items.forEach(item => {
            // Simple text check, better to use data attributes but this works for simple case
            if (item.firstChild.textContent === mapData.name) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Calculate bounds
        // In Leaflet CRS.Simple, [0,0] is typically bottom-left.
        // We want the image to match our tile structure.
        // Our backend generates tiles from top-left (0,0) down.
        // However, standard Leaflet XYZ layer expects tiles to map to coordinates.

        // Let's use negative Y to simulate top-left origin if needed,
        // or just map [0,0] to [height, width].

        // CRS.Simple:
        // By default, it maps (0,0) to pixels (0,0).
        // Y grows downwards? No, Y grows upwards in Cartesian.
        // Images usually have (0,0) at top-left, Y grows downwards.
        // Leaflet.map(..., {crs: L.CRS.Simple}) usually handles this by using negative y for image overlays.
        // BUT for TileLayer, it requests tiles based on standard grid.

        // Key issue: Standard Leaflet requests tiles with y growing DOWNWARDS?
        // No, in standard Spherical Mercator:
        // x grows right, y grows DOWN. (TMS uses y grows up).
        // Leaflet defaults to y grows DOWN (Google Maps style).

        // So for our tiles generator:
        // z/x/y.jpg where y=0 is top row.
        // This MATCHES Leaflet default.

        // If we place them at bounds [[0,0], [height, width]], 
        // Leaflet might be confused about which tiles cover that area if CRS is Simple.

        // Let's try defining the bounds as:
        // South-West: [-height, 0]
        // North-East: [0, width]
        // This puts (0,0) at Top-Left.

        const southWest = map.unproject([0, mapData.height], map.getMaxZoom());
        const northEast = map.unproject([mapData.width, 0], map.getMaxZoom());
        // Simple CRS bounds: [[-height, 0], [0, width]]
        const bounds = [[-mapData.height, 0], [0, mapData.width]];

        currentLayer = L.tileLayer(`/static/maps/${mapData.id}/{z}/{x}_{y}.jpg`, {
            minZoom: -mapData.max_zoom,
            maxZoom: 2, // Allow zooming in past 1:1
            maxNativeZoom: 0, // Tiles exist up to Leaflet Zoom 0 (which maps to Backend Max Zoom)
            zoomOffset: mapData.max_zoom, // Shift Leaflet Zoom so: Leaflet -X -> Backend 0
            tileSize: 256,
            noWrap: true,
            tms: false,
            bounds: bounds
        });

        currentLayer.addTo(map);

        // Center Map Logic
        if (mapData.center_poi_id) {
            // If we have a center POI, we need its coordinates.
            // But mapData only gives us ID. 
            // We can wait for loadPois OR we can fetch it now.
            // Actually, get_maps returns center_x and center_y! 
            // Let's check get_maps query in app.py. Yes: p.x as center_x, p.y as center_y
            // BUT loadMap is called with either the result of get_maps OR a manually constructed object (unlikely here).
            // Let's assume mapData has center_x/y if get_maps populated it.
            if (mapData.center_x !== null && mapData.center_y !== null) {
                map.setView([mapData.center_y, mapData.center_x], 0);
            } else {
                map.fitBounds(bounds);
            }
        } else {
            map.fitBounds(bounds);
        }

        // Load POIs for this map
        loadPois(mapData.id);
        loadSegments(mapData.id);

        document.getElementById('poiSection').style.display = 'block';
        document.getElementById('routeSection').style.display = 'block';

        // Initialize Quill if not already done
        if (!quill) {
            quill = new Quill('#poiDescriptionEditor', {
                theme: 'snow'
            });
        }

        // Initialize Event Quill if not already done
        if (!eventQuill) {
            eventQuill = new Quill('#eventContentEditor', {
                theme: 'snow'
            });
        }
    }

    // Upload Map
    document.getElementById('uploadForm').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const submitBtn = e.target.querySelector('button[type="submit"]');

        progressContainer.style.display = 'block';
        submitBtn.disabled = true;
        progressBar.style.width = '0%';
        progressText.textContent = 'Caricamento in corso...';

        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 5;
                progressBar.style.width = Math.min(progress, 90) + '%';
            }
        }, 500);

        try {
            const response = await fetch('/api/maps', {
                method: 'POST',
                body: formData
            });

            clearInterval(interval);
            progressBar.style.width = '100%';
            progressText.textContent = 'Elaborazione completata!';

            const result = await response.json();

            if (result.success) {
                setTimeout(() => {
                    uploadModal.style.display = "none";
                    progressContainer.style.display = 'none';
                    progressBar.style.width = '0%';
                    e.target.reset();
                    submitBtn.disabled = false;
                    loadMaps(); // Reload list
                }, 1000);
            } else {
                alert('Errore caricamento: ' + result.error);
                progressContainer.style.display = 'none';
                submitBtn.disabled = false;
            }
        } catch (error) {
            clearInterval(interval);
            console.error('Error uploading:', error);
            alert('Errore di rete durante il caricamento');
            progressContainer.style.display = 'none';
            submitBtn.disabled = false;
        }
    };

    // Delete Map
    async function deleteMap(id) {
        try {
            const response = await fetch(`/api/maps/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                if (currentMapId === id) {
                    currentMapId = null;
                    if (currentLayer) {
                        map.removeLayer(currentLayer);
                        currentLayer = null;
                    }
                }
                loadMaps();
            }
        } catch (error) {
            console.error('Error deleting:', error);
        }
    }

    // Initial load
    loadMaps();

    // Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const closeSidebar = document.getElementById('closeSidebar');

    if (closeSidebar) {
        closeSidebar.onclick = () => {
            sidebar.classList.add('hidden');
            sidebarToggle.style.display = 'block';
        };
    }

    if (sidebarToggle) {
        sidebarToggle.onclick = () => {
            sidebar.classList.remove('hidden');
            sidebarToggle.style.display = 'none';
        };
    }

    // --- POI Logic ---
    const addGroupPoiBtn = document.getElementById('addGroupPoiBtn');
    if (addGroupPoiBtn) {
        addGroupPoiBtn.onclick = () => {
            // Toggle off others
            if (isAddingPoi) document.getElementById('addPoiBtn').click();
            if (isAddingSegment) document.getElementById('addRouteBtn').click();

            isAddingGroupPoi = !isAddingGroupPoi;
            if (isAddingGroupPoi) {
                addGroupPoiBtn.classList.remove('btn-secondary');
                addGroupPoiBtn.classList.add('btn-primary');
                document.getElementById('map').style.cursor = 'crosshair';
            } else {
                addGroupPoiBtn.classList.remove('btn-primary');
                addGroupPoiBtn.classList.add('btn-secondary');
                document.getElementById('map').style.cursor = '';
            }
        };
    }

    const addPoiBtn = document.getElementById('addPoiBtn');

    addPoiBtn.onclick = () => {
        if (isAddingSegment) resetRouteMode();
        if (isAddingGroupPoi) document.getElementById('addGroupPoiBtn').click();

        isAddingPoi = !isAddingPoi;
        if (isAddingPoi) {
            addPoiBtn.classList.remove('btn-secondary');
            addPoiBtn.classList.add('btn-primary');
            addPoiBtn.textContent = 'Annulla';
            document.getElementById('map').style.cursor = 'crosshair';
        } else {
            addPoiBtn.classList.remove('btn-primary');
            addPoiBtn.classList.add('btn-secondary');
            addPoiBtn.textContent = '+';
            document.getElementById('map').style.cursor = '';
        }
    };

    map.on('click', (e) => {
        if (isAddingPoi && currentMapId) {
            // If we were adding a POI, open modal for NEW poi
            editingPoiId = null;
            document.getElementById('poiForm').reset();
            document.getElementById('poiX').value = e.latlng.lng;
            document.getElementById('poiY').value = e.latlng.lat;
            document.getElementById('poiModal').querySelector('h2').textContent = 'Aggiungi Punto di Interesse';
            if (quill) quill.setContents([]); // Clear Quill
            document.getElementById('poiModal').style.display = "block";

            // Reset mode
            isAddingPoi = false;
            addPoiBtn.classList.remove('btn-primary');
            addPoiBtn.classList.add('btn-secondary');
            addPoiBtn.textContent = '+';
            document.getElementById('map').style.cursor = '';
            addPoiBtn.textContent = '+';
            document.getElementById('map').style.cursor = '';
        } else if (isAddingGroupPoi && currentMapId) {
            createGroupPoi(e.latlng);
        } else if (isAddingSegment && currentMapId) {
            handleRouteSelection({ type: 'point', latlng: e.latlng });
        } else if (isPlacingEvent && currentMapId) {
            // Place Event Logic
            placeEventOnMap(e.latlng);
        }
    });

    async function createGroupPoi(latlng) {
        // Check if exists
        const existing = currentPois.find(p => p.type === 'Gruppo');
        if (existing) {
            if (confirm("Spostare il segnalino Gruppo qui?")) {
                try {
                    await fetch(`/api/pois/${existing.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ x: latlng.lng, y: latlng.lat })
                    });
                    loadPois(currentMapId);
                } catch (e) { console.error(e); }
            }
        } else {
            try {
                await fetch(`/api/maps/${currentMapId}/pois`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: 'Gruppo',
                        type: 'Gruppo',
                        x: latlng.lng,
                        y: latlng.lat,
                        description: 'Posizione del gruppo'
                    })
                });
                loadPois(currentMapId);
            } catch (e) { console.error(e); }
        }
        // Reset mode
        document.getElementById('addGroupPoiBtn').click();
    }

    // Variable to track if we are editing
    let editingPoiId = null;

    document.getElementById('poiForm').onsubmit = async (e) => {
        e.preventDefault();
        if (!currentMapId) return;

        const formData = new FormData(e.target);
        // Get content from Quill
        if (quill) {
            formData.set('description', quill.root.innerHTML);
        }
        const data = Object.fromEntries(formData.entries());

        const method = editingPoiId ? 'PUT' : 'POST';
        const url = editingPoiId ? `/api/pois/${editingPoiId}` : `/api/maps/${currentMapId}/pois`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                document.getElementById('poiModal').style.display = "none";
                e.target.reset();
                editingPoiId = null; // Reset
                loadPois(currentMapId);
            } else {
                alert('Errore: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving POI:', error);
        }
    };

    function handleRouteSelection(point) {
        // Add point to list
        routePoints.push(point);

        // Marker for this point
        const marker = L.circleMarker([point.latlng.lat, point.latlng.lng], {
            color: 'green',
            radius: 4
        }).addTo(map);
        currentRouteMarkers.push(marker);

        if (routePoints.length === 1) {
            // First point
            startMarker = marker; // Keep reference to first
            startMarker.setRadius(8);
            document.getElementById('addRouteBtn').textContent = 'Seleziona prossimo...';
            map.on('mousemove', drawTempLine);
        } else {
            // Update finished polyline
            const latlngs = routePoints.map(p => [p.latlng.lat, p.latlng.lng]);
            if (finishedPolyline) map.removeLayer(finishedPolyline);
            finishedPolyline = L.polyline(latlngs, { color: 'blue', weight: 3 }).addTo(map);

            // Check if this point is a POI (and not the first one, which we just handled)
            // If it is a POI, we finish.
            if (point.type === 'poi') {
                finishRouteCreation();
            } else {
                document.getElementById('addRouteBtn').textContent = 'Seleziona POI per finire...';
            }
        }
    }

    function finishRouteCreation() {
        if (routePoints.length < 2) return;

        const startPoint = routePoints[0];
        const endPoint = routePoints[routePoints.length - 1];

        // Cleanup temporary
        map.off('mousemove', drawTempLine);
        if (tempPolyline) map.removeLayer(tempPolyline);
        // Don't remove finishedPolyline yet, wait for save

        // Open Modal
        document.getElementById('segmentStartName').textContent = startPoint.name || 'Punto Iniziale';
        document.getElementById('segmentEndName').textContent = endPoint.name || 'Punto Finale';

        // Calculate Total Distance
        let totalDistancePixels = 0;
        for (let i = 0; i < routePoints.length - 1; i++) {
            const p1 = routePoints[i].latlng;
            const p2 = routePoints[i + 1].latlng;

            const dx = p1.lng - p2.lng;
            const dy = p1.lat - p2.lat;
            totalDistancePixels += Math.sqrt(dx * dx + dy * dy);
        }

        const ppi = currentMapPPI || 96;
        const inches = totalDistancePixels / ppi;
        const km = inches * 15;

        document.getElementById('segmentDistance').value = km.toFixed(2);

        // Store data
        segmentModal.dataset.startData = JSON.stringify(startPoint);
        segmentModal.dataset.endData = JSON.stringify(endPoint);
        segmentModal.dataset.points = JSON.stringify(routePoints);

        segmentModal.style.display = "block";

        // Reset mode internally but UI stays until save/cancel
        isAddingSegment = false;
        document.getElementById('map').style.cursor = '';
        addRouteBtn.classList.remove('btn-primary');
        addRouteBtn.classList.add('btn-secondary');
        addRouteBtn.textContent = '+';
        map.off('mousemove', drawTempLine);
    }

    function drawTempLine(e) {
        if (routePoints.length === 0) return;

        const lastPoint = routePoints[routePoints.length - 1];

        if (tempPolyline) map.removeLayer(tempPolyline);

        tempPolyline = L.polyline([
            [lastPoint.latlng.lat, lastPoint.latlng.lng],
            [e.latlng.lat, e.latlng.lng]
        ], { color: 'red', dashArray: '5, 10' }).addTo(map);
    }

    function resetRouteMode() {
        isAddingSegment = false;
        routePoints = [];
        if (tempPolyline) map.removeLayer(tempPolyline);
        if (finishedPolyline) map.removeLayer(finishedPolyline);
        currentRouteMarkers.forEach(m => map.removeLayer(m));
        currentRouteMarkers = [];
        startMarker = null;
        map.off('mousemove', drawTempLine);

        const btn = document.getElementById('addRouteBtn');
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        btn.textContent = '+';
        document.getElementById('map').style.cursor = '';
    }

    async function loadPois(mapId) {
        try {
            const response = await fetch(`/api/maps/${mapId}/pois`);
            const data = await response.json();

            if (data.success) {
                currentPois = data.pois;
                renderPois(data.pois);
            }
        } catch (error) {
            console.error('Error loading POIs:', error);
        }
    }

    function renderPois(pois) {
        poiLayerGroup.clearLayers();
        const list = document.getElementById('poiList');
        list.innerHTML = '';

        pois.forEach(poi => {
            if (poi.type === 'Gruppo') {
                // Special Group Marker
                var greenIcon = new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });

                const groupMarker = L.marker([poi.y, poi.x], {
                    icon: greenIcon,
                    draggable: true,
                    zIndexOffset: 1000 // Ensure it's on top
                });

                groupMarker.on('dragend', async (event) => {
                    const newPos = event.target.getLatLng();
                    try {
                        await fetch(`/api/pois/${poi.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ x: newPos.lng, y: newPos.lat })
                        });
                        // Don't need full reload, just update local model if needed
                        poi.x = newPos.lng;
                        poi.y = newPos.lat;
                    } catch (e) { console.error("Error updating group pos", e); }
                });

                const popupContent = `
                    <strong>Gruppo</strong><br>
                    <button onclick="deletePoi(${poi.id})" style="color:red; font-size:0.8em; cursor:pointer;">Rimuovi Gruppo</button>
                `;
                groupMarker.bindPopup(popupContent);
                poiLayerGroup.addLayer(groupMarker);
                return; // Do not add to list
            }

            // Add Marker
            // Leaflet standard marker
            let markerOptions = {};
            if (poi.type === 'Evento') {
                // Red icon for events
                var redIcon = new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });
                markerOptions = { icon: redIcon };
            }
            const marker = L.marker([poi.y, poi.x], markerOptions);

            const popupContent = `
                <strong>${poi.name}</strong><br>
                <em>${poi.type}</em><br>
                ${poi.population ? `Pop: ${poi.population}<br>` : ''}
                <div class="poi-description-content" style="max-height: 200px; overflow-y: auto;">
                    ${poi.description || ''}
                </div>
                <div style="margin-top:5px; display:flex; gap:5px; flex-wrap:wrap;">
                    ${poi.type !== 'Evento' ? `<button onclick="editPoi(${poi.id})" style="font-size:0.8em;">Modifica</button>` : `<button onclick="editPoi(${poi.id})" style="font-size:0.8em;">Modifica</button>`}
                    <button onclick="setMapCenter(${poi.id})" style="font-size:0.8em;">Imposta Centro</button>
                    <button onclick="deletePoi(${poi.id})" style="color:red; font-size:0.8em;">Elimina</button>
                </div>
            `;

            marker.bindPopup(popupContent, { maxWidth: 400 });

            marker.on('click', (e) => {
                if (isAddingSegment) {
                    // Stop event from propagating to map click
                    L.DomEvent.stopPropagation(e);
                    // Prevent/Close popup if we are just selecting a point
                    e.target.closePopup();
                    handleRouteSelection({ type: 'poi', id: poi.id, name: poi.name, latlng: e.latlng });
                }
            });

            poiLayerGroup.addLayer(marker);

            // Add List Item
            const div = document.createElement('div');
            div.className = 'map-list-item'; // Reuse styling
            div.innerHTML = `
                <div><strong>${poi.name}</strong> <small>(${poi.type})</small></div>
            `;

            div.onclick = () => {
                map.setView([poi.y, poi.x], map.getZoom() > 0 ? map.getZoom() : 0);
                marker.openPopup();
            };

            list.appendChild(div);
        });
    }

    // Make deletePoi globally accessible for popup button
    window.deletePoi = async function (id) {
        if (!confirm('Eliminare questo POI?')) return;

        try {
            const response = await fetch(`/api/pois/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                loadPois(currentMapId);
            }
        } catch (error) {
            console.error('Error deleting POI:', error);
        }
    };
    // --- Route/Segment Logic ---
    const addRouteBtn = document.getElementById('addRouteBtn');

    addRouteBtn.onclick = () => {
        // If adding POI, cancel that
        if (isAddingPoi) {
            isAddingPoi = false;
            addPoiBtn.classList.remove('btn-primary');
            addPoiBtn.classList.add('btn-secondary');
            addPoiBtn.textContent = '+';
        }
        if (isAddingGroupPoi) document.getElementById('addGroupPoiBtn').click();

        isAddingSegment = !isAddingSegment;
        if (isAddingSegment) {
            addRouteBtn.classList.remove('btn-secondary');
            addRouteBtn.classList.add('btn-primary');
            addRouteBtn.textContent = 'Seleziona inizio...';
            document.getElementById('map').style.cursor = 'crosshair';
            routePoints = [];
            currentRouteMarkers = [];
            if (finishedPolyline) map.removeLayer(finishedPolyline);

            // Reset Edit State just in case
            editingSegmentId = null;
            document.getElementById('segmentModal').querySelector('h2').textContent = 'Salva Segmento';
        } else {
            resetRouteMode();
        }
    };

    document.getElementById('segmentForm').onsubmit = async (e) => {
        e.preventDefault();

        const distance = document.getElementById('segmentDistance').value;
        const description = document.getElementById('segmentDescription').value;
        const transport = document.getElementById('segmentTransport').value;

        if (editingSegmentId) {
            // Update existing
            try {
                const response = await fetch(`/api/segments/${editingSegmentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        distance: distance,
                        description: description,
                        transport: transport
                    })
                });
                const result = await response.json();
                if (result.success) {
                    segmentModal.style.display = "none";
                    e.target.reset();
                    editingSegmentId = null;
                    loadSegments(currentMapId);
                } else {
                    alert('Errore: ' + result.error);
                }
            } catch (error) { console.error("Error updating segment", error); }
            return;
        }

        // Create New
        const startData = JSON.parse(segmentModal.dataset.startData);
        const endData = JSON.parse(segmentModal.dataset.endData);
        const points = JSON.parse(segmentModal.dataset.points || "[]");
        // ... continue existing creation logic

        // Simplify points for payload [ [lng, lat], ... ]
        // Note: Backend expects start_x, start_y ... 
        // We will send start/end too for compatibility but also 'points' list
        const pointsArray = points.map(p => [p.latlng.lat, p.latlng.lng]); // Leaflet format is [lat, lng]

        const payload = {
            start_x: startData.latlng.lng,
            start_y: startData.latlng.lat,
            end_x: endData.latlng.lng,
            end_y: endData.latlng.lat,
            distance: distance,
            description: description,
            points: pointsArray,
            description: description,
            points: pointsArray,
            transport: transport
        };

        if (startData.type === 'poi') payload.start_poi_id = startData.id;
        if (endData.type === 'poi') payload.end_poi_id = endData.id;

        try {
            const response = await fetch(`/api/maps/${currentMapId}/segments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.success) {
                segmentModal.style.display = "none";
                e.target.reset();
                loadSegments(currentMapId);
            } else {
                alert('Errore: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding segment:', error);
        }
    };

    async function loadSegments(mapId) {
        try {
            const response = await fetch(`/api/maps/${mapId}/segments`);
            const data = await response.json();

            if (data.success) {
                currentSegments = data.segments;
                renderSegments(data.segments);
            }
        } catch (error) {
            console.error('Error loading segments:', error);
        }
    }

    function renderSegments(segments) {
        segmentLayerGroup.clearLayers();
        const list = document.getElementById('routeList');
        list.innerHTML = '';

        segments.forEach(seg => {
            // Parse Points if available
            let latlngs = [];
            if (seg.points) {
                try {
                    const points = JSON.parse(seg.points);
                    // stored as [lat, lng] array
                    latlngs = points.map(p => {
                        if (p.latlng) return [p.latlng.lat, p.latlng.lng];
                        return p;
                    });
                } catch (e) { console.error("Error parsing segment points", e); }
            }

            // Fallback for old segments
            if (latlngs.length === 0) {
                latlngs = [
                    [seg.start_y, seg.start_x],
                    [seg.end_y, seg.end_x]
                ];
            }

            // Draw Line
            const polyline = L.polyline(latlngs, {
                color: 'red',
                weight: 5,
                opacity: 0.8,
            }).addTo(segmentLayerGroup);

            // Calculate time
            const speed = {
                'piedi': 4.8,
                'cavallo': 12.8,
                'carrozza': 3.75,
                'diligenza': 5.25,
                'barca': 3.75
            }[seg.transport || 'piedi'] || 4.8;

            const hours = parseFloat(seg.distance) / speed;
            const timeStr = hours < 1 ? `${Math.round(hours * 60)} min` : `${hours.toFixed(1)} ore`;


            // Popup on line?
            const label = `${seg.start_poi_name || 'Punto'} ↔ ${seg.end_poi_name || 'Punto'}`;
            polyline.bindPopup(`
                <strong>Itinerario</strong><br>
                ${label}<br>
                Distanza: ${seg.distance} km<br>
                Tempo: ${timeStr} (${seg.transport || 'piedi'})<br>
                ${seg.description ? `<em>${seg.description}</em><br>` : ''}
                <div style="margin-top:5px; display:flex; gap:5px;">
                    <button onclick="editSegment(${seg.id})" style="font-size:0.8em;">Modifica</button>
                    <button onclick="deleteSegment(${seg.id})" style="color:red; font-size:0.8em;">Elimina</button>
                </div>
            `);

            // List Item
            const div = document.createElement('div');
            div.className = 'map-list-item';
            div.innerHTML = `
                <div><strong>${label}</strong></div>
                <div style="font-size: 0.85em; color: #aaa;">
                    ${seg.distance} km - ${timeStr} (${seg.transport || 'piedi'})<br>
                    ${seg.description || ''}
                </div>
            `;

            div.onclick = () => {
                map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
                polyline.openPopup();
            };

            list.appendChild(div);
        });
    }

    window.deleteSegment = async function (id) {
        if (!confirm('Eliminare questo segmento?')) return;

        try {
            const response = await fetch(`/api/segments/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                loadSegments(currentMapId);
            }
        } catch (error) {
            console.error('Error deleting segment:', error);
        }
    };

    window.editSegment = function (id) {
        const seg = currentSegments.find(s => s.id === id);
        if (!seg) return;

        editingSegmentId = id;
        document.getElementById('segmentDistance').value = seg.distance;
        document.getElementById('segmentDescription').value = seg.description || '';
        document.getElementById('segmentTransport').value = seg.transport || 'piedi';

        const startName = seg.start_poi_name || 'Punto';
        const endName = seg.end_poi_name || 'Punto';
        document.getElementById('segmentStartName').textContent = startName;
        document.getElementById('segmentEndName').textContent = endName;

        document.getElementById('segmentModal').querySelector('h2').textContent = 'Modifica Segmento';
        segmentModal.style.display = "block";
    };

    window.editPoi = function (id) {
        const poi = currentPois.find(p => p.id === id);
        if (!poi) return;

        editingPoiId = id;
        document.getElementById('poiX').value = poi.x;
        document.getElementById('poiY').value = poi.y;
        document.getElementById('poiName').value = poi.name;
        document.getElementById('poiType').value = poi.type;
        document.getElementById('poiPopulation').value = poi.population;
        // Set Quill content
        if (quill) {
            quill.root.innerHTML = poi.description || '';
        }

        // If it's an event, we might want to use the Event Editor? 
        // For simplicity, we use the standard POI editor which now supports Rich Text.
        // The user can edit "Evento" type POIs just like regular ones.

        document.getElementById('poiModal').querySelector('h2').textContent = 'Modifica Punto di Interesse';
        document.getElementById('poiModal').style.display = "block";
    };

    async function placeEventOnMap(latlng) {
        let content = '';
        let title = '';

        if (eventToPlace) {
            content = eventToPlace.content;
            title = eventToPlace.title;
        } else {
            // Placing from modal
            if ((!currentEventContent && !eventQuill)) return;
            content = eventQuill ? eventQuill.root.innerHTML : currentEventContent;
            const inputTitle = document.getElementById('eventTitle').value;
            title = inputTitle || ("Evento: " + (eventQuill ? eventQuill.getText().substring(0, 20) : "Nuovo") + "...");
        }

        const payload = {
            map_id: currentMapId,
            name: title,
            type: 'Evento',
            description: content,
            population: '',
            x: latlng.lng,
            y: latlng.lat
        };

        try {
            const response = await fetch(`/api/maps/${currentMapId}/pois`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.success) {
                //alert('Evento piazzato!'); // User said "not alert"
                isPlacingEvent = false;
                eventToPlace = null; // Reset
                document.getElementById('map').style.cursor = '';
                loadPois(currentMapId);
            } else {
                alert('Errore: ' + result.error);
            }
        } catch (error) {
            console.error('Error placing event:', error);
        }
    }

    window.setMapCenter = async function (id) {
        if (!currentMapId) return;
        try {
            const response = await fetch(`/api/maps/${currentMapId}/center`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ poi_id: id })
            });
            const result = await response.json();
            if (result.success) {
                alert('Centro mappa aggiornato!');
            } else {
                alert('Errore: ' + result.error);
            }
        } catch (error) {
            console.error('Error setting center:', error);
        }
    };

    // --- Gemini Event Generator ---
    const generateEventBtn = document.getElementById('generateEventBtn');
    // --- Event Logic with Save ---
    const eventModal = document.getElementById('eventModal');
    const closeEventModal = document.getElementById('closeEventModal');
    const placeEventBtn = document.getElementById('placeEventBtn');
    let currentEventContent = '';
    let currentEventType = 'Generico';
    let editingSavedEventId = null; // Track if we are editing an existing saved event
    // eventToPlace declared globally
    let currentEventImageFilename = null; // Track current image filename

    // Image Handling Functions
    window.previewEventImage = function (input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            document.getElementById('eventImageName').textContent = file.name;
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('eventImagePreview').src = e.target.result;
                document.getElementById('eventImagePreviewContainer').style.display = 'block';
                document.getElementById('removeEventImageBtn').style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    };

    window.removeEventImage = function () {
        document.getElementById('eventImageInput').value = '';
        document.getElementById('eventImageName').textContent = 'Nessuna immagine';
        document.getElementById('eventImagePreview').src = '';
        document.getElementById('eventImagePreviewContainer').style.display = 'none';
        document.getElementById('removeEventImageBtn').style.display = 'none';
        currentEventImageFilename = null; // Mark as removed
    };

    function resetEventImageInput() {
        window.removeEventImage();
        currentEventImageFilename = null;
    }


    async function generateEvent(url, type) {
        // Clear editor
        if (eventQuill) eventQuill.setContents([]);
        else return; // Should allow fallback?

        eventQuill.root.innerHTML = '<em>Consultando gli oracoli...</em>';
        document.getElementById('eventTitle').value = "Evento " + type; // Default title
        resetEventImageInput(); // Reset image
        saveEventBtn.style.display = 'none';
        saveEventBtn.textContent = 'Salva in Lista';
        editingSavedEventId = null; // Reset editing state
        placeEventBtn.style.display = 'none';
        eventModal.style.display = 'block';

        try {
            const response = await fetch(url, { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                currentEventContent = result.event; // Raw text (maybe markdown?)
                currentEventType = type;

                // Assuming result.event is text, convert newlines to BR if needed, 
                // but Quill handles HTML. 
                // If the generator returns Markdown, we might want to parse it. 
                // For now, let's treat it as text with line breaks.
                const formatted = result.event.replace(/\n/g, '<br>');
                eventQuill.root.innerHTML = formatted;

                saveEventBtn.style.display = 'inline-block';
                placeEventBtn.style.display = 'inline-block';
            } else {
                eventQuill.root.innerHTML = `<span style="color:red">Errore: ${result.error}</span>`;
            }
        } catch (error) {
            console.error('Error generating event:', error);
            eventQuill.root.innerHTML = `<span style="color:red">Errore di connessione.</span>`;
        }
    }

    if (generateEventBtn) {
        generateEventBtn.onclick = () => generateEvent('/api/generate_event', 'Generico');
    }

    if (generateNightEventBtn) {
        generateNightEventBtn.onclick = () => generateEvent('/api/generate_night_event', 'Notte');
    }

    if (saveEventBtn) {
        saveEventBtn.onclick = async () => {
            try {
                // Use Quill content
                const content = eventQuill ? eventQuill.root.innerHTML : currentEventContent;
                const title = document.getElementById('eventTitle').value || 'Evento';

                // Handle Image Upload First
                let finalImageFilename = currentEventImageFilename;
                const imageInput = document.getElementById('eventImageInput');

                if (imageInput.files && imageInput.files[0]) {
                    const formData = new FormData();
                    formData.append('image', imageInput.files[0]);

                    try {
                        const upRes = await fetch('/api/events/upload_image', {
                            method: 'POST',
                            body: formData
                        });
                        const upData = await upRes.json();
                        if (upData.success) {
                            finalImageFilename = upData.filename;
                        } else {
                            alert('Errore caricamento immagine: ' + upData.error);
                            return; // Stop saving if upload fails
                        }
                    } catch (e) {
                        alert('Errore caricamento immagine.');
                        console.error(e);
                        return;
                    }
                }

                const payload = {
                    title: title,
                    content: content,
                    type: currentEventType,
                    image_filename: finalImageFilename
                };

                let response;
                if (editingSavedEventId) {
                    // Update existing
                    response = await fetch(`/api/saved_events/${editingSavedEventId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Create new
                    response = await fetch('/api/saved_events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                const result = await response.json();
                if (result.success) {
                    alert('Evento salvato!');
                    // Do not close modal automatically, allow placing too?
                    // eventModal.style.display = 'none';
                    loadSavedEvents();
                } else {
                    alert('Errore salvataggio: ' + result.error);
                }
            } catch (error) {
                console.error('Error saving event:', error);
            }
        };
    }

    if (placeEventBtn) {
        placeEventBtn.onclick = () => {
            if (!currentMapId) {
                alert("Seleziona prima una mappa!");
                return;
            }
            // updates current content from quill before placing
            currentEventContent = eventQuill.root.innerHTML;
            const title = document.getElementById('eventTitle').value;
            // We set eventToPlace so logic knows we are placing this specific one
            eventToPlace = { title: title, content: currentEventContent };

            eventModal.style.display = 'none';
            isPlacingEvent = true;
            document.getElementById('map').style.cursor = 'crosshair';

            // Show a toast or small info?
            // For now just cursor change.
        };
    }

    if (closeEventModal) {
        closeEventModal.onclick = () => {
            eventModal.style.display = 'none';
            isPlacingEvent = false; // Cancel placement if they close modal? 
            // Actually they close modal to cancel generation. 
            // If they clicked "Place", modal is already closed.
        };
    }

    // --- Saved Events Sidebar ---
    async function loadSavedEvents() {
        try {
            const response = await fetch('/api/saved_events');
            const data = await response.json();
            if (data.success) {
                savedEventsCache = data.events;
                renderSavedEvents(data.events);
            }
        } catch (error) {
            console.error('Error loading saved events:', error);
        }
    }

    function renderSavedEvents(events) {
        const list = document.getElementById('savedEventsList');
        if (!list) return;
        list.innerHTML = '';

        events.forEach(event => {
            const div = document.createElement('div');
            div.className = 'map-list-item'; // Reuse style
            div.style.cursor = 'default';

            // Format content preview
            const preview = event.content.length > 100 ? event.content.substring(0, 100) + '...' : event.content;

            div.innerHTML = `
                <div style="font-size: 0.8em; color: var(--accent-color); margin-bottom: 5px; display:flex; justify-content:space-between;">
                   <span>${event.type} - ${new Date(event.created_at).toLocaleDateString()}</span>
                   <div>
                        <span title="Piazza sulla Mappa" style="cursor:pointer; margin-right:8px;" onclick="placeSavedEventOnMap(${event.id})">📍</span>
                        <span style="cursor:pointer; color:red;" onclick="deleteSavedEvent(${event.id})">&times;</span>
                   </div>
                </div>
                ${event.image_filename ?
                    `<div style="margin-bottom:5px; text-align:center;">
                        <img src="/static/uploads/events/${event.image_filename}" style="max-width:100%; max-height:100px; border-radius:4px; border:1px solid #444;">
                     </div>` : ''
                }
                <div style="font-weight:bold; margin-bottom: 5px;">${event.title || 'Senza Titolo'}</div>
                <div style="font-size: 0.9em; white-space: pre-wrap;">${preview}</div>
            `;

            // Allow expanding/editing on click
            div.onclick = (e) => {
                if (e.target.tagName !== 'SPAN') { // Don't trigger on delete/place listeners
                    editSavedEvent(event.id);
                }
            };

            list.appendChild(div);
        });
    }

    window.placeSavedEventOnMap = function (id) {
        const event = savedEventsCache.find(e => e.id === id);
        if (!event) return;

        if (!currentMapId) {
            alert("Seleziona prima una mappa!");
            return;
        }

        eventToPlace = { title: event.title || 'Evento', content: event.content };
        isPlacingEvent = true;
        document.getElementById('map').style.cursor = 'crosshair';
    };

    window.deleteSavedEvent = async function (id) {
        if (!confirm('Eliminare questo evento salvato?')) return;
        try {
            const response = await fetch(`/api/saved_events/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadSavedEvents();
            }
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    };

    window.editSavedEvent = function (id) {
        const event = savedEventsCache.find(e => e.id === id);
        if (!event) return;

        editingSavedEventId = id;
        currentEventType = event.type;
        currentEventContent = event.content;

        document.getElementById('eventTitle').value = event.title;
        if (eventQuill) eventQuill.root.innerHTML = event.content;

        // Load existing image if any
        currentEventImageFilename = event.image_filename || null;
        if (currentEventImageFilename) {
            document.getElementById('eventImageName').textContent = currentEventImageFilename;
            document.getElementById('eventImagePreview').src = `/static/uploads/events/${currentEventImageFilename}`;
            document.getElementById('eventImagePreviewContainer').style.display = 'block';
            document.getElementById('removeEventImageBtn').style.display = 'block';
        } else {
            resetEventImageInput();
        }

        saveEventBtn.textContent = 'Aggiorna';
        saveEventBtn.style.display = 'inline-block';
        placeEventBtn.style.display = 'inline-block'; // Allow placing while editing

        eventModal.style.display = 'block';
    };

    // Initial Load
    loadSavedEvents();

});


