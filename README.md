En C:\Users\ITS\AppData\Roaming\Claude o donde se haya instalado Claude crear el archivo claude_desktop_config.json:

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