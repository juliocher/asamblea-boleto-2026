# 🚌 Boleto de Traslado – Tarjeta de Embarque Digital

Sitio web estático para la gestión y emisión de tarjetas de embarque digitales para el traslado privado de pasajeros (68 personas, 2 buses de 34 asientos, asientos libres). Diseñado con estética de aerolínea premium (*luxury boarding pass* inspirada en LATAM, Emirates y Qatar Airways), desarrollado exclusivamente en **HTML, CSS y JavaScript Vanilla**, con cifrado de privacidad de grado militar mediante la **Web Crypto API (AES-256-GCM y PBKDF2)**.

---

## 📁 1. Estructura del Proyecto

```text
boleto-traslado/
├── index.html           # Vista del pasajero (consulta, tarjeta de embarque e impresión)
├── admin.html           # Panel de administradores (nómina, filtros, control de abordaje en vivo)
├── config.json          # Parámetros del evento: horarios, puntos de salida, mapas y WhatsApp
├── roster.csv           # Lista de pasajeros y asignación de buses (editable en Excel)
├── build.js             # Script Node.js que cifra el roster y genera data.enc.json
├── data.enc.json        # Datos cifrados (SIN nombres ni teléfonos en texto plano)
├── css/
│   └── styles.css       # Sistema de diseño de aerolínea, modo oscuro y estilos @media print A4
├── js/
│   ├── app.js           # Lógica del pasajero y renderizado de boletos familiares
│   ├── admin.js         # Lógica de administración, métricas y pase de lista (localStorage)
│   ├── crypto-utils.js  # Módulo criptográfico compartido (PBKDF2, AES-GCM, SHA-256)
│   └── qrcode.min.js    # Generador de códigos QR autónomo y local (sin APIs de terceros)
└── README.md            # Guía completa de uso, actualización y despliegue
```

---

## 🔒 2. Arquitectura de Privacidad y Cifrado

Para garantizar que nadie pueda acceder a la lista general inspeccionando el código fuente o el archivo de datos:

1. **Cero texto claro**: En el archivo `data.enc.json` no existe ningún nombre ni teléfono legible.
2. **Cifrado por Familia**: Cada grupo familiar se cifra con **AES-256-GCM**, utilizando una clave derivada con **PBKDF2 (100,000 iteraciones)** a partir del `Nombre Normalizado + Teléfono` de cada miembro.
   - Cualquier integrante de la familia (por ejemplo la madre o cualquiera de sus hijos) puede abrir las tarjetas de todo su grupo familiar introduciendo sus datos.
   - No es sensible a mayúsculas, tildes ni espacios extra.
3. **Cifrado de Administración**: El roster completo con los 68 pasajeros se cifra con una clave derivada de la contraseña maestra del administrador. Los dos administradores solo necesitan conocer esta clave para descifrar el listado en memoria directamente en su navegador.

---

## 📝 3. Cómo editar la lista y configurar el evento

### Paso A: Editar `config.json`
Abre `config.json` en cualquier editor de texto para ajustar:
- `evento_nombre`: Nombre oficial del evento (ej: *"Cumbre Anual Horizonte 2026"*).
- `whatsapp_organizador`: Tu número telefónico en formato internacional (ej: `"+56912345678"`).
- Horarios de salida (`hora_salida`), hora límite de llegada recomendada (`hora_limite_llegada`), punto de encuentro físico (`punto_salida`) y enlaces a Google Maps para el **Bus 1** y **Bus 2**, tanto para la **Ida** como para la **Vuelta**.

### Paso B: Editar `roster.csv`
Puedes abrirlo en **Microsoft Excel**, **Google Sheets** o bloc de notas:
```csv
familia,nombre,telefono,ida_bus,vuelta_bus
FAM-01,Carolina Morales Rivera,+56987654321,1,1
FAM-01,Santiago Morales Rivera,+56987654321,1,1
FAM-01,Mateo Morales Rivera,+56987654321,1,1
FAM-01,Valentina Morales Rivera,+56987654321,1,1
FAM-02,Carlos Mendoza Solís,+56912340001,1,
FAM-03,Andrés Silva Navarro,+56912340003,1,2
```
* **Reglas:**
  - Si una persona **solo viaja de ida**, deja `vuelta_bus` en blanco.
  - Si una persona **solo viaja de vuelta**, deja `ida_bus` en blanco.
  - Si una persona **cambia de bus** en el retorno (ej: Bus 1 de ida y Bus 2 de vuelta), el sistema mostrará automáticamente un aviso destacado de cambio de bus en su tarjeta.
  - Los integrantes de una misma familia deben tener el mismo código en la columna `familia`.

---

## ⚡ 4. Cómo regenerar los datos (`build.js`)

