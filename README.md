# Patrimonio (versión de prueba)

App personal de seguimiento de patrimonio. Se instala en el iPhone desde Safari
(Compartir → Agregar a pantalla de inicio).

- Los datos se guardan **cifrados en el teléfono** (AES-256-GCM, llave derivada de tu código con PBKDF2, 600,000 iteraciones).
- Nada se envía a ningún servidor. Este repositorio solo contiene el código de la app, nunca datos.
- Los respaldos van cifrados y se guardan donde tú elijas (por ejemplo, Google Drive).
