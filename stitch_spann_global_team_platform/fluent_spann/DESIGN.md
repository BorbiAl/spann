```markdown
# Design System Document: Desktop Communication Architecture

## 1. Overview & Creative North Star: "The Luminous Canvas"

This design system moves beyond the rigid, utilitarian nature of traditional communication tools to embrace **"The Luminous Canvas."** Our North Star is a desktop experience that feels less like a software application and more like an organized, architectural workspace built from light and glass.

By leveraging the physics of Windows 11 Fluent materials—specifically Mica and Acrylic—we move away from "flat" design into a world of **Atmospheric Depth**. We reject the "boxed-in" feeling of traditional grids in favor of intentional asymmetry and tonal layering. The interface does not sit on the screen; it breathes within the OS environment, using transparency and soft refraction to create a sense of calm focus for high-stakes communication.

---

## 2. Colors & Surface Philosophy

Our palette is rooted in the "Microsoft Blue" legacy but elevated through Material Design token logic to ensure sophisticated tonal depth.

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Boundaries must be defined solely through background color shifts or tonal transitions. For example, a conversation list (using `surface-container-low`) sits directly against a chat window (using `surface`), separated only by the change in luminance, never a line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of frosted glass.
- **Base Layer (The Window):** Uses the `surface` token with **Mica** material effects, allowing the desktop wallpaper to subtly tint the background.
- **Secondary Layer (Sidebars/Navigation):** Uses `surface-container-low` with **Acrylic** (60% opacity + Backdrop Blur) to create a distinct functional zone.
- **Interactive Layer (Cards/Inputs):** Uses `surface-container-lowest` (Pure White/High Brightness) to "lift" the element toward the user.

### The Glass & Gradient Rule
To move beyond a "standard" feel, main CTAs and Hero states should use a **Signature Texture**: a linear gradient from `primary` (#005faa) to `primary-container` (#0078d4) at a 135-degree angle. This adds "visual soul" and a premium finish that flat colors cannot achieve.

---

## 3. Typography: The Editorial Voice

We utilize **Segoe UI Variable** (mapped to the `inter` scale for web/electron parity) to drive an authoritative yet readable editorial experience.

*   **Display (Display-LG to SM):** Reserved for empty states or major dashboard headings. Use `on-surface` with a `-0.02em` letter spacing to feel "tight" and premium.
*   **Headlines & Titles:** Use `headline-sm` (#1a1c1c) for channel names and contact headers. The high contrast against `surface` colors ensures immediate hierarchy.
*   **Body (Body-MD):** Our workhorse. Optimized for long-form messaging. Ensure a line-height of `1.5` for maximum legibility.
*   **Labels (Label-MD):** Used for timestamps and metadata. Always use `on-surface-variant` (#404752) to keep the peripheral information from distracting the eye.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are a fallback, not a standard. We achieve hierarchy through **Tonal Stacking**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. The delta in brightness creates a soft, natural lift.
*   **Ambient Shadows:** For floating elements (Context Menus, Tooltips), use a shadow with a 32px Blur and 8% Opacity. The color must be a tinted version of `on-surface` (#1a1c1c), not pure black, to mimic natural light refraction.
*   **The Ghost Border Fallback:** If a border is required for accessibility, it must be a "Ghost Border": `outline-variant` (#c0c7d4) at **20% opacity**. 100% opaque borders are strictly forbidden.
*   **Glassmorphism:** Navigation sidebars must use `surface-container-high` at 70% opacity with a `20px` backdrop blur. This integrates the app into the user’s unique desktop environment.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), white text, `DEFAULT` (8px) rounded corners.
- **Secondary:** `surface-container-highest` background. No border.
- **Tertiary:** Transparent background; `on-primary-fixed-variant` text. High-padding (12px 24px) to emphasize the "Editorial" feel.

### InfoBars & Progress
- **InfoBars:** Use `secondary-container` for neutral info and `error-container` for alerts. Use a "Ghost Border" to define the edge softly.
- **Progress Rings:** Use `primary` for the track and `surface-variant` for the remaining path. Thickness should be 4px for a delicate, premium feel.

### Sentiment Bars
- A custom component for 'Spann'. Use a horizontal track with `surface-container-high`. The active sentiment uses a gradient transition from `tertiary` (Teal) to `primary` (Blue) to represent tone shifts.

### Toggle Switches & Sliders
- **Toggles:** Use `primary` for the 'On' state. The "knob" should be `surface-container-lowest` and feature a subtle `Ambient Shadow`.
- **Sliders:** The track should be 4px thick. The thumb should be an 18px circle with a `Ghost Border`.

### Cards & Lists
- **The No-Divider Rule:** Forbid 1px dividers between messages or contacts. Use **Vertical White Space** (16px - 24px) or a subtle hover state shift to `surface-container-high` to separate content. This keeps the interface "open" and airy.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `Mica` for the primary window background to respect Windows 11 aesthetics.
- **Do** lean into `xl` (1.5rem) roundedness for large layout containers to soften the "tech" feel.
- **Do** prioritize "Breathing Room." If a layout feels cramped, increase the padding rather than adding a border.

### Don't
- **Don't** use pure black (#000000) for shadows or text; always use the `on-surface` or `on-background` tokens.
- **Don't** use "Alert Red" for anything other than critical errors. Use `tertiary` (Teals) for positive reinforcement.
- **Don't** place high-contrast borders on cards. If the card isn't visible, adjust the `surface-container` tier of the background instead.

---

## 7. Scaling & Accessibility
All color pairings (e.g., `on-primary` on `primary`) must maintain a 4.5:1 contrast ratio. When using Acrylic/Glassmorphism, ensure the `on-surface` text remains legible by increasing the backdrop-blur density if the desktop background is high-noise.```