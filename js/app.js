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
  const btnAudioControl    = document.getElementById('btnAudioControl');
  const audioControlText   = document.getElementById('audioControlText');
  const eventTitleDisplay  = document.getElementById('eventTitleDisplay');
  const annualThemeHeader  = document.getElementById('annualThemeHeader');

  // ─── Música de Bienvenida ──────────────────────────────────────────────────
  let bgAudio = null;
  let isAudioPlaying = false;
  let fadeInterval = null;

  function playWelcomeMusic() {
    try {
      if (!bgAudio) {
        bgAudio = new Audio('las_asambleas_nos_hacen_felices.mp3');
        bgAudio.loop = true;
        bgAudio.volume = 0;
      }
      if (bgAudio.paused) {
        bgAudio.volume = 0;
        const playPromise = bgAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            isAudioPlaying = true;
            updateAudioButtonUI(true);
            fadeInAudio(0.35, 1200);
          }).catch(err => {
            console.warn('Autoplay bloqueado por el navegador hasta interacción adicional:', err);
            isAudioPlaying = false;
            updateAudioButtonUI(false);
          });
        }
      }
    } catch (e) {
      console.warn('Error al iniciar audio:', e);
    }
  }

  function fadeInAudio(targetVolume, durationMs) {
    if (!bgAudio) return;
    if (fadeInterval) clearInterval(fadeInterval);
    const steps = 20;
    const stepTime = Math.max(20, Math.floor(durationMs / steps));
    const volStep = targetVolume / steps;
    let currentVol = 0;
    fadeInterval = setInterval(() => {
      currentVol = Math.min(targetVolume, currentVol + volStep);
      if (bgAudio) bgAudio.volume = currentVol;
      if (currentVol >= targetVolume) {
        clearInterval(fadeInterval);
        fadeInterval = null;
      }
    }, stepTime);
  }

  function toggleAudio() {
    if (!bgAudio) {
      playWelcomeMusic();
      return;
    }
    if (bgAudio.paused) {
      bgAudio.play().then(() => {
        isAudioPlaying = true;
        updateAudioButtonUI(true);
        fadeInAudio(0.35, 600);
      }).catch(err => console.warn(err));
    } else {
      if (fadeInterval) clearInterval(fadeInterval);
      bgAudio.pause();
      isAudioPlaying = false;
      updateAudioButtonUI(false);
    }
  }

  function updateAudioButtonUI(playing) {
    if (!btnAudioControl) return;
    if (playing) {
      btnAudioControl.classList.remove('paused');
      btnAudioControl.classList.add('playing');
      if (audioControlText) audioControlText.textContent = 'Música activa';
    } else {
      btnAudioControl.classList.remove('playing');
      btnAudioControl.classList.add('paused');
      if (audioControlText) audioControlText.textContent = 'Música en pausa';
    }
  }

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

    if (btnAudioControl) {
      btnAudioControl.addEventListener('click', toggleAudio);
    }

    if (btnBackToSearch) {
      btnBackToSearch.addEventListener('click', () => {
        currentPassenger = null;
        if (bgAudio && !bgAudio.paused) {
          bgAudio.pause();
          isAudioPlaying = false;
          updateAudioButtonUI(false);
        }
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

    const dupBox = document.getElementById('duplicateResolver');
    if (dupBox) dupBox.style.display = 'none';

    // 1. Coincidencia exacta con la credencial asignada
    const exact = allPassengers.find(p => normCred(p.credential) === inputNorm);
    if (exact) {
      currentPassenger = exact;
      loginErrorMessage.style.display = 'none';
      renderTicketView();
      return;
    }

    // 2. Coincidencia exacta con el nombre completo
    const fullMatch = allPassengers.find(p => normCred(p.nombre) === inputNorm);
    if (fullMatch) {
      currentPassenger = fullMatch;
      loginErrorMessage.style.display = 'none';
      renderTicketView();
      return;
    }

    // 3. Buscar si coincide con el primer nombre de uno o más pasajeros
    const matches = allPassengers.filter(p => {
      const parts = normCred(p.nombre).split(' ');
      const pFirst = parts[0];
      const credParts = normCred(p.credential).split(' ');
      return pFirst === inputNorm || credParts.includes(inputNorm) || normCred(p.nombre).includes(inputNorm);
    });

    if (matches.length === 1) {
      // Coincidencia única directa
      currentPassenger = matches[0];
      loginErrorMessage.style.display = 'none';
      renderTicketView();
      return;
    }

    if (matches.length > 1) {
      // Múltiples personas con ese nombre: mostrar selector amigable
      loginErrorMessage.style.display = 'none';
      showDuplicateResolver(matches);
      return;
    }

    showError(`No se encontró "${inputValue}". Verifica que esté bien escrito o contacta al coordinador.`);
  }

  function showDuplicateResolver(candidates) {
    const dupBox = document.getElementById('duplicateResolver');
    const dupList = document.getElementById('duplicateList');
    if (!dupBox || !dupList) return;

    dupList.innerHTML = '';
    candidates.forEach(cand => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-duplicate-pick';
      
      const busInfo = [];
      if (cand.ida_bus) busInfo.push(`Ida: Bus ${cand.ida_bus}`);
      if (cand.vuelta_bus) busInfo.push(`Retorno: Bus ${cand.vuelta_bus}`);

      btn.innerHTML = `
        <div class="dup-name">${esc(cand.nombre)}</div>
        <div class="dup-meta">${busInfo.join(' • ')}</div>
      `;
      btn.onclick = () => {
        currentPassenger = cand;
        dupBox.style.display = 'none';
        renderTicketView();
      };
      dupList.appendChild(btn);
    });

    dupBox.style.display = 'block';
  }

  function showError(msg) {
    if (loginErrorText) loginErrorText.textContent = msg;
    if (loginErrorMessage) loginErrorMessage.style.display = 'flex';
  }

  // ─── 6. Vista de tarjeta ───────────────────────────────────────────────────
  let isSwitchingSegment = false;

  function renderTicketView() {
    if (!currentPassenger) return;

    // Reproducción automática de música de bienvenida
    playWelcomeMusic();

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

    renderCurrentSegment('initial');

    // Scroll suave únicamente al cargar por primera vez la tarjeta
    ticketViewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function switchSegment(segment) {
    if (activeSegment === segment || isSwitchingSegment) return;

    isSwitchingSegment = true;
    const direction = segment === 'vuelta' ? 'forward' : 'backward';
    activeSegment = segment;

    tabIdaBtn.classList.toggle('active',    segment === 'ida');
    tabVueltaBtn.classList.toggle('active', segment === 'vuelta');

    const currentCard = ticketsContainer.querySelector('.ticket-card-outer');

    if (currentCard) {
      currentCard.classList.remove('slide-in-from-right', 'slide-in-from-left', 'ticket-entrance');
      currentCard.classList.add(direction === 'forward' ? 'slide-out-to-left' : 'slide-out-to-right');
      // Transición fluida suave sin saltos
      await new Promise(resolve => setTimeout(resolve, 170));
    }

    renderCurrentSegment(direction);
    isSwitchingSegment = false;
  }

  // ─── 7. Renderizar tarjeta del tramo activo ────────────────────────────────
  function renderCurrentSegment(slideDirection) {
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
    card.className = 'ticket-card-outer';

    if (slideDirection === 'forward') {
      card.classList.add('slide-in-from-right');
    } else if (slideDirection === 'backward') {
      card.classList.add('slide-in-from-left');
    } else {
      card.classList.add('ticket-entrance');
    }

    card.innerHTML = buildCardHTML({
      p, tramo, busConfig, busLabel, tramoLabel, tramoDesc,
      asientoLabel, asientoNum, asientoZona, nombreCorto,
      busChangeHtml, qrId
    });

    ticketsContainer.appendChild(card);

    // Generar QR de WhatsApp
    generateWhatsAppQR(qrId);

    // Hacer que el QR también abra el WhatsApp al hacer clic
    const qrEl = document.getElementById(qrId);
    if (qrEl) {
      qrEl.style.cursor = 'pointer';
      qrEl.onclick = () => window.open(WHATSAPP_URL, '_blank');
    }
  }

  // ─── 8. HTML de la tarjeta (RÉPLICA EXACTA) ────────────────────────────────
  function buildCardHTML({ p, tramo, busConfig, busLabel, tramoLabel, tramoDesc,
                           asientoLabel, asientoNum, asientoZona, nombreCorto,
                           busChangeHtml, qrId }) {
    const salidaLabel = activeSegment === 'vuelta' ? 'SALIDA RETORNO' : 'SALIDA';
    const badgeText = `${busLabel} - ${tramoLabel}`;

    return `
      <div class="ticket-luxury-card">
        <!-- ══ SECCIÓN PRINCIPAL IZQUIERDA ══ -->
        <div class="ticket-main-section">
          
          <!-- Barra superior beige con ilustración suave y badge -->
          <div class="tkt-header-bar">
            <div class="tkt-header-texts">
              <div class="tkt-header-title">Asamblea de circuito 2026–2027</div>
              <div class="tkt-header-theme">“${esc(config.tema_anual || 'Haz de Jehová tu mayor alegría')}” (${esc(config.cita_tema || 'Salmo 37:4')})</div>
            </div>

            <div class="tkt-header-illustration-wrap">
              <img src="assets/ilustracion-screen.jpg" alt="Ilustración Asamblea" class="tkt-header-img" onerror="this.style.display='none'">
              <div class="tkt-bus-badge">${esc(badgeText)}</div>
            </div>
          </div>

          <!-- Nombre del Pasajero -->
          <div class="tkt-passenger-group">
            <div class="tkt-passenger-label">NOMBRE DEL PASAJERO</div>
            <div class="tkt-passenger-name">${esc(p.nombre)}</div>
          </div>

          <!-- Recuadro Beige de Ruta (Cuerpo Central) -->
          <div class="tkt-route-beige-box">
            <div class="tkt-route-top-row">
              <!-- Origen -->
              <div class="tkt-origin-group">
                <div class="tkt-city-row">
                  <span class="tkt-code">${esc(tramo.origen_codigo)}</span>
                  <span class="tkt-city">${esc(tramo.origen_ciudad)}</span>
                </div>
                <div class="tkt-place-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>${esc(tramo.origen_lugar)}</span>
                </div>
              </div>

              <!-- Centro: Directo + Flecha Animada + Duración -->
              <div class="tkt-route-middle">
                <span class="tkt-directo-label">Directo</span>
                <div class="tkt-arrow-track">
                  <span class="tkt-arrow-pulse-dot"></span>
                  <span class="tkt-arrow-head"></span>
                </div>
                <span class="tkt-duration-pill">${esc(tramo.duracion || '1h 20m')}</span>
              </div>

              <!-- Destino -->
              <div class="tkt-destination-group">
                <div class="tkt-city-row">
                  <span class="tkt-city">${esc(tramo.destino_ciudad)}</span>
                  <span class="tkt-code">${esc(tramo.destino_codigo)}</span>
                </div>
                <div class="tkt-place-pill">
                  <span>${esc(tramo.destino_lugar)}</span>
                </div>
              </div>
            </div>

            <!-- Tiempos: Salida y Llegada Estimada -->
            <div class="tkt-times-subrow">
              <div class="tkt-time-block">
                <div class="tkt-time-label">${esc(salidaLabel)}</div>
                <div class="tkt-time-big orange-hero">${esc(busConfig.hora_salida)}</div>
              </div>

              <div class="tkt-time-block right-align">
                <div class="tkt-time-label">LLEGADA ESTIMADA</div>
                <div class="tkt-time-big navy-hero">${esc(busConfig.hora_llegada)}</div>
              </div>
            </div>
          </div>

          <!-- Fila Inferior: Fecha, Abordaje y Pill de Asiento -->
          <div class="tkt-bottom-row">
            <div class="tkt-meta-item">
              <span class="tkt-meta-label">FECHA</span>
              <span class="tkt-meta-val">${esc(tramo.fecha)}</span>
            </div>

            <div class="tkt-meta-item">
              <span class="tkt-meta-label">ABORDAJE</span>
              <span class="tkt-meta-val red-hero">${esc(busConfig.hora_abordaje)}</span>
            </div>

            <div class="tkt-seat-pill-btn" title="Tu asiento asignado">
              <span class="tkt-seat-pill-text">Tu Asiento</span>
              <span class="tkt-seat-pill-num">${esc(asientoLabel)}</span>
            </div>
          </div>

          <!-- Cita Anual Centrada al Fondo -->
          <div class="tkt-annual-quote-center">
            “${esc(config.tema_anual || 'Haz de Jehová tu mayor alegría')}” (${esc(config.cita_tema || 'Salmo 37:4')})
          </div>

        </div>

        <!-- ══ LÍNEA DIVISORIA DE CORTE / PERFORACIÓN CON MUESCAS ══ -->
        <div class="ticket-perforation-divider">
          <div class="notch-cutout notch-top"></div>
          <div class="notch-cutout notch-bottom"></div>
        </div>

        <!-- ══ SECCIÓN TALÓN DE ABORDAJE (DERECHA) ══ -->
        <div class="ticket-stub-section">
          <!-- Banner Naranja Superior -->
          <div class="stub-header-banner">
            <div class="stub-banner-title">Talón de Abordaje</div>
            <div class="stub-banner-sub">${esc(tramoDesc)}</div>
          </div>

          <!-- Contenido del Talón -->
          <div class="stub-body-content">
            <!-- Fila Pasajero y Asiento -->
            <div class="stub-passenger-seat-row">
              <div class="stub-passenger-col">
                <div class="stub-pax-lbl">PASAJERO</div>
                <div class="stub-pax-name">${esc(nombreCorto)}</div>
              </div>
              <div class="stub-seat-orange-box">
                <span class="stub-seat-box-label">Asiento</span>
                <span class="stub-seat-box-num">${esc(asientoLabel)}</span>
              </div>
            </div>

            <!-- Código QR -->
            <div class="stub-qr-card" id="${qrId}" title="Toca o escanea para abrir WhatsApp"></div>

            <!-- Leyenda debajo del QR -->
            <div class="stub-consultas-caption">
              <div class="stub-caption-title">¿TIENES ALGUNA CONSULTA?</div>
              <div class="stub-caption-sub">Escanea el QR y contáctanos por WhatsApp.</div>
            </div>

            <!-- BOTÓN DE WHATSAPP DIRECTO IDÉNTICO -->
            <a href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" class="btn-stub-whatsapp" title="Abrir chat de WhatsApp directamente">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span>Abrir chat de WhatsApp</span>
            </a>

            <!-- Control de Abordaje -->
            <div class="stub-control-pill-box">
              <div class="stub-control-title">CONTROL DE ABORDAJE</div>
              <div class="stub-control-sub">Presentar en pantalla al subir a la unidad</div>
            </div>
          </div>
        </div>
      </div>

      ${busChangeHtml}

      <!-- Acordeón Desplegable para ver la Distribución del Bus -->
      <button type="button" class="croquis-accordion-toggle" onclick="toggleCroquisDrawer()">
        <span>🚌 Ver croquis y ubicación de mi asiento en el bus (${asientoLabel})</span>
        <svg id="croquisChevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.25s ease;">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div id="croquisDrawer" class="croquis-drawer">
        <div class="bp-seating-map">
          ${renderBusCroquis(asientoNum)}
        </div>
      </div>
    `;
  }

  // ─── Función para abrir/cerrar croquis ────────────────────────────────────
  window.toggleCroquisDrawer = function() {
    const drawer = document.getElementById('croquisDrawer');
    const chevron = document.getElementById('croquisChevron');
    if (!drawer) return;
    drawer.classList.toggle('open');
    if (chevron) {
      chevron.style.transform = drawer.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  };

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
