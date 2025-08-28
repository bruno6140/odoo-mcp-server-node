#!/usr/bin/env node

/**
 * Servidor MCP para Odoo - Versión Node.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import xmlrpc from "xmlrpc";
import dotenv from "dotenv";
import process from "process";

// ======================
// Conector Odoo
// ======================
class OdooConnector {
  constructor(url, db, username, password) {
    this.url = url;
    this.db = db;
    this.username = username;
    this.password = password;
    this.uid = null;
    this.models = null;
  }

  async authenticate() {
    try {
      // Cliente para autenticación
      const isHttps = new URL(this.url).protocol === "https:";
      const clientFactory = isHttps
        ? xmlrpc.createSecureClient
        : xmlrpc.createClient;

      const common = clientFactory({
        host: new URL(this.url).hostname,
        port: new URL(this.url).port || (isHttps ? 443 : 80),
        path: "/xmlrpc/2/common",
      });

      // Autenticar
      this.uid = await new Promise((resolve, reject) => {
        common.methodCall(
          "authenticate",
          [this.db, this.username, this.password, {}],
          (error, value) => {
            if (error) reject(error);
            else resolve(value);
          }
        );
      });

      if (this.uid) {
        // Cliente para operaciones con modelos
        this.models = clientFactory({
          host: new URL(this.url).hostname,
          port: new URL(this.url).port || (isHttps ? 443 : 80),
          path: "/xmlrpc/2/object",
        });

        console.error(`Conectado a Odoo como usuario ID: ${this.uid}`);
      } else {
        throw new Error("Falló la autenticación");
      }
    } catch (error) {
      console.error(`Error conectando con Odoo: ${error.message}`);
      throw error;
    }
  }

  async searchRead(model, domain = [], fields = [], limit = null) {
    if (!this.models) {
      throw new Error("No hay conexión con Odoo");
    }

    const kwargs = fields.length > 0 ? { fields } : {};
    if (limit) {
      kwargs.limit = limit;
    }

    return new Promise((resolve, reject) => {
      this.models.methodCall(
        "execute_kw",
        [
          this.db,
          this.uid,
          this.password,
          model,
          "search_read",
          [domain],
          kwargs,
        ],
        (error, value) => {
          if (error) reject(error);
          else resolve(value);
        }
      );
    });
  }
}

// ======================
// Inicializar conexión Odoo
// ======================
let odoo = null;

async function initOdooConnection() {
  dotenv.config();

  const url = process.env.ODOO_URL;
  const db = process.env.ODOO_DB;
  const username = process.env.ODOO_USER;
  const password = process.env.ODOO_PASSWORD;

  console.error(`Conectando a: ${url}`);
  console.error(`Base de datos: ${db}`);
  console.error(`Usuario: ${username}`);

  odoo = new OdooConnector(url, db, username, password);
  await odoo.authenticate();
}

// ======================
// Servidor MCP
// ======================
const server = new Server(
  {
    name: "odoo-mcp-nodejs",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Lista de herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_customers",
        description: "Obtener lista de clientes de Odoo",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Número máximo de clientes a obtener",
              default: 50,
            },
          },
        },
      },
      {
        name: "get_products",
        description: "Obtener lista de productos de Odoo",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Número máximo de productos a obtener",
              default: 50,
            },
          },
        },
      },
      {
        name: "get_sale_orders",
        description: "Obtener órdenes de venta de Odoo",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Número máximo de órdenes a obtener",
              default: 20,
            },
          },
        },
      },
      {
        name: "get_users",
        description: "Obtener lista de usuarios de Odoo",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Número máximo de usuarios a obtener",
              default: 50,
            },
          },
        },
      },
    ],
  };
});

// Manejar llamadas a herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!odoo) {
    return {
      content: [
        {
          type: "text",
          text: "❌ No hay conexión con Odoo",
        },
      ],
    };
  }

  try {
    switch (name) {
      case "get_customers": {
        const limit = args?.limit || 50;
        const customers = await odoo.searchRead(
          "res.partner",
          [["customer_rank", ">", 0]],
          ["name", "email", "phone", "city"],
          limit
        );

        let result;
        if (customers && customers.length > 0) {
          result = `👥 **${customers.length} clientes encontrados:**\n\n`;
          for (const c of customers) {
            result += `📋 **${c.name}**\n`;
            if (c.email) {
              result += `   📧 ${c.email}\n`;
            }
            if (c.phone) {
              result += `   📞 ${c.phone}\n`;
            }
            if (c.city) {
              result += `   🏙️ ${c.city}\n`;
            }
            result += "\n";
          }
        } else {
          result =
            "❌ **No hay clientes registrados**\n\nPuedes agregar clientes desde Ventas → Clientes en Odoo.";
        }

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get_products": {
        const limit = args?.limit || 50;
        const products = await odoo.searchRead(
          "product.product",
          [["sale_ok", "=", true]],
          ["name", "list_price", "categ_id"],
          limit
        );

        let result;
        if (products && products.length > 0) {
          result = `📦 **${products.length} productos encontrados:**\n\n`;
          for (const p of products) {
            result += `🏷️ **${p.name}**\n`;
            result += `   💰 $${p.list_price}\n`;
            if (p.categ_id && p.categ_id.length > 1) {
              result += `   📂 ${p.categ_id[1]}\n`;
            }
            result += "\n";
          }
        } else {
          result =
            "❌ **No hay productos registrados**\n\nPuedes agregar productos desde Ventas → Productos en Odoo.";
        }

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get_sale_orders": {
        const limit = args?.limit || 20;
        const orders = await odoo.searchRead(
          "sale.order",
          [],
          ["name", "partner_id", "date_order", "amount_total", "state"],
          limit
        );

        let result;
        if (orders && orders.length > 0) {
          result = `🛒 **${orders.length} órdenes encontradas:**\n\n`;
          for (const o of orders) {
            result += `📄 **${o.name}**\n`;
            if (o.partner_id && o.partner_id.length > 1) {
              result += `   👤 ${o.partner_id[1]}\n`;
            }
            result += `   📅 ${o.date_order}\n`;
            result += `   💵 $${o.amount_total}\n`;
            result += `   📊 ${o.state}\n\n`;
          }
        } else {
          result =
            "❌ **No hay órdenes de venta**\n\nLas órdenes aparecerán cuando se creen desde Ventas → Órdenes.";
        }

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get_users": {
        const limit = args?.limit || 50;
        const users = await odoo.searchRead(
          "res.users",
          [],
          ["name", "login", "email", "active"],
          limit
        );

        let result;
        if (users && users.length > 0) {
          result = `👨‍💻 **${users.length} usuarios encontrados:**\n\n`;
          for (const u of users) {
            // Determinar estado
            let estado;
            if (!u.active) {
              estado = "❌ Inactivo";
            } else if (u.last_activity_time) {
              estado = `🕒 Último acceso: ${u.last_activity_time}`;
            } else {
              estado = "🆕 Nunca se conectó";
            }

            result += `👤 **${u.name}**\n`;
            result += `   🔑 ${u.login}\n`;
            if (u.email && u.email !== u.login) {
              result += `   📧 Email: ${u.email}\n`;
            }
            result += `   ${estado}\n\n`;
          }
        } else {
          result = "❌ **No hay usuarios registrados**";
        }

        return {
          content: [{ type: "text", text: result }],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `❌ Herramienta '${name}' no encontrada`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Error: ${error.message}`,
        },
      ],
    };
  }
});

// ======================
// Función principal
// ======================
async function main() {
  console.error("Iniciando servidor MCP para Odoo...");

  try {
    await initOdooConnection();
    console.error("✅ Servidor MCP listo!");

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    if (error.name === "CancelledError") {
      console.error("Servidor MCP cancelado");
    } else {
      console.error(`Error del servidor: ${error.message}`);
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// ======================
// Ejecución principal
// ======================
process.on("SIGINT", () => {
  console.error("\n👋 ¡Hasta luego!");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.error(`\n💥 Error fatal: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

// Iniciar servidor
console.error("=".repeat(60));
console.error("🚀 SERVIDOR MCP ODOO - ITS Systems");
console.error("=".repeat(60));

main().catch((error) => {
  console.error(`Error iniciando servidor: ${error.message}`);
  process.exit(1);
});
