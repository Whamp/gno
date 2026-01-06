# OG Image Templates

HTML templates for Open Graph images (1200x630). Each feature has a unique template with feature-specific decorations.

## Design System

- **Background**: #0a0f18 (dark)
- **Accent**: #4db8a8 (teal)
- **Fonts**: Space Grotesk (headings), Crimson Pro italic (taglines)
- **Grid**: 40px pattern overlay at 3% opacity
- **Corners**: Frame accents at 30px inset

## Structure

Each template follows a two-column layout:

- **Left (400px)**: Feature icon (180px) with glow effect
- **Right**: GNO badge, feature title, accent bar, tagline
- **Bottom right**: gno.sh URL

## Files

| File                         | Feature            | Decoration                |
| ---------------------------- | ------------------ | ------------------------- |
| `og-template.html`           | Generic GNO        | Floating document shapes  |
| `og-agent-integration.html`  | Agent Integration  | Signal waves + SKILL.md   |
| `og-hybrid-search.html`      | Hybrid Search      | Concentric rings          |
| `og-local-llm.html`          | Local LLM          | Neural network dots       |
| `og-web-ui.html`             | Web UI             | Browser window frames     |
| `og-multi-format.html`       | Multi-Format       | Stacked documents         |
| `og-privacy-first.html`      | Privacy First      | Shield protection rings   |
| `og-mcp-integration.html`    | MCP Integration    | Connection dots & lines   |
| `og-api.html`                | REST API           | Code brackets & endpoints |
| `og-tags.html`               | Tags               | Floating tag chips        |
| `og-note-linking.html`       | Note Linking       | Wiki links `[[...]]`      |
| `og-graph-view.html`         | Knowledge Graph    | Graph nodes & edges       |
| `og-collections.html`        | Collections        | Folder stack              |
| `og-advanced-retrieval.html` | Advanced Retrieval | Neural pathways           |

## Converting to PNG

Use the Playwright script to generate PNGs from HTML templates:

```bash
bun run website:og              # All templates
bun run website:og -f og-api    # Single file
```

First run requires: `bun install && bunx playwright install chromium`

## Adding New OG Images

1. Copy an existing template as base
2. Update: title, tagline, icon SVG, decorative elements
3. Keep design system consistent (colors, fonts, layout)
4. Convert to PNG and add to feature page frontmatter:

```yaml
og_image: /assets/images/og/og-feature-name.png
```

## Wiring Up

In feature page frontmatter:

```yaml
---
title: Feature Name
og_image: /assets/images/og/og-feature-name.png
---
```

The `default.html` layout reads `page.og_image` for OG meta tags.
