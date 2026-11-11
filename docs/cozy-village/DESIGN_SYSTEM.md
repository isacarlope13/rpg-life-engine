# COZY PIXEL DESIGN SYSTEM
## Guía de Estilo, Tokens y Catálogo de Componentes Reutilizables

**Proyecto:** RPG Life-Engine / Cozy Living Village (Valle de Oakhaven)  
**Versión:** v1.2.0 (Design System)  
**Entorno:** Next.js 15, Tailwind CSS v4, TypeScript, React 19  

---

## 1. DIRECCIÓN ARTÍSTICA & VISIÓN

El **Cozy Pixel Design System** provee la identidad visual para la transformación de RPG Life-Engine en un pueblo virtual cálido y acogedor. Se fundamenta en:

* **Estética Cozy Pixel Art:** Inspirada en clásicos como *Stardew Valley*, *Animal Crossing*, *Habbo* y *Club Penguin*.
* **Naturaleza & Materia Noble:** Uso preponderante de madera, tonos crema, salvia y verde bosque profundo.
* **Modernidad Bento Grid:** Cuadrículas modulares de esquinas suaves combinadas con biseles táctiles pixelados.
* **Respuesta Táctil & Háptica:** Botones con relieve 3D pixel (`0 3px 0 #3A2E2B`) que responden al clic y emiten micro-vibraciones hápticas en dispositivos móviles.

---

## 2. PALETA BASE OFICIAL

| Token | Nombre | Código HEX | Rol y Uso Principal | Contraste |
|---|---|:---:|---|:---:|
| `forest` | **Forest** | `#314C3C` | Primario bosque. Botones principales, cabeceras y títulos. | Blanco / Crema |
| `sage` | **Sage** | `#77936A` | Verde salvia. Badges de bienestar, acentos secundarios y Tier 2. | Blanco / Bark |
| `meadow` | **Meadow** | `#B8CCA0` | Verde pradera suave. Fondos resaltados y barras de progreso. | Bark |
| `cream` | **Cream** | `#F4EEDC` | Fondo principal cálido del pueblo y de tarjetas Bento. | Bark |
| `wood` | **Wood** | `#D8B48A` | Madera clara. Marcos, botones secundarios y Tier 1. | Bark |
| `clay` | **Clay** | `#C88973` | Terracota. Alertas suaves, estados activos y micro-misiones. | Blanco |
| `lake` | **Lake** | `#A9C7C7` | Azul lago sereno. Concentración, reflejos y estados de foco. | Bark |
| `sunlight` | **Sunlight** | `#E7D69C` | Luz dorada. Monedas GP, estrellas, hitos, Tier 3 y maestría. | Bark |
| `bark` | **Bark** | `#3A2E2B` | Corteza oscura. Borde pixel canónico y texto de alta legibilidad. | Fondo Crema |
| `parchment` | **Parchment** | `#FFFDF8` | Blanco apergaminado. Tarjetas de lectura y modales. | Bark |

---

## 3. PROGRESIÓN VISUAL DE TIERS EN EDIFICIOS

Los edificios de Oakhaven evolucionan de acuerdo con las sesiones y el nivel del jugador:

| Tier | Nombre | Icono | Borde & Acento | Decoración Distintiva |
|:---:|---|:---:|---|---|
| **Tier 1** | Cabaña Rústica | `🪵` | Borde `#5C4033`, Badge Wood | Humo de leña, cesta de materiales y mesa exterior. |
| **Tier 2** | Taller Establecido | `🌿` | Borde 3px `#77936A`, Badge Sage | Toldo de lona artesanal, farol encendido y repisas. |
| **Tier 3** | Santuario Maestro | `⭐` | Borde 4px `#E7D69C`, Ring Glow | Cúpula iluminada, vidrieras doradas y estandarte. |

---

## 4. CATÁLOGO DE COMPONENTES ATÓMICOS (`src/components/cozy/ui/`)

