# A-MarkdownUI MCP Server (`@a-mdui/mcp-server`)

> **Fork notice.** This is a fork of [anandsankarank/md2ui-mcp](https://github.com/anandsankarank/md2ui-mcp). It adds reconstructed renderer assets at `dist/assets/a-mdui.bundle.js` and `dist/assets/a-mdui.bundle.css` so `render_mdui` can inline a working `<a-mdui>` widget while the official `@a-mdui/web` package remains unpublished (the jsDelivr CDN fallback currently 404s).
>
> These files are a **compatibility rebuild** of the public `<a-mdui>` host API and `.mdui` language documented in this repo. **They are not the official unpublished `@a-mdui/web` package.**
>
> The CloudPulse dashboard, rendered by those assets from the official `dashboard` template, is in [`examples/CloudPulse-Global-Infrastructure.html`](examples/CloudPulse-Global-Infrastructure.html) ([screenshot](examples/cloudpulse-dashboard.png)). A shorter copy of the same demo is in [`examples/demo.html`](examples/demo.html).

The official **Model Context Protocol (MCP)** server for **A-MarkdownUI (`a-mdui`)**.

This server connects LLM coding assistants and AI IDEs—such as **Google Antigravity IDE**, **Anthropic Claude Desktop**, **Cursor**, and **Windsurf**—directly to the A-MarkdownUI runtime, enabling AI agents to validate, lint, template, and render rich interactive native UI components on the fly.

---

## 🚀 Features

* **⚡ Generative UI Rendering**: Transforms `.mdui` markup into self-contained HTML artifacts that render natively inside Antigravity IDE chat (via `<agent-embed>`) or in side-pane artifact viewers.
* **🛡️ Offline & CSP-Safe**: Inlines the pre-bundled `<a-mdui>` web component and design tokens with zero external CDN dependencies, running reliably within sandboxed webviews.
* **🔍 Static Linting & Validation**: Parses `.mdui` documents in `< 2ms` to detect mismatched container blocks (`:::`), unclosed form controls (`???`), broken `@state` variables, or invalid expressions (`{{ }}`).
* **📦 Production Templates**: Supplies turnkey production layouts for airline booking, executive dashboards, retail checkouts, and SVG data analytics charts.
* **🧠 System Prompt Integration**: Exposes pre-tuned agent instructions (`amdui_authoring_guide`) to prevent markdown code fences and optimize LLM generation quality.

---

## 🛠️ MCP Tools

### 1. `render_mdui`
Renders `.mdui` markup into an interactive UI widget.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `content` | `string` | **Yes** | The raw A-MarkdownUI (`.mdui`) document markup. |
| `title` | `string` | No | Widget header title (default: `"A-MarkdownUI Component"`). |
| `theme` | `string` | No | Preset theme: `"dark"`, `"default"`, `"fintech"`, `"sunset"`, `"nordic"`, `"amethyst"`. |
| `targetDir` | `string` | No | Output folder for HTML artifact (defaults to system temporary directory or Antigravity artifact folder). |

**Output:**
```html
<agent-embed src="file:///path/to/artifact.html"></agent-embed>
```

---

### 2. `validate_mdui`
Fast AST validator and linter.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `content` | `string` | **Yes** | The `.mdui` markup string to validate. |

**Output:**
Returns validation success status, container counts, active form control tallies, and structural syntax warnings.

---

### 3. `get_mdui_template`
Retrieves pre-built production-grade `.mdui` layouts.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `template` | `string` | **Yes** | One of: `"flight_booking"`, `"dashboard"`, `"checkout"`, `"charts"`. |

---

## 📖 MCP Prompts

### `amdui_authoring_guide`
A compact (~220 token) system prompt instructing LLMs on the 6 core A-MDUI directives:
1. **State**: `@key("value")`
2. **Containers**: `::: card`, `::: row`, `::: grid`, `::: hero`, `::: barChart`, `::: lineChart`, `::: pieChart`
3. **Inputs**: `??? id \n typeOf: [segmented | toggle | slider | text | picker | date] \n ???`
4. **Interpolation**: `{{ count * price | 0 | currency }{.bold, #38bdf8}}`
5. **Actions**: `[Button Label](action:action_name){primary}`
6. **Conditionals**: `::: card if: @key == "value"`

---

## 💻 Configuration & Setup

### 1. Antigravity IDE

#### Workspace Auto-Discovery (Recommended)
Add or verify [`.agents/mcp_config.json`](https://github.com/anandsankarank/MD2UI/blob/main/.agents/mcp_config.json) in your project root:
```json
{
  "mcpServers": {
    "amdui": {
      "command": "node",
      "args": [
        "${workspaceRoot}/packages/mcp/dist/index.js"
      ]
    }
  }
}
```

#### Global Configuration
Add to `~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "amdui": {
      "command": "node",
      "args": [
        "/absolute/path/to/MD2UI/packages/mcp/dist/index.js"
      ]
    }
  }
}
```

---

### 2. Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "amdui": {
      "command": "node",
      "args": [
        "/absolute/path/to/MD2UI/packages/mcp/dist/index.js"
      ]
    }
  }
}
```

---

### 3. Cursor

Add to your project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "amdui": {
      "command": "node",
      "args": [
        "packages/mcp/dist/index.js"
      ]
    }
  }
}
```

---

## 🔨 Development & Build

```bash
# Navigate to package directory
cd packages/mcp

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run directly with live reloading (development)
npx tsx src/index.ts
```

---

## 📄 License

MIT © [A-MarkdownUI Team](https://github.com/anandsankarank/MD2UI)
