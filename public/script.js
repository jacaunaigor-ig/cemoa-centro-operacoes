// ========================================
// CONFIGURAÇÕES
// ========================================
const UF = 'AM';

// 🔑 SUA CHAVE DA NASA
const MAP_KEY = '4bddf9631a833cb60bf6793b340a343f';

// 🌎 Coordenadas do Amazonas (Oeste, Sul, Leste, Norte)
const COORDS = '-74.0,-9.5,-58.0,-2.0';

// ========================================
// INICIALIZAR MAPA
// ========================================
const map = L.map('map').setView([-3.5, -63.0], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// ========================================
// FUNÇÃO PARA CARREGAR FOCOS (DIRETO DA NASA - ÚLTIMAS 24H)
// ========================================
let markerLayer = null;

function carregarFocos() {
    document.getElementById('loading').style.display = 'flex';
    
    // AQUI ESTÁ A MUDANÇA: O "/1" no final busca apenas as últimas 24 horas (hoje)!
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_NOAA20_NRT/${COORDS}/1`;
    
    console.log('Buscando focos de HOJE na NASA FIRMS:', url);
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        })
        .then(csvTexto => {
            document.getElementById('loading').style.display = 'none';
            
            const focos = converterCSV(csvTexto);
            console.log('Total de focos recebidos hoje:', focos.length);
            
            mostrarFocos(focos);
        })
        .catch(erro => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('totalFocos').textContent = '❌ Erro';
            console.error('Erro ao carregar:', erro);
        });
}

// ========================================
// FUNÇÃO PARA CONVERTER CSV EM OBJETOS
// ========================================
function converterCSV(csvTexto) {
    const linhas = csvTexto.trim().split('\n');
    if (linhas.length < 2) return [];
    
    // Remove espaços extras do cabeçalho
    const headers = linhas[0].split(',').map(header => header.trim());
    
    return linhas.slice(1).map(linha => {
        const valores = linha.split(',');
        const objeto = {};
        headers.forEach((header, index) => {
            objeto[header] = valores[index];
        });
        return objeto;
    });
}

// ========================================
// FUNÇÃO PARA MOSTRAR FOCOS NO MAPA
// ========================================
function mostrarFocos(focos) {
    if (markerLayer) {
        map.removeLayer(markerLayer);
    }
    
    document.getElementById('totalFocos').textContent = focos.length || 0;
    document.getElementById('ultimaAtualizacao').textContent = new Date().toLocaleTimeString('pt-BR');
    
    const periodo = document.getElementById('periodo');
    if (periodo) periodo.textContent = `Hoje (últimas 24h)`;

    if (focos.length === 0) {
        document.getElementById('totalFocos').textContent = '0 (Nenhum foco hoje)';
        return;
    }
    
    markerLayer = L.layerGroup();
    
    focos.forEach(foco => {
        const lat = parseFloat(foco.latitude);
        const lon = parseFloat(foco.longitude);
        
        if (!isNaN(lat) && !isNaN(lon)) {
            // Círculos laranjas para visualizar os focos
            const circle = L.circleMarker([lat, lon], {
                radius: 3,
                fillColor: "#ff7800",
                color: "#ffffff",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });
            
            circle.bindPopup(`
                <div class="custom-popup">
                    <strong>🔥 Foco de Calor (NASA)</strong><br>
                    <strong>Data:</strong> ${foco.acq_date || 'N/A'}<br>
                    <strong>Satélite:</strong> ${foco.satellite || 'N/A'}<br>
                    <strong>Coordenadas:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}
                </div>
            `);
            
            markerLayer.addLayer(circle);
        }
    });
    
    markerLayer.addTo(map);
    
    const bounds = [];
    focos.forEach(foco => {
        const lat = parseFloat(foco.latitude);
        const lon = parseFloat(foco.longitude);
        if (!isNaN(lat) && !isNaN(lon)) {
            bounds.push([lat, lon]);
        }
    });
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// ========================================
// INICIAR
// ========================================
carregarFocos();
setInterval(carregarFocos, 600000);