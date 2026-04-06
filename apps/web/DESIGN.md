# ThreatGuard Design System

> Community-maintained design reference for ThreatGuard brand protection platform.
> Intended for AI agents (Claude, Cursor, etc.) to generate consistent UI matching the ThreatGuard design language.

---

## 1. Visual Theme and Atmosphere

**Aesthetic**: Clean, trustworthy security platform with a professional Japanese enterprise feel.

ThreatGuard communicates **vigilance and reliability** through a minimal color palette anchored by a single brand blue accent. The interface prioritizes information density while maintaining clear visual hierarchy through semantic risk colors (red/orange/yellow/green). Dark mode is a first-class citizen, using deep gray surfaces rather than pure black.

**Key Principles**:
- Security-first visual language: shields, locks, and alert iconography
- Risk-centric: color immediately communicates threat severity
- Bilingual UI: Japanese labels with emoji for visual scanning
- High information density with clear hierarchy
- Light/Dark parity: every element has an explicit dark mode counterpart

---

## 2. Color Palette and Roles

### Brand Colors

| Token | Hex | Role |
|---|---|---|
| `brand-50` | `#eff6ff` | Brand tint background |
| `brand-500` | `#3b82f6` | Brand accent (links, active states) |
| `brand-600` | `#2563eb` | Primary interactive (buttons, CTAs) |
| `brand-700` | `#1d4ed8` | Hover/pressed state |

### Surface Colors

| Token | Light | Dark | Role |
|---|---|---|---|
| `surface-base` | `#f9fafb` (gray-50) | `#111827` (gray-900) | Page background |
| `surface-card` | `#ffffff` | `#1f2937` (gray-800) | Card/container background |
| `surface-elevated` | `#f3f4f6` (gray-100) | `#374151` (gray-700) | Elevated elements, badges, inputs |
| `surface-overlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.7)` | Modal/drawer overlays |

### Text Colors

| Token | Light | Dark | Role |
|---|---|---|---|
| `text-primary` | `#111827` (gray-900) | `#f3f4f6` (gray-100) | Headings, primary content |
| `text-secondary` | `#6b7280` (gray-500) | `#9ca3af` (gray-400) | Descriptions, metadata |
| `text-tertiary` | `#9ca3af` (gray-400) | `#6b7280` (gray-500) | Timestamps, disabled labels |
| `text-inverse` | `#ffffff` | `#ffffff` | Text on brand/status fills |

### Border Colors

| Token | Light | Dark | Role |
|---|---|---|---|
| `border-default` | `#e5e7eb` (gray-200) | `#374151` (gray-700) | Card/section borders |
| `border-subtle` | `#f3f4f6` (gray-100) | `#374151` (gray-700) | Inner dividers |

### Risk / Status Colors (Semantic)

| Level | Score | Fill | Text (Light) | Text (Dark) | Background (Light) | Background (Dark) |
|---|---|---|---|---|---|---|
| Critical | 80-100 | `#ef4444` (red-500) | `#b91c1c` (red-700) | `#fca5a5` (red-300) | `#fef2f2` (red-50) | `rgba(127,29,29,0.3)` (red-900/30) |
| High | 60-79 | `#f97316` (orange-500) | `#c2410c` (orange-700) | `#fdba74` (orange-300) | `#fff7ed` (orange-50) | `rgba(124,45,18,0.3)` (orange-900/30) |
| Medium | 40-59 | `#eab308` (yellow-500) | `#a16207` (yellow-700) | `#fde047` (yellow-300) | `#fefce8` (yellow-50) | `rgba(113,63,18,0.3)` (yellow-900/30) |
| Low | 0-39 | `#22c55e` (green-500) | `#15803d` (green-700) | `#86efac` (green-300) | `#f0fdf4` (green-50) | `rgba(20,83,45,0.3)` (green-900/30) |
| Info/New | — | `#3b82f6` (blue-500) | `#1d4ed8` (blue-700) | `#93c5fd` (blue-300) | `#eff6ff` (blue-50) | `rgba(30,58,138,0.3)` (blue-900/30) |

