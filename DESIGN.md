# Design

## Visual World
A clean, professional B2B SaaS dashboard. Eliminates 'cybercrime' tropes in favor of scanability and utility. Uses a white and light-slate palette with semantic status colors.

## Palette
- **Background**: `bg-slate-50` (off-white for reduced glare)
- **Surfaces**: `bg-white` with `border-slate-200`
- **Text**: `text-slate-900` for primary, `text-slate-500` for secondary
- **Accents**: `bg-blue-600` for primary branding, `text-red-600` for threats
- **Status**: `bg-green-100`/`text-green-800` (BENIGN), `bg-red-100`/`text-red-800` (THREAT)

## Typography
- **Primary**: Sans-serif (`font-sans`) for all prose and headers.
- **Tabular Data**: Monospace (`font-mono`) restricted only to packet IPs, lengths, and timestamps to ensure vertical alignment.

## Composition
- Root layout is constrained to `max-w-7xl` and centered.
- A top header holds the branding and global system status.
- A four-column grid displays high-level KPIs.
- A 2:1 split grid holds the Traffic Analysis area chart and Threat Distribution bar chart.
- The bottom full-width table acts as a scrolling terminal log for raw packets.
