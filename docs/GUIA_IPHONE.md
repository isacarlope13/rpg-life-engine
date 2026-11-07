# 📱 Guía Maestra de Configuración & Uso en iPhone (iOS)
### *RPG Productivity & Personal Finance Life-Engine*

Esta guía detalla paso a paso cómo transformar tu iPhone en el centro de mando de tu vida y tus finanzas con el motor RPG, aprovechando **PWA nativa**, **Apple Shortcuts (Atajos de iOS)**, **Automatizaciones automáticas por SMS bancario**, **Comandos de Voz con Siri** y **Widgets en pantalla de inicio**.

---

## 1. 📲 Instalar la App como PWA Nativa en tu iPhone

Para usar la aplicación en pantalla completa sin barra de navegación de Safari:

1. Abre **Safari** en tu iPhone y entra a tu URL de producción:
   `https://rpg-life-engine-production.up.railway.app`
2. Inicia sesión con tus credenciales.
3. Toca el botón **Compartir** de Safari (el ícono de un cuadrado con una flecha hacia arriba en la barra inferior).
4. Desplázate hacia abajo y selecciona **"Agregar a pantalla de inicio"** (o *"Add to Home Screen"*).
5. Dale el nombre **"RPG Life"** y presiona **Agregar**.
6. **¡Listo!** Ahora tendrás un ícono nativo en tu pantalla de inicio que abre la app a pantalla completa, con soporte offline y respuesta ultrarrápida.

> [!TIP]
> **Modo Móvil 5 Segundos:** Si vas por la calle o en el transporte y necesitas registrar algo en 5 segundos sin distracciones, accede directamente a:
> `https://rpg-life-engine-production.up.railway.app/quick`
> Esta vista minimalista te permite ingresar un gasto, activar el escudo Aegis o loguear una sesión con un teclado numérico grande en 1 solo toque.

---

## 2. ⚡ Atajos de iOS (Apple Shortcuts)

Tu motor expone endpoints optimizados para interactuar con la app de **Atajos (Shortcuts)** de iOS sin necesidad de abrir la aplicación.

### Endpoint Base
`https://rpg-life-engine-production.up.railway.app/api/shortcuts`

### Autenticación en Atajos
Los endpoints de atajos soportan autenticación mediante la cabecera `Authorization`:
```http
Authorization: Bearer TU_SHORTCUT_API_KEY
```
*(Puedes definir tu clave en las variables de entorno de Railway como `SHORTCUT_API_KEY`). Si estás en la misma sesión de cookies de Safari, se autentica automáticamente.*

---

## 3. 🤖 Atajo 1: Registro Automático de Gastos por SMS Bancario

Cuando compras con tarjeta de débito o crédito, los bancos en Colombia (Bancolombia, Davivienda, Nu Colombia, Nequi, Lulo Bank, RappiCard) envían una notificación SMS de compra instantánea. iOS te permite disparar un atajo de forma 100% automática cuando llega ese SMS.

### Paso a Paso para la Automatización:

1. Abre la app **Atajos (Shortcuts)** en tu iPhone.
2. Ve a la pestaña **Automatización** en la parte inferior.
3. Toca el botón **"+"** (Nueva automatización) y elige **"Mensaje"**.
4. Configura:
   - **Remitente:** El número o nombre del banco (ej. `Bancolombia`, `Davivienda`, `85585`).
   - **El mensaje contiene:** `Compraste` o `compra`.
   - Marca **"Ejecutar inmediatamente"** (Run Immediately) y desmarca "Preguntar antes de ejecutar".
5. En la acción a ejecutar, agrega:
   - **Obtener contenido de URL** (*Get Contents of URL*):
     - **URL:** `https://rpg-life-engine-production.up.railway.app/api/shortcuts/quick-expense`
     - **Método:** `POST`
     - **Cabeceras:**
       - `Content-Type`: `application/json`
       - `Authorization`: `Bearer TU_API_KEY`
     - **Cuerpo de la Solicitud (JSON):**
       - `raw_text`: Selecciona la variable del atajo **"Entrada de atajo"** (Shortcut Input) -> **Contenido del mensaje**.
       - `use_aegis_shield`: `true` (Booleano)
   - **Mostrar notificación** o **Leer texto con Siri** (*Speak Text*):
     - Configura el texto con la respuesta del motor: `shortcut_tts_message`.