**Rule**: Risk colors carry meaning. Never use red/orange/yellow/green decoratively. Blue is the only brand accent and is reserved for interactive elements and informational states.

---

## 3. Typography Rules

### Font Stack

```css
font-family: var(--font-noto-sans-jp), -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", sans-serif;
```

**Noto Sans JP** is loaded via `next/font/google` with weights 400, 500, 600, 700. The CSS variable `--font-noto-sans-jp` is set on the `<html>` element and used as the primary font. System fonts serve as fallback while the web font loads.

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Display | 48px (`text-5xl`) | 700 (`font-bold`) | 1.1 | Hero elements |
| Heading 1 | 30px (`text-3xl`) | 700 (`font-bold`) | 1.2 | Metric numbers, dashboard stats |
| Heading 2 | 24px (`text-2xl`) | 700 (`font-bold`) | 1.3 | Page titles |
| Heading 3 | 20px (`text-xl`) | 600 (`font-semibold`) | 1.4 | Section headings |
| Heading 4 | 18px (`text-lg`) | 600 (`font-semibold`) | 1.5 | Card titles, subsections |
| Body | 16px (`text-base`) | 400 (`font-normal`) | 1.5 | Body text (default) |
| Label | 14px (`text-sm`) | 500 (`font-medium`) | 1.4 | Button text, table headers, nav links, form labels |
| Caption | 12px (`text-xs`) | 500 (`font-medium`) | 1.4 | Badges, timestamps, metadata |

### Icon System

ThreatGuard uses an `<Icon>` component (`components/ui/Icon.tsx`) with Heroicons-based SVG paths. Icons are used for structural UI elements; semantic status indicators (risk levels) retain emoji for visual scanning.

**Available icons**: `shield`, `search`, `globe`, `lock`, `camera`, `bell`, `trash`, `alertTriangle`, `chart`, `refresh`, `lightbulb`, `building`

**Usage**:
```tsx
import { Icon } from '@/components/ui';
<Icon name="shield" size={20} className="text-brand-600" />
```

**Sizing**: Default 20px. Use 14-16px inline with text, 20-24px for standalone, 28px for logo.

**Rule**: Use `<Icon>` for structural UI (navigation, section headings, buttons). Keep emoji for risk indicators (🔴🟡🟢) and status labels where visual scanning matters.

---

## 4. Component Stylings

### Buttons

**Primary Button**
```
px-4 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm
hover:bg-brand-700 transition-colors
disabled:opacity-50 disabled:cursor-not-allowed
focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 outline-none
```

**Secondary Button (Outline)**
```
px-4 py-2 border border-brand-600 text-brand-600 rounded-lg font-medium text-sm
hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors
```

**Danger Button**
```
px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm
hover:bg-red-700 transition-colors
```

**Ghost Button**
```
px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-elevated
rounded-lg font-medium text-sm transition-colors
```

### Cards

**Standard Card**
```
bg-surface-card rounded-xl border border-border-default p-6
dark:bg-gray-800 dark:border-gray-700
```

**Status Card (with risk color)**
```
rounded-xl border-2 p-4
border-{risk-color}-200 dark:border-{risk-color}-800
bg-{risk-color}-50 dark:bg-{risk-color}-900/30
```

**Interactive Card (clickable)**
```
bg-surface-card rounded-xl border border-border-default p-4
hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors
```

### Badges

**Risk Badge**
```
px-2 py-1 rounded-full text-xs font-bold
bg-{risk-color}-50 dark:bg-{risk-color}-900/30
text-{risk-color}-700 dark:text-{risk-color}-300
border border-{risk-color}-200 dark:border-{risk-color}-800
```

**Info Badge**
```
px-2 py-0.5 rounded text-xs font-medium
bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300
```

### Tables

**Table Container**
```
bg-surface-card rounded-xl border border-border-default overflow-hidden
```

