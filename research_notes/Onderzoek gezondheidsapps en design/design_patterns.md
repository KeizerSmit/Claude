# Best-in-class visual & interaction design for health/fitness dashboards (iPhone → mobile web/PWA), 2025-2026

Research date: 2026-11-04. Method: WebSearch plus direct fetches of Apple HIG markdown pages (developer.apple.com `.md` endpoints worked). Many third-party domains were blocked for WebFetch in this session (e.g. whoop.com, buildmvpfast.com), so several findings rely on search-result summaries; these are flagged where relevant. Items in "Inferences" are the researcher's synthesis or practitioner convention, not sourced facts.

---

## 1. Apple HIG foundations: charts, typography, colour, materials and Liquid Glass (and how to approximate them on the web)

### Takeaway
Apple's guidance comes down to this: the data itself is the hero, glass is only for the floating control/navigation layer (never for content cards), colour is semantic and never the only carrier of meaning, and type follows a fixed scale (17 pt body, 11 pt minimum, no light weights). On the web a tasteful approximation is a restrained `-webkit-backdrop-filter` blur + tint + 1px inner highlight on the tab bar/sheet only. Refraction effects are Chromium-only gimmicks and should be skipped for an iPhone PWA.

### Cited Findings

**Charts (HIG "Charts" page, fetched verbatim)**
- "An effective chart highlights a few key pieces of information in a dataset." Fitness progress monitoring is one of Apple's three named use cases. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Mark choice: bars for comparing categories or **sums per period** (e.g. "total number of steps taken in a day"). Lines show change over time and trends. Points show individual values, outliers and clusters. "Consider combining mark types," e.g. points on a line to show trend plus individual values. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Axes: use a **fixed range** when min/max are meaningful (battery 0-100%). Use a **dynamic range** when values vary widely (Health's Steps chart scales so the max sits near the top). Bar charts should start at zero, but "a heart rate chart that always uses zero for the lower bound could obscure important differences between resting and active readings." — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Use familiar tick sequences (0, 5, 10, not 1, 6, 11). "Too many grid lines can be visually overwhelming." If the chart is interactive, "you might use fewer grid lines and light label colors to ensure the data remains visually prominent." — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- "Summarize the main message of your chart." Example: Weather's title/subtitle states the next-hour precipitation in plain language above the chart. Titles should say what the chart does before people look at it. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Hierarchy: "you want the data itself to be most prominent, while letting the descriptions and axes provide additional context without competing with the data." — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Compact layouts: "maximize the width of the plot area". Keep y-axis labels short, put units in the title, and consider moving the **Y axis to the trailing side** so tick labels don't protrude past the leading edge and the chart aligns with other views. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Interaction: "Let people interact with the data when it makes sense, but don't require interaction to reveal critical information." Stocks example: drag a vertical indicator to reveal the value at a time. When marks are too small to hit, "consider expanding the hit target to include the entire plot area, letting people scrub across the area." — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Animate changes to marks and axes so people notice them, but also signal the change another way for VoiceOver users and Reduce Motion. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Colour in charts: don't rely on colour alone. Health's blood-pressure chart uses a red **circle** for systolic and a black/white **diamond** for diastolic. Add thin separators between contiguous colour segments in stacked bars (iPhone Storage example). — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Accessibility labels should use actual values, not subjective words ("rapidly", "almost"). Write "June 6" rather than "6/6" and "60 minutes" rather than "60m". Describe what a series represents, not its colour. A small chart inside a button can get a single summary label. Swift Charts ships Audio Graphs by default. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- watchOS: avoid complex chart interactions. Heart Rate on Watch shows today only, while iPhone Health shows multiple periods and per-mark inspection, so the depth goes to the larger screen. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)

