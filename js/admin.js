/**
 * admin.js - Lógica del Panel de Administración y Control de Abordaje
 */

(function () {
  'use strict';

  // Estado en memoria
  let encryptedDataStore = null;
  let adminPayload = null;
  let passengersList = [];
  let isBoardingMode = false;

  // Clave base para localStorage
  const STORAGE_KEY_PREFIX = 'traslado_boarding_v1_';

  // Elementos DOM
  const adminLoginSection = document.getElementById('adminLoginSection');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminPassInput = document.getElementById('adminPassInput');
  const btnAdminLogin = document.getElementById('btnAdminLogin');
  const adminLoginError = document.getElementById('adminLoginError');

  const adminDashboardSection = document.getElementById('adminDashboardSection');
  const adminHeaderTitle = document.getElementById('adminHeaderTitle');
  const adminHeaderSubtitle = document.getElementById('adminHeaderSubtitle');
  const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');

  const modeGeneralBtn = document.getElementById('modeGeneralBtn');
  const modeBoardingBtn = document.getElementById('modeBoardingBtn');
  const boardingModeBanner = document.getElementById('boardingModeBanner');
  const btnResetBoarding = document.getElementById('btnResetBoarding');
  const quickCheckinInput = document.getElementById('quickCheckinInput');
  const btnQuickCheckin = document.getElementById('btnQuickCheckin');
  const boardingProgressTitle = document.getElementById('boardingProgressTitle');
  const boardingProgressCounter = document.getElementById('boardingProgressCounter');
  const boardingProgressBar = document.getElementById('boardingProgressBar');

  const statTotalPassengers = document.getElementById('statTotalPassengers');
  const statTotalFamilies = document.getElementById('statTotalFamilies');
  const statIdaBus1 = document.getElementById('statIdaBus1');
  const statIdaBus1Sub = document.getElementById('statIdaBus1Sub');
  const progressIda1 = document.getElementById('progressIda1');
  const statIdaBus2 = document.getElementById('statIdaBus2');
  const statIdaBus2Sub = document.getElementById('statIdaBus2Sub');
  const progressIda2 = document.getElementById('progressIda2');
  const statVueltaBus1 = document.getElementById('statVueltaBus1');
  const statVueltaBus1Sub = document.getElementById('statVueltaBus1Sub');
  const progressVue1 = document.getElementById('progressVue1');
  const statVueltaBus2 = document.getElementById('statVueltaBus2');
  const statVueltaBus2Sub = document.getElementById('statVueltaBus2Sub');
  const progressVue2 = document.getElementById('progressVue2');
  const statBusSwitches = document.getElementById('statBusSwitches');

  const adminSearchInput = document.getElementById('adminSearchInput');
  const filterSegmentSelect = document.getElementById('filterSegmentSelect');
  const filterBusSelect = document.getElementById('filterBusSelect');
  const filterBoardingSelect = document.getElementById('filterBoardingSelect');
  const tableCountDisplay = document.getElementById('tableCountDisplay');
  const thCheckin = document.getElementById('thCheckin');
  const passengersTableBody = document.getElementById('passengersTableBody');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnPrintAdminList = document.getElementById('btnPrintAdminList');

  // 1. Inicialización
  async function init() {
    try {
      const response = await fetch('data.enc.json');
      if (!response.ok) throw new Error('No se pudo cargar data.enc.json');
      encryptedDataStore = await response.json();
    } catch (err) {
      console.error('Error al inicializar admin:', err);
      alert('Error: No se pudo cargar el archivo data.enc.json. Por favor genera los datos con node build.js.');
    }

    setupEventListeners();
  }

  // 2. Listeners
  function setupEventListeners() {
    adminLoginForm.addEventListener('submit', handleAdminLogin);
    btnLogoutAdmin.addEventListener('click', handleLogout);

    modeGeneralBtn.addEventListener('click', () => setBoardingMode(false));
    modeBoardingBtn.addEventListener('click', () => setBoardingMode(true));

    adminSearchInput.addEventListener('input', renderTable);
    filterSegmentSelect.addEventListener('change', renderTable);
    filterBusSelect.addEventListener('change', renderTable);
    filterBoardingSelect.addEventListener('change', renderTable);

    btnResetBoarding.addEventListener('click', handleResetBoarding);
    btnQuickCheckin.addEventListener('click', handleQuickCheckin);
    quickCheckinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickCheckin();
      }
    });

    btnExportCSV.addEventListener('click', exportTableToCSV);
    btnPrintAdminList.addEventListener('click', () => window.print());
  }

  // 3. Inicio de Sesión de Administrador con Web Crypto
  async function handleAdminLogin(e) {
    e.preventDefault();
    adminLoginError.style.display = 'none';

    const pass = adminPassInput.value;
    if (!pass) return;

    if (!encryptedDataStore || !encryptedDataStore.admin) {
      alert('No se encontraron datos administrativos en data.enc.json.');
      return;
    }

    setLoginLoading(true);

    try {
      const adminEntry = encryptedDataStore.admin;
      const decrypted = await CryptoUtils.decryptAesGcm(
        adminEntry.data,
        adminEntry.iv,
        adminEntry.salt,
        pass
      );

      adminPayload = decrypted;
      passengersList = adminPayload.passengers || [];

      // Éxito: Mostrar Dashboard
      adminLoginSection.style.display = 'none';
      adminDashboardSection.style.display = 'block';
      btnLogoutAdmin.style.display = 'inline-flex';

      if (adminPayload.config?.evento_nombre) {
        adminHeaderTitle.textContent = `${adminPayload.config.evento_nombre} – Control de Abordaje`;
      }

      computeStats();
      renderTable();

    } catch (err) {
      console.error('Error al autenticar admin:', err);
      adminLoginError.style.display = 'flex';
    } finally {
      setLoginLoading(false);
    }
  }

  function setLoginLoading(loading) {
    if (loading) {
      btnAdminLogin.disabled = true;
      btnAdminLogin.innerHTML = '<span class="spinner"></span> Verificando y descifrando...';
    } else {
      btnAdminLogin.disabled = false;
      btnAdminLogin.innerHTML = `
        <span class="btn-text">Descifrar e Ingresar</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      `;
    }
  }

  function handleLogout() {
    adminPayload = null;
    passengersList = [];
    adminPassInput.value = '';
    adminDashboardSection.style.display = 'none';
    btnLogoutAdmin.style.display = 'none';
    adminLoginSection.style.display = 'block';
  }

  // 4. Cálculo de Métricas y Cupos por Bus
  function computeStats() {
    const total = passengersList.length;
    const familiesSet = new Set(passengersList.map(p => p.familia));

    let ida1 = 0, ida2 = 0;
    let vue1 = 0, vue2 = 0;
    let busSwitches = 0;

    passengersList.forEach(p => {
      if (p.ida_bus === '1') ida1++;
      if (p.ida_bus === '2') ida2++;
      if (p.vuelta_bus === '1') vue1++;
      if (p.vuelta_bus === '2') vue2++;

      if (p.ida_bus && p.vuelta_bus && p.ida_bus !== p.vuelta_bus) {
        busSwitches++;
      }
    });

    statTotalPassengers.textContent = total;
    statTotalFamilies.textContent = `${familiesSet.size} familias inscritas`;

    statIdaBus1.textContent = `${ida1} / 34`;
    statIdaBus1Sub.textContent = `${Math.round((ida1 / 34) * 100)}% de ocupación`;
    progressIda1.style.width = `${Math.min(100, Math.round((ida1 / 34) * 100))}%`;

    statIdaBus2.textContent = `${ida2} / 34`;
    statIdaBus2Sub.textContent = `${Math.round((ida2 / 34) * 100)}% de ocupación`;
    progressIda2.style.width = `${Math.min(100, Math.round((ida2 / 34) * 100))}%`;

    statVueltaBus1.textContent = `${vue1} / 34`;
    statVueltaBus1Sub.textContent = `${Math.round((vue1 / 34) * 100)}% de ocupación`;
    progressVue1.style.width = `${Math.min(100, Math.round((vue1 / 34) * 100))}%`;

    statVueltaBus2.textContent = `${vue2} / 34`;
    statVueltaBus2Sub.textContent = `${Math.round((vue2 / 34) * 100)}% de ocupación`;
    progressVue2.style.width = `${Math.min(100, Math.round((vue2 / 34) * 100))}%`;

    statBusSwitches.textContent = busSwitches;
  }

  // 5. Cambio entre Modo General y Modo Abordaje
  function setBoardingMode(enable) {
    isBoardingMode = enable;
    if (enable) {
      modeGeneralBtn.classList.remove('active');
      modeBoardingBtn.classList.add('active');
      boardingModeBanner.style.display = 'block';
      thCheckin.style.display = 'table-cell';
      filterBoardingSelect.style.display = 'inline-block';
    } else {
      modeGeneralBtn.classList.add('active');
      modeBoardingBtn.classList.remove('active');
      boardingModeBanner.style.display = 'none';
      thCheckin.style.display = 'none';
      filterBoardingSelect.style.display = 'none';
    }
    renderTable();
  }

  // 6. Helpers de Abordaje en localStorage
  function getPassengerStorageKey(passenger, segment) {
    const norm = CryptoUtils.normalizeName(passenger.nombre);
    return `${STORAGE_KEY_PREFIX}${segment}_${norm}`;
  }

  function isPassengerBoarded(passenger, segment) {
    const key = getPassengerStorageKey(passenger, segment);
    return localStorage.getItem(key) === 'true';
  }

  function togglePassengerBoarded(passenger, segment) {
    const key = getPassengerStorageKey(passenger, segment);
    const current = isPassengerBoarded(passenger, segment);
    if (current) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, 'true');
    }
  }

  // 7. Renderizado Dinámico de la Tabla
  function renderTable() {
    const searchQuery = CryptoUtils.normalizeName(adminSearchInput.value);
    const segmentFilter = filterSegmentSelect.value;
    const busFilter = filterBusSelect.value;
    const boardingFilter = filterBoardingSelect.value;

    // Segmento activo para control de abordaje
    const currentActiveSegment = segmentFilter === 'vuelta' ? 'vuelta' : 'ida';

    const filtered = passengersList.filter(p => {
      // 1. Filtro de búsqueda
      if (searchQuery) {
        const normNom = CryptoUtils.normalizeName(p.nombre);
        const normFam = CryptoUtils.normalizeName(p.familia);
        const normTel = CryptoUtils.normalizePhone(p.telefono);
        if (!normNom.includes(searchQuery) && !normFam.includes(searchQuery) && !normTel.includes(searchQuery)) {
          return false;
        }
      }

      // 2. Filtro de tramo
      if (segmentFilter === 'ida') {
        if (!p.ida_bus) return false;
      } else if (segmentFilter === 'vuelta') {
        if (!p.vuelta_bus) return false;
      } else if (segmentFilter === 'cambio') {
        if (!p.ida_bus || !p.vuelta_bus || p.ida_bus === p.vuelta_bus) return false;
      }

      // 3. Filtro de bus
      if (busFilter !== 'all') {
        if (segmentFilter === 'vuelta') {
          if (p.vuelta_bus !== busFilter) return false;
        } else {
          // Por defecto evalúa bus de ida o el relevante
          if (p.ida_bus !== busFilter && p.vuelta_bus !== busFilter) return false;
        }
      }

      // 4. Filtro de estado de abordaje (en modo abordaje)
      if (isBoardingMode && boardingFilter !== 'all') {
        const boarded = isPassengerBoarded(p, currentActiveSegment);
        if (boardingFilter === 'boarded' && !boarded) return false;
        if (boardingFilter === 'pending' && boarded) return false;
      }

      return true;
    });

    tableCountDisplay.textContent = `Mostrando ${filtered.length} de ${passengersList.length} pasajeros`;

    // Actualizar barra de progreso de abordaje
    if (isBoardingMode) {
      updateBoardingProgress(filtered, currentActiveSegment, busFilter);
    }

    passengersTableBody.innerHTML = '';

    if (filtered.length === 0) {
      passengersTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
            No se encontraron pasajeros con los filtros seleccionados.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((p, idx) => {
      const tr = document.createElement('tr');
      const isBoarded = isPassengerBoarded(p, currentActiveSegment);
      
      if (isBoardingMode) {
        tr.className = `checkin-row ${isBoarded ? 'boarded' : ''}`;
      }

      const hasChange = p.ida_bus && p.vuelta_bus && p.ida_bus !== p.vuelta_bus;
      let observationHtml = '';
      if (hasChange) {
        observationHtml = `<span class="badge-alert">Cambia a Bus ${escapeHtml(p.vuelta_bus)} en vuelta</span>`;
      } else if (!p.ida_bus) {
        observationHtml = `<span style="color: var(--text-light); font-size: 0.8rem;">Solo viaje de regreso</span>`;
      } else if (!p.vuelta_bus) {
        observationHtml = `<span style="color: var(--text-light); font-size: 0.8rem;">Solo viaje de ida</span>`;
      }

      const cleanPhone = CryptoUtils.normalizePhone(p.telefono);
      const whatsappUrl = `https://wa.me/${cleanPhone}`;

      tr.innerHTML = `
        ${isBoardingMode ? `
          <td style="text-align: center;">
            <input 
              type="checkbox" 
              class="checkin-checkbox" 
              ${isBoarded ? 'checked' : ''}
              aria-label="Marcar como abordado"
            >
          </td>
        ` : ''}
        <td>
          <span style="font-family: var(--font-mono); font-weight: 700; color: var(--gold-600); font-size: 0.85rem;">
            ${escapeHtml(p.familia)}
          </span>
        </td>
        <td class="passenger-col-name" style="font-weight: 700;">
          ${escapeHtml(p.nombre)}
        </td>
        <td>
          <a href="tel:${escapeHtml(cleanPhone)}" class="phone-link tabular-nums">${escapeHtml(p.telefono)}</a>
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="quick-whatsapp" title="Enviar WhatsApp">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </a>
        </td>
        <td>
          ${p.ida_bus ? `<span class="tag-bus tag-bus-${escapeHtml(p.ida_bus)}">Bus ${escapeHtml(p.ida_bus)}</span>` : '<span class="tag-none">No viaja</span>'}
        </td>
        <td>
          ${p.vuelta_bus ? `<span class="tag-bus tag-bus-${escapeHtml(p.vuelta_bus)}">Bus ${escapeHtml(p.vuelta_bus)}</span>` : '<span class="tag-none">No viaja</span>'}
        </td>
        <td>
          ${observationHtml}
        </td>
      `;

      if (isBoardingMode) {
        // Toggle al hacer clic en el checkbox o en la fila
        const chk = tr.querySelector('.checkin-checkbox');
        chk.addEventListener('click', (ev) => {
          ev.stopPropagation();
          togglePassengerBoarded(p, currentActiveSegment);
          renderTable();
        });

        tr.addEventListener('click', (ev) => {
          if (ev.target.tagName.toLowerCase() === 'a' || ev.target.closest('a')) return;
          togglePassengerBoarded(p, currentActiveSegment);
          renderTable();
        });
      }

      passengersTableBody.appendChild(tr);
    });
  }

  function updateBoardingProgress(filteredList, segment, bus) {
    const busLabel = bus === 'all' ? 'Todos los Buses' : `Bus ${bus}`;
    const segmentLabel = segment === 'vuelta' ? 'Vuelta' : 'Ida';
    boardingProgressTitle.textContent = `Progreso de Abordaje: ${busLabel} (${segmentLabel})`;

    let totalEligible = 0;
    let boardedCount = 0;

    filteredList.forEach(p => {
      const travels = segment === 'ida' ? !!p.ida_bus : !!p.vuelta_bus;
      if (travels) {
        totalEligible++;
        if (isPassengerBoarded(p, segment)) {
          boardedCount++;
        }
      }
    });

    const percent = totalEligible > 0 ? Math.round((boardedCount / totalEligible) * 100) : 0;
    boardingProgressCounter.textContent = `${boardedCount} / ${totalEligible} (${percent}%)`;
    boardingProgressBar.style.width = `${percent}%`;
  }

  // 8. Registro Rápido por QR o Nombre
  function handleQuickCheckin() {
    const rawVal = quickCheckinInput.value.trim();
    if (!rawVal) return;

    const segment = filterSegmentSelect.value === 'vuelta' ? 'vuelta' : 'ida';

    // El QR tiene formato: TKT|FAM-01|Nombre Completo|B1|IDA
    let targetName = rawVal;
    if (rawVal.includes('|')) {
      const parts = rawVal.split('|');
      if (parts.length >= 3) {
        targetName = parts[2]; // Extrae el nombre
      }
    }

    const normTarget = CryptoUtils.normalizeName(targetName);
    const found = passengersList.find(p => CryptoUtils.normalizeName(p.nombre) === normTarget || CryptoUtils.normalizeName(p.nombre).includes(normTarget));

    if (!found) {
      alert(`No se encontró ningún pasajero coincidente con: "${rawVal}"`);
      return;
    }

    // Verificar si viaja en este tramo
    const busInSegment = segment === 'ida' ? found.ida_bus : found.vuelta_bus;
    if (!busInSegment) {
      alert(`⚠️ Atención: ${found.nombre} NO viaja en el tramo de ${segment.toUpperCase()}.`);
      return;
    }

    const key = getPassengerStorageKey(found, segment);
    localStorage.setItem(key, 'true');

    quickCheckinInput.value = '';
    renderTable();

    // Feedback visual agradable
    alert(`✅ ¡ABORDADO REGISTRADO CON ÉXITO!\nPasajero: ${found.nombre}\nFamilia: ${found.familia}\nAsignado a: Bus ${busInSegment} (${segment.toUpperCase()})`);
  }

  function handleResetBoarding() {
    const segment = filterSegmentSelect.value === 'vuelta' ? 'vuelta' : 'ida';
    if (!confirm(`¿Estás seguro de que deseas REINICIAR todos los registros de abordaje para el tramo de ${segment.toUpperCase()} en este dispositivo?`)) {
      return;
    }

    // Limpiar claves que comiencen con el prefijo y el segmento
    const prefix = `${STORAGE_KEY_PREFIX}${segment}_`;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));
    renderTable();
    alert(`Se han reiniciado los registros de abordaje del tramo de ${segment.toUpperCase()}.`);
  }

  // 9. Exportar a CSV
  function exportTableToCSV() {
    if (!passengersList || passengersList.length === 0) return;

    const segment = filterSegmentSelect.value === 'vuelta' ? 'vuelta' : 'ida';

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Familia,Pasajero,Telefono,Bus_Ida,Bus_Vuelta,Abordado_Ida,Abordado_Vuelta\r\n';

    passengersList.forEach(p => {
      const boardedIda = isPassengerBoarded(p, 'ida') ? 'SI' : 'NO';
      const boardedVue = isPassengerBoarded(p, 'vuelta') ? 'SI' : 'NO';

      const row = [
        `"${p.familia}"`,
        `"${p.nombre}"`,
        `"${p.telefono}"`,
        `"${p.ida_bus || ''}"`,
        `"${p.vuelta_bus || ''}"`,
        `"${boardedIda}"`,
        `"${boardedVue}"`
      ];
      csvContent += row.join(',') + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nomina_pasajeros_traslado_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