**Table Header**
```
text-sm text-text-secondary font-medium uppercase tracking-wide
bg-gray-50 dark:bg-gray-800 px-4 py-3
border-b border-border-default
```

**Table Row**
```
px-4 py-3 border-b border-border-subtle
hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
```

### Form Inputs

**Text Input**
```
w-full px-3 py-2 text-sm rounded-lg
border border-gray-300 dark:border-gray-600
bg-white dark:bg-gray-700
text-text-primary placeholder-text-tertiary
focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none
transition-colors
```

**Select**
```
Same as Text Input, with appearance-none and custom dropdown arrow
```

### Alerts / Banners

**Alert Container**
```
rounded-xl border p-4
bg-{color}-50 dark:bg-{color}-900/30
border-{color}-200 dark:border-{color}-800
text-{color}-700 dark:text-{color}-300
```

### Navigation

**NavBar Container**
```
bg-surface-card border-b border-border-default px-4 sm:px-6 py-3 sm:py-4
```

**Nav Link (Desktop)**
```
text-text-secondary hover:text-text-primary font-medium text-sm transition-colors
```

**Nav Link (Active)**
```
text-brand-600 dark:text-brand-500 font-medium text-sm
```

### Progress Bar (Risk Score)

**Container**
```
w-full h-2 (compact) or h-3 (full) bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden
```

**Fill**
```
h-full rounded-full bg-{risk-color}-500 transition-all
```

---

## 5. Layout Principles

### Spacing Scale (Tailwind units)

```
0.5 (2px) | 1 (4px) | 1.5 (6px) | 2 (8px) | 3 (12px) | 4 (16px) | 5 (20px) | 6 (24px) | 8 (32px) | 10 (40px) | 12 (48px) | 16 (64px)
```

### Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `rounded` | 4px | Small badges, inner elements |
| `rounded-md` | 6px | — |
| `rounded-lg` | 8px | Buttons, inputs, small cards |
| `rounded-xl` | 12px | Cards, containers, alerts |
| `rounded-2xl` | 16px | Large feature cards |
| `rounded-full` | 9999px | Badges, avatars, toggles |

### Container

```
max-w-7xl mx-auto px-4 sm:px-6
```

### Section Spacing

```
space-y-6 (standard section gap)
space-y-8 (page section gap)
```

### Grid System

```
Summary cards:  grid grid-cols-1 md:grid-cols-3 gap-4
Detail layout:  grid grid-cols-1 lg:grid-cols-2 gap-6
Form layout:    flex flex-col gap-4
```

---

## 6. Depth and Elevation

ThreatGuard uses **minimal shadow**. Depth is communicated primarily through **borders and background color contrast**.

| Level | Style | Usage |
|---|---|---|
| Level 0 | No shadow, `border-border-default` | Default cards |
| Level 1 | `shadow-sm` | Dropdown menus, selected cards |
| Level 2 | `shadow-md` | Modals, popovers |
| Level 3 | `shadow-lg` | Toast notifications |

**Hover elevation**: Cards may gain `shadow-sm` or lighten background on hover, but avoid heavy shadow stacking.

---

## 7. Do's and Don'ts