**Typography (HIG "Typography", fetched)**
- iOS default text size **17 pt**, minimum **11 pt**. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- "In general, avoid light font weights… prefer Regular, Medium, Semibold, or Bold… avoid Ultralight, Thin, and Light." — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- iOS Dynamic Type, Large (default) size, as style: weight / size / leading (pt): Large Title Regular 34/41; Title 1 Regular 28/34; Title 2 Regular 22/28; Title 3 Regular 20/25; Headline **Semibold** 17/22; Body Regular 17/22; Callout 16/21; Subhead 15/20; Footnote 13/18; Caption 1 12/16; Caption 2 11/13. Emphasized weights are Bold for titles and Semibold for the rest. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- SF Pro tracking per size (pt): 11 → +0.06; 12 → 0; 13 → -0.08; 15 → -0.23; **17 → -0.43**; 20 → -0.45; 22 → -0.26; 28 → +0.38; 34 → +0.40; 48 → +0.35; 64 → +0.22; 80 → 0. SF Pro Rounded is looser: 17 → +0.37, 34 → +0.38. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- System fonts use "dynamic optical sizes" (Text/Display interpolated continuously). Rounded variants exist "to coordinate text with the appearance of soft or rounded UI elements". "Minimize the number of typefaces." — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- Under large text sizes, switch inline layouts to stacked layouts and keep primary elements at the top. Not every string must scale (tab titles needn't). — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- Web: CSS `ui-rounded` resolves to SF Pro Rounded on Apple platforms (Safari 13.1+). `system-ui` / `-apple-system` give SF Pro. No Windows browser supports `ui-rounded`. — [furbo.org: System Fonts in CSS](https://furbo.org/2018/03/28/system-fonts-in-css/); [Apple UIFontDescriptor.SystemDesign.rounded](https://developer.apple.com/documentation/uikit/uifontdescriptor/systemdesign/rounded.md)
- SF fonts are **not licensed** to self-host as web fonts. An Apple engineer answered "No" on the forums, so rely on the system font stack instead. — [Apple Developer Forums thread 127350](https://developer.apple.com/forums/thread/127350)

**Colour (HIG "Color", fetched; updated 9 Jun 2025 and 16 Dec 2025)**
- iOS 26 system colours (light / dark / increased-contrast light / increased-contrast dark, RGB):
  - Red 255,56,60 / 255,66,69 / 233,21,45 / 255,97,101
  - Orange 255,141,40 / 255,146,48 / 197,83,0 / 255,160,86
  - Yellow 255,204,0 / 255,214,0 / 161,106,0 / 254,223,67
  - Green 52,199,89 / 48,209,88 / 0,137,50 / 74,217,104
  - Mint 0,200,179 / 0,218,195; Teal 0,195,208 / 0,210,224; Cyan 0,192,232 / 60,211,254
  - Blue 0,136,255 / 0,145,255 / 30,110,244 / 92,184,255
  - Indigo 97,85,245 / 109,124,255; Purple 203,48,224 / 219,52,242; Pink 255,45,85 / 255,55,95
  - Grays (dark mode): systemGray6 28,28,30; Gray5 44,44,46; Gray4 58,58,60; Gray3 72,72,74. (Light mode: Gray6 242,242,247.)
  — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- "Avoid using the same color to mean different things." Supply light, dark **and increased-contrast** variants for custom colours. "Even if your app ships in a single appearance mode, provide both light and dark colors to support Liquid Glass adaptivity." — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- Background hierarchy: primary for the overall view, secondary for grouping inside it, tertiary for grouping inside secondary (`systemBackground` / `secondarySystemBackground` / `tertiary…`, or the grouped set). Label hierarchy: label / secondary / tertiary / quaternary. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- Culture matters: Stocks shows a rising line green in English and red in Chinese. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- Wide colour: "visual data and status indicators that use wide color can be more meaningful". Use Display P3 where appropriate. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- watchOS Activity uses a background that matches each ring's colour in its infographic views. "Use background color when you have something to communicate, rather than as a solely visual flourish." — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- Liquid Glass colour: glass "has no inherent color". Tint sparingly, only the primary action ("apply color to the background rather than to symbols or text"), and "Refrain from adding color to the background of multiple controls." Over colourful content, prefer monochrome tab bars and toolbars. The resting state (top of scroll) must be clearly legible. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)

**Materials & Liquid Glass (HIG "Materials", fetched; updated 9 Sep 2025)**
- "Liquid Glass forms a distinct functional layer for controls and navigation elements — like tab bars and sidebars — that floats above the content layer." — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- "**Don't use Liquid Glass in the content layer.**" The exception is transient controls such as sliders and toggles, which go glassy only while they are being touched. "Use Liquid Glass effects sparingly… Limit these effects to the most important functional elements." — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- Variants: *regular* blurs and adjusts luminosity for legibility and is used by most system components and anything text-heavy. *Clear* is highly translucent, only over rich media. Over bright content, add "a dark dimming layer of 35% opacity". — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- For the content layer, iOS keeps four standard materials (ultraThin, thin, regular, thick). Thicker means more contrast for fine text, thinner keeps context. Use vibrant label colours on materials and avoid quaternary labels on thin/ultraThin. — [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- WWDC25 "Meet Liquid Glass": don't stack glass on glass. — [WWDC25 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) (via search summary)
- WWDC25 "Get to know the new design system" defines three shape types: **fixed, capsule, concentric**. Concentric inner radius = parent radius − padding. On iPhone, controls near the screen edge are capsules. Large controls use capsules with a new X-Large size. — [WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/); [WWDC Notes 356](https://wwdcnotes.com/documentation/wwdc25-356-get-to-know-the-new-design-system/); [Nil Coalescing: ConcentricRectangle](https://nilcoalescing.com/blog/ConcentricRectangleInSwiftUI)
- Liquid Glass was criticised for legibility. iOS 26.1 added Settings > Display & Brightness > Liquid Glass > **Clear / Tinted**, where Tinted "increases opacity and adds more contrast". Reduce Transparency makes it fully opaque. — [Engadget](https://www.engadget.com/mobile/smartphones/how-to-adjust-the-liquid-glass-effect-in-ios-261-203634681.html); [Six Colors](https://sixcolors.com/?p=37413); [Gulf News](https://gulfnews.com/technology/companies/apple-yields-tinted-control-in-ios-261-beta-4-tones-down-liquid-glass-after-backlash-1.500315176)
- Wikipedia reports Apple announced a Liquid Glass revamp for iOS 27 at WWDC 2026 in response to legibility criticism. This was not verified against a primary Apple source. — [Wikipedia: Liquid Glass](https://en.wikipedia.org/wiki/Liquid_Glass)

**Approximating glass on the web**
- A Safari-safe recipe is `-webkit-backdrop-filter` (iOS needs the prefix, otherwise users get "a flat grey box") plus a translucent tint, a faint semi-transparent border and an inset top-edge highlight shadow as a fake specular. — [ThePlusAddons](https://theplusaddons.com/blog/liquid-glass-ui/); [DEV: glassmorphism in 2026](https://dev.to/nickbenksim/the-effect-of-frosted-glass-glassmorphism-in-pure-css-in-2026-jp0); [Josh Comeau: backdrop-filter](https://joshwcomeau.com/css/backdrop-filter)
- SVG-filter refraction inside `backdrop-filter` is **Chromium-only**. Safari and Firefox fall back to plain blur, and atlaspuplabs could not recreate the specular in Safari or Firefox. backdrop-filter only affects pixels within the element's bounds, so Apple's edge refraction can't be reproduced. — [Medium/Ekino: Liquid glass in CSS and SVG](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d); [Atlas Pup Labs](https://hn.jakechampion.name/reader/https://atlaspuplabs.com/blog/liquid-glass-but-in-css); [kube.io: Refraction with CSS and SVG](https://hn.jakechampion.name/reader/https://kube.io/blog/liquid-glass-css-svg); [LogRocket](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
- `prefers-reduced-transparency` is **not supported in Safari/iOS Safari** (Chrome/Edge 118+), so iOS users' Reduce Transparency setting can't be read from CSS. — [caniuse](https://caniuse.com/wf-prefers-reduced-transparency); [Chrome blog](https://developer.chrome.com/en/blog/css-prefers-reduced-transparency/)

### Inferences
- **Glass budget for a WHOOP-like PWA:** use glass on exactly three surfaces: the floating tab bar (capsule, inset ~8-16 px from the screen edges), the sticky large-title/top bar after scroll (a scroll-edge blur), and bottom sheets. Score cards and charts should be opaque `secondarySystemBackground`-style surfaces (e.g. dark #1C1C1E / light #FFFFFF on #F2F2F7). This follows Apple's "no glass in the content layer" rule and keeps blur cost low.
- **Suggested CSS starting point** (practitioner convention, values not from Apple): `background: rgb(30 30 32 / .55)` in dark or `rgb(255 255 255 / .6)` in light; `-webkit-backdrop-filter: blur(20px) saturate(180%)`; `border: .5px solid rgb(255 255 255 / .12)`; `box-shadow: inset 0 1px 0 rgb(255 255 255 / .18), 0 8px 24px rgb(0 0 0 / .25)`. Because Safari ignores `prefers-reduced-transparency`, offer an in-app "Solid surfaces" toggle and also make the glass opaque under `prefers-contrast: more`.
- **Tasteful vs gimmicky:** tasteful means subtle blur over content scrolling under the nav, a 1px top highlight, concentric radii, and tint only on the primary CTA. Gimmicky means refraction/displacement maps, glass score cards, glass on glass, rainbow specular sweeps, animated blobs behind glass, and coloured tints on every button. Gimmicks also hurt the scroll frame rate on iPhone.
- **Type on the web:** `font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for UI. Hero numbers can use `ui-rounded` (SF Pro Rounded) at 600-700 weight to echo Apple Fitness and Bevel. Add `font-variant-numeric: tabular-nums` to any number that changes or lines up in a column (scrubbing readouts, roll-ups, tables) so digits don't jitter. Map Apple's scale to CSS px 1:1 (34/28/22/20/17/15/13/12/11). Use `letter-spacing` from the tracking table, e.g. 17px → -0.43px and 34px → +0.40px. Support browser text zoom by sizing in `rem`. Unverified for this session: whether WebKit honours the `-apple-system-body` font keyword for Dynamic Type in PWAs (it historically does in Safari).
- **Corner radii:** apply concentricity. If a card has radius R and inner padding p, an inner element gets R−p. Common iOS-feeling values are 20-28 px cards with 16 px padding (inner 4-12 px), and capsule (height/2) buttons and tab bar. These are conventions, not sourced numbers.
- **Colour strategy:** keep the chrome neutral grey and reserve saturated system colours for data and meaning. Use the HIG RGB values as CSS custom properties with dark and increased-contrast variants (`@media (prefers-contrast: more)`). Consider `color(display-p3 …)` for ring and score colours on iPhone.

### Gaps
- HIG "Charting data" page body did not render via fetch, so only the "Charts" component page was captured.
- No primary Apple source in this session gives Liquid Glass numeric blur radii. The one blog that offers numbers (designedforhumans.tech) is unverified.
- `tabular-nums` / `font-variant-numeric` support in Safari was not confirmed by a source in this session. It is widely known to work, but treat that as unverified here.

---

## 2. Data-visualisation patterns that work on small screens

### Takeaway
The winning pattern is a glanceable "big number + plain-language summary + baseline context" card. Tapping it opens a scrubbable detail chart with a shaded personal-normal band and range toggles (D/W/M/6M/Y). Rings and dials work for 1-3 headline scores only. Composite scores need visible contributors and context to avoid becoming "anxiety delivery mechanisms".

### Cited Findings
- WHOOP's Home screen puts **three separate dials** at the top (Sleep, Recovery, Strain). Each opens a deep-dive page. WHOOP describes the redesign as being about "clarity" and checking scores "at a glance" or tapping in for detail. — [WHOOP: The all-new WHOOP Home screen](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/); [WHOOP Community](https://www.community.whoop.com/t/what-s-new-with-how-the-app-looks/822) (via search summary; fetch blocked)
- An independent 2023 review of the WHOOP home redesign ("looks pretty but is it as intuitive?") suggests the dials trade intuitiveness for beauty. — [the5krunner, 2023](https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/)
- Bevel shows Strain, Recovery and Sleep as "easily digestible visual circles", gives a personalised daily Strain *target*, and lets users edit dashboard cards. — [ScreensDesign: Bevel showcase](https://screensdesign.com/showcase/bevel-health-performance)
- Gentler Streak's core visual, the **Activity Path**, is a moving band of the user's sustainable range. Heavier sessions push the line above it and lighter sessions below, and the goal is to "stay within it". It is a baseline/range-band visual instead of a goal-completion ring. — [TechRadar](https://techradar.com/computing/websites-apps/this-fitness-app-shows-apple-a-better-way-to-track-my-workouts); [App Store listing](https://apps.apple.com/us/app/id1576857102?l=en-us)
- Apple HIG: point marks on lines for trend plus detail, full-plot-area scrub hit target, a dynamic y-range for heart rate (not zero-based), and a title/subtitle that summarises the main message in plain language. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Apple Health (iOS 13+ architecture) uses **Highlights**, auto-generated charts showing "relevant comparisons of recent health data", alongside user-chosen Favorites on Summary. — [MacStories: Health in iOS 13](https://www.macstories.net/?p=60534)
- Oura's October 2025 update made parts of the app "change color depending on biometrics", added Cumulative Stress (load over time), and widened the cycle view from 1 month to a 12-month window. — [9to5Google, Oct 2025](https://9to5google.com/2025/10/20/oura-app-redesign/)
- NN/g: dashboards should "use visualization styles that work with human preattentive visual processing" for fast and reliable overview reading. — [NN/g: Data Visualizations for Dashboards](https://www.nngroup.com/videos/data-visualizations-dashboards/)
- A Tableau eye-tracking study found viewers follow an F-pattern and are drawn to "big numbers" more than expected. It recommends a squint test. — [Tableau blog, 2018](https://www.tableau.com/blog/how-design-thinking-will-affect-todays-analysts-93507)
- Criticism of single scores: "Compressing a complex night into one score — '62, poor' — with no context strips away meaning… A number with no explanation is just an anxiety delivery mechanism" (vendor blog, so potentially biased). — [Sahha blog, Jun 2026](https://sahha.ai/blog/orthosomnia-sleep-tracker-anxiety/)
- A 2025 academic evaluation of composite health scores (readiness/recovery/strain) assesses their "underlying methodologies, contributors, and scientific basis". Only the abstract was seen. — [Readiness, recovery, and strain: an evaluation of composite health scores](https://matdisc.unitech.ac.pg/Record/doaj-art-e06b2cf2d8a0402d9af92b0a4c3cb1f9/Description)

### Inferences
- **Card anatomy (glanceable):** eyebrow label (13 px semibold, secondary colour, optional SF-Symbol-style glyph in the metric colour) → hero value (34-48 px rounded semibold, tabular) with unit at ~50% size → one-line delta vs baseline ("+8 ms vs 30-day avg", with an arrow glyph *and* sign, not colour alone) → 7-day sparkline or mini-bars (no axes, last point emphasised with a dot) → chevron. Apple's Weather/Health "headline sentence" pattern turns this into "HRV is above your normal range today."
- **Rings/dials:** limit to 1-3 headline scores (the WHOOP/Bevel convention). Use 270° gauges or full rings with round caps, a 10-14% stroke-to-diameter ratio, a track at ~15-20% opacity of the ring colour, and the score number centred. Avoid ring overflow tricks for scores capped at 100. A ring implies "fill to complete", which suits goals (steps, strain target) better than recovery. For recovery, a gauge or a band position is semantically better.
- **Baselines / range bands:** draw the personal normal (e.g. 30-day mean ±1 SD or IQR) as a soft shaded band behind the line, with today's dot above, inside or below it. This is the most informative low-clutter pattern (Gentler Streak Activity Path, Apple Vitals-style "typical range"). Label the band once ("Your normal").
- **Scrubbing:** use the whole plot as the hit area (HIG). Long-press or drag shows a vertical rule plus a floating readout pinned to the top of the chart (not under the finger) with date and value in tabular numerals. Fire a haptic tick per data point where possible (see §4). Release returns to the summary state. Use pointer events with `touch-action: pan-y` on the chart so vertical page scroll still works, and start scrubbing only after a ~150-250 ms hold or a clear horizontal drag.
- **Range switcher:** a segmented control (D/W/M/6M/Y) like Apple Health. Animate y-axis rescale and mark morphs (HIG: animate changes). Aggregate to bars for sums (steps, strain) and lines/points with min-max range bars for averaged signals (HR, HRV).
- **Heatmaps/calendars:** a month grid of small rounded squares coloured by a *sequential single-hue* scale (not red/green). Good for consistency/streaks, sleep regularity and journal tags. Tap a day to open that day's sheet.
- **Uncertainty:** show bands or whiskers for estimated metrics. Mark "estimated" or "low confidence" with a dotted line or hollow point, show "calibrating, N of 14 nights" states for new baselines, and grey out days with insufficient wear time instead of interpolating.
- **Progressive disclosure:** Today card → tap → detail sheet/page (chart + contributors list with each contributor's own mini-bar vs baseline + educational "what this means") → trends page. Never hide the raw value behind the score. Always show the contributors (HRV, RHR, sleep, temperature deviation).

### Gaps
- No source in this session gives exact ring stroke widths or gauge geometry used by WHOOP, Bevel or Apple. The numbers above are conventions.
- No controlled study was found comparing ring vs bar vs band comprehension for health scores.

---

## 3. Information architecture of top apps

### Takeaway
The leaders converged on **3-tab (sometimes 4-5) structures**: a "Today"/Home dashboard with 2-3 hero scores at the top, then customisable cards, then a trends/health tab and a coach/journal tab. Logging is a secondary action reachable from Home or a "+" button. Simplification (Oura 5→3 tabs, Gentler Streak 4→3) has been the 2024-2025 trend.

### Cited Findings
- **Oura (2024 redesign):** five tabs merged into three: **Today** (insights through the day, from waking to winding down), **Vitals** (a detailed snapshot of Readiness, Sleep, Activity, Daytime Stress, Daytime HR) and **My Health** (long-term trends such as cardiovascular health, stress resilience and sleep quality). — [Oura blog: new Oura app experience](https://ouraring.com/blog/new-oura-app-experience/); [Tom's Guide](https://tomsguide.com/wellness/fitness-trackers/forget-oura-ring-4-oura-ring-3-users-can-access-all-of-these-new-features-in-the-oura-app)
- **Oura (Oct 2025):** biometric-driven colour changes, Cumulative Stress, and a 12-month cycle view. — [9to5Google](https://9to5google.com/2025/10/20/oura-app-redesign/)
- **WHOOP:** three dials (Sleep, Recovery, Strain) atop Home, each with a deep-dive page. A navigation update added bottom labels. WHOOP 5.0/MG launched 8 May 2025 with a "cleaner home screen". The dial layout dates to ~2023 and was not specifically a 5.0 change. — [WHOOP Home screen](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/); [WHOOP nav bar update](https://www.whoop.com/us/en/thelocker/app-update-navigation-bar); [BusinessWire, May 2025](https://www.businesswire.com/news/home/20250508546933/en); [the5krunner](https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/)
- **WHOOP vs Bevel lawsuit (2026):** WHOOP sued Bevel, alleging its app is visually similar enough (three-ring home) that users would associate the two. The three-ring home was introduced with WHOOP 5.0 on 8 May 2025, according to this source, which conflicts with the 2023 dial redesign above. There is no ruling yet. — [the5krunner, Apr 2026](https://the5krunner.com/2026/04/04/whoop-sues-bevel/)
- **Bevel:** Strain/Recovery/Sleep circles on the main view. Users can choose Light/Dark theme and Illustrative/Minimalistic background and **edit dashboard cards**. A **Journal** logs habits (hydration, sunlight, etc.), and Insights correlate journal entries with Sleep/Recovery once enough data exists. It is a software layer over Apple Watch, Oura, Garmin etc. It raised a $10M Series A in Oct 2025 and has >500k users. — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance); [TechCrunch](https://techcrunch.com/2025/10/30/bevel-raises-10m-series-a-from-general-catalyst-for-its-ai-health-companion); [the5krunner](https://the5krunner.com/2026/04/04/whoop-sues-bevel/)
- Bevel critique: a reviewer found the strain target hard to act on ("you don't really know how to implement"). — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance) (via search summary)
- Reviewers call Bevel "one of the best-looking health apps on iPhone". Another reviewer awards "best UI and app experience" to WHOOP over Bevel. — [Autonomous.ai review](https://www.autonomous.ai/ourblog/bevel-app-review); [The Flyby](https://flyby.willpaige.com/bevel-vs-whoop/)
- **Gentler Streak (Mar 2025 redesign):** reduced from four tabs to three. The main page, "the Streak", sits directly below the Activity Path. Later updates let non-recorded steps count toward the path and sync RPE edits from Apple Fitness. — [BGR](https://bgr.com/tech/gentler-streak-gets-a-major-redesign-focused-on-your-wellbeing/); [BGR (watchOS 26 features)](https://bgr.com/lifestyle/gentler-streak-gets-two-long-awaited-features-ahead-of-watchos-26)
- **Apple Health:** Summary (Favorites + Highlights) and Browse tabs since iOS 13. Early 2026 reports (Macworld/9to5Mac via aggregators) describe an iOS 26.4-era redesign with a new category layout, "significantly simplified logging of measurements", food tracking and expert videos. These are pre-release rumours and unconfirmed. — [MacStories](https://www.macstories.net/?p=60534); [T3](https://www.t3.com/tech/smartwatches/apples-health-app-could-be-getting-a-major-revamp-in-ios-26-4-with-food-tracking-and-an-ai-health-coach-rumoured); [Business Today](https://www.businesstoday.in/technology/news/story/apple-to-redesign-health-app-add-video-coaching-and-overhaul-siri-report-510557-2026-01-12)
- **Athlytic:** described as recovery-focused, with "clean data presentation and Apple Watch integration". No layout details were found. — [Lifestack: Bevel review](https://lifestack.ai/blog/bevel-app-review)

### Inferences
- **Recommended IA for a personal WHOOP-like PWA:** 3-4 tabs in a floating capsule tab bar. (1) **Today**: hero row of 2-3 scores (Recovery/Readiness, Sleep, Strain/Load), a one-sentence "coach line", then reorderable cards (HRV, RHR, sleep stages, activity, journal prompt). (2) **Trends**: per-metric detail with range switcher and baseline bands. (3) **Journal**: daily tags/behaviours with correlation insights, Bevel-style. (4) optional **Profile/Settings**. Put a "+" or log action in the top-right nav bar or as a tab-bar-adjacent capsule button (the iOS 26 pattern is a separate circular glass button next to the tab bar). This is preferable to a Material-style FAB that covers content.
- **Card customisation:** an "Edit" mode with drag handles and show/hide toggles (Apple Health Favorites, Bevel editable cards). Default order should follow the user's morning question: "How recovered am I?" → "How did I sleep?" → "What should I do today?"
- **Day navigation:** horizontal swipe or date chevrons on Today to view past days (WHOOP/Oura convention). Show "Today, 07:12 — synced 2 min ago" so data freshness is always visible.
- **Widgets/Live Activities equivalent on the web:** a PWA can't make iOS widgets or Live Activities. The closest substitutes are a Home Screen icon badge (Badging API, available to installed web apps on iOS 16.4+, not verified in this session), web push notifications for the morning summary, and a fast-launching "glance" Today screen.

### Gaps
- Primary WHOOP pages could not be fetched (domain blocked). The exact current WHOOP tab structure (Home / Health / Community / More?) was not confirmed.
- No Mobbin flows were retrieved. Mobbin is login-gated and its pages are not indexed with detail.
- Garmin Connect's 2024-2025 redesign (customisable "My Day") was not researched in this session.

---

## 4. Motion, micro-interactions and web performance

### Takeaway
Apple's motion system is springs with zero bounce by default: ~0.5 s perceptual duration, small bounce (≤0.2-0.3) reserved for playful moments. On the web, approximate this with CSS `linear()` spring easings or a JS spring library, View Transitions (Safari 18.2+ cross-document) and scroll-driven animations (Safari 26). Haptics only work through the `<input type="checkbox" switch>` hack (Safari 17.4+).

### Cited Findings
- WWDC23 "Animate with springs": SwiftUI defaults to springs. With no bounce specified you get bounce 0, "the most versatile general-purpose choice". Presets: `.smooth` (no bounce), `.snappy` (small bounce), `.bouncy` (visible bounce). Examples: `.snappy(duration: 0.4, extraBounce: 0.1)`, `.bouncy(duration: 0.5, extraBounce: 0.2)`, `.spring(duration: 0.6, bounce: 0.2)`. Bounce ~15% "doesn't feel very bouncy" and ~30% is noticeable. Values above ~0.4 may feel exaggerated for UI. Springs use a *perceptual* duration. — [WWDC Notes: Animate with springs](https://wwdcnotes.com/documentation/wwdc23-10158-animate-with-springs/); [Apple WWDC23 10158](https://developer.apple.com/videos/play/wwdc2023/10158/)
- Safari 26.0 shipped **scroll-driven animations** (`animation-timeline`, `animation-range`). — [WebKit: Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0) (via search summary)
- **Cross-document View Transitions** are supported in Safari 18.2+, Chrome 126+ and Edge 126+. Same-document View Transitions in Safari were not confirmed by the sources found. — [daily.dev WebKit 2025](https://app.daily.dev/sources/webkit/best-of/2025); [Chrome I/O 2024 recap](https://developer.chrome.com/blog/new-in-web-ui-io-2024?hl=en)
- **Web haptics on iOS:** `navigator.vibrate()` is not implemented in iOS Safari. A hidden `<input type="checkbox" switch>` toggled via its label triggers the Taptic Engine (switch element since Safari 17.4). Patterns come from timed repeated clicks. Installed-PWA support is claimed by one source only. It depends on Safari's switch behaviour and could break. — [azukiazusa.dev: iOS Safari web haptics](https://azukiazusa.dev/en/blog/ios-safari-web-haptics); [web_haptics package](https://pub.dev/packages/web_haptics); [rapidtoolset iOS Haptics Tester](https://rapidtoolset.com/en/tool/ios-haptics-tester)
- HIG: animate chart changes so people notice them, and provide non-animated cues for Reduce Motion users. — [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)

### Inferences
- **Spring tokens for CSS** (approximations): `--spring-smooth` ≈ 500 ms with a `linear()` curve generated for bounce 0, used for sheets, cards and page pushes. `--spring-snappy` ≈ 350-400 ms with ~10% overshoot, used for toggles, tab switches and scrubber snap. `--spring-bouncy` ≈ 500 ms with ~20% overshoot, used only for celebratory moments like ring completion. Generate the `linear()` curves with a spring-to-linear tool or use a JS spring (Motion/Framer Motion, react-spring) for interruptible gestures. Sheet drags must be interruptible and velocity-aware, which needs JS.
- **Number roll-ups:** count from the previous value (not 0) to the new value over ~600-900 ms with ease-out, using `tabular-nums` so width doesn't jump. Skip the animation if the value is unchanged or under `prefers-reduced-motion`. Odometer-style digit rolling is a nice touch for a single hero number only.
- **Ring/chart reveal:** on first paint, animate ring `stroke-dashoffset` with the smooth spring (~800 ms), staggered 60-80 ms across the three rings. Draw line charts left-to-right with a clip-path or `stroke-dasharray`, and fade bars up with a 20-30 ms per-bar stagger. Play this only on first view per day, not every tab switch, so it isn't tiresome.
- **Skeletons:** use shaped placeholders matching the final layout (ring outline, bar stubs) with a slow shimmer (~1.2-1.5 s), and show cached data immediately with a "Syncing…" pill instead of blanking the screen (stale-while-revalidate via service worker + IndexedDB).
- **Haptics plan:** a selection tick per scrub point, a light impact on segmented-control change, success on log save. Gate everything behind feature detection plus a user setting.
- **Performance:** keep `backdrop-filter` to ≤2-3 simultaneously visible elements (tab bar, nav bar, open sheet). Animate only `transform`/`opacity`. Use SVG for rings and small charts, and canvas (or a lightweight lib) only for dense scrub charts with >1-2k points. Avoid layout-thrashing scroll listeners and prefer CSS scroll-driven animations (Safari 26) for collapsing large titles. Respect `prefers-reduced-motion` by swapping springs for 150-200 ms cross-fades.

### Gaps
- Exact default durations of SwiftUI `.smooth`/`.snappy`/`.bouncy` presets were not confirmed by sources (commonly cited as 0.5 s, unverified).
- Same-document View Transitions support status in Safari 26 was not confirmed (it shipped in Safari 18.0 per general knowledge, unverified here).
- No source confirmed whether the switch-haptic hack works inside standalone (home-screen) PWAs on iOS 26.

---

## 5. Common UX complaints and how the best apps avoid them; accessibility

### Takeaway
The biggest risks are score anxiety and orthosomnia, opaque composite scores, and red/green-only status. The best responses are compassionate copy, rest modes, always-visible contributors, "how you feel" check-ins, colour plus shape plus text for status, and pervasive freshness/sync indicators.

### Cited Findings
- **Orthosomnia:** "the unhealthy fixation on achieving perfect sleep metrics, causing sufferers to prioritize what their device reports over how they actually feel upon waking". It particularly affects people prone to performance anxiety. — [Sahha blog](https://sahha.ai/blog/orthosomnia-sleep-tracker-anxiety/); [Irish Times](https://www.irishtimes.com/business/technology/the-problem-with-ireland-s-obsession-with-sleep-trackers-1.3970904)
- Dr Michael Breus: tracking "has made sleep into something you have to perform and score, which can deepen anxiety and perfectionism when the numbers don't look right." — [AOL](https://www.aol.com/articles/oura-ring-judging-160543237.html)
- A sleep expert calls the overall sleep score "almost meaningless" because its derivation is rarely transparent. No consumer wearable measures sleep directly. — [Gulf Today, Jun 2026](https://www.gulftoday.ae/lifestyle/2026/06/09/wearable-sleep-trackers-are-they-helping-your-health-or-causing-anxiety)
- Oura reportedly added "Rest Mode" and more "compassionate" messaging to counter score anxiety. This comes from an essay and was not verified with Oura. — [Revolutionized](https://revolutionized.com/?p=8268)
- Gentler Streak is praised for encouraging rest instead of pushing limits, and won the **2024 Apple Design Award for Social Impact**. — [Apple App Store story: ADA 2024 winners](https://apps.apple.com/us/story/id1745165692?l=ru); [Apple Newsroom 2024 ADA](https://www.apple.com.cn/newsroom/2024/06/apple-announces-winners-of-the-2024-apple-design-awards/)
- Bevel user feedback: "even more variability with the Bevel Recover score vs. Oura's Readiness score". Score volatility erodes trust. — [App Store reviews: Bevel](https://apps.apple.com/us/app/bevel-ai-health-coach/id6456176249?see-all=reviews) (via search summary)
- **Colour-blind safety:** red+green is "the most common and problematic pairing". Replace it with blue/orange or blue/yellow and always add redundant cues (icons, labels, shapes, percentages). Cisco Meraki's colour-blind assist mode swapped green/yellow/red for **blue/orange/a new red**. Blue/yellow is risky for tritanopia. — [WebAbility](https://www.webability.io/blog/colors-to-avoid-for-color-blindness); [Meraki Community](https://community.meraki.com/t5/Feature-Announcements/Colorblind-Assist-Mode-Now-Available-Across-the-Dashboard-to/ba-p/217908); [UX Collective: dashboards for the color blind](https://uxdesign.cc/creating-dashboards-for-the-color-blind-74d62d67547)
- HIG: never rely on colour alone (Health BP uses circle vs diamond). Provide increased-contrast colour variants. Light and dark yellow/green are low-contrast on white, which is why the increased-contrast yellow is 161,106,0. — [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color); [Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Liquid Glass accessibility backlash (eye strain, legibility) led to iOS 26.1 "Tinted". — [Engadget](https://www.engadget.com/mobile/smartphones/how-to-adjust-the-liquid-glass-effect-in-ios-261-203634681.html); [designedforhumans.tech](https://designedforhumans.tech/blog/liquid-glass-smart-or-bad-for-accessibility)
- Over-reliance on preattentive emphasis "can lead to cluttered or misleading visualizations". — [Shortform: Big Book of Dashboards](https://www.shortform.com/pdf/the-big-book-of-dashboards-pdf-steve-wexler-jeffrey-shaffer-and-andy-cotgreave)

### Inferences
- **Avoid:**
  - More than 3 composite scores on Home.
  - Scores without contributors.
  - Judgemental words ("Poor") in red. Prefer neutral framing ("Lower than your normal — take it easier") with an actionable suggestion.
  - Streak-loss guilt.
  - Paywalled raw data. A personal app has no paywall, but the principle stands: raw values must always be one tap away.
  - Silent stale data. Show "last synced" and the data source.
  - Notification spam.
  - Infinite precision. Show HRV as integer ms and scores as integers, and never show decimals that imply false accuracy.
- **Recovery palette suggestion (colour-blind-aware):** keep a WHOOP-like semantic order, but make hue *and lightness* both vary and pair them with shape and label. Example: high = teal/green (HIG mint/green) + ▲ "High"; medium = amber/yellow (HIG increased-contrast yellow in light mode) + ● "Moderate"; low = red-orange or magenta-red + ▼ "Low". Check with a CVD simulator. Alternatively offer a "colour-blind mode" (blue/orange/red) like Meraki. Position on a gauge or band also encodes the state without colour.
- **Anxiety-reducing patterns:** a subjective "How do you feel?" check-in next to the score, a "Rest/Sick mode" that pauses targets, weekly framing over daily, ranges ("within your normal") over single-point verdicts, and an explicit confidence/"calibrating" state.
- **Contrast:** ≥4.5:1 for text and ≥3:1 for chart marks and UI boundaries (WCAG). Secondary-label greys on glass need checking in both themes.

### Gaps
- The full text of the 2025 composite-score evaluation paper and the Bergen Orthosomnia Scale findings were not accessed.
- No source quantified slow-sync complaints for WHOOP/Oura specifically.

---

## 6. Design resources, case studies and Apple Design Award winners (health/fitness 2023-2026)

### Takeaway
Gentler Streak is the standout ADA-recognised health app (2023 Visuals & Graphics finalist, 2024 Social Impact winner). No health app won an ADA in 2025, though Evolve and Train Fitness were finalists. Bevel is the most-cited "beautiful" WHOOP-alternative, and practical CSS glass and liquid-glass write-ups exist (LogRocket, Ekino, Josh Comeau).

### Cited Findings
- **ADA 2024:** Gentler Streak won Social Impact. It was a 2023 ADA finalist (Visuals & Graphics) and 2022 Apple Watch App of the Year. — [App Store: Meet This Year's ADA Winners (2024)](https://apps.apple.com/ca/story/id1745165692); [Apple 2022 App Store Awards](https://apps.apple.com/us/story/id1647057981); [9to5Mac: Gentler Streak icons 2024](https://9to5mac.com/2024/06/05/fitness-tracker-gentler-streak-new-icons)
- **ADA 2025:** no health/fitness winner. Finalists in Inclusivity were **Evolve: Daily Self-Care Coach** ("A beautifully designed health and fitness app… focused on the LGBTQ+ community") and **Train Fitness** (logs workouts from Apple Watch and AirPods motion via CoreMotion/CoreML). Speechify won Inclusivity. Some outlets mislabel the finalists as winners. — [9to5Mac ADA 2025](https://9to5mac.com/2025/06/03/apple-announces-2025-apple-design-award-winners/); [Apple Newsroom ADA 2025](https://www.apple.com/sn/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards)
- **App Store Awards 2025:** Strava was Apple Watch App of the Year and Tiimo was iPhone App of the Year. — [Free Press Journal](https://www.freepressjournal.in/tech/apple-app-store-awards-2025-tiimo-wins-iphone-app-of-the-year-as-ai-apps-dominate-full-winners-list)
- Case study: "Behind the Design: How Gentler Streak approaches fitness with 'humanity'" (Apple's Behind the Design series, mirrored). — [Progressive Robot mirror](https://blog.progressiverobot.co.uk/behind-the-design-how-gentler-streak-approaches-fitness-with-humanity)
- Case study / teardown: "Bevel: Reverse-Engineering a $70K/Month Health & Performance Powerhouse". — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance)
- Bevel screenshots gallery. — [Reeoo](https://reeoo.com/app-screenshot/bevel-ai-health-coach/)
- Curated Liquid Glass resources list (design kits, libraries). — [GitHub: awesome-liquid-glass](https://github.com/carolhsiaoo/awesome-liquid-glass)
- Liquid Glass best practices (secondary). — [Bitrig](https://bitrig.com/blog/liquid-glass-best-practices); [Create with Swift](https://www.createwithswift.com/liquid-glass-redefining-design-through-hierarchy-harmony-and-consistency/)
- Apple WWDC25 sessions: Meet Liquid Glass (219), Get to know the new design system (356), plus Swift Charts session 313 (WWDC25, linked from the HIG Charts page). — [WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/); [WWDC25 356](https://developer.apple.com/videos/play/wwdc2025/356/)
- Apple Design Resources (Figma/Sketch iOS 26 kits, Dynamic Type tables). — [Apple Design Resources](https://developer.apple.com/design/resources/)

### Inferences
- The best references for "Apple-level" health dashboards are, in order: Apple Health/Fitness (system patterns), Gentler Streak (calm, illustrative, range-band viz), Bevel (WHOOP-like rings, polished cards, journal) and Oura (3-tab simplification, compassionate copy). WHOOP is the reference for the dark, data-dense athletic aesthetic. Copying WHOOP's three-ring home too literally carries legal and design-identity risk (see the lawsuit), so a personal app should develop its own hero visual, e.g. a single recovery gauge plus a baseline band.

### Gaps
- Mobbin, Dribbble and Medium case studies for WHOOP/Oura were not retrieved: Mobbin is gated, and Medium/Dribbble returned no specific results in the queries run.
- ADA 2026 winners (June 2026) were not researched in this session.
- Athlytic and Garmin design specifics were not found.
