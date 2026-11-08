# POLÍTICA DE TRATAMIENTO Y PROTECCIÓN DE DATOS PERSONALES
**RPG PRODUCTIVITY & PERSONAL FINANCE LIFE-ENGINE (v3.4)**

*Última actualización: Noviembre de 2026*  
*Marco Normativo: Ley Estatutaria 1581 de 2012 y Decreto Reglamentario 1377 de 2013 (República de Colombia — Régimen de Habeas Data)*

---

## 1. IDENTIFICACIÓN DEL RESPONSABLE DEL TRATAMIENTO

El **RPG Productivity & Personal Finance Life-Engine** (en adelante, "La Plataforma" o "El Sistema") es una plataforma tecnológica de código abierto y computación en la nube para el seguimiento cuantitativo de productividad, gestión ágil de proyectos (Scrum, Kanban, Lean), métricas de habilidades multidisciplinarias (WCA Speedcubing, Lectura con repetición espaciada SM-2, Trabajo profundo) y simulación económica gamificada (XP/GP).

- **Canal Oficial de Privacidad y Habeas Data:** `privacidad@rpg-life-engine.local`
- **Repositorio Oficial:** `https://github.com/isacarlope13/rpg-life-engine`

---

## 2. MARCO LEGAL Y PRINCIPIOS RECTORES

La presente Política de Tratamiento de Datos Personales se fundamenta en el Artículo 15 de la Constitución Política de Colombia, la **Ley 1581 de 2012**, el **Decreto 1377 de 2013**, la Circular Única de la Superintendencia de Industria y Comercio (SIC) y las mejores prácticas internacionales de privacidad digital (GDPR):

1. **Principio de Legalidad:** El tratamiento de datos personales es una actividad reglada sujeta a la ley colombiana.
2. **Principio de Finalidad:** La recolección obedece exclusivamente a una finalidad legítima y necesaria para la gamificación y sistematización de datos personales.
3. **Principio de Libertad:** Solo se recopilan y procesan datos con el consentimiento libre, previo, expreso e informado del titular.
4. **Principio de Veracidad o Calidad:** Los datos deben ser veraces, completos, exactos, actualizados y comprensibles.
5. **Principio de Transparencia:** Se garantiza el derecho del titular a obtener información acerca de sus datos en cualquier momento.
6. **Principio de Acceso y Circulación Restringida:** Los datos solo son accesibles por el propio titular mediante mecanismos criptográficos y de autenticación de usuario.
7. **Principio de Seguridad:** Se emplean medidas técnicas y administrativas para otorgar seguridad a los registros y evitar su pérdida, adulteración o acceso no autorizado.
8. **Principio de Confidencialidad:** Toda persona o entidad involucrada en el tratamiento de los datos está obligada a guardar reserva profesional.

---

## 3. CATEGORÍAS DE DATOS RECOLECTADOS

La Plataforma trata las siguientes categorías de datos:

### A. Datos de Identificación y Acceso
- Dirección de correo electrónico.
- Contraseña cifrada unidireccionalmente mediante funciones hash criptográficas seguras (bcrypt a través de Supabase Auth).
- Nombre de usuario o alias de aventurero y clase de personaje elegida.

### B. Datos de Productividad y Habilidades
- Registro de horas y minutos invertidos en sesiones de estudio y trabajo profundo (*Deep Work*).
- Métricas de lectura: títulos de libros, número de páginas leídas por día y tarjetas de memoria activa con algoritmo de repetición espaciada (SM-2).
- Métricas de Speedcubing: tiempos de resolución cronometrados conforme a regulaciones WCA, scrambles oficiales generados, medias trimmed (Ao5, Ao12) y penalizaciones (+2s, DNF).
- Métricas de enfoque en artes o deportes (hileras de tejido artesanal, rutinas de entrenamiento).

### C. Datos de Proyectos Ágiles y Tareas
- Nombres de proyectos, metodologías de trabajo (Scrum, Kanban, Lean), columnas de tableros Trello y tarjetas de tareas.
- Entregables y estimaciones de tiempo.

### D. Datos de Ritmo Circadiano y Sueño
- Horas aproximadas de vigilia (levantarse) y descanso (dormir) registradas por el usuario para la conformación de cronogramas biológicos diarios y semanales.