> **¿Qué pasa en segundo plano?**
> La IA de Gemini analiza el SMS, extrae el comercio (ej. "Rappi Restaurantes"), el valor exacto ($32.500 COP), la fecha y la categoría. Si tienes saldo en tu Billetera GP y marcaste el escudo Aegis, protege tu racha; si es un gasto fijo, actualiza tu presupuesto operativo.

---

## 4. 🎙️ Atajo 2: Registro por Voz con Siri ("Oye Siri, Registrar Lectura")

Puedes dictarle a Siri mientras tienes el libro físico en las manos o cuando terminas de armar el cubo de Rubik.

### Configuración del Atajo de Lectura:

1. Crea un nuevo Atajo con el nombre: **"Registrar Lectura"**.
2. Acción 1: **Solicitar entrada** (*Ask for Input*):
   - Pregunta: *"¿Cuántas páginas leíste?"* (Tipo: Número).
3. Acción 2: **Solicitar entrada** (*Ask for Input*):
   - Pregunta: *"¿Alguna frase que quieras recordar?"* (Tipo: Texto, Opcional).
4. Acción 3: **Obtener contenido de URL**:
   - **URL:** `https://rpg-life-engine-production.up.railway.app/api/shortcuts/skill-session`
   - **Método:** `POST`
   - **JSON:**
     ```json
     {
       "action": "log_session",
       "domain": "reading",
       "pages_read": Variable(Entrada 1),
       "quote_text": Variable(Entrada 2),
       "duration_minutes": 30
     }
     ```
5. Acción 4: **Hablar texto** (*Speak Text*):
   - Dicta el mensaje devuelto por el servidor (`shortcut_tts_message`).
6. **Uso:** Di *"Oye Siri, Registrar Lectura"*, respóndele *"15"* y Siri te dirá: *"¡Excelente! Registraste 15 páginas. Ganaste +1.500 GP y tu racha subió a 4 días."*

---

## 5. 📸 Atajo 3: Escaneo de Facturas con la Cámara (OCR con Gemini)

1. Crea un nuevo Atajo llamado **"Escanear Factura"**.
2. Acción 1: **Tomar foto** (*Take Photo*) con la cámara trasera.
3. Acción 2: **Codificar con Base64** (*Base64 Encode*) la imagen tomada.
4. Acción 3: **Obtener contenido de URL**:
   - **URL:** `https://rpg-life-engine-production.up.railway.app/api/shortcuts/receipt-vision`
   - **Método:** `POST`
   - **JSON:**
     ```json
     {
       "image_base64": Variable(Base64)
     }
     ```
5. Acción 4: Muestra el resultado de los ítems detectados (Supermercado, Alimentos, Total) y su impacto en tu presupuesto semanal.

---

## 6. 📊 Atajo 4: Widget en Pantalla de Inicio / Bloqueo con Scriptable

Para ver en tu pantalla de inicio el saldo de tu Bóveda, tu Billetera y la vida restante de tus Jefes de Deuda (ADDI / Nequi):

1. Descarga la aplicación gratuita **Scriptable** del App Store.
2. Crea un nuevo script en Scriptable y pega el código disponible en la pestaña **"Laboratorio iOS Shortcuts -> Scriptable Widget"** dentro de tu Dashboard.
3. Agrega un widget de Scriptable en la pantalla de inicio de tu iPhone.
4. ¡Tendrás tu barra de vida RPG y oro en tiempo real actualizada automáticamente!

---

## 7. ⏱️ Cronómetro en Vivo desde el iPhone

Cuando estés leyendo un libro, practicando Rubik, tejiendo o entrenando:

1. Abre la PWA en tu iPhone y ve a la sala de la habilidad.
2. Toca el botón verde **"▶ Iniciar Sesión"**.
3. El cronómetro comenzará a contar en tiempo real con indicador pulsante.
4. Puedes minimizar o bloquear el teléfono; el tiempo continuará calculándose.
5. Al terminar, toca **"⏹ Finalizar y Registrar"**. El motor convertirá automáticamente el tiempo a minutos, calculará tu XP, transferirá los GP de tu Bóveda a tu Billetera y guardará tu sesión.
