# Configuración de Claude con MCP Server para Odoo

En **Windows**, debes crear el archivo `claude_desktop_config.json` en la siguiente ruta:

C:\Users\ITS\AppData\Roaming\Claude


(O en el directorio donde se haya instalado Claude).

---

## Contenido del archivo `claude_desktop_config.json`

```json
{
  "scale": 0,
  "locale": "es-419",
  "userThemeMode": "system",
  "mcpServers": {
    "odoo_node": {
      "command": "node",
      "args": [
        "ruta/hacia/index.js"
      ],
      "env": {
        "ODOO_URL": "https://midominio.com",
        "ODOO_DB": "mi_db",
        "ODOO_USER": "miusuario",
        "ODOO_PASSWORD": "micontra",
        "DOTENV_CONFIG_QUIET": "true"
      }
    }
  }
}