Cada vez que modifiques `roster.csv` o `config.json`, debes regenerar el archivo cifrado ejecutando en tu terminal:

### Opción 1: Con contraseña por defecto (`admin2026`)
```bash
node build.js
```

### Opción 2: Definiendo una contraseña personalizada de administrador
```bash
node build.js --admin-pass="MiClaveSecreta2026"
```
o mediante variable de entorno:
```bash
ADMIN_PASSWORD="MiClaveSecreta2026" node build.js
```

El script validará la nómina, calculará las claves y generará un nuevo `data.enc.json` listo para publicar.

---

## 💻 5. Cómo probar el proyecto localmente

Dado que el navegador requiere un servidor web para permitir peticiones `fetch()` a `data.enc.json`, tienes dos formas inmediatas de ejecutarlo:

- **Opción A (Doble clic en Windows):** Haz doble clic en el archivo [iniciar_servidor.bat](file:///c:/Users/HAOC/.gemini/antigravity-ide/scratch/boleto-traslado/iniciar_servidor.bat).
- **Opción B (Terminal):** Ejecuta:
  ```bash
  npm start
  ```
  o bien:
  ```bash
  node server.js
  ```

Se abrirá automáticamente en tu navegador predeterminado en `http://localhost:8080/index.html`.

---

## 🧪 6. Casos de Prueba Incluidos

Puedes probar el flujo inmediatamente con las siguientes familias de prueba:

| Caso | Nombre a ingresar | Teléfono | Resultado |
| :--- | :--- | :--- | :--- |
| **Familia con 4 integrantes** | `Carolina Morales Rivera` (o cualquiera de sus hijos) | `987654321` | Muestra los 4 boletos de la familia FAM-01 para Bus 1. |
| **Solo viaje de ida** | `Carlos Mendoza Solís` | `912340001` | Muestra boleto de Ida. En pestaña Vuelta indica *"No viaja en este tramo"*. |
| **Cambio de bus en vuelta** | `Andrés Silva Navarro` | `912340003` | En Ida muestra Bus 1. En Vuelta muestra Bus 2 con cartel de advertencia de cambio. |
| **Panel Administrador** | Acceder a `admin.html` | Clave: `admin2026` | Descifra los 68 pasajeros, muestra cupos 34/34 y activa modo abordaje. |

> **Nota de flexibilidad:** Al consultar como pasajero, puedes escribir en minúsculas, con o sin acentos (ej: `carolina morales`), y el teléfono con o sin código de país (ej: `987654321` o `+56 9 8765-4321`). El sistema lo normaliza automáticamente.

---

## 🚀 6. Publicación del Sitio Web

Al ser un sitio web 100% estático (sin servidor backend), puedes publicarlo gratis en minutos en cualquiera de las siguientes plataformas:

### A. Netlify (Recomendado - 2 minutos)
1. Inicia sesión en [Netlify Drop](https://app.netlify.com/drop).
2. Arrastra y suelta la carpeta `boleto-traslado/` en el navegador.
3. ¡Listo! Te entregará una URL HTTPS segura inmediatamente.

### B. Cloudflare Pages
1. Ve a tu panel de Cloudflare > **Workers & Pages** > **Create application** > **Pages**.
2. Conecta tu repositorio de GitHub o sube directamente los archivos compilados (`index.html`, `admin.html`, `data.enc.json`, carpetas `css/` y `js/`).
3. El directorio de salida es la raíz `./`.

### C. GitHub Pages
1. Crea un repositorio en GitHub y sube los archivos del proyecto.
2. Ve a **Settings** > **Pages**.
3. En **Source**, selecciona `Deploy from a branch` y elige la rama `main` (carpeta `/root`).
4. Haz clic en **Save**. En un par de minutos estará disponible en `https://tu-usuario.github.io/tu-repo/`.

---

## 🖨️ 7. Instrucciones para el Día del Abordaje

1. **Para los pasajeros**:
   - Pueden presentar su boleto digital en el teléfono (el QR se escanea directamente en pantalla).
   - O pueden imprimirlo en hoja A4 (frente con el boleto y muescas, reverso con los pasos de llegada).
2. **Para los administradores en el bus**:
   - Abre `admin.html` en tu celular e ingresa la contraseña.
   - Activa el **"Modo Abordaje en Vivo"**.
   - Filtra por el tramo actual (Ida o Vuelta) y tu número de bus (Bus 1 o Bus 2).
   - A medida que las personas suban, toca su nombre para marcarlos como *"Subió"*. Verás el contador subir en tiempo real (ej: `28/34 (82%)`).
   - Puedes exportar el reporte final en cualquier momento con el botón **"Exportar a CSV"**.
