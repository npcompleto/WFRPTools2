var quill = new Quill('#editor-container', {
    theme: 'snow',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
            ['blockquote', 'code-block'],
            [{ 'header': 1 }, { 'header': 2 }],               // custom button values
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'script': 'sub' }, { 'script': 'super' }],      // superscript/subscript
            [{ 'indent': '-1' }, { 'indent': '+1' }],          // outdent/indent
            [{ 'direction': 'rtl' }],                         // text direction
            [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
            [{ 'font': [] }],
            [{ 'align': [] }],
            ['clean']                                         // remove formatting button
        ]
    }
});

let currentEditingDate = null;
let currentCellElement = null;
let currentWeatherData = {};

async function openEditor(dateIso, element) {
    currentEditingDate = dateIso;
    currentCellElement = element;

    document.getElementById('modalDate').innerText = 'Diario del ' + dateIso;

    // Load Note
    let noteContent = '';
    let tooltipNote = element.querySelector('.note-content');
    if (tooltipNote) {
        noteContent = tooltipNote.innerHTML;
    }
    quill.root.innerHTML = noteContent;

    // Load Weather
    let weatherData = {};
    try {
        let weatherAttr = element.getAttribute('data-weather');
        if (weatherAttr) {
            weatherData = JSON.parse(weatherAttr);
        }
    } catch (e) {
        console.error("Error parsing weather data", e);
    }

    // If no weather data exists and note is empty, generate new weather
    if ((!weatherData || Object.keys(weatherData).length === 0) && !noteContent.trim()) {
        try {
            const response = await fetch(`/generate_weather?date=${dateIso}`);
            const data = await response.json();
            if (data.success) {
                weatherData = data.weather;
                currentWeatherData = weatherData;
                // Update the element's data attribute
                element.setAttribute('data-weather', JSON.stringify(weatherData));
            }
        } catch (e) {
            console.error("Error generating weather", e);
        }
    } else {
        currentWeatherData = weatherData;
    }

    renderWeather(weatherData);

    // Load Photos
    loadPhotos(dateIso);

    document.getElementById('diaryModal').style.display = "block";
}

// --- Photos Logic ---
async function loadPhotos(dateIso) {
    const gallery = document.getElementById('photo-gallery');
    gallery.innerHTML = '<div style="color:#bdc3c7; font-style:italic;">Caricamento foto...</div>';

    try {
        const res = await fetch(`/api/diary/photos/${dateIso}`);
        const data = await res.json();
        if (data.success) {
            renderPhotos(data.photos);
        } else {
            gallery.innerHTML = 'Errore caricamento foto.';
        }
    } catch (e) {
        console.error(e);
        gallery.innerHTML = 'Errore caricamento foto.';
    }
}

function renderPhotos(photos) {
    const gallery = document.getElementById('photo-gallery');
    gallery.innerHTML = '';

    if (photos.length === 0) {
        gallery.innerHTML = '<div style="color:#bdc3c7; font-style:italic; font-size:0.9em;">Nessuna foto.</div>';
        return;
    }

    photos.forEach(photo => {
        const item = document.createElement('div');
        item.className = 'photo-item';

        const imgPath = `/static/uploads/diary_photos/${photo.filename}`;

        item.innerHTML = `
                <img src="${imgPath}" alt="Foto" onclick="window.open('${imgPath}', '_blank')">
                ${photo.caption ? `<div class="photo-caption" title="${photo.caption}">${photo.caption}</div>` : ''}
                <button class="btn-delete-photo" onclick="deletePhoto(${photo.id})" title="Elimina">×</button>
            `;
        gallery.appendChild(item);
    });
}

function updateFileName() {
    const input = document.getElementById('photo-input');
    const span = document.getElementById('file-name');
    if (input.files && input.files.length > 0) {
        span.textContent = input.files[0].name;
    } else {
        span.textContent = 'Nessun file';
    }
}

async function uploadPhoto() {
    const input = document.getElementById('photo-input');
    const captionInput = document.getElementById('photo-caption');
    const statusDiv = document.getElementById('upload-status');

    if (!input.files || input.files.length === 0) {
        alert('Seleziona una foto prima!');
        return;
    }

    const file = input.files[0];
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('date_iso', currentEditingDate);
    formData.append('caption', captionInput.value);

    statusDiv.textContent = 'Caricamento in corso...';

    try {
        const res = await fetch('/api/diary/upload_photo', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            statusDiv.textContent = 'Caricamento completato!';
            // Reset form
            input.value = ''; // clears selection
            document.getElementById('file-name').textContent = 'Nessun file';
            captionInput.value = '';

            // Refresh Gallery
            loadPhotos(currentEditingDate);

            setTimeout(() => statusDiv.textContent = '', 3000);
        } else {
            statusDiv.textContent = 'Errore: ' + (data.error || 'Sconosciuto');
        }
    } catch (e) {
        console.error(e);
        statusDiv.textContent = 'Errore di connessione.';
    }
}

async function deletePhoto(id) {
    if (!confirm('Sei sicuro di voler eliminare questa foto?')) return;

    try {
        const res = await fetch(`/api/diary/delete_photo/${id}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            loadPhotos(currentEditingDate);
        } else {
            alert('Errore eliminazione: ' + data.error);
        }
    } catch (e) {
        console.error(e);
    }
}


function renderWeather(data) {
    const container = document.getElementById('weather-widget');
    container.innerHTML = '';

    if (!data || Object.keys(data).length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'grid';

    const periods = ['Mattino', 'Pomeriggio', 'Sera', 'Notte'];

    periods.forEach(period => {
        if (data[period]) {
            const w = data[period];
            const card = document.createElement('div');
            card.className = 'weather-card';

            // Determine Icon
            let icon = '☀️'; // Default Sun
            let condition = 'Sereno';

            if (w.snow_cm > 0) {
                icon = '❄️';
                condition = 'Neve';
            } else if (w.rain_mm > 0) {
                icon = '🌧️';
                condition = 'Pioggia';
            } else if (w.cloudiness_pct > 70) {
                icon = '☁️';
                condition = 'Nuvoloso';
            } else if (w.cloudiness_pct > 30) {
                icon = '⛅';
                condition = 'Parz. Nuvoloso';
            } else if (period === 'Notte' || period === 'Sera') {
                icon = '🌙'; // Moon for clear night
            }

            card.innerHTML = `
                    <h4>${period}</h4>
                    <div class="weather-icon" title="${condition}">${icon}</div>
                    <div class="weather-temp">${w.temperature_c}°C</div>
                    <div class="weather-details">
                        <span>💨 ${w.wind_kmh} km/h</span>
                        <span>☁️ ${w.cloudiness_pct}%</span>
                        ${w.rain_mm > 0 ? `<span>💧 ${w.rain_mm} mm</span>` : ''}
                        ${w.snow_cm > 0 ? `<span>❄️ ${w.snow_cm} cm</span>` : ''}
                    </div>
                `;
            container.appendChild(card);
        }
    });
}

function closeModal() {
    document.getElementById('diaryModal').style.display = "none";
}

function saveDiary() {
    const noteHtml = quill.root.innerHTML;

    fetch('/save_diary', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            date: currentEditingDate,
            note: noteHtml,
            weather: currentWeatherData
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            } else {
                alert('Errore nel salvataggio: ' + data.error);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Errore nel salvataggio');
        });
}

window.onclick = function (event) {
    var modal = document.getElementById('diaryModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}