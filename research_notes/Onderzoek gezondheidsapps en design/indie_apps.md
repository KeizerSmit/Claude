# Independent / third-party health & training apps: features, data interpretation and design (state late 2026)

Research date: 2026-11-04. Method: WebSearch (standard/extended) only. WebFetch failed (askvora.com not resolvable in this sandbox), so findings rest on search-result summaries of the cited pages. Many 2026 "comparison" sources are vendor-adjacent SEO blogs (competing apps such as Vora, Fitcoin, Lifestack, Sensai, Bodly, RepReturn). They are marked as such and should be weighted below official pages, Apple, 9to5Mac, BGR and TechRadar.

Important 2026 context: several sources report that Apple added a native 0–10 **Readiness** score in watchOS 27, but only on **Apple Watch Series 12 and Ultra 4**, which have a new sensing system with higher-frequency HR/HRV sampling. Older watches do not get it and still rely on Athlytic, Bevel, Gentler Streak and Training Today — [Fitcoin](https://www.fitcoin.co/articles/apple-watch-readiness-score); [Ness Health](https://ness-health.com/blog/apple-watch-readiness-models); [Vora](https://askvora.com/blog/best-apple-watch-recovery-apps-2026). These are all vendor-adjacent blogs and they disagree on dates and models. One reports that Apple has published no validation of the score. Tom's Guide, writing before launch, noted that older watches did not measure HR continuously outside workouts — [Tom's Guide](https://www.tomsguide.com/wellness/smartwatches/i-use-readiness-on-my-garmin-watch-every-day-heres-why-im-excited-about-it-coming-to-the-apple-watch). Check this against Apple's own material before relying on it.

## 1. Signature features and scores per app

### Takeaway
The recovery apps (Athlytic, Bevel, Training Today, Gentler Streak) all build a WHOOP-style trio from Apple Watch data: readiness/recovery from HRV and RHR against a roughly 60-day baseline, a load/strain/exertion score, and sleep. Bevel adds the most extra layers (Energy Bank, Biological Age, nutrition, strength). The apps that stand out on interpretation either refuse a single composite (HRV4Training), translate data into one action (Visible's stability score, Rise's energy windows), or correlate behaviour with outcomes (Bearable, Welltory).

### Cited Findings

**Athlytic** (iOS/Apple Watch, indie)
- It turns Apple Watch data into a daily Recovery score, an Exertion score and a Sleep score, with no extra hardware — [Fitcoin via search summary](https://www.fitcoin.co/articles/apple-watch-readiness-score); [Fitcoin Bevel vs Athlytic](https://www.fitcoin.co/articles/bevel-vs-athlytic)
- Recovery compares overnight HRV and resting HR with a 60-day baseline. Exertion runs 0–10 and builds while HR sits above your threshold, and the app shows a daily target zone — [Vora Bevel vs Athlytic (vendor-adjacent)](https://askvora.com/blog/bevel-vs-athlytic-apple-watch-recovery-apps); [Lifestack](https://lifestack.ai/blog/bevel-vs-athlytic)
- Pricing: Pro is $4.99/month or $29.99/year with a 7-day trial. Another source gives about $25/year — [Vora](https://askvora.com/blog/best-apple-watch-recovery-apps-2026)
- Critique: an independent reviewer argues that recovery leans heavily on cardio signals and ignores muscle fatigue, so exertion targets "may result in overtraining" — [ibikerun Substack](https://ibikerun.substack.com/p/athlytic-app-review-iosapple-watch)
- Positioning: comparisons call it the stronger, simpler choice for daily training guidance and weaker if you want a broad "health OS" — [Fitcoin](https://www.fitcoin.co/articles/bevel-vs-athlytic); [HealthGenie](https://healthgenieapp.com/blog/athlytic-vs-bevel-vs-gentler-streak.html)

**Bevel** (iOS, "All-In-One Health App", later listed as "AI Health Coach")
- Scores: Recovery (1–100%) from resting HR, HRV, respiratory rate, SpO₂ and wrist temperature, plus Sleep, Strain and Stress — [Vora](https://askvora.com/blog/bevel-vs-athlytic-apple-watch-recovery-apps); [Fitcoin scores explained](https://www.fitcoin.co/articles/bevel-scores-explained)
- **Energy Bank** combines recovery, sleep, strain and stress into one figure that shows energy building and draining through the day, similar to Garmin Body Battery — [App Store](https://apps.apple.com/us/app/bevel-all-in-one-health-app/id6456176249); [Neura Health](https://neura.health/insight/bevel-health-app-in-depth-review)
- A Strain recommendation (how hard to train today, based on sleep and recovery). Reviewers say the app pushes you toward a decision: train hard, take it easy, or prioritise sleep — [HealthAppInsider](https://www.healthappinsider.com/en/reviews/bevel-review); [Bodly](https://bodly.app/blog/bevel-app-review)
- **Biological Age** from sleep, activity, RHR and other markers. Most sources put it behind Pro, but Bodly lists it as free (conflict). Critics say it cannot diagnose illness or explain a low recovery score — [HealthAppInsider](https://www.healthappinsider.com/en/reviews/bevel-review); [Bodly](https://bodly.app/blog/bevel-app-review)
- Free tier is reported to include Recovery, Sleep, Strain, Stress, Energy Bank, nutrition, Strength Builder, cycle tracking and the journal. Pro covers AI coaching, Health Records and Biological Age. Price conflicts: $14.99/month or $99.99/year in one source, $5.99/month or $49.99/year in another — [HealthAppInsider](https://www.healthappinsider.com/en/reviews/bevel-review); [Lifestack](https://lifestack.ai/blog/bevel-vs-athlytic)
- Pulls data from Garmin, Oura and Google Health, not only Apple Watch — [Vora](https://askvora.com/blog/best-apple-watch-recovery-apps-2026)
- Reported legal issue: WHOOP is said to have sued Bevel over how it uses WHOOP-derived data. This is a single TechRadar-attributed report that I could not verify — [Bevel alternatives blog citing TechRadar](https://www.superage.app/en/blog/best-bevel-alternatives/)

**Gentler Streak** (iOS/watchOS, Gentler Stories, Slovenia)
- Awards: Apple Design Award **winner 2024, Social Impact**, finalist 2023, Apple Watch App of the Year 2022 — [Apple Developer "Behind the Design"](https://developer.apple.com/news/?id=3m0ht22s); [Gentler docs](https://docs.gentler.app/fr/mises-a-jour-et-annonces/gentler-streak-remporte-un-apple-design-award-pour-son-impac); [FIT TECH](https://www.fittechglobal.com/fit-tech-news/Kind-activity-tracker-Gentler-Streak-wins-Apple-Watch-App-of-the-Year/350559)
- **Activity Path**: the green path across the Streak tab combines your logged workouts, their intensity and their impact on your fitness. It shows whether you are under-doing it, in range or over-doing it, instead of using closed rings — [App Store](https://apps.apple.com/us/app/gentler-streak-workout-tracker/id1576857102); [BGR](https://bgr.com/tech/gentler-streak-non-tracked-workouts/)
- Readiness takes age, gender, resting HR, HR during activity and VO2max (when available) into account, weighting the last 60 days most — [App Store via search](https://apps.apple.com/us/app/id1576857102?l=en-us)
- March 2025: a new "For You" tab merges the Streak with health and Wellbeing data — [9to5Mac 2025-03-18](https://9to5mac.com/2025/03/18/gentler-streak-update-health/). February 2025 brought new Home Screen widgets with health metrics — [9to5Mac 2025-02-14](https://9to5mac.com/2025/02/14/gentler-streak-new-widgets/). December 2024 brought improved health metrics and an Activity Recap — [9to5Mac 2024-12-23](https://9to5mac.com/2024/12/23/gentler-streak-health-metrics-recap-2024/)
- App Store: 4.7 from about 8.8K ratings. One review gives Premium at about $8.99/month — [App Store](https://apps.apple.com/us/app/gentler-streak-workout-tracker/id1576857102); [HealthAppInsider](https://www.healthappinsider.com/en/reviews/gentler-streak-review)
- "Fitness Age": I found **no evidence** of a feature by that name (see Gaps).

**Training Today / HRV4Training** (Marco Altini)
- Design philosophy: Altini criticises composite readiness scores for false precision. A score that includes sleep "penalizes a poor night twice" (low sleep plus the resulting low HRV). HRV4Training keeps HRV as the core metric and sets it against your normal range and history, with colour-coded advice and a short message that also uses subjective feel — [Altini, Medium "On HRV and readiness"](https://medium.com/@altini_marco/on-heart-rate-variability-hrv-and-readiness-394a499ed05b); [Altini "Data interpretation issues"](https://medium.com/@altini_marco/data-interpretation-issues-in-wearables-a3942cae82ac); [Uphill Athlete podcast](https://uphillathlete.com/podcast/making-sense-of-the-data/)
- Input can come from the phone camera, a Polar H10, Apple Watch or Oura. It is cheap — [the5krunner](https://the5krunner.com/2022/01/11/hrv-more-than-you-ever-needed-or-wanted-to-know) (2022, older)
- Training Today is listed among the 2026 Apple Watch recovery apps — [Vora/Fitcoin via search](https://www.fitcoin.co/articles/apple-watch-readiness-score). I found no direct 2025–26 review of it.

**Visible** (pacing for ME/CFS and Long Covid)
- A daily **Morning Stability Score** (1–5) from a morning HRV reading taken with a finger on the phone camera plus symptom check-ins, used to set daily pacing. Visible Plus adds all-day tracking via a Polar Verity Sense armband and gives "pace points" — [ME Association](https://meassociation.org.uk/?p=135851); [Visible blog](https://www.makevisible.com/blog/introducing-the-morning-stability-score-1-1); [Fit&Well](https://www.fitandwell.com/features/visible-health-review)
- Known issue: unusually high HRV is treated as instability and lowers the score, and the morning score can overestimate reserves during a long crash. The developers moved to a much longer baseline. They also run a research partnership with Imperial College London — [Visible blog](https://www.makevisible.com/blog/introducing-the-morning-stability-score-1-1); [S4ME forum](https://s4me.info/threads/monitoring-app-visible-a-platform-designed-for-any-invisible-illness-that-benefits-from-resting-and-pacing-including-me-cfs-long-covid.23542/page-9)

**Welltory**
- Stress and energy measured from HRV, through a camera measurement (free) or wearables. It adds a daily readiness score and breathing exercises. Paid tiers add a dashboard that logs lifestyle factors and shows their effect on stress and energy — [App Store](https://apps.apple.com/app/id1074367771); [Product Hunt](https://www.producthunt.com/products/welltory)
- Praise: clear visuals, educational context, a polished Apple Watch app. Complaints: a learning curve around HRV and its scores, some accuracy and stability issues, limits without a wearable, and persistent upselling. The upselling point comes from an automated summary site and is lower confidence — [Product Hunt reviews](https://www.producthunt.com/products/welltory/reviews?page=1)
- I found no independent 2025 review from a major publication.

**Bearable** (symptom/mood tracker)
- Its core idea is automatic correlations between habits, factors such as sleep, and mood or symptoms. Users repeatedly name this the standout feature ("helped me make some correlations that have improved my quality of life") — [App Store](https://apps.apple.com/app/bearable/id1482581097); [Bearable](https://bearable.app/symptom-tracker/)
- Free with no ads. Premium adds extra reports, correlations, notes, "significant events" and historic symptom data. Ratings sit around 4.6–4.7 — [Bearable](https://bearable.app/); [App Store](https://apps.apple.com/au/app/id1482581097)
- Requests and complaints: deeper long-term trend analytics and exports to share with doctors. The correlations are not independently validated statistically — [Product Hunt](https://www.producthunt.com/products/bearable/reviews)

**Rise (Rise Science)**
- Built on two concepts, **sleep debt** (cumulative, over 14 nights) and **circadian rhythm**. It produces a daily **energy schedule**: a grogginess window of about 90 minutes after waking, then peaks and a dip, a melatonin window and a wind-down. The windows shift with last night's sleep — [Rise](https://www.risescience.com/fb2); [Bustle](https://www.bustle.com/wellness/rise-sleep-tracking-app-review); [Sleepopolis](https://sleepopolis.com/sleep-accessories/rise-sleep-and-energy-app-review/)
- It infers sleep from phone use and steps. Critics say this skews results if you don't touch your phone right before and after sleep. A sleep-debt number such as 26.5 hours can be daunting and demotivating. Irregular schedules are handled poorly, and users ask for a debt reset after offline periods — [Mattress Clarity 3.4/5](https://www.mattressclarity.com/sleep-app-reviews/rise-app-review); [Bustle 4.5/5](https://www.bustle.com/wellness/rise-sleep-tracking-app-review)
- Price is about $60–69.99/year (sources conflict) — same sources.

**Strava**
- **Relative Effort** (subscribers) is HR-based training load, and **Fitness** (Fitness & Freshness) is built from Relative Effort and/or power data — [Strava Support: Relative Effort](https://support.strava.com/en-us/articles/15401794-relative-effort); [Strava Support: Fitness](https://support.strava.com/en-us/articles/15401765-fitness)
- **Athlete Intelligence** (AI summaries) left beta in early 2025. Strava claims 80%+ of polled subscribers find it "very helpful" (Strava's own claim). The Progress charts were redesigned in February 2025 (sport plus 1w/1m/3m/6m/YTD/1y) — [Android Central](https://www.androidcentral.com/wearables/strava-announces-stable-athlete-intelligence-anti-cheating-and-flyover-sharing); [Wareable](https://www.wareable.com/news/strava-athlete-intelligence-full-launch-flyover-sharing-progress-comparison)
- Leaderboards became subscriber-only in an earlier overhaul (pre-2025) — [Cycling Weekly](https://www.cyclingweekly.com/news/product-news/strava-overhaul-better-routes-more-training-analysis-leaderboard-for-paying-customers-only-455995)
- Hevy now syncs to Strava with full exercise, set and rep details (July 2026) — [Hevy community update July 2026](https://www.hevyapp.com/community-updates/july-26/)

**Hevy / Strong / Fitbod** — see section 3.

### Inferences
- The market has converged on a "WHOOP-without-the-strap" trio (recovery/strain/sleep). Apps now differ in how they explain the numbers and turn them into advice, more than in the metrics themselves. Apple's native Readiness (if confirmed) pushes third-party apps further toward interpretation, journaling and cross-device aggregation (Bevel), or toward tone and philosophy (Gentler Streak, HRV4Training).
- Two opposing interpretation philosophies are worth naming for a design. One is a **single synthesised score** (Bevel Energy Bank, Athlytic Recovery, Visible stability 1–5). The other is **raw metric in a personal normal range plus a recommendation** (HRV4Training, Altini's critique of double counting).

### Gaps
- No primary source for Athlytic's exact Sleep score formula or recent (2025–26) design changes.
- Gentler Streak "Fitness Age": not found. It may not exist or may be confused with another app. Bevel has Biological Age; Apple-adjacent "fitness age" concepts exist elsewhere.
- Stelo (Dexcom) and Levels (CGM): not researched, for lack of tool budget.
- Training Today: no direct review found. Its link to Marco Altini is from my background knowledge (Altini also makes HRV4Training) and was **not confirmed** in these searches.

## 2. After-the-fact logging and effort estimation without HR

### Takeaway
The standard pattern is a manual entry (type, duration, optionally distance) plus a **0/1–10 perceived-exertion (RPE) slider**, which then feeds the same load model as HR-based workouts. Strava and Gentler Streak both do this explicitly. Fitbod estimates per-muscle fatigue from sets × reps × load rather than from HR.

### Cited Findings
- **Strava Perceived Exertion**: a 1–10 scale set on the save or edit screen. A "Use instead of heart rate" toggle lets RPE power Relative Effort and Fitness without an HR monitor. Without a power meter or HR you have to set RPE to get a Relative Effort at all — [Strava Support: Perceived Exertion](https://support.strava.com/en-us/articles/15401767-perceived-exertion); [Strava Support: Relative Effort](https://support.strava.com/en-us/articles/15401794-relative-effort)
- Strava priority rule: a power meter takes precedence over HR or RPE for Fitness — [Strava Community (Dec 2025)](https://communityhub.strava.com/devices-and-connections-6/relative-effort-now-shown-despite-having-heart-rate-data-10827)
- Trust problems: users reported Relative Effort and Fitness dropping after a change around 18 September 2025, and the "Fitness score ignores Strava app activities". Suspected causes were the RPE toggle and HR zone changes (anecdotal, not confirmed by Strava) — [Strava Community](https://communityhub.strava.com/strava-features-chat-5/why-are-relative-effort-and-fitness-decreasing-10878); [Strava Community](https://communityhub.strava.com/strava-features-chat-5/fitness-score-ignores-strava-app-activities-12050)
- **Gentler Streak "Add Workout Manually"** (since v2.7, 2022): enter workout type, duration, intensity and distance. Intensity is RPE from 0 ("No Effect") to 10 ("Maximum Effort"), with in-app guidance to consider muscle fatigue, elevated heart rate and breathing rate. Manual workouts appear on the Activity Path alongside tracked ones — [BGR](https://bgr.com/tech/gentler-streak-non-tracked-workouts/); [9to5Mac 2022](https://9to5mac.com/2022/10/12/gentler-streak-apple-watch-update/); [App Store](https://apps.apple.com/us/app/gentler-streak-workout-tracker/id1576857102)
- Caveat: one secondary blog says manual workouts lack the automatic recovery tracking of watch-tracked ones (low confidence) — [Lifestack](https://lifestack.ai/blog/gentler-streak)
- **Fitbod**: after each logged workout it estimates per-muscle-group load from sets, reps and weight and assigns 0–100% recovery. Muscles recover in up to about 7 days depending on load (another source says 6). Cardio is factored in, and Apple Health, Fitbit and Strava data can feed it. Users can manually override a muscle's percentage ("Fresh Muscle Groups") — [Fitbod Help: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery); [Fitbod blog](https://fitbod.me/blog/muscle-recovery/); [Sensai](https://www.sensai.fit/blog/hevy-vs-strong-vs-fitbod-vs-jefit)
- **Hevy** supports RPE per set in the free tier — [Sensai Hevy review 2026](https://www.sensai.fit/blog/hevy-review-2026)
- **Visible** combines objective HRV with subjective symptom check-ins for its score. **HRV4Training** combines physiology with subjective "feel" in its daily advice — [ME Association](https://meassociation.org.uk/?p=135851); [Altini](https://medium.com/@altini_marco/on-heart-rate-variability-hrv-and-readiness-394a499ed05b)

### Inferences
- Best practice: let manual entries flow into the **same** load and trend visual (Gentler's Activity Path, Strava's Fitness chart) instead of a separate list. Show clearly which source (HR, power or RPE) drives a score, because Strava's silent source switching is what caused user confusion.
- A labelled 0–10 RPE scale with short descriptors and body cues (Gentler) is the most user-friendly HR-free effort input. Combining RPE × duration (session-RPE) is the likely model under the hood, but that is not confirmed from primary sources for either app.

### Gaps
- Exact formulas for how Strava and Gentler convert RPE into load are not published in the sources found.
- Whether Bevel or Athlytic accept manual RPE entries was not confirmed.

## 3. Strength-training UX (Hevy, Strong, Fitbod, Bevel Strength Builder)

### Takeaway
Strong is consistently rated the fastest, most minimal logger (about two taps per set, auto rest timer). Hevy wins on value, social features and breadth (previous-performance hints, live PR banner, muscle charts, notes, Strava sync). Fitbod is the "plans for you" app with a per-muscle recovery heat map. Users want speed plus visible progress, without being forced into AI suggestions.

### Cited Findings
- **Strong**: "Starting a workout takes two taps. Logging a set takes two taps." The rest timer starts automatically after each set. No coaching, no social feed and no recovery tracking — "just clean, fast logging". It does not handle runs, cycling or HIIT. The free tier allows unlimited logging but only 3 custom routines. Pro is about $29.99/year — [RepReturn Strong review](https://repreturn.com/strong-app-review/); [Strong "love" page](https://strong.app/love); [lifting-apps review](https://lifting-apps.pages.dev/reviews/strong)
- A speed-first competitor argues that Strong still needs more taps than necessary (contested, vendor) — [Setgraph](https://setgraph.app/articles/best-strong-app-alternatives-(2025))
- **Hevy**: shows your previous performance in-workout to beat it. Tracks PRs, estimated 1RM and volume. Free features: set types, supersets, RPE, rest timers, plate calculator, **live PR banner**, Monthly Report, muscle-group charts. Pro: unlimited routines (free is capped at 4), warm-up calculator, sets per muscle group, Hevy Trainer — [Hevy Help 2026 features guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727-Everything-You-Need-to-Know-About-the-Hevy-App-2026-Features-Guide); [Sensai Hevy review](https://www.sensai.fit/blog/hevy-review-2026); [Push/Pull](https://push-pull.app/blog/push-pull-vs-hevy)
- Hevy Apple Watch app: workout sync, set tracking, complications, HR tracking, duration timers. 2026 updates: Strava sync with full set details (July) and exercise-, routine- and workout-level notes (October, "one of your most requested features") — [Hevy July 2026](https://www.hevyapp.com/community-updates/july-26/); [Hevy October 2026](https://www.hevyapp.com/community-updates/october-26/)
- Hevy pricing conflicts: most often $2.99/month, $23.99/year or $74.99 lifetime, with other figures quoted — [Sensai](https://www.sensai.fit/blog/hevy-review-2026); [RepReturn](https://repreturn.com/hevy-app-review/)
- Comparison consensus: Hevy is the value pick with social features, Strong the leanest logger, Fitbod the choice for recovery-based programming. One source says Fitbod requires confirming AI suggestions on each set — [Sensai](https://www.sensai.fit/blog/hevy-vs-strong-vs-fitbod-vs-jefit); [Stronger blog](https://www.strongermobileapp.com/blog/best-workout-tracker-apps)
- **Fitbod**: a Recovery tab with a composite **muscle fatigue heat map** (front and back body), and workouts generated from fresh muscles. Reviewers stress that the map is a model, not a measurement — [Fitbod Help](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery); [Gainframe review](https://gainframe.app/blog/fitbod-app-review/)
- **Bevel Strength Builder**: free, 700+ exercises, "visualizes progress nicely". A **spiderweb/radar graph** shows how much each body part has been worked lately, but a reviewer notes accuracy issues such as undercrediting upper-back work — [Autonomous.ai engineer review](https://www.autonomous.ai/ourblog/bevel-app-review); [Neura Health](https://neura.health/insight/bevel-health-app-in-depth-review)

### Inferences
- The patterns users value most are: inline "previous" values per set (Hevy and Strong both use them); one-tap set completion that auto-starts the rest timer (Strong); a celebratory but non-blocking live PR banner (Hevy); and routines/templates. Muscle visuals (Fitbod heat map, Bevel radar) are loved as overview but distrusted when they misattribute muscles, so let users override them (Fitbod "Fresh Muscle Groups").
- Free-tier routine caps (Strong 3, Hevy 4) are a common friction point.

### Gaps
- No Reddit (r/weightroom, r/naturalbodybuilding) threads surfaced in search, so user sentiment comes from review blogs and vendor pages. Independent first-hand UX testimony is thin.
- Whether Hevy has a body-map heatmap (as opposed to charts) was not confirmed.

## 4. Design analysis: what makes them exceptional, and common complaints

### Takeaway
Gentler Streak is the reference for **tone and humane design**: compassionate framing, an Activity Path instead of rings, rest as part of the plan, and illustration. Apple recognised it with an ADA 2024 Social Impact award. Bevel is the reference for **polish and motion**: card stories, springy transitions and a free-tier generosity that reviewers repeatedly praise. The most common complaints across the category are paywalls and upselling (Strava, Welltory, Bevel Pro), demotivating or opaque numbers (Rise sleep debt, Strava score shifts, Athlytic overtraining risk) and too many scores (Altini's critique).

### Cited Findings
- **Gentler Streak**: Apple's "Behind the Design" frames it as fitness approached with "humanity". It meets people where they are, with suggestions, statistics and encouragement for all skill levels, and rest is treated as part of the path. It won the ADA Social Impact award in 2024 — [Apple Developer](https://developer.apple.com/news/?id=3m0ht22s); [Sketch blog "How Gentler Streak brings kindness to fitness"](https://www.sketch.com/blog/gentler-streak/)
- TechRadar: "This fitness app shows Apple a better way to track my workouts" (the Activity Path versus rigid ring streaks) — [TechRadar](https://www.techradar.com/computing/websites-apps/this-fitness-app-shows-apple-a-better-way-to-track-my-workouts)
- Gentler Streak widgets with health metrics (February 2025) and a yearly Activity Recap that is free for everyone (a Spotify-Wrapped-style retention pattern) — [9to5Mac](https://9to5mac.com/2025/02/14/gentler-streak-new-widgets/); [BGR](https://www.bgr.com/2052282/apple-watch-fitness-recap-2025-on-iphone/)
- **Bevel**: a design showcase notes horizontal page swipes, springy card slides and interactive story cards that walk users through their stats — [60fps.design](https://60fps.design/apps/bevel)
- Bevel reviewers: "polished UI that brings metrics like strain, sleep, and recovery to life"; "genuinely good" design; a polished interface that makes complex measurements easier to scan; "beautiful and easy to use" — [mwm.ai summary](https://mwm.ai/apps/bevel-all-in-one-health-app/6456176249); [Autonomous.ai](https://www.autonomous.ai/ourblog/bevel-app-review); [HealthAppInsider](https://www.healthappinsider.com/en/reviews/bevel-review)
- Yahoo/Lifehacker framing: "Bevel (sort of) makes your Apple Watch act like a Whoop" — [Yahoo](https://currently.att.yahoo.com/att/bevel-sort-makes-apple-watch-230000160.html)
- **Welltory** is praised for clear visuals and educational context, with criticism of upselling and a steep HRV learning curve — [Product Hunt](https://www.producthunt.com/products/welltory/reviews?page=1)
- **Rise**: a constant sleep-debt display can be "daunting", an example of a metric that demotivates when framed as debt — [Mattress Clarity](https://www.mattressclarity.com/sleep-app-reviews/rise-app-review)
- **Strava**: paywall complaints (2024 Play Store analysis), a March 2026 r/Strava thread asking "Is Strava pushing subscriptions too hard?", a May 2026 post objecting to Athlete Intelligence rating prompts on unstructured runs, and a reported lack of an AI opt-out (secondhand, September 2026) — [Kimola](https://kimola.com/reports/strava-app-feedback-analysis-unveil-user-insights-google-play-en-us-152323); [r/Strava snapshot](https://reddit.sentinel-team.org/subreddits/Strava/snapshots/2026-03-11T14%3A04%3A24.991849Z); [r/Strava snapshot](https://reddit.sentinel-team.org/subreddits/Strava/snapshots/2026-05-14T03%3A53%3A37.037914Z); [ITERA blog](https://blog.itera.ac.id/?p=7117)
- **Too many numbers**: Altini argues that blended readiness scores create false precision and double-count poor sleep. HRV4Training uses a colour-coded normal range plus one short message instead — [Altini](https://medium.com/@altini_marco/data-interpretation-issues-in-wearables-a3942cae82ac)
- **Strong** is loved for minimalism; its own testimonials page emphasises simplicity and speed — [Strong](https://strong.app/love)

### Inferences
- Patterns that reviewers praise and that would transfer to a design:
  1. One clear daily recommendation in plain language (Bevel's strain target, Gentler's suggestions, Visible's 1–5).
  2. A personal-baseline band ("your normal range") instead of absolute numbers (HRV4Training, Athlytic's 60-day baseline).
  3. Compassionate framing that counts rest as progress (Gentler) instead of punitive streaks or debt (Rise).
  4. Story-like card flows with spring animation for daily briefing (Bevel).
  5. Widgets and yearly recaps for retention (Gentler).
  6. Behaviour-outcome correlations with journaling (Bearable, Welltory, Bevel journal).
- Anti-patterns: aggressive upselling or core metrics behind paywalls, scores that shift silently after algorithm changes (Strava September 2025), unexplained composite numbers, and AI prompts users cannot switch off.

### Gaps
- No primary detail on Gentler Streak's colour palette, typography or its mascot/illustration style. Searches for the Behind the Design interview content did not surface specifics, and WebFetch was blocked.
- No 9to5Mac/MacStories/The Verge design review of Bevel found. Bevel design praise comes from user and blog reviews plus 60fps.design.
- Haptics are not documented in any source found for these apps.
- Athlytic's visual design (gauges and rings) is not documented in the sources found.
