
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Map
    const map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: 0
    });

    let currentMapId = null;
    let currentLayer = null;
    let poiLayerGroup = L.layerGroup().addTo(map);
    let isAddingPoi = false;

    // --- Modal Logic ---
    const uploadModal = document.getElementById("uploadModal");
    const poiModal = document.getElementById("poiModal"); // New POI Modal
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
        closePoiModal.onclick = function () {
            poiModal.style.display = "none";
        }
    }

    window.onclick = function (event) {
        if (event.target == uploadModal) {
            uploadModal.style.display = "none";
        }
        if (event.target == poiModal) {
            poiModal.style.display = "none";
        }
    }

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
        map.fitBounds(bounds);

        // Load POIs for this map
        loadPois(mapData.id);
        document.getElementById('poiSection').style.display = 'block';
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
    const addPoiBtn = document.getElementById('addPoiBtn');

    addPoiBtn.onclick = () => {
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
            document.getElementById('poiX').value = e.latlng.lng;
            document.getElementById('poiY').value = e.latlng.lat;
            document.getElementById('poiModal').style.display = "block";

            // Reset mode
            isAddingPoi = false;
            addPoiBtn.classList.remove('btn-primary');
            addPoiBtn.classList.add('btn-secondary');
            addPoiBtn.textContent = '+';
            document.getElementById('map').style.cursor = '';
        }
    });

    document.getElementById('poiForm').onsubmit = async (e) => {
        e.preventDefault();
        if (!currentMapId) return;

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`/api/maps/${currentMapId}/pois`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                document.getElementById('poiModal').style.display = "none";
                e.target.reset();
                loadPois(currentMapId);
            } else {
                alert('Errore: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding POI:', error);
        }
    };

    async function loadPois(mapId) {
        try {
            const response = await fetch(`/api/maps/${mapId}/pois`);
            const data = await response.json();

            if (data.success) {
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
            // Add Marker
            // Leaflet standard marker
            const marker = L.marker([poi.y, poi.x]);

            const popupContent = `
                <strong>${poi.name}</strong><br>
                <em>${poi.type}</em><br>
                ${poi.population ? `Pop: ${poi.population}<br>` : ''}
                <p>${poi.description || ''}</p>
                <button onclick="deletePoi(${poi.id})" style="color:red; font-size:0.8em;">Elimina</button>
            `;

            marker.bindPopup(popupContent);
            poiLayerGroup.addLayer(marker);

            // Add List Item
            const div = document.createElement('div');
            div.className = 'map-list-item'; // Reuse styling
            div.innerHTML = `
                <div><strong>${poi.name}</strong> <small>(${poi.type})</small></div>
                <div style="font-size: 0.85em; color: #aaa;">${poi.description || ''}</div>
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
});