### Do
- Use `brand-600` (#2563eb) exclusively for primary interactive elements (buttons, links, focus rings)
- Use risk colors (red/orange/yellow/green) only to communicate threat severity
- Apply `rounded-xl` to all cards and containers for consistency
- Provide explicit `dark:` variants for every color class
- Use `<Icon>` component for structural UI icons (navigation, section headings, action buttons)
- Keep emoji only for semantic risk/status indicators (🔴🟡🟢) where visual scanning matters
- Keep nav links at `text-sm font-medium` for clean horizontal navigation
- Apply `transition-colors` to all interactive hover states

### Don't
- Use brand blue decoratively (backgrounds, borders) without interactive purpose
- Use risk colors for non-risk UI elements (e.g., don't use green for "success" buttons)
- Mix border-radius sizes within the same visual group
- Use `shadow-xl` or heavy drop shadows — the design is flat with borders
- Omit dark mode variants — every light color must have a `dark:` counterpart
- Use hardcoded color values — always reference the token system
- Use more than 2 font weights in a single component

---

## 8. Responsive Behavior

### Breakpoints

| Token | Width | Description |
|---|---|---|
| `sm` | 640px | Large phones / small tablets |
| `md` | 768px | Tablets — navigation switches from hamburger to inline |
| `lg` | 1024px | Small desktops — two-column layouts activate |
| `xl` | 1280px | Standard desktops |
| `2xl` | 1536px | Wide displays |

### Key Responsive Patterns

- **Navigation**: Hamburger menu on mobile (`md:hidden`), horizontal links on desktop (`hidden md:flex`)
- **Content padding**: `px-4 sm:px-6` — tighter on mobile
- **Grid columns**: `grid-cols-1 md:grid-cols-3` for summary cards
- **Detail pages**: Single column on mobile, `lg:grid-cols-2` on desktop
- **Tables**: Horizontal scroll on mobile with `overflow-x-auto`
- **Font sizes**: Heading scales down one step on mobile where needed

---

## 9. Agent Prompt Guide

Quick-reference for AI code generators building ThreatGuard UI:

### Color Tokens
```
Brand:          #2563eb (brand-600)
Brand Hover:    #1d4ed8 (brand-700)
Brand Light:    #eff6ff (brand-50)
Background:     light: #f9fafb  dark: #111827
Card:           light: #ffffff  dark: #1f2937
Text Primary:   light: #111827  dark: #f3f4f6
Text Secondary: light: #6b7280  dark: #9ca3af
Border:         light: #e5e7eb  dark: #374151
```

### Risk Colors
```
Critical (80+): #ef4444  text: #b91c1c / #fca5a5
High (60-79):   #f97316  text: #c2410c / #fdba74
Medium (40-59): #eab308  text: #a16207 / #fde047
Low (0-39):     #22c55e  text: #15803d / #86efac
```

### Quick Component Patterns
```
Card:      bg-surface-card rounded-xl border border-[var(--border-default)] p-6
Button:    <Button variant="primary">Text</Button>  (or import from @/components/ui)
Input:     <Input label="ラベル" placeholder="..." />  (or import from @/components/ui)
Alert:     <Alert variant="error">Message</Alert>  (or import from @/components/ui)
Badge:     px-2 py-1 rounded-full text-xs font-bold bg-{color}-50 text-{color}-700
Table:     bg-surface-card rounded-xl border border-[var(--border-default)] overflow-hidden
NavLink:   text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm
PageHeader: <PageHeader title="タイトル" description="説明" actions={<Button>...</Button>} />
Icon:      <Icon name="shield" size={20} className="text-brand-600" />
```

### Shared UI Components (`@/components/ui`)
```
Button     — variant: primary | secondary | danger | ghost, size: sm | md | lg
Card       — variant: default | interactive | status, padding: sm | md | lg
Alert      — variant: info | success | warning | error
Input      — label, hint, all standard input props
PageHeader — title, description, actions
Icon       — name (shield, search, globe, lock, camera, bell, trash, etc.), size, className
```

### Rules for Agents
1. Use CSS variable tokens (`var(--text-primary)`, `bg-surface-card`) — avoid hardcoded `dark:` gray pairs
2. Use semantic risk colors only for threat/risk contexts
3. Use `brand-600` for primary actions, `brand-700` for hover
4. All containers use `rounded-xl`, buttons use `rounded-lg`
5. Standard spacing: `p-6` for cards, `p-4` for compact cards, `gap-4` for form fields
6. UI text is in Japanese — preserve all Japanese labels
7. Font: Noto Sans JP via `next/font/google` — do not add additional font imports
8. Interactive elements need `transition-colors` and explicit hover states
9. Use `<Icon>` for structural icons, emoji only for risk indicators (🔴🟡🟢)
10. Use shared UI components (`Button`, `Card`, `Alert`, `Input`, `PageHeader`) when possible
