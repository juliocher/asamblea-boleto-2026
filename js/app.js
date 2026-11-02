/**
 * app.js — Tarjeta de Embarque Digital v3.1
 * Asamblea de Circuito 2026-2027 • Traslado Privado Cusco ↔ Urubamba
 *
 * - Login por credencial (primer nombre, o nombre + apellido si se repite)
 * - 100% estático: funciona en GitHub Pages sin servidor
 * - Sin botones de impresión
 */

(function () {
  'use strict';

  // ─── Estado global ─────────────────────────────────────────────────────────
  let allPassengers = [];   // Datos desde passengers_data.json
  let config = {};          // Datos desde config.json
  let currentPassenger = null;
  let activeSegment = 'ida';

  // ─── Constantes ────────────────────────────────────────────────────────────
  const WHATSAPP_NUM = '51912100299';
  const WHATSAPP_MSG = encodeURIComponent(
    'Hola, tengo una consulta sobre mi traslado para la Asamblea de circuito 2026-2027. ¿Puedes ayudarme?'
  );
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUM}?text=${WHATSAPP_MSG}`;

  // ─── Referencias DOM ───────────────────────────────────────────────────────
  const loginSection       = document.getElementById('loginSection');
  const ticketViewSection  = document.getElementById('ticketViewSection');
  const credentialInput    = document.getElementById('credentialInput');
  const btnLogin           = document.getElementById('btnLogin');
  const loginErrorMessage  = document.getElementById('loginErrorMessage');
  const loginErrorText     = document.getElementById('loginErrorText');
  const ticketsContainer   = document.getElementById('ticketsContainer');
  const tabIdaBtn          = document.getElementById('tabIdaBtn');
  const tabVueltaBtn       = document.getElementById('tabVueltaBtn');
  const badgeIdaCount      = document.getElementById('badgeIdaCount');
  const badgeVueltaCount   = document.getElementById('badgeVueltaCount');
  const btnBackToSearch    = document.getElementById('btnBackToSearch');
  const eventTitleDisplay  = document.getElementById('eventTitleDisplay');
  const annualThemeHeader  = document.getElementById('annualThemeHeader');

  // ─── 1. Inicialización ─────────────────────────────────────────────────────
  async function init() {
    try {
      const [passRes, cfgRes] = await Promise.all([
        fetch('passengers_data.json'),
        fetch('config.json')
      ]);

      if (!passRes.ok) throw new Error('No se pudo cargar passengers_data.json');
      if (!cfgRes.ok)  throw new Error('No se pudo cargar config.json');

      allPassengers = await passRes.json();
      config        = await cfgRes.json();

      applyBranding();
    } catch (err) {
      console.error('Error al inicializar:', err);
      showError('No se pudieron cargar los datos. Intenta recargando la página.');
    }

    setupListeners();
  }

  // ─── 2. Branding ───────────────────────────────────────────────────────────
  function applyBranding() {
    if (!config) return;
    const root = document.documentElement;
    if (config.color_acento)      root.style.setProperty('--color-acento', config.color_acento);
    if (config.color_crema)       root.style.setProperty('--color-crema',  config.color_crema);
    if (config.color_azul_marino) root.style.setProperty('--color-azul-marino', config.color_azul_marino);

    const titulo = config.nombre_evento || 'Asamblea de circuito 2026-2027';
    if (eventTitleDisplay) eventTitleDisplay.textContent = titulo;
    document.title = `${titulo} – Tarjeta de Embarque`;

    if (annualThemeHeader && config.tema_anual) {
      annualThemeHeader.innerHTML = `<em>"${esc(config.tema_anual)}"</em>${
        config.cita_tema ? ` <span class="theme-scripture">(${esc(config.cita_tema)})</span>` : ''
      }`;
    }
  }

  // ─── 3. Normalización de credencial ────────────────────────────────────────
  // Elimina tildes, mayúsculas, espacios extra
  function normCred(str) {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ─── 4. Listeners ──────────────────────────────────────────────────────────
  function setupListeners() {
    if (btnLogin) {
      btnLogin.addEventListener('click', handleLogin);
    }

    if (credentialInput) {
      credentialInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleLogin();
      });
      // Limpiar error al escribir
      credentialInput.addEventListener('input', () => {
        loginErrorMessage.style.display = 'none';
      });
    }

    if (tabIdaBtn)    tabIdaBtn.addEventListener('click',    () => switchSegment('ida'));
    if (tabVueltaBtn) tabVueltaBtn.addEventListener('click', () => switchSegment('vuelta'));

    if (btnBackToSearch) {
      btnBackToSearch.addEventListener('click', () => {
        currentPassenger = null;
        ticketViewSection.style.display = 'none';
        loginSection.style.display = 'block';
        loginErrorMessage.style.display = 'none';
        credentialInput.value = '';
        credentialInput.focus();
      });
    }
  }

  // ─── 5. Login / Validación de credencial ───────────────────────────────────
  function handleLogin() {
    const inputValue = credentialInput ? credentialInput.value : '';
    const inputNorm  = normCred(inputValue);

    if (!inputNorm) {
      showError('Por favor ingresa tu credencial (tu nombre).');
      return;
    }

    if (allPassengers.length === 0) {
      showError('Los datos aún no se han cargado. Recarga la página.');
      return;
    }

    // Buscar el pasajero por credencial exacta
    const found = allPassengers.find(p => normCred(p.credential) === inputNorm);

    if (!found) {
      showError(`No se encontró la credencial "${inputValue}". Verifica que estés escribiendo correctamente tu nombre (sin tildes está bien). Si necesitas ayuda, contacta al coordinador.`);
      return;
    }

    currentPassenger = found;
    loginErrorMessage.style.display = 'none';
    renderTicketView();
  }

  function showError(msg) {
    if (loginErrorText) loginErrorText.textContent = msg;
    if (loginErrorMessage) loginErrorMessage.style.display = 'flex';
  }

  // ─── 6. Vista de tarjeta ───────────────────────────────────────────────────
  function renderTicketView() {
    if (!currentPassenger) return;

    loginSection.style.display = 'none';
    ticketViewSection.style.display = 'block';

    const hasIda    = !!currentPassenger.ida_bus;
    const hasVuelta = !!currentPassenger.vuelta_bus;

    if (badgeIdaCount)    badgeIdaCount.textContent    = hasIda    ? '✓' : '0';
    if (badgeVueltaCount) badgeVueltaCount.textContent = hasVuelta ? '✓' : '0';

    tabIdaBtn.style.opacity    = hasIda    ? '1' : '0.45';
    tabVueltaBtn.style.opacity = hasVuelta ? '1' : '0.45';
    tabIdaBtn.disabled    = !hasIda;
    tabVueltaBtn.disabled = !hasVuelta;

    if (!hasIda && hasVuelta) {
      activeSegment = 'vuelta';
      tabIdaBtn.classList.remove('active');
      tabVueltaBtn.classList.add('active');
    } else {
      activeSegment = 'ida';
      tabIdaBtn.classList.add('active');
      tabVueltaBtn.classList.remove('active');
    }

    renderCurrentSegment();

    // Scroll al inicio de la tarjeta
    ticketViewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function switchSegment(segment) {
    activeSegment = segment;
    tabIdaBtn.classList.toggle('active',    segment === 'ida');
    tabVueltaBtn.classList.toggle('active', segment === 'vuelta');
    renderCurrentSegment();
    ticketsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── 7. Renderizar tarjeta del tramo activo ────────────────────────────────
  function renderCurrentSegment() {
    if (!currentPassenger || !config.tramos) return;

    ticketsContainer.innerHTML = '';

    const p     = currentPassenger;
    const tramo = config.tramos[activeSegment];
    if (!tramo) return;

    const busNum = activeSegment === 'ida' ? p.ida_bus : p.vuelta_bus;

    if (!busNum) {
      ticketsContainer.innerHTML = `
        <div class="no-travel-card">
          <div class="no-travel-icon">🚌</div>
          <div class="no-travel-name">${esc(p.nombre)}</div>
          <span class="no-travel-badge">No viaja en el tramo de ${activeSegment === 'ida' ? 'Ida' : 'Retorno'}</span>
          <p class="no-travel-hint">Selecciona el otro tramo con los botones de arriba.</p>
        </div>`;
      return;
    }

    const busConfig = tramo.buses[busNum];
    if (!busConfig) {
      console.warn(`Bus ${busNum} no encontrado para tramo ${activeSegment}`);
      return;
    }

    const asiento      = activeSegment === 'ida' ? p.ida_asiento : p.vuelta_asiento;
    const asientoNum   = parseInt(asiento || '0', 10);
    const asientoLabel = asiento ? asiento : '—';
    const asientoZona  = getZona(asientoNum);
    const busLabel     = `Bus ${busNum}`;
    const tramoLabel   = activeSegment === 'ida' ? 'IDA' : 'RETORNO';
    const tramoDesc    = activeSegment === 'ida'
      ? `Ida: ${tramo.origen_ciudad} → ${tramo.destino_ciudad}`
      : `Retorno: ${tramo.origen_ciudad} → ${tramo.destino_ciudad}`;

    // Alerta cambio de bus
    const hasBusChange = p.ida_bus && p.vuelta_bus && p.ida_bus !== p.vuelta_bus;
    let busChangeHtml = '';
    if (hasBusChange) {
      if (activeSegment === 'ida') {
        busChangeHtml = `
          <div class="bus-change-alert bus-change-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            En el <strong>retorno</strong> viajarás en el <strong>Bus ${p.vuelta_bus}</strong>, asiento <strong>${p.vuelta_asiento || '—'}</strong>.
          </div>`;
      } else {
        busChangeHtml = `
          <div class="bus-change-alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <strong>Aviso:</strong> En la ida viajaste en el <strong>Bus ${p.ida_bus}</strong>. Este retorno es en <strong>Bus ${busNum}</strong>.
          </div>`;
      }
    }

    // Nombre corto para el talón
    const nombreCorto = p.nombre_corto || p.nombre.split(' ').slice(0, 3).join(' ');

    const qrId = `qr-wp-${activeSegment}`;

    const card = document.createElement('article');
    card.className = 'boarding-pass-v3';
    card.innerHTML = buildCardHTML({
      p, tramo, busConfig, busLabel, tramoLabel, tramoDesc,
      asientoLabel, asientoNum, asientoZona, nombreCorto,
      busChangeHtml, qrId
    });

    ticketsContainer.appendChild(card);

    // Generar QR de WhatsApp
    generateWhatsAppQR(qrId);
  }

  // ─── 8. HTML de la tarjeta ─────────────────────────────────────────────────
  function buildCardHTML({ p, tramo, busConfig, busLabel, tramoLabel, tramoDesc,
                           asientoLabel, asientoNum, asientoZona, nombreCorto,
                           busChangeHtml, qrId }) {
    return `
      <!-- ══ CABECERA AZUL MARINO ══ -->
      <div class="bp-header">
        <div class="bp-header-left">
          <div class="bp-event-badge">ASAMBLEA DE CIRCUITO</div>
          <div class="bp-event-name">${esc(config.nombre_evento || 'Asamblea de circuito 2026-2027')}</div>
          <div class="bp-theme-serif">"${esc(config.tema_anual || 'Haz de Jehová tu mayor alegría')}"</div>
          <div class="bp-scripture">${esc(config.cita_tema || 'Salmo 37:4')}</div>
        </div>
        <div class="bp-tramo-pill ${activeSegment === 'vuelta' ? 'bp-tramo-retorno' : ''}">
          ${esc(busLabel)} • ${esc(tramoLabel)}
        </div>
      </div>

      <!-- ══ NOMBRE DEL PASAJERO ══ -->
      <div class="bp-passenger-block">
        <div class="bp-passenger-label">NOMBRE DEL PASAJERO</div>
        <div class="bp-passenger-name">${esc(p.nombre)}</div>
      </div>

      <!-- ══ CUERPO CREMA ══ -->
      <div class="bp-body">

        <!-- Ruta -->
        <div class="bp-route-box">
          <div class="bp-route-origin">
            <div class="bp-route-code">${esc(tramo.origen_codigo)}</div>
            <div class="bp-route-city">${esc(tramo.origen_ciudad)}</div>
            <div class="bp-route-place">${esc(tramo.origen_lugar)}</div>
          </div>
          <div class="bp-route-middle">
            <div class="bp-route-arrow">
              <div class="bp-route-line-left"></div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-acento)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
              <div class="bp-route-line-right"></div>
            </div>
            <div class="bp-route-tipo">DIRECTO</div>
            <div class="bp-route-duracion">${esc(tramo.duracion || '1h 20m')}</div>
          </div>
          <div class="bp-route-destination">
            <div class="bp-route-code">${esc(tramo.destino_codigo)}</div>
            <div class="bp-route-city">${esc(tramo.destino_ciudad)}</div>
            <div class="bp-route-place">${esc(tramo.destino_lugar)}</div>
          </div>
        </div>

        <!-- Tiempos -->
        <div class="bp-times-row">
          <div class="bp-time-cell">
            <div class="bp-time-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              SALIDA
            </div>
            <div class="bp-time-value">${esc(busConfig.hora_salida)}</div>
            <div class="bp-time-sub">${esc(busConfig.punto_salida)}</div>
          </div>
          <div class="bp-time-cell">
            <div class="bp-time-label">LLEGADA EST.</div>
            <div class="bp-time-value bp-time-secondary">${esc(busConfig.hora_llegada)}</div>
          </div>
          <div class="bp-time-cell">
            <div class="bp-time-label">ABORDAJE</div>
            <div class="bp-time-value bp-time-secondary">${esc(busConfig.hora_abordaje)}</div>
          </div>
        </div>

        <!-- Fecha + Asiento -->
        <div class="bp-date-seat-row">
          <div class="bp-meta-block">
            <div class="bp-meta-label">FECHA</div>
            <div class="bp-meta-value">${esc(tramo.fecha)}</div>
          </div>
          <div class="bp-meta-block">
            <div class="bp-meta-label">PUNTO DE PARTIDA</div>
            <div class="bp-meta-value">${esc(busConfig.punto_salida)}</div>
          </div>
          <div class="bp-seat-badge-wrap">
            <div class="bp-seat-label">TU ASIENTO</div>
            <div class="bp-seat-badge">${esc(asientoLabel)}</div>
            <div class="bp-seat-zona">${esc(asientoZona)}</div>
          </div>
        </div>

        <!-- Croquis del bus -->
        <div class="bp-seating-map">
          ${renderBusCroquis(asientoNum)}
        </div>

        ${busChangeHtml}

        <!-- Nota si existe -->
        ${p.nota ? `<div class="bp-nota">${esc(p.nota)}</div>` : ''}

        <!-- Tema anual -->
        <div class="bp-theme-quote">
          "${esc(config.tema_anual)}" <span>(${esc(config.cita_tema)})</span>
        </div>
      </div>

      <!-- ══ TALÓN DE ABORDAJE (NARANJA) ══ -->
      <div class="bp-stub">
        <div class="bp-stub-header">
          <div class="bp-stub-title">TALÓN DE ABORDAJE</div>
          <div class="bp-stub-route">${esc(tramoDesc)}</div>
        </div>
        <div class="bp-stub-body">
          <div class="bp-stub-info">
            <div class="bp-stub-passenger">${esc(nombreCorto)}</div>
            <div class="bp-stub-seat-box">${esc(asientoLabel)}</div>
          </div>
          <div class="bp-stub-qr-wrap">
            <div class="bp-stub-qr" id="${qrId}"></div>
            <div class="bp-stub-qr-caption">
              ¿TIENES ALGUNA CONSULTA?<br>
              <span>Escanea el QR y contáctanos por WhatsApp</span>
            </div>
          </div>
        </div>
        <div class="bp-stub-footer">
          <div class="bp-stub-control">CONTROL DE ABORDAJE</div>
          <div class="bp-stub-instruction">Presentar en pantalla al subir a la unidad</div>
        </div>
      </div>
    `;
  }

  // ─── 9. Zona del asiento ───────────────────────────────────────────────────
  function getZona(n) {
    if (!n || isNaN(n)) return '';
    if (n <= 11) return 'Zona Delantera';
    if (n <= 22) return 'Zona Media';
    return 'Zona Posterior';
  }

  // ─── 10. Croquis del bus (34 asientos, 4 por fila con pasillo) ─────────────
  function renderBusCroquis(asientoSeleccionado) {
    const total = 34;
    const filas = Math.ceil(total / 4); // 9 filas (última con 2)

    let html = '<div class="croquis-bus">';
    html += '<div class="croquis-driver">🚌 CONDUCTOR ▲</div>';
    html += '<div class="croquis-grid">';

    for (let f = 0; f < filas; f++) {
      const a = f * 4 + 1;
      const b = f * 4 + 2;
      const c = f * 4 + 3;
      const d = f * 4 + 4;

      html += '<div class="croquis-fila">';
      html += renderSeat(a, asientoSeleccionado, total);
      html += renderSeat(b, asientoSeleccionado, total);
      html += '<div class="croquis-pasillo"></div>';
      html += renderSeat(c, asientoSeleccionado, total);
      html += (d <= total) ? renderSeat(d, asientoSeleccionado, total) : '<div class="croquis-seat-empty"></div>';
      html += '</div>';
    }

    html += '</div>';
    html += `
      <div class="croquis-legend">
        <span class="croquis-legend-item">
          <span class="croquis-seat-demo croquis-seat-selected"></span> Tu asiento (${String(asientoSeleccionado).padStart(2,'0')})
        </span>
        <span class="croquis-legend-item">
          <span class="croquis-seat-demo"></span> Disponible
        </span>
      </div>`;
    html += '</div>';
    return html;
  }

  function renderSeat(num, selected, total) {
    if (num > total) return '<div class="croquis-seat-empty"></div>';
    const label = String(num).padStart(2, '0');
    const isSel = (num === selected);
    return `<div class="croquis-seat${isSel ? ' croquis-seat-selected' : ''}" title="Asiento ${label}">${label}</div>`;
  }

  // ─── 11. QR de WhatsApp ────────────────────────────────────────────────────
  function generateWhatsAppQR(elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: WHATSAPP_URL,
        width: 90,
        height: 90,
        colorDark: '#14213D',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      container.innerHTML = `
        <a href="${WHATSAPP_URL}" target="_blank" style="font-size:0.6rem;color:#14213D;text-align:center;display:block;padding:8px;">
          WhatsApp<br>Coordinador
        </a>`;
    }
  }

  // ─── 12. Sanitizar HTML ────────────────────────────────────────────────────
  function esc(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  }

  // ─── Arranque ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

})();
