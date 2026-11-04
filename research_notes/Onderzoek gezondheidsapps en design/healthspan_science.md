# Healthspan / biologische leeftijd: how consumer wearables do it, the evidence per input, and a defensible scoring design

Research note (2026-11-04). Method: WebSearch only. WebFetch failed on whoop.com, assets.ctfassets.net (WHOOP white paper PDF) and pmc.ncbi.nlm.nih.gov because those hosts are outside this session's allowed network domains. So most numbers come from search-result abstracts and snippets, not from full texts I read. Figures marked "(snippet)" or "(secondary)" should be checked against the primary paper before they go into the app's UI or documentation.

---

## 1. WHOOP Healthspan (WHOOP Age, Pace of Aging; launched May 2025)

### Takeaway
WHOOP Healthspan turns 9 behaviour and fitness inputs into two outputs:
- **WHOOP Age**, built from about 6 months of data.
- **Pace of Aging**, built from the last 30 days and updated weekly. The scale runs from about −1x to 3x, where 1x means ageing at the same speed as the calendar.

Each input is compared with literature-based all-cause-mortality associations and expert-set "reference values". The exact formula and weights are not published, and validation so far is WHOOP's own white paper, not independent peer review.

### Cited Findings
- **Launch.** Healthspan launched with WHOOP 5.0 / WHOOP MG on 8 May 2025 as a longevity feature — [BusinessWire press release](https://www.businesswire.com/news/home/20250508546933/en); [WHOOP 2025 launches](https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/)
- **The 9 inputs** are grouped as sleep, strain/activity and fitness:
  - sleep: sleep consistency, hours of sleep
  - activity: time in HR zones 1–3, time in HR zones 4–5, strength activity time, daily steps
  - fitness: VO2max, resting heart rate, lean body mass

  Source: [WHOOP podcast 323, "The 9 Metrics That Make Up Your Healthspan" (Emily Capodilupo)](https://www.whoop.com/us/en/thelocker/podcast-323-the-9-metrics-that-make-up-your-healthspan-with-emily-capodilupo/). Note: lean body mass appears on only some WHOOP pages; others list only the first 8 — [WHOOP Healthspan page](https://www.whoop.com/us/en/thelocker/healthspan/)
- **What HRV does not feed.** HRV is NOT one of the 9 inputs, even though WHOOP measures it. WHOOP also says its Advanced Labs blood biomarkers do not feed WHOOP Age or Pace of Aging — [peaktrack explainer (secondary)](https://peaktrack.co.za/blogs/news/whoop-age-explained)
- **Time windows.** WHOOP Age uses about 6 months of data. Pace of Aging shows where the last 30 days would move that long-term number. Pace of Aging updates weekly, on Sunday — [WHOOP Healthspan page](https://www.whoop.com/us/en/thelocker/healthspan/); [peaktrack (secondary)](https://peaktrack.co.za/blogs/news/whoop-age-explained)
- **Pace of Aging scale.** 1.0x = ageing at the calendar rate; 0 = WHOOP Age holding steady; negative = "reversing" (a younger short-term trend). The reported range is about −1.0x to 3.0x — [WHOOP Healthspan page](https://www.whoop.com/us/en/thelocker/healthspan/); [themetabolicjournal comparison (secondary)](https://themetabolicjournal.com/compare/whoop-age-vs-garmin-fitness-age)
- **Reference values.** WHOOP's reference values are expert-based optima, not population averages. Example for sleep consistency: the reference value is 85, so a member averaging 60 "looks older" and one averaging 95 "looks younger" — [WHOOP Healthspan page / sleep consistency description (search snippet)](https://www.whoop.com/us/en/thelocker/healthspan/)
- **Basis and partner.** WHOOP says the model is "grounded in all-cause mortality" and in peer-reviewed literature on healthy ageing, and was created in partnership with the Buck Institute — [WHOOP Healthspan White Paper page](https://www.whoop.com/us/en/thelocker/Healthspan-Data-Meets-Longevity/); [White paper PDF copy](https://bengreenfieldlife.com/wp-content/uploads/2025/09/WHOOP_2025_White_Paper_Healthspan.pdf.pdf)
- **WHOOP's own validation** (company analysis, not independent):
  - Members with 2 or more chronic-condition groups had higher WHOOP Ages relative to their chronological age.
  - An "early insights" table shows an expected WHOOP Age change of about −1.6 years in both a US reference group and the WHOOP cohort.

  Source: [White paper PDF (assets.ctfassets.net)](https://assets.ctfassets.net/rbzqg6pelgqa/3ONehqJslbqxI7CQlwGjfT/36429d6f66940e1fd866a772ed5bfc93/WHOOP_2025_White_Paper_Healthspan__6_.pdf), via search snippet
- **Naming borrowed from DunedinPACE.** "Pace of Aging" comes from the Dunedin Study (Belsky/Moffitt). DunedinPoAm modelled change in 18 biomarkers over 12 years in n=954 people. DunedinPACE is a later DNA-methylation clock. These are blood-DNAm measures, a different modality from wearables — [DunedinPoAm, PMC7282814](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7282814/); [Belsky DunedinPACE slides](https://biomarker-network.isr.umich.edu/wp-content/uploads/2023/08/BELSKY-DunedinPACE.pdf)
- **Which metric weighs most.** A WHOOP 2025 year-in-review podcast discusses why VO2max carries so much weight. A Reddit user reported that sleep consistency of 76% cost about 1.1 years (anecdote) — [WHOOP podcast 353](https://www.whoop.com/us/en/thelocker/podcast-353-whoop-2025-year-in-review/)
- **Access.** Peak/Life tiers only; not available to users under 18; "wellness purposes only" — [WHOOP 2025 launches](https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/)
- **Critique.** A Medium post argues:
  - WHOOP's hazard ratios come from population studies, but its adjustments are calibrated on its own (healthier, more affluent) member base.
  - No confidence intervals are reported to users.

  Source: [Medium, "Is WHOOP really able to measure your healthspan?"](https://medium.com/@cailbhe/is-whoop-really-able-to-measure-your-healthspan-728b88e69175)

### Inferences
- **How the architecture probably works.** For each metric, WHOOP compares the user's value with a reference optimum. It maps the difference to a mortality hazard ratio from the literature, converts that HR into "years", and sums the results across metrics. WHOOP Age is that sum plus chronological age, computed over a 6-month window.
- **What Pace of Aging probably is.** It looks like the slope of WHOOP Age per calendar year implied by the 30-day window: 1x = +1 year per year, 0 = flat. For our app this can be copied as a "rolling 30-day vs 180-day" design.
- **Why HRV is left out.** HRV is very individual and is measured differently across devices. That supports keeping it out of a years-based score, or at most giving it a small weight.
- **The suggested Dunedin/PhenoAge link is unpublished.** No published head-to-head between WHOOP Age and DunedinPACE or Levine PhenoAge was found, despite marketing that suggests a link. A claim of validation against an epigenetic clock should not be repeated without a source.

### Gaps
- Exact weights, functional forms, per-metric HRs and caps used by WHOOP. The white paper PDF could not be fetched.
- Whether WHOOP shows a range or uncertainty around WHOOP Age. No evidence was found that it does.
- Whether a Dunedin/PhenoAge collaboration exists. I found no source confirming one.

---

## 2. Other consumer implementations

### Takeaway
Most competitors measure one physiological domain rather than a multi-behaviour mortality model:
- **Garmin Fitness Age:** mainly VO2max against age and sex norms, plus RHR, BMI or body fat, and vigorous activity.
- **Oura Cardiovascular Age:** pulse-wave-velocity estimated from the PPG waveform.
- **Apple:** Cardio Fitness category labels from VO2max, with no age conversion.

None has independent peer-reviewed validation of the age output.

### Cited Findings
- **Garmin Fitness Age**
  - Compares the VO2max estimate with typical values for age groups of the same sex. Newer models also use activity intensity (vigorous minutes), RHR, and body fat % or BMI. It may not update if weight or body-fat data is more than 7 days old. Free in Garmin Connect — [Garmin Rumors explainer (secondary)](https://garminrumors.com/how-garmin-fitness-age-works-and-how-to-lower-it/); [the5krunner](https://the5krunner.com/garmin-features/physiology/fitness-age/)
  - The exact weighting of vigorous minutes is not documented. The feature saturates for already-fit athletes and has no published validation — [the5krunner](https://the5krunner.com/garmin-features/physiology/fitness-age/); [lordofthesmartrings comparison](https://www.lordofthesmartrings.com/wearable-biological-age-comparison-guide/)
- **Oura Cardiovascular Age**
  - Uses estimated pulse wave velocity and age-related changes in the shape of the PPG pulse waveform. Oura does not measure PWV directly.
  - Needs at least 14 nights of data in the past 30 days to calibrate.
  - Shown as an age that can be up to about ±years from chronological age.

  Source: [Oura support: Cardiovascular Age](https://support.ouraring.com/hc/en-us/articles/28451491040019-Cardiovascular-Age). The claim that it also integrates RHR, HRV and SpO2 comes only from third-party sources, not Oura — [lordofthesmartrings](https://www.lordofthesmartrings.com/wearable-biological-age-comparison-guide/)
- **Apple**
  - Cardio Fitness is shown as a VO2max value with categories (Low / Below Average / Above Average / High) against age and sex norms, with no age conversion. Supported range is 14–65 ml/kg/min. Third-party apps turn it into a "fitness age" — [Body Insights app (secondary)](https://bodyinsightsapp.com/features/fitness-age); [joincentury blog](https://joincentury.app/blog/2026-07-22-fitness-age-vs-chronological-age)
  - Reports of an Apple "Health Age" (2026) conflict and could not be confirmed — [longevity-germany fact-check](https://longevity-germany.com/en/articles/apple-s-longevity-tab-and-health-age-fact-checked)
- **Ultrahuman and others.** Oura Cardiovascular Age, WHOOP Age and Ultrahuman's Age Metric are composites of HRV, RHR and activity, so they are proxies, not epigenetic clocks. WHOOP and Ultrahuman ages fluctuate more than Oura's — [longevityhub 2026 guide](https://pro.longevityhub.net/guides/wearables); [onetwenty guide](https://onetwenty.com/blog/best-wearable-for-longevity)
- **Google Health API (relevant to our app)**
  - Has a **`daily-vo2-max`** data type (Daily record, filter `daily_vo2_max`, activity_and_fitness scope), plus separate `vo2_max` (Sample) and `run_vo2_max` types — [Google Health API data types](https://developers.google.com/health/data-types)
  - Background: Fitbit's Cardio Fitness Score is estimated from RHR, age, sex, weight and other personal data. It is returned as a *range* unless GPS runs give a single value, always in ml/kg/min — [Fitbit Web API VO2max](https://dev.fitbit.com/build/reference/web-api/cardio-fitness-score/get-vo2max-summary-by-date/)

### Inferences
- **The Fitbit/Google VO2max is partly derived from RHR and weight.** Using both VO2max and RHR as separate inputs therefore double-counts. Shrink one of them, or combine them.
- **Presentation patterns to borrow:**
  - Garmin: an age plus "how to lower it" tips.
  - Apple: categories relative to age and sex norms.
  - Oura: a minimum data requirement before showing a number.
  - WHOOP: a long window for the level plus a short window for direction.

### Gaps
- Samsung (Energy Score / any bio-age), Bevel, Gentler Streak, the Humanity app (H-age / "pace of ageing") and Tally: the search returned nothing usable on their methods.
- Garmin's official formula and the weight of vigorous minutes.

---

## 3. Evidence per input (all-cause mortality), with effect sizes

### Takeaway
By effect size and evidence quality:
1. **Cardiorespiratory fitness (VO2max)** has the strongest and steepest association: elite vs low HR about 0.20.
2. **Daily steps, MVPA, muscle-strengthening and grip strength** have robust but smaller associations. Steps: about 47% lower risk at 7,000 vs 2,000 per day. Strength training: about 15% lower risk at 30–60 min/week.
3. **Sleep regularity** has a moderate association that can be larger than for sleep duration. Sleep duration is J-shaped with its minimum around 7–8 h.
4. **RHR** is modest, about 9–17% per 10 bpm.
5. **HRV** predicts mortality, but mostly in clinical or older populations, and with device-specific measurement problems.

All of this evidence is observational and confounded, and the inputs are strongly intercorrelated.

### Cited Findings

**VO2max / cardiorespiratory fitness**
- **Mandsager 2018, JAMA Netw Open** (Cleveland Clinic treadmill cohort, about 122k adults):
  - Risk-adjusted mortality: elite vs low HR 0.20 (95% CI 0.16–0.24); elite vs high HR 0.77 (0.63–0.95). Equivalently, low vs elite HR about 5.04 (4.10–6.20).
  - Groups were age- and sex-specific percentiles; "low" = below the 25th percentile.
  - No upper limit of benefit was found.

  Source: [JAMA Netw Open](https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2707428); [ResearchGate PDF](https://www.researchgate.net/publication/328420900_Association_of_Cardiorespiratory_Fitness_With_Long-term_Mortality_Among_Adults_Undergoing_Exercise_Treadmill_Testing)
- **Kokkinos 2022, JACC 80(6)** ("CRF and mortality risk across the spectra of age, race and sex"; US veterans):
  - Lowest risk at about 14 METs for both men (HR 0.24) and women (HR 0.23) vs the least-fit group.
  - No increased risk at extreme fitness.

  Source: [JACC abstract](https://www.jacc.org/doi/abs/10.1016/j.jacc.2022.05.031); [ResearchGate](https://www.researchgate.net/publication/362406048_Cardiorespiratory_Fitness_and_Mortality_Risk_Across_the_Spectra_of_Age_Race_and_Sex)
- **Per MET.** Reviews give about 10–30% lower mortality per 1-MET increment. One JACC paper reports 12% lower all-cause mortality per +1 MET. That attribution is uncertain — [JACC 2018 CRF in healthy men and women](https://www.jacc.org/doi/10.1016/j.jacc.2018.08.2166)
- **Change in fitness.** Kokkinos et al. JACC 2023 (81(12):1137–47) found that changes in CRF of ≥1 MET were associated with proportionate inverse changes in mortality, regardless of baseline fitness — [Scribd copy of JACC 2023](https://www.scribd.com/document/635935026/j-jacc-2023-01-027)

**Daily steps**
- **Paluch 2022, Lancet Public Health** (15 cohorts, about 47k adults):
  - Quartile medians were 3,553 / 5,801 / 7,842 / 10,901 steps per day.
  - Mortality benefit plateaus at about 6,000–8,000 steps per day for adults aged 60+ and about 8,000–10,000 for those under 60.

  Source: [Lancet Public Health](https://thelancet.com/journals/lanpub/article/PIIS2468-2667(21)00302-9/fulltext); [EurekAlert](https://www.eurekalert.org/news-releases/945267)
- **Ding 2025, Lancet Public Health** (57 studies, 35 cohorts):
  - 7,000 vs 2,000 steps per day: 47% lower all-cause mortality (14 studies, I²=36%).
  - Curve flattens at about 5,000–7,000 steps.
  - Evidence certainty: moderate.

  Source: [Lancet Public Health 2025](https://www.thelancet.com/journals/lanpub/article/PIIS2468-2667(25)00164-1/fulltext); [EurekAlert](https://www.eurekalert.org/news-releases/1092050)
- **Saint-Maurice 2020, JAMA** (NHANES accelerometry): 8,000 vs 4,000 steps per day HR about 0.49; 12,000 vs 4,000 HR about 0.35. These figures are from a secondary source and need checking against doi:10.1001/jama.2020.1382 — [sahha.ai review (secondary)](https://sahha.ai/blog/10000-steps-myth/)

**MVPA / heart-rate zone minutes**
- **Arem 2015, JAMA Intern Med** (6 cohorts, about 661k people), compared with no leisure-time activity:

  | Activity level | Mortality risk |
  |---|---|
  | Some activity, below the guideline | 20% lower |
  | 1–2× guideline (150–300 MET-h…) | 31% lower |
  | 2–3× guideline | 37% lower |
  | 3–5× guideline | 39% lower (HR 0.61; plateau) |

  No harm was seen at 10× the guideline — [Arem 2015 PDF](https://projects.iq.harvard.edu/files/bparc/files/arem_2015_leisure_time_mvpa.pdf)
- **Lee 2022, Circulation** (about 116k US adults, 30-year follow-up), mutually adjusted:
  - Meeting the vigorous guideline (75–149 min/week) vs no vigorous activity: HR 0.81 (0.76–0.87).
  - 2–4× the vigorous guideline: 21–23% lower risk. 2–4× the moderate guideline: 26–31% lower risk.
  - Lowest risk at about 150–600 min/week.

  Source: [Circulation](https://www.ahajournals.org/doi/10.1161/CIRCULATIONAHA.121.058162); [AHA newsroom](https://newsroom.heart.org/news/new-study-finds-lowest-risk-of-death-was-among-adults-who-exercised-150-600-minutesweek)
- **Wen 2011, Lancet** (Taiwan, about 416k people): about 92 min/week (about 15 min/day) vs inactive gave HR 0.86 (0.81–0.91) for all-cause mortality and about 3 years longer life expectancy (men 2.55, women 3.10) — [natap summary of Lancet paper](https://www.natap.org/2011/HIV/081911_03.htm); [Bloomberg](https://www.bloomberg.com/news/articles/2011-08-15/exercising-15-minutes-a-day-adds-3-years-to-life-expectancy-study-finds)

**Muscle-strengthening activity and strength**
- **Momma 2022, BJSM 56(13):755–763** (meta-analysis of cohorts):
  - Muscle-strengthening activity: 10–17% lower all-cause mortality, CVD, cancer and diabetes. All-cause RR about 0.85 (0.79–0.93).
  - Maximum risk reduction at about 30–60 min/week.
  - J-shaped curve: the benefit of higher volumes is unclear.

  Source: [PMC9209691](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9209691/); [hospitalhealthcare summary](https://hospitalhealthcare.com/specialisms/cardiovascular/muscle-strengthening-activities-reduces-cvd-cancer-and-all-cause-mortality-risk/)
- **Leong 2015, Lancet (PURE, about 140k people in 17 countries):** per 5 kg *lower* grip strength, all-cause mortality HR 1.16 (1.13–1.20). Grip strength was a stronger predictor than systolic blood pressure — [Healio](https://www.healio.com/news/cardiology/20150821/grip-strength-may-predict-risk-for-mortality-cvd); [Medical News Today](https://www.medicalnewstoday.com/articles/293880)

**Resting heart rate**
- **Zhang et al. 2016, CMAJ** (general-population meta-analysis): per +10 bpm RR 1.09 (1.07–1.12) for all-cause mortality and 1.08 (1.06–1.10) for CV mortality. Risk rises above about 60 bpm — [CMAJ](https://www.cmaj.ca/content/188/3/E53)
- **Aune et al. 2017, NMCD** (dose-response meta-analysis, 87 studies): about 17% higher all-cause mortality per +10 bpm — [ResearchGate](https://www.researchgate.net/publication/316344510_Resting_heart_rate_and_the_risk_of_cardiovascular_disease_total_cancer_and_all-cause_mortality_-_A_systematic_review_and_dose-response_meta-analysis_of_prospective_studies)
- **One null cohort.** A single middle-aged Swedish male cohort found HR 1.02 per 10 bpm (not significant), so the evidence is not uniform — [PMC8166682](https://pmc.ncbi.nlm.nih.gov/articles/PMC8166682/)

**HRV**
- **Jarczok et al. 2022, Neurosci Biobehav Rev** (32 studies, about 38k participants, healthy and patient populations): HRV predicts all-cause mortality. 5-minute RMSSD in the lowest quartile corresponds to about 56% higher risk of death — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0149763422003967)
- **CVD patients.** In patients with cardiovascular disease, lower SDNN and LF power predict all-cause death — [ResearchGate meta-analysis](https://www.researchgate.net/publication/336088956_Heart_Rate_Variability_and_Risk_of_All-Cause_Death_and_Cardiovascular_Events_in_Patients_With_Cardiovascular_Disease_A_Meta-Analysis_of_Cohort_Studies)
- **Not comparable across devices.** Apple at 45 ms and Oura at 70 ms is not a contradiction, because devices measure HRV differently — [longevityhub](https://pro.longevityhub.net/guides/wearables)

**Sleep duration**
- **Duration and mortality are J/U-shaped**, with the lowest risk at about 7 h:
  - [Liu et al. 2017, JAHA dose-response](https://www.ahajournals.org/doi/10.1161/JAHA.117.005947)
  - [Shen et al. 2016, Sci Rep](https://www.nature.com/articles/srep21480)
  - [da Silva/Jike 2018, 40-cohort meta-regression, Sleep Med Rev](https://www.sciencedirect.com/science/article/abs/pii/S1087079216000216)
- **2025 meta-analysis**, vs 7–8 h: under 7 h HR 1.14 (1.10–1.18); 9 h or more HR 1.34 (1.26–1.42). Long sleep is partly reverse causation (illness) — [PMC12181477](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12181477/)

**Sleep regularity (Sleep Regularity Index, SRI)**
- **Windred et al. 2024, SLEEP 47(1):zsad253** (UK Biobank accelerometry, n=60,977, about 7 days of wear):
  - The top four SRI quintiles (SRI 71.6–98.5) had 20–48% lower all-cause mortality than the bottom quintile (SRI < 71.6).
  - Most vs least regular quintile: HR about 0.70 fully adjusted (0.52 adjusted only for age, sex and ethnicity).
  - SRI predicted mortality better than sleep duration.

  Source: [OUP Sleep](https://academic.oup.com/sleep/article/47/1/zsad253/7280269); [Flinders PDF](https://researchnow-admin.flinders.edu.au/ws/portalfiles/portal/136820007/Windred_Sleep_P2024.pdf); [Manchester repository](https://research.manchester.ac.uk/en/publications/sleep-regularity-is-a-stronger-predictor-of-mortality-risk-than-s/)
- **Cribb et al. 2023** (UK Biobank, n=88,975, 3,010 deaths, mean follow-up 7.1 years): non-linear SRI–mortality curve, with HRs relative to the median SRI of 60; the most irregular had the highest risk — [eLife](https://elifesciences.org/articles/88359); [PMC10153326](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10153326/)
- **HR 1.53 at the 5th SRI percentile vs the median** is reported only by a secondary blog and is unverified. It probably comes from Cribb 2023, not Windred — [longlevity blog (secondary)](https://longlevity.ai/blog/sleep-regularity-vs-duration/)

### Inferences
**Suggested relative weighting for our score** (my synthesis, not a source), from strongest to weakest:
1. VO2max
2. Steps and MVPA (combine them; they overlap)
3. Strength training
4. Sleep regularity
5. Sleep duration
6. RHR (overlaps with VO2max, since the Fitbit VO2max uses RHR)
7. HRV (low weight, or display-only)

**Plateaus.** Most curves plateau: steps at about 7–10k, MVPA at 3–5× the guideline (about 450–750 min/week), strength at about 60 min/week. Use saturating functions so extreme behaviour does not keep "reducing age".

**How the inputs map to the app's data:**
- **Strength.** Strength-training *frequency/time* (Momma) is the defensible strength input. Top sets per exercise could support a relative-strength trend, but there is no mortality curve for "top-set kg". Grip strength (Leong) is the closest validated measure, and the app has no grip data.
- **Lean body mass** (a WHOOP input) needs a body-fat scale. The evidence for lean mass in particular was not covered in these searches.

### Gaps
Unverified or missing:
- Exact pooled quartile HRs in Paluch 2022 (from memory about Q2 0.60, Q3 0.55, Q4 0.47 vs Q1; unverified).
- Exact Saint-Maurice 2020 HRs.
- Kokkinos 2022 sample size and per-MET HR (n≈750k recalled, unverified).
- Ekelund 2019 BMJ accelerometer sedentary-time dose-response (search returned nothing).
- Global BMI Mortality Collaboration 2016 BMI/waist figures (search returned nothing).
- Evidence on lean body mass, and on Zone-2-specific benefit beyond total MVPA (I found no zone-2-specific mortality data).
- Whether accelerometer-derived SRI from about 7 days transfers to wearable SRI computed over weeks.

---

## 4. Converting relative risks to "years", communicating uncertainty, and criticism

### Takeaway
The defensible conversion is the **rate-advancement-period / Gompertz approach**. Adult all-cause mortality roughly doubles every about 8 years (Gompertz slope b ≈ 0.085–0.09 per year), so a hazard ratio HR corresponds to "years of age" Δ = ln(HR)/b.
- Example: HR 0.86 gives about −1.8 years.
- Example: HR 0.20 gives about −19 years, which needs capping.

This is a risk-equivalent age, not life expectancy. Show it with ranges and on long windows, and expect the main criticisms: opacity, vendor-only validation, double counting of correlated inputs, noisy VO2max estimates, and population-average HRs applied to individuals.

### Cited Findings
- **Wen 2011, an example where both numbers are available.** HR 0.86 for about 15 min/day of activity was reported as about 3 years of extra life expectancy. A Gompertz rate-advancement conversion of the same HR gives about 1.8 years, and the two are different quantities — [natap/Lancet](https://www.natap.org/2011/HIV/081911_03.htm)
- **Gompertz figures need a citation.** The Gompertz slope (about 0.085 per year, mortality doubling about every 8 years) is standard demography, but no search result confirmed it. Cite a demography source before publishing; see Gaps.
- **WHOOP critique:** no confidence intervals; HRs taken from populations but calibrated on members — [Medium critique](https://medium.com/@cailbhe/is-whoop-really-able-to-measure-your-healthspan-728b88e69175)
- **General critiques of consumer age scores:**
  - Mostly vendor white papers or company-tied studies.
  - VO2max estimates are imprecise yet often carry the most weight.
  - "Biological age is astrology" framing.

  Sources: [twopct "Biological Age is Astrology"](https://www.twopct.com/p/biological-age-is-astrology); [joincentury](https://joincentury.app/blog/2026-07-16-biological-age-wearables)
- **Opaque formulas.** Neither WHOOP nor Garmin publishes its formula. Scores rest on population averages that may not fit an individual. Different brands give conflicting ages — [lordofthesmartrings](https://www.lordofthesmartrings.com/wearable-biological-age-comparison-guide/); [daliahealth](https://daliahealth.com/blog/how-apps-calculate-biological-age)
- **WHOOP accuracy.** Peer-reviewed evidence on WHOOP covers sensor accuracy, not the age score — [medRxiv systematic review 2024](https://www.medrxiv.org/content/10.1101/2024.01.04.24300784.full.pdf)

### Inferences — proposed transparent scoring design for the app

All of this section is my design proposal, built on the cited evidence above.

**Step 1. Per-input "risk-equivalent years".** For each input *i*, take the user's rolling value (mean over the window), look up log-HR versus a reference value from a piecewise-linear dose-response curve, and convert:

Δyears_i = ln(HR_i) / 0.087

Suggested anchors (verify before release):

| Input | Reference point | Dose-response anchor | Shape / cap |
|---|---|---|---|
| VO2max | Age/sex 50th percentile | Per MET (3.5 ml/kg/min) about HR 0.88 (12%) | Cap at ±elite/low (HR 0.20 to 5.0 is too extreme; cap Δ at about ±6–8 years and shrink, because the Fitbit estimate is noisy) |
| Steps | 7,000/day | 2,000 → 7,000 ≈ HR 0.53 | Log-linear, flat above about 10k |
| MVPA minutes (zones 2–5 weighted 1× moderate, 2× vigorous) | 150 min/week moderate-equivalent | Arem curve | Flat above about 600 |
| Strength | 60 min/week (or ≥2 sessions) | 0 → 30–60 min/week ≈ RR 0.85 | No further benefit beyond that |
| Sleep duration | 7–8 h | <7 h HR 1.14; ≥9 h HR 1.34 (likely reverse causal: down-weight) | J-shape |
| Sleep regularity (SRI over 14–28 days) | — | Most vs least regular quintile HR 0.70 | Interpolate by quintile |
| RHR | 60 bpm | Per 10 bpm HR 1.09 | — |
| HRV | Personal baseline | — | Trend display only, no years |
| BMI / body fat | — | — | Optional; add once the BMI/waist evidence is sourced |

**Step 2. Correct for overlap and avoid double counting.** These inputs are correlated (VO2max with RHR, steps with MVPA, sleep duration with regularity), and the HRs come from models that already partially adjust for each other.
- Option (a): sum within domains and take the maximum or mean across overlapping items.
- Option (b): multiply the total by a shrinkage factor (for example 0.5–0.7).
- Cap the total at about ±10–12 years.

Document the choice in the UI ("how is this calculated").

**Step 3. Two windows, like WHOOP.**
- "Biologische leeftijd" = chronological age + ΣΔ over a 90–180-day window.
- "Tempo van verouderen" = 1 + (ΣΔ_30d − ΣΔ_180d)/(30/365) is too noisy. Better: compare the 30-day score with the 180-day score and show it as a multiplier clipped to −1…3, updated weekly.
- Require minimum data (for example ≥14 days of sleep in the last 30, like Oura's calibration rule) before showing anything.

**Step 4. Show uncertainty.**
- Propagate HR confidence intervals, for example by Monte Carlo over ln(HR) ± 1.96·SE, and show "35 (32–38)".
- Round to 0.5 years.
- Show a per-input bar chart (a "waterfall" of years gained or lost) so the score is transparent and actionable, with a "largest lever" message.

**Step 5. Wording.** Use "risk-equivalent age / leefstijl-leeftijd" rather than "biologische leeftijd", or explicitly state that it is based on population associations (observational), is not a diagnosis, and does not predict lifespan.

**Step 6. Personal app data.**
- Strength log: count sessions and minutes per week for the score. Use top-set progression only for a separate "strength trend" with no years attached.
- Body weight and fat: optional lean-mass or BMI input with low weight.

### Gaps
- No search result confirmed the Gompertz slope/doubling-time constant or the term "rate advancement period" (Brenner et al.). Cite a demography source (for example Gompertz-law reviews or Brenner 1993 on rate advancement periods) before publishing the method.
- No independent peer-reviewed validation of any consumer bio-age score (WHOOP, Oura, Garmin, Ultrahuman) was found.
- Systematic critique articles from The Verge or Wired, and Peter Attia's commentary, were not retrieved in this session.