### E. Datos de Finanzas Personales Cuantitativas
- Metas de ahorro proyectadas, presupuestos operativos y fijos estimados.
- Saldos de oro virtual (GP) en Bóveda y Billetera para economía de restricción gamificada.
- Montos de pasivos financieros introducidos voluntariamente por el usuario para la simulación de estrategias de desendeudamiento (Bola de Nieve vs Avalancha).

> ### ⚠️ DECLARACIÓN EXPRESA SOBRE DATOS BANCARIOS SENSIBLES
> La Plataforma **NO** solicita, no recolecta, no procesa ni almacena números de cuentas bancarias completas, números de tarjetas de crédito o débito de 16 dígitos, códigos de seguridad CVV/CVC, tokens OTP ni contraseñas de acceso a portales financieros.  
> Los nombres de entidades (como ADDI, Nequi, Bancolombia) actúan exclusivamente como etiquetas descriptivas de juego (*Debt Bosses*) introducidas por el propio usuario para su autogestión.

---

## 4. FINALIDADES DEL TRATAMIENTO

Los datos personales son tratados para:
1. Validar la identidad y autenticar al usuario en el sistema.
2. Calcular la progresión de juego: nivel de aventurero, puntos de experiencia (XP), forja de oro virtual (GP) y multiplicadores de racha de hábitos.
3. Renderizar gráficos analíticos personales: Heatmap de constancia anual de 365 días, curva de rendimiento WCA y cronograma biológico.
4. Procesar atajos automáticos de iOS Shortcuts y el Modo Móvil de 5 segundos.
5. Mantener la cola de sincronización local en el dispositivo del usuario cuando opera en Modo Offline (Progressive Web App).
6. Permitir la exportación integral de los datos en formatos abiertos (Notion CSV, CSV financiero, JSON maestro).

---

## 5. POLÍTICA DE NO COMERCIALIZACIÓN DE DATOS

**El RPG Life-Engine NO comercializa, no vende, no arrienda, no cede ni transfiere datos personales a terceros, redes publicitarias, empresas de marketing ni centrales de riesgo financiero.** Todos los datos pertenecen de forma inalienable al titular.

---

## 6. MEDIDAS TÉCNICAS DE SEGURIDAD

- **Cifrado en Tránsito (TLS/HTTPS):** Todas las comunicaciones entre el dispositivo del aventurero y los servidores están cifradas mediante protocolos modernos TLS.
- **Row Level Security (RLS) en Base de Datos:** Las políticas a nivel de fila en PostgreSQL impiden que cualquier usuario acceda a los registros de otro jugador (`auth.uid() = user_id`).
- **Almacenamiento Local PWA Protegido:** Las acciones offline se almacenan en el espacio privado del navegador del usuario (`localStorage` / caché del Service Worker).
- **Shortcut API Keys Privadas:** Los atajos de iOS autentican con tokens individuales revocables y regenerables en cualquier momento.

---

## 7. DERECHOS DEL TITULAR (HABEAS DATA)

De conformidad con el Artículo 8 de la Ley 1581 de 2012, el titular tiene derecho a:
1. Conocer, actualizar y rectificar sus datos personales frente a La Plataforma.
2. Solicitar prueba de la autorización otorgada para el tratamiento.
3. Ser informado sobre el uso que se ha dado a sus datos personales.
4. Presentar ante la Superintendencia de Industria y Comercio quejas por infracciones a la ley.
5. Revocar la autorización y/o solicitar la supresión de sus datos personales (**Derecho al Olvido**).
6. Acceder en forma gratuita a sus datos personales tratados.

---

## 8. PROCEDIMIENTO PARA EL EJERCICIO DE DERECHOS

Para radicar consultas o reclamos de Habeas Data, el titular debe remitir una comunicación al correo:  
📧 **`privacidad@rpg-life-engine.local`**

La solicitud debe contener:
- Nombre completo del titular.
- Correo electrónico registrado en La Plataforma.
- Motivo de la solicitud (consulta, actualización, rectificación, portabilidad o supresión total).
- Las consultas serán resueltas en un plazo máximo de diez (10) días hábiles y los reclamos en un plazo máximo de quince (15) días hábiles, contados a partir del día siguiente al recibo de la comunicación.

---

## 9. VIGENCIA Y ACTUALIZACIONES

Esta política rige a partir de su publicación en noviembre de 2026. La base de datos asociada a cada usuario se mantendrá activa mientras el titular conserve su cuenta o hasta que solicite formalmente su eliminación definitiva. Cualquier modificación sustancial a los términos de esta política será notificada a través del sitio web oficial.