### 1. `CozyButton`
Botón pixelado con relieve táctil y respuesta háptica PWA.
* **Variantes (100% Paleta Oficial):** `forest`, `wood`, `clay`, `sunlight`, `sage`, `lake`, `cream`, `ghost`.
* **Tamaños:** `sm` (compacto), `md` (estándar), `lg` (llamado a la acción).
* **Propiedades:** `icon`, `iconPosition`, `disableHaptic`, `disabled`.

### 2. `CozyCard` & `CozyCardHeader`
Contenedor modular Bento con marco de madera biselado.
* **Tornillos decorativos (`bolts={true}`):** Añade tornillos `🔩` en las 4 esquinas simulando un banco de trabajo artesanal.
* **Variantes:** `parchment`, `cream`, `wood`, `sage`.

### 3. `CozyWindow`
Ventana estilo interfaz de videojuego retro con barra de título contrastada, icono, subtítulo y botón de cierre táctil 'X'.

### 4. `CozyModal`
Modal accesible (`role="dialog"`, `aria-modal="true"`):
* Centrado absoluto con desenfoque de fondo (`backdrop-blur-sm`).
* Cierre con tecla Escape y clic en el exterior.
* Bloqueo de desplazamiento de fondo.

### 5. `CozyTooltip`
Indicador contextual estilo pergamino/madera que se despliega al pasar el cursor o hacer foco en 4 posiciones (`top`, `bottom`, `left`, `right`).

### 6. `CozyProgress`
Barra de progreso con contenedor biselado y relleno vegetal o dorado adaptable con porcentaje numérico opcional.

### 7. `CozyTabs`
Conmutador de pestañas estilo lengüetas de archivo o inventario de aventura con insignias de conteo (`badge`).

### 8. `CozyNotification`
Alertas y banners estilo pergamino con 4 variantes: `success` (verde), `info` (lago), `warning` (dorado) y `error` (arcilla).

### 9. `CozyEmptyState`
Estado vacío con ilustración pixelada o ASCII, mensaje cálido de bienvenida y botón de acción opcional.

### 10. `CozyLoadingState`
Placeholder esqueleto o spinner temático cozy con mensaje informativo.

### 11. `CozySessionControls`
Panel interactivo para sesiones de foco o habilidad con reloj digital monospace retro, presets rápidos (5, 15, 25, 45 min) y botón de forja de sesión hacia el motor.

---

## 5. COMPONENTES COMPUESTOS DE EXPERIENCIA

### 1. `CozySoundscapeModal` (`src/components/cozy/cozy-soundscape-modal.tsx`)
Selector de ambientación sonoro procedural basado en la **Web Audio API** nativa:
* 5 presets: Silencio (`off`), Lluvia (`rain`), Fogón (`fireplace`), Brisa (`breeze`) y Campanas (`chimes`).
* Control lineal de volumen (0 a 100%) con persistencia en `localStorage`.
* Silencio garantizado por defecto hasta que el usuario decida activarlo.

### 2. `VillageQuestsModal` (`src/components/cozy/village-quests-modal.tsx`)
Diario Comunitario de Misiones Bento:
* Presenta a los 8 residentes con medidor de amistad en corazones (`❤️🤍`).
* Muestra títulos, descripciones y tiempos estimados de cada micro-misión.
* Permite registrar avances canónicos directamente mediante un botón táctil con resiliencia offline.

---

## 6. PÁGINA DE DEMOSTRACIÓN INTERACTIVA

Se encuentra disponible en:
```
/cozy/design-system
```
Permite explorar todos los tokens visuales, copiar códigos hexadecimales con un solo clic, interactuar con los botones en todas sus variantes, probar el temporizador de foco y abrir el modal accesible.

---

## 7. ACCESIBILIDAD & MOVIMIENTO REDUCIDO

* **WCAG 2.1 AA:** Todo texto garantiza una relación de contraste superior a 4.5:1 sobre sus fondos respectivos.
* **`prefers-reduced-motion`:** Las utilidades en `src/app/globals.css` aseguran que ante la activación de movimiento reducido en el sistema operativo, las transiciones y animaciones se minimicen instantáneamente a `0.01ms`.
* **Navegación por Teclado:** Foco visible en todos los botones y tabs; modales controlables mediante `Tab` y `Escape`.
