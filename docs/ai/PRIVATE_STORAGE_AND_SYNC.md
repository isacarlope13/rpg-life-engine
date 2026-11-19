# PRIVATE STORAGE AND SYNC — STORAGE PRIVADO Y ESTADOS DE SINCRONIZACIÓN

## 1. Bucket Privado en Supabase Storage (Preparado en SQL Draft)
El archivo `supabase/drafts/20261119_phase2_private_storage_and_resources.sql` define:
- Bucket `oakhaven-private-resources` con **`public = false`** (cero URLs públicas permanentes).
- Políticas RLS estrictas en `storage.objects`: el primer segmento de la ruta debe coincidir exactamente con `auth.uid()::text`.
- Sin uso de `service_role` en el navegador.

## 2. Estados de Sincronización Visibles (`SyncLifecycleState`)
Cada recurso y flujo de sincronización distingue exactamente 5 estados:
- **`GUARDADO_LOCALMENTE`**: Existe solo en este dispositivo (ej. migración aún pendiente o sin sesión en nube).
- **`PENDIENTE_SINCRONIZACION`**: En cola local por falta de red o tabla pendiente.
- **`SINCRONIZADO`**: Confirmado en Supabase con RLS del propietario.
- **`ERROR`**: Fallo explícito de red o validación (se conserva el dato local para reintento).
- **`CONFLICTO`**: El mismo registro cambió de forma divergente en dos dispositivos; se detiene la sobrescritura automática hasta que el usuario elija qué versión conservar.

## 3. Cómo recuperarte si algo falla
- Nunca se borra `localStorage` automáticamente tras un intento de subida.
- En cada biblioteca tienes el botón **`Respaldo JSON`** para descargar tus registros locales antes de cualquier limpieza.
- El archivado usa `deleted_at` (archivado lógico) y exige confirmación explícita (`Confirmar archivo`) en la interfaz.
