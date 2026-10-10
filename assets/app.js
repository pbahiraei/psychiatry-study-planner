(() => {
      'use strict';

      const PSP_CONFIG = window.PsychiatryStudyPlannerConfig || {};
      let saveQueue = Promise.resolve();
      let persistenceError = '';
      const weekTitles = [
        "Psychiatric Assessment","Psychiatric Emergencies","Psychosis","Psychosis Treatment",
        "Bipolar Disorders","Depressive Disorders","Antipsychotic Pharmacology","Antidepressants",
        "Mood Stabilizers","Somatic Treatments","Delirium","Major Neurocognitive Disorders",
        "Anxiety Disorders","OCD","Trauma","Personality Disorders","Substance Use Disorders",
        "Substance Use Disorders","Consultation-Liaison","Child and Adolescent Psychiatry",
        "Child and Adolescent Psychiatry","Sleep/Sexual/Eating Disorders","Psychotherapy","Integration & Review"
      ];

      const kaplanChapters = [
        "Chapter 1: Psychiatric Assessment","Chapter 25: Emergency Psychiatry","Chapter 5: Psychotic Disorders",
        "Chapter 5: Treatment of Psychosis","Chapter 6: Bipolar and Related Disorders","Chapter 7: Depressive Disorders",
        "Chapter 21: Antipsychotic Drugs","Chapter 21: Antidepressants","Chapter 21: Mood Stabilizers",
        "Chapter 22: Somatic Treatments","Chapter 3: Delirium","Chapter 3: Neurocognitive Disorders",
        "Chapter 8: Anxiety Disorders","Chapter 9: OCD and Related Disorders","Chapter 10: Trauma Disorders",
        "Chapter 19: Personality Disorders","Chapter 4: Substance-Related Disorders","Chapter 4: Substance-Related Disorders",
        "Chapter 25: Consultation-Liaison","Chapter 2: Child Psychiatry","Chapter 2: Adolescent Psychiatry",
        "Chapter 15: Sleep, Sexual and Eating Disorders","Chapter 23: Psychotherapy","Comprehensive Review"
      ];

      const topicSeeds = {
        1:["Psychiatric interview","Mental Status Examination","Diagnostic formulation"],
        5:["Bipolar I disorder","Bipolar II disorder","Mania and hypomania","Lithium monitoring"],
        12:["Cognitive assessment","Alzheimer disease","Vascular dementia","Behavioral symptoms"],
        24:["Diagnostic framework","Differential diagnosis","Medication pearls","Case notebook review"]
      };

      const safeNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, safeNumber(value)));
      const asArray = value => Array.isArray(value) ? value : [];

      const makeWeeks = () => weekTitles.map((title, index) => {
        const number = index + 1;
        const topics = topicSeeds[number] || [
          `${title}: core concepts`,
          `${title}: clinical assessment`,
          `${title}: management and review`
        ];
        return {
          number,
          title,
          kaplan: kaplanChapters[index] || "Kaplan",
          objective: number === 5
            ? "تشخیص mania و افتراق آن از psychosis، personality disorder و substance-induced states."
            : "مطالعه و مرور مباحث این هفته",
          tasman: number === 5 ? ["Mood regulation", "Biological basis of bipolar disorder"] : ["Clinical reasoning", "Focused review"],
          targetHours: 8,
          topics
        };
      });

      let activeView = "dashboard";
      let selectedWeekNumber = 1;
      let selectedDisorderId = "";
      let weeks = makeWeeks();
      let tasks = [];
      let sessions = [];
      let topicChecks = {};
      let notesByWeek = {};
      let currentRotation = {
        name: "Inpatient Psychiatry",
        focus: "Assessment, mood disorders, risk formulation, and medication monitoring",
        startDate: "",
        endDate: "",
        notes: ""
      };
      let knowledge = {
        disorders: [
          {id:"disorder-schizophrenia", title:"Schizophrenia", category:"Psychiatric disorder", details:"Definition, clinical features, diagnostic criteria, differential diagnosis, assessment, treatment, clinical pearls, and personal notes.", links:"Positive symptoms; Negative symptoms; Antipsychotics; EPS; Metabolic monitoring"},
          {id:"disorder-bipolar", title:"Bipolar disorder", category:"Psychiatric disorder", details:"Mania and hypomania; longitudinal history; differential diagnosis; mood stabilizers; monitoring.", links:"Mania; Lithium; Lamotrigine; Mood stabilizers"},
          {id:"disorder-mdd", title:"Major depressive disorder", category:"Psychiatric disorder", details:"Clinical features, risk assessment, differential diagnosis, treatment options, and follow-up.", links:"Anhedonia; Suicidal ideation; Sertraline; CBT"},
          {id:"disorder-ptsd", title:"PTSD", category:"Psychiatric disorder", details:"Trauma-related symptoms, assessment, differential diagnosis, and evidence-based treatment.", links:"Trauma; Anxiety; CBT"},
          {id:"disorder-ocd", title:"OCD", category:"Psychiatric disorder", details:"Obsessions, compulsions, functional impact, assessment, and treatment.", links:"Sertraline; CBT; Exposure and response prevention"}
        ],
        medications: [
          {id:"med-lithium", title:"Lithium", category:"Mood stabilizer", details:"Mechanism: editable. Indications: bipolar disorder; augmentation in depression. Dosing notes: record individualized plan. Monitoring: serum level, renal function, thyroid function. Adverse effects: tremor, hypothyroidism, toxicity. Warnings: toxicity risk and interactions; follow local guidance.", links:"Bipolar disorder; Depression; Tremor; Renal monitoring; Thyroid monitoring"},
          {id:"med-sertraline", title:"Sertraline", category:"SSRI antidepressant", details:"Mechanism: editable. Indications: depression, anxiety disorders, OCD, PTSD. Dosing notes: record individualized plan. Monitoring: response, tolerability, interactions, and suicidality where clinically indicated. Adverse effects: GI effects, activation, sexual dysfunction.", links:"Depression; OCD; PTSD; Anxiety"},
          {id:"med-olanzapine", title:"Olanzapine", category:"Antipsychotic", details:"Mechanism: editable. Indications: selected psychotic and bipolar presentations. Monitoring: weight, glucose, lipids, movement symptoms, and other clinically indicated parameters.", links:"Schizophrenia; Bipolar disorder; Metabolic monitoring"},
          {id:"med-lamotrigine", title:"Lamotrigine", category:"Mood stabilizer", details:"Mechanism: editable. Indications: selected bipolar maintenance contexts. Dosing notes: gradual titration; review product guidance and rash precautions.", links:"Bipolar disorder; Mood stabilizers"}
        ],
        cases: [], pearls: [], articles: [], flashcards: [], differentialNotes: ""
      };
      let timerSeconds = 25 * 60;
      let timerHandle = null;
      let persistenceReady = false;
      let migrationDirty = false;

      function safeWeeks() {
        return asArray(weeks).length ? asArray(weeks) : makeWeeks();
      }
      function getWeek(number) {
        const validNumber = clamp(number, 1, 24);
        const found = safeWeeks().find(item => safeNumber(item.number) === validNumber);
        return found || {
          number: validNumber,
          title: "Week " + validNumber,
          topics: [],
          objective: "مطالعه و مرور مباحث این هفته",
          kaplan: "Kaplan",
          tasman: "",
          targetHours: 8
        };
      }
      function getTopics(week) {
        return asArray(week && week.topics);
      }
      function minutesForWeek(number) {
        return asArray(sessions)
          .filter(session => safeNumber(session.weekNumber) === safeNumber(number))
          .reduce((total, session) => total + Math.max(0, safeNumber(session.minutes)), 0);
      }
      function minutesForToday() {
        const today = new Date().toISOString().slice(0, 10);
        return asArray(sessions)
          .filter(session => String(session.loggedAt || '').slice(0, 10) === today)
          .reduce((total, session) => total + Math.max(0, safeNumber(session.minutes)), 0);
      }

      function hoursForWeek(number) {
        return Math.round((minutesForWeek(number) / 60) * 10) / 10;
      }
      function topicProgress(week) {
        const topics = getTopics(week);
        if (!topics.length) return 0;
        const complete = topics.filter((topic, index) => topicChecks[week.number + "-" + index]).length;
        return clamp(Math.round((complete / topics.length) * 100));
      }
      function weeklyProgress(week) {
        const topicValue = topicProgress(week);
        const hourValue = clamp((hoursForWeek(week.number) / Math.max(1, safeNumber(week.targetHours, 8))) * 100);
        return clamp(Math.round((topicValue + hourValue) / 2));
      }
      function formatHours(hours) {
        return safeNumber(hours).toFixed(1);
      }
      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
          "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
        }[char]));
      }

      // External medical resources. Query URLs are defined only for sources with a known public search endpoint.
      const medicalSearchSources = {
        rapidrx: { label: "RapidRx", url: "https://rapidrx.ir/", mode: "copy" },
        // Medscape's reference search endpoint accepts q and plr=ref.
        medscape: { label: "Medscape", url: "https://search.medscape.com/search/?q=", suffix: "&plr=ref&page=1", mode: "query" },
        pillix: { label: "Pillix · بانک دارویی ایران", url: "https://pillix.ir/medicine", mode: "copy" },
        scholar: { label: "Google Scholar · مقالات علمی", url: "https://scholar.google.com/scholar?q=", mode: "query" },
        google: { label: "Google · جست‌وجوی وب", url: "https://www.google.com/search?q=", mode: "query" }
      };

      function openExternalResource(url) {
        const opened = window.open(url, "_blank");
        if (opened) {
          try { opened.opener = null; } catch (_) {}
          return true;
        }
        return false;
      }

      async function copyMedicalSearchTerm(value) {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return true;
          }
        } catch (_) {}
        try {
          const temporary = document.createElement("textarea");
          temporary.value = value;
          temporary.setAttribute("readonly", "");
          temporary.style.position = "fixed";
          temporary.style.opacity = "0";
          temporary.style.pointerEvents = "none";
          document.body.appendChild(temporary);
          temporary.select();
          const copied = document.execCommand("copy");
          temporary.remove();
          return Boolean(copied);
        } catch (_) {
          return false;
        }
      }

      function handleOpenWeek(number) {
        const requested = safeNumber(number, 5);
        const valid = requested >= 1 && requested <= 24 ? requested : 5;
        selectedWeekNumber = valid;
        activeView = "weekly-view";
        render();
      }

      function navigate(viewName) {
        const views = ["dashboard","study-plan","weekly-view","daily-log","tasks","timer","analytics","notes","rotations","weekly-review","settings","knowledge-map","disorders","disorder-profile","medications","cases","pearls","articles","flashcards","differential","search"];
        activeView = views.includes(viewName) ? viewName : "dashboard";
        render();
      }

      function renderSidebar() {
        const links = [
          ["dashboard","داشبورد"],["study-plan","برنامه مطالعه"],["daily-log","گزارش مطالعه"],["tasks","Taskها"],
          ["timer","تایمر"],["analytics","تحلیل پیشرفت"],["notes","یادداشت‌ها"],["rotations","Rotation"],
          ["weekly-review","مرور هفتگی"],["knowledge-map","نقشه دانش"],["disorders","اختلالات"],["medications","داروها"],["cases","Caseهای بالینی"],["pearls","Psychiatry Pearls"],["articles","مقالات"],["flashcards","فلش‌کارت‌ها"],["differential","Differential Diagnosis"],["search","جستجو"],["settings","تنظیمات"]
        ];
        return `
          <aside class="sidebar">
            <div class="brand"><strong>Psychiatry</strong><br>Study Planner</div>
            <p class="subtle" style="margin:8px 0 0">Residency workspace</p>
            <nav class="nav-list" aria-label="Primary navigation">
              ${links.map(([view, label]) => `<button type="button" class="nav-btn ${activeView === view ? "active" : ""}" data-nav="${view}">${label}</button>`).join("")}
            </nav>
            <div class="card pad" style="margin-top:28px;background:var(--teal-soft);box-shadow:none">
              <div class="label">Active plan</div>
              <strong style="display:block;margin-top:5px">Foundation · 24 weeks</strong>
              <p class="subtle" style="margin:7px 0 0">Reliable fallback curriculum is always available.</p>
            </div>
          </aside>
        `;
      }

      function dashboardView() {
        const current = getWeek(selectedWeekNumber);
        const todayMinutes = minutesForToday();
        const todayProgress = clamp((todayMinutes / 90) * 100);
        const currentHours = hoursForWeek(current.number);
        const currentTasks = tasksForWeek(current.number);
        const completedTasks = currentTasks.filter(task => task.done).length;
        return `
          <section>
            <article class="card pad medical-search-card" style="margin-bottom:16px">
              <div class="medical-search-heading">
                <div class="medical-search-mark" aria-hidden="true">⌕</div>
                <div>
                  <h2>جست‌وجوی سریع منابع پزشکی</h2>
                  <p class="subtle">یک عبارت بنویس و منبع موردنظرت را انتخاب کن؛ بدون API یا اشتراک اضافه.</p>
                </div>
              </div>
              <form id="medical-search-form" class="medical-search-form">
                <label class="medical-search-query-label" for="medical-search-query">عبارت جست‌وجو</label>
                <input id="medical-search-query" class="input" type="search" name="query" placeholder="مثلاً lithium toxicity یا serotonin syndrome" autocomplete="off" required>
                <label class="medical-search-query-label" for="medical-search-source">جست‌وجو در منبع</label>
                <div class="medical-search-actions">
                  <select id="medical-search-source" class="input" name="source">
                    <option value="rapidrx">RapidRx · پروتکل‌های بالینی</option>
                    <option value="medscape">Medscape · جست‌وجوی مستقیم در Reference</option>
                    <option value="pillix">Pillix · بانک دارویی ایران</option>
                        <option value="scholar">Google Scholar · مقالات علمی (جست‌وجوی مستقیم)</option>
                    <option value="google">Google · جست‌وجوی وب</option>
                  </select>
                  <button class="btn btn-primary medical-search-submit" type="submit">جست‌وجو <span aria-hidden="true">↗</span></button>
                </div>
                <p id="medical-search-status" class="medical-search-status" role="status" aria-live="polite">در Medscape، Google و Google Scholar عبارت مستقیماً جست‌وجو می‌شود. در RapidRx و بانک دارویی ایران، سایت باز می‌شود و عبارت کپی می‌شود تا آن‌جا Paste کنی.</p>
              </form>
            </article>
            <div class="grid metrics">
              <article class="card pad metric"><span class="label">Today</span><strong>${todayMinutes} <small class="subtle">/ 90 min</small></strong><div class="progress"><span style="width:${todayProgress}%"></span></div><p class="subtle">${Math.max(0, 90 - todayMinutes)} minutes remaining</p></article>
              <article class="card pad metric"><span class="label">Current week</span><strong>Week ${current.number}</strong><p class="subtle">${escapeHtml(current.title)}</p></article>
              <article class="card pad metric"><span class="label">Study hours</span><strong>${formatHours(currentHours)} <small class="subtle">/ ${safeNumber(current.targetHours,8)} h</small></strong><div class="progress"><span style="width:${clamp((currentHours / Math.max(1,safeNumber(current.targetHours,8))) * 100)}%"></span></div></article>
              <article class="card pad metric"><span class="label">Tasks</span><strong>${completedTasks}/${currentTasks.length}</strong><p class="subtle">Completed in Week ${current.number}</p></article>
            </div>

            <div class="grid two-col" style="margin-top:16px">
              <article class="card pad">
                <div class="section-head"><div><h2>Week ${current.number} Tasks</h2><p class="subtle" style="margin:4px 0 0">Your academic priorities for the selected week.</p></div><button type="button" class="btn" data-nav="tasks">Manage Tasks</button></div>
                ${currentTasks.length ? currentTasks.map(task => `
                  <div class="task task-action-row">
                    <label class="row" style="align-items:flex-start;flex:1;min-width:0">
                      <input type="checkbox" data-task="${escapeHtml(task.id)}" ${task.done ? "checked" : ""}>
                      <span><strong>${escapeHtml(task.title)}</strong><br><span class="subtle">${task.done ? "Completed" : "Open"}</span></span>
                    </label>
                    <button type="button" class="btn btn-small btn-danger" data-delete-task="${escapeHtml(task.id)}" aria-label="Delete task">Delete</button>
                  </div>
                `).join("") : `<div class="empty">No tasks for this week yet.</div>`}
              </article>
              <article class="card pad">
                <div class="section-head"><div><h2>Week ${current.number} — ${escapeHtml(current.title)}</h2><p class="subtle" style="margin:4px 0 0">Core curriculum focus</p></div><button type="button" class="btn btn-primary" data-open-week="${current.number}">Open Week</button></div>
                <p class="subtle">${escapeHtml(current.objective)}</p>
                <div class="progress"><span style="width:${weeklyProgress(current)}%"></span></div>
                <div class="row between subtle" style="margin-top:8px"><span>${weeklyProgress(current)}% progress</span><span>${formatHours(currentHours)} / ${safeNumber(current.targetHours,8)} hours</span></div>
              </article>
            </div>

            <section class="card pad" style="margin-top:16px">
              <div class="section-head"><div><h2>Quick Actions</h2><p class="subtle" style="margin:4px 0 0">Direct actions without routes or hidden sections.</p></div></div>
              <div class="row" style="flex-wrap:wrap">
                <button type="button" class="btn btn-primary" data-open-week="${current.number}">Open Week ${current.number}</button>
                <button type="button" class="btn" data-nav="study-plan">Browse Study Plan</button>
                <button type="button" class="btn" data-nav="timer">Start Timer</button>
                <button type="button" class="btn" data-log-current>Log Study Session</button>
              </div>
            </section>
          </section>
        `;
      }

      function studyPlanView() {
        return `
          <section>
            <article class="card pad">
              <div class="section-head"><div><h2>24-week Study Plan</h2><p class="subtle" style="margin:4px 0 0">Open a week to edit its title, manage topics and tasks, or swap its content with another week.</p></div></div>
              <div class="row" style="flex-wrap:wrap">
                ${[1,5,12,24].map(number => `<button type="button" class="btn btn-primary" data-open-week="${number}">Week ${number}</button>`).join("")}
              </div>
            </article>
            <div class="week-grid">
              ${safeWeeks().map(week => {
                const progress = weeklyProgress(week);
                const completeHours = formatHours(hoursForWeek(week.number));
                const taskCount = tasksForWeek(week.number).length;
                const doneTasks = tasksForWeek(week.number).filter(task => task.done).length;
                return `
                  <button type="button" class="week-card" data-open-week="${week.number}" aria-label="Open Week ${week.number}: ${escapeHtml(week.title)}">
                    <span class="tag">Week ${week.number}</span>
                    <h3>${escapeHtml(week.title)}</h3>
                    <p class="subtle" style="margin:0 0 10px">${escapeHtml(week.kaplan)}</p>
                    <div class="progress"><span style="width:${progress}%"></span></div>
                    <div class="row between subtle" style="margin-top:8px"><span>${progress}% progress</span><span>${completeHours}/${safeNumber(week.targetHours,8)} h</span></div>
                    <div class="row between subtle" style="margin-top:7px"><span>${doneTasks}/${taskCount} tasks done</span><span class="btn btn-small btn-primary">Open Week</span></div>
                  </button>
                `;
              }).join("")}
            </div>
          </section>
        `;
      }

      function weeklyView() {
        const selected = getWeek(selectedWeekNumber);
        try {
          const week = safeWeeks().find(item => safeNumber(item.number) === safeNumber(selectedWeekNumber)) || selected;
          const topics = getTopics(week);
          const tasmanTopics = asArray(week.tasman);
          const relatedSessions = asArray(sessions).filter(session => safeNumber(session.weekNumber) === safeNumber(week.number));
          const relatedTasks = tasksForWeek(week.number);
          const progress = weeklyProgress(week);
          return `
            <section>
              <article class="card pad">
                <div class="row between" style="align-items:flex-start;flex-wrap:wrap">
                  <div>
                    <span class="tag">Week ${week.number}</span>
                    <h2 style="font-family:Fraunces,serif;font-size:28px;margin:9px 0 6px">Week ${week.number} — ${escapeHtml(week.title)}</h2>
                    <p class="subtle" style="max-width:850px;margin:0">${escapeHtml(week.objective || "مطالعه و مرور مباحث این هفته")}</p>
                  </div>
                  <button type="button" class="btn" data-back-plan>Back to Study Plan</button>
                </div>
                <div class="grid three-col" style="margin-top:20px">
                  <div><span class="label">Kaplan chapter</span><p>${escapeHtml(week.kaplan || "Kaplan")}</p></div>
                  <div><span class="label">Tasman topics</span><p>${escapeHtml(tasmanTopics.join(" · ") || "Focused complementary review")}</p></div>
                  <div><span class="label">Progress</span><p><strong>${progress}%</strong> · ${formatHours(hoursForWeek(week.number))}/${safeNumber(week.targetHours,8)} hours</p></div>
                </div>
                <div class="progress"><span style="width:${progress}%"></span></div>
              </article>

              <div class="grid two-col" style="margin-top:16px">
                <article class="card pad">
                  <div class="section-head"><div><h2>Checklist topics</h2><p class="subtle" style="margin:4px 0 0">Check, add, or remove focused review items.</p></div></div>
                  <div style="display:grid;gap:9px">
                    ${topics.length ? topics.map((topic,index) => `
                      <div class="topic ${topicChecks[week.number + "-" + index] ? "done" : ""}">
                        <input type="checkbox" data-topic-week="${week.number}" data-topic-index="${index}" ${topicChecks[week.number + "-" + index] ? "checked" : ""}>
                        <span style="min-width:0"><strong>${escapeHtml(topic)}</strong><br><span class="subtle">Focused review item</span></span>
                        <button type="button" class="btn btn-small btn-danger topic-delete" data-delete-topic-week="${week.number}" data-delete-topic-index="${index}">Delete</button>
                      </div>
                    `).join("") : `<div class="empty">No predefined topics yet. Add a focused topic below.</div>`}
                  </div>
                  <div style="margin-top:16px">
                    <label class="label" for="custom-topic">Add Custom Topic</label>
                    <div class="row" style="margin-top:7px">
                      <input id="custom-topic" class="input" placeholder="e.g. Relapse prevention planning">
                      <button type="button" class="btn btn-primary" data-add-topic>Add Custom Topic</button>
                    </div>
                  </div>
                </article>

                <article class="card pad">
                  <div class="section-head"><div><h2>Week Settings</h2><p class="subtle" style="margin:4px 0 0">Rename this week or swap its content with another week.</p></div></div>
                  <label class="label" for="week-title-input">Week title</label>
                  <input id="week-title-input" class="input" style="margin-top:7px" value="${escapeHtml(week.title)}">
                  <button type="button" class="btn btn-primary" style="margin-top:10px" data-save-week-title>Save Title</button>
                  <div class="divider" style="margin:18px 0"></div>
                  <label class="label" for="swap-week-select">Swap content with</label>
                  <div class="row" style="margin-top:7px;align-items:stretch">
                    <select id="swap-week-select" class="input">
                      ${safeWeeks().filter(item => item.number !== week.number).map(item => `<option value="${item.number}">Week ${item.number} — ${escapeHtml(item.title)}</option>`).join("")}
                    </select>
                    <button type="button" class="btn" data-swap-week>Swap</button>
                  </div>
                  <p class="subtle" style="margin-top:9px">The swap keeps the week numbers in place and moves the curriculum, notes, topics, tasks, and study sessions with their week.</p>
                </article>
              </div>

              <div class="grid two-col" style="margin-top:16px">
                <article class="card pad">
                  <div class="section-head"><div><h2>Week Tasks</h2><p class="subtle" style="margin:4px 0 0">Create academic tasks specifically for Week ${week.number}.</p></div></div>
                  <div class="row" style="margin-bottom:12px;align-items:stretch">
                    <input id="new-week-task" class="input" placeholder="e.g. Review lithium interactions">
                    <button type="button" class="btn btn-primary" data-add-task data-task-week="${week.number}">Add Task</button>
                  </div>
                  ${relatedTasks.length ? relatedTasks.map(task => `
                    <div class="task task-action-row">
                      <label class="row" style="align-items:flex-start;flex:1;min-width:0">
                        <input type="checkbox" data-task="${escapeHtml(task.id)}" ${task.done ? "checked" : ""}>
                        <span><strong>${escapeHtml(task.title)}</strong><br><span class="subtle">${task.done ? "Completed" : "Open"}</span></span>
                      </label>
                      <button type="button" class="btn btn-small btn-danger" data-delete-task="${escapeHtml(task.id)}">Delete</button>
                    </div>
                  `).join("") : `<div class="empty">No tasks for this week yet.</div>`}
                </article>

                <article class="card pad">
                  <div class="section-head"><div><h2>Notes</h2><p class="subtle" style="margin:4px 0 0">A concise week-specific learning note.</p></div></div>
                  <label class="label" for="week-notes">Study notes</label>
                  <textarea id="week-notes" class="textarea" style="margin-top:7px">${escapeHtml(notesByWeek[week.number] || "")}</textarea>
                  <button type="button" class="btn" style="margin-top:10px" data-save-note>Save Notes</button>
                  <div class="notice" style="margin-top:16px"><strong>Objective</strong><br><span class="subtle">${escapeHtml(week.objective || "مطالعه و مرور مباحث این هفته")}</span></div>
                </article>
              </div>

              <div class="grid two-col" style="margin-top:16px">
                <article class="card pad">
                  <div class="section-head"><div><h2>Related study sessions</h2><p class="subtle" style="margin:4px 0 0">Delete a session if it was logged by mistake.</p></div></div>
                  ${relatedSessions.length ? relatedSessions.map(session => `
                    <div class="task task-action-row">
                      <span style="min-width:0"><strong>${safeNumber(session.minutes)} min · ${escapeHtml(session.resource)}</strong><br><span class="subtle">${escapeHtml(session.note || "Focused study session")}</span></span>
                      <button type="button" class="btn btn-small btn-danger" data-delete-session="${escapeHtml(session.id)}">Delete</button>
                    </div>
                  `).join("") : `<div class="empty">No sessions logged for this week yet.</div>`}
                </article>
                <article class="card pad">
                  <div class="section-head"><div><h2>Study session</h2><p class="subtle" style="margin:4px 0 0">Add a 30-minute Kaplan study block.</p></div></div>
                  <p class="subtle">This action adds a session to Week ${week.number} and immediately updates the displayed progress.</p>
                  <button type="button" class="btn btn-primary" data-log-current>Log Study Session</button>
                </article>
              </div>
            </section>
          `;
        } catch (error) {
          console.error("Weekly view error:", error);
          return weeklyFallback(selectedWeekNumber);
        }
      }

      function weeklyFallback(number) {
        const weekNumber = clamp(number, 1, 24);
        return `
          <section class="card pad">
            <span class="tag">Week ${weekNumber}</span>
            <h2 style="font-family:Fraunces,serif;margin:10px 0">جزئیات هفته آماده نیست</h2>
            <p class="subtle">Week ${weekNumber} is still available to continue planning and logging study time.</p>
            <div class="row" style="flex-wrap:wrap;margin-top:16px">
              <button type="button" class="btn" data-back-plan>بازگشت به Study Plan</button>
              <button type="button" class="btn btn-primary" data-reload-week>بارگذاری دوباره</button>
            </div>
          </section>
        `;
      }

      function genericView(title, description, body) {
        return `<section class="card pad"><h2 style="font-family:Fraunces,serif;margin-top:0">${title}</h2><p class="subtle">${description}</p>${body}</section>`;
      }

      function renderView() {
        switch (activeView) {
          case "dashboard": return dashboardView();
          case "study-plan": return studyPlanView();
          case "weekly-view": return weeklyView();
          case "daily-log":
            return genericView("Daily Log", "Study sessions currently stored in this workspace.",
              `<div>${asArray(sessions).slice().reverse().map(session => `<div class="task task-action-row"><span><strong>Week ${safeNumber(session.weekNumber)} · ${safeNumber(session.minutes)} min</strong><br><span class="subtle">${escapeHtml(session.resource)}${session.note ? " · " + escapeHtml(session.note) : ""}</span></span><button type="button" class="btn btn-small btn-danger" data-delete-session="${escapeHtml(session.id)}">Delete</button></div>`).join("") || `<div class="empty">No study sessions yet.</div>`}</div>`);
          case "tasks":
            return genericView("Tasks", "Create tasks for any week, then mark or remove them.",
              `<div class="card pad" style="margin-bottom:16px;box-shadow:none">
                <div class="row" style="align-items:stretch;flex-wrap:wrap">
                  <input id="new-task-title" class="input" placeholder="e.g. Review emergency psychiatry notes" style="flex:1 1 260px">
                  <select id="new-task-week" class="input" style="flex:0 1 220px">${safeWeeks().map(week => `<option value="${week.number}" ${week.number === selectedWeekNumber ? "selected" : ""}>Week ${week.number} — ${escapeHtml(week.title)}</option>`).join("")}</select>
                  <button type="button" class="btn btn-primary" data-add-task>Add Task</button>
                </div>
              </div>
              ${safeWeeks().map(week => {
                const weekTasks = tasksForWeek(week.number);
                if (!weekTasks.length) return "";
                return `<section class="card pad" style="margin-top:12px;box-shadow:none"><div class="section-head"><div><h3 style="font-family:Fraunces,serif;margin:0">Week ${week.number} — ${escapeHtml(week.title)}</h3></div><button type="button" class="btn btn-small" data-open-week="${week.number}">Open Week</button></div>${weekTasks.map(task => `<div class="task task-action-row"><label class="row" style="align-items:flex-start;flex:1;min-width:0"><input type="checkbox" data-task="${escapeHtml(task.id)}" ${task.done ? "checked" : ""}><span><strong>${escapeHtml(task.title)}</strong><br><span class="subtle">${task.done ? "Completed" : "Open"}</span></span></label><button type="button" class="btn btn-small btn-danger" data-delete-task="${escapeHtml(task.id)}">Delete</button></div>`).join("")}</section>`;
              }).join("") || `<div class="empty">No tasks yet. Create one above.</div>`}`);
          case "timer":
            return genericView("Focus Timer", "A simple in-page focus timer.", `<div class="timer" id="timer-display">${formatTimer(timerSeconds)}</div><div class="row" style="justify-content:center"><button type="button" class="btn btn-primary" data-timer-toggle>${timerHandle ? "Pause" : "Start"}</button><button type="button" class="btn" data-timer-reset>Reset</button></div>`);
          case "analytics":
            return analyticsView();
          case "notes":
            return genericView("Notes", "Week notes remain accessible from each weekly workspace.", `<div class="notice"><strong>Current Week ${selectedWeekNumber} note</strong><br><span class="subtle">${escapeHtml(notesByWeek[selectedWeekNumber] || "No note saved yet.")}</span></div><div style="margin-top:12px"><button type="button" class="btn btn-primary" data-open-week="${selectedWeekNumber}">Open Week ${selectedWeekNumber}</button></div>`);
          case "rotations": return rotationsView();
          case "knowledge-map": return knowledgeMapView();
          case "disorders": return entityView("disorders");
          case "disorder-profile": return disorderProfileView();
          case "medications": return entityView("medications");
          case "cases": return entityView("cases");
          case "pearls": return entityView("pearls");
          case "articles": return entityView("articles");
          case "flashcards": return flashcardsView();
          case "differential": return differentialView();
          case "search": return searchView();
          case "weekly-review":
            return genericView("Weekly Review", "Review progress before planning the selected week.", `<p><strong>Week ${selectedWeekNumber}</strong> is currently ${weeklyProgress(getWeek(selectedWeekNumber))}% complete.</p><button type="button" class="btn btn-primary" data-open-week="${selectedWeekNumber}">Open Current Week</button>`);
          case "settings":
            return genericView("Settings", "Saved planner data is restored safely after the interface is available.", `<div class="notice"><strong>Workspace storage</strong><br><span class="subtle">${persistenceError ? escapeHtml(persistenceError) : (persistenceReady ? "Workspace is synced to your WordPress account." : "Loading your saved workspace…")}</span></div>`);
          default:
            activeView = "dashboard";
            return dashboardView();
        }
      }


      const entityLabels = {
        disorders: {title:"Disorder Profiles", singular:"Disorder", placeholder:"e.g. Panic disorder", desc:"Personal disorder pages: definition, epidemiology, risk factors, neurobiology, clinical features, diagnostic criteria, differential, assessment, treatment, pearls, and notes."},
        medications: {title:"Medication Knowledge Database", singular:"Medication", placeholder:"e.g. Risperidone", desc:"Record category, mechanism, indications, dosing notes, monitoring, adverse effects, warnings, and related disorders/cases."},
        cases: {title:"Case-Based Learning", singular:"Clinical case", placeholder:"e.g. First episode psychosis in young adult", desc:"Keep de-identified learning cases. Do not enter patient-identifying information."},
        pearls: {title:"My Psychiatry Pearls", singular:"Pearl", placeholder:"e.g. Rule out delirium before diagnosing psychosis in an older adult", desc:"Short practical learning points, tagged for quick retrieval."},
        articles: {title:"Articles & Evidence", singular:"Article", placeholder:"Article title", desc:"Track literature, summaries, clinical relevance, links, and personal notes."}
      };
      function entityArray(type) { return asArray(knowledge[type]); }
      function rotationsView() {
        return genericView("Current Rotation", "Edit your current clinical rotation and its learning focus. This is saved with your planner.", `
          <form id="rotation-form" class="grid two-col">
            <label><span class="label">Rotation name</span><input class="input" name="name" required value="${escapeHtml(currentRotation.name || "")}" placeholder="e.g. Consultation-Liaison Psychiatry"></label>
            <label><span class="label">Focus</span><input class="input" name="focus" value="${escapeHtml(currentRotation.focus || "")}" placeholder="Key clinical learning goals"></label>
            <label><span class="label">Start date</span><input class="input" type="date" name="startDate" value="${escapeHtml(currentRotation.startDate || "")}"></label>
            <label><span class="label">End date</span><input class="input" type="date" name="endDate" value="${escapeHtml(currentRotation.endDate || "")}"></label>
            <label style="grid-column:1/-1"><span class="label">Rotation notes</span><textarea class="textarea" name="notes">${escapeHtml(currentRotation.notes || "")}</textarea></label>
            <div><button class="btn btn-primary" type="submit">Save Rotation</button></div>
          </form>
          <div class="notice" style="margin-top:16px"><strong>Current rotation:</strong> ${escapeHtml(currentRotation.name || "Not set")}<br><span class="subtle">${escapeHtml(currentRotation.focus || "")}</span></div>`);
      }
      function knowledgeMapView() {
        const groups = [
          ["disorders","Psychiatric disorders"],["medications","Medications"],["cases","Clinical cases"],
          ["pearls","Clinical pearls"],["articles","Articles & evidence"]
        ];
        const all = groups.flatMap(([type,label]) => entityArray(type).map(item => ({...item,type,label})));
        const nodes = all.map((item,i) => `<button type="button" class="knowledge-node kn-${item.type}" data-nav="${item.type === "disorders" ? "disorder-profile" : item.type}" ${item.type === "disorders" ? `data-disorder-id="${escapeHtml(item.id)}"` : ""} title="${escapeHtml(item.details || item.links || "")}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.label)}</small>${item.links ? `<small class="knowledge-links">↔ ${escapeHtml(item.links)}</small>` : ""}</button>`).join("");
        return genericView("Psychiatry Knowledge Map", "Your personal clinical knowledge network. Nodes represent disorders, medications, cases, pearls, and articles; related concepts are stored in each entry's links field.", `
          <div class="knowledge-legend">${groups.map(([type,label])=>`<span class="knowledge-legend-item"><i class="legend-${type}"></i>${label}</span>`).join("")}</div>
          <div class="knowledge-graph">${nodes || `<div class="empty">No knowledge nodes yet. Add disorders, medications, cases, pearls, or articles to grow your map.</div>`}</div>
          <div class="notice" style="margin-top:14px"><strong>Example connection</strong><p style="margin:6px 0 0">Schizophrenia → positive/negative symptoms → antipsychotics → EPS and metabolic monitoring. Add connections in each entry's “Related concepts / links” field.</p></div>
          <div class="row" style="flex-wrap:wrap;margin-top:14px">${groups.map(([type,label])=>`<button class="btn" type="button" data-nav="${type}">Manage ${label}</button>`).join("")}</div>`);
      }
      function disorderProfileView() {
        const item=entityArray("disorders").find(d=>d.id===selectedDisorderId);
        if(!item)return genericView("Disorder Profile","Choose a disorder from the knowledge map.",`<button class="btn" data-nav="disorders">Browse disorders</button>`);
        return genericView(item.title,"Personal disorder knowledge page. Keep clinical notes educational and de-identified.",`
          <div class="row" style="flex-wrap:wrap;margin-bottom:12px"><span class="tag">Psychiatric disorder</span><button class="btn" data-nav="disorders" data-profile-edit="${escapeHtml(item.id)}">Edit profile</button><button class="btn" data-nav="knowledge-map">Back to Knowledge Map</button></div>
          <article class="card pad" style="box-shadow:none"><h3>Clinical knowledge & personal notes</h3><div style="white-space:pre-wrap;line-height:1.7">${escapeHtml(item.details || "Add definition, epidemiology, risk factors, neurobiology, clinical features, diagnostic criteria, differential diagnosis, assessment, treatment, psychotherapy, clinical pearls, and personal notes.")}</div><hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><h3>Related concepts</h3><p>${escapeHtml(item.links || "No related concepts recorded yet.")}</p></article>
          <div style="margin-top:14px"><button class="btn btn-primary" data-nav="disorders" data-profile-edit="${escapeHtml(item.id)}">Edit disorder page</button></div>`);
      }
      function entityView(type) {
        const cfg = entityLabels[type];
        if (!cfg) return "";
        const list = entityArray(type);
        const formFields = type === "disorders" ? `
          <label><span class="label">Profile / sections</span><textarea class="textarea" name="details" placeholder="Definition, epidemiology, risk factors, neurobiology, clinical features, DSM criteria, differential, assessment, treatment, psychotherapy, pearls, personal notes…"></textarea></label>
          <label><span class="label">Related concepts / links</span><input class="input" name="links" placeholder="Symptoms; medications; assessments; cases"></label>` :
        type === "medications" ? `
          <label><span class="label">Category</span><input class="input" name="category" placeholder="e.g. SSRI, mood stabilizer"></label>
          <label><span class="label">Knowledge details</span><textarea class="textarea" name="details" placeholder="Mechanism, indications, dosing notes, monitoring, adverse effects, warnings…"></textarea></label>
          <label><span class="label">Related disorders / cases / links</span><input class="input" name="links" placeholder="Bipolar disorder; depression; case IDs"></label>` :
        type === "cases" ? `
          <label><span class="label">Date</span><input class="input" name="date" type="date"></label>
          <label><span class="label">Rotation</span><input class="input" name="rotation" value="${escapeHtml(currentRotation.name || "")}"></label>
          <label><span class="label">Presenting complaint / symptoms / differential / final diagnosis / plan / what I learned</span><textarea class="textarea" name="details" placeholder="Use de-identified case notes only."></textarea></label>
          <label><span class="label">Related disorders, medications, articles, notes</span><input class="input" name="links" placeholder="Schizophrenia; risperidone; suicide risk assessment"></label>` :
        type === "pearls" ? `
          <label><span class="label">Tag / topic</span><input class="input" name="category" placeholder="e.g. Differential diagnosis"></label>
          <label><span class="label">Pearl</span><textarea class="textarea" name="details" placeholder="Short practical learning point"></textarea></label>
          <label><span class="label">Related disorder / links</span><input class="input" name="links" placeholder="Delirium; psychosis"></label>` : `
          <label><span class="label">Authors · Year · Journal</span><input class="input" name="category" placeholder="Authors; 2025; Journal name"></label>
          <label><span class="label">Link</span><input class="input" name="url" type="url" placeholder="https://..."></label>
          <label><span class="label">Summary / clinical relevance / personal notes</span><textarea class="textarea" name="details" placeholder="Summary and how this evidence changes or informs clinical practice"></textarea></label>
          <label><span class="label">Topic / related disorders / cases</span><input class="input" name="links" placeholder="Bipolar disorder; lithium; case title"></label>`;
        return genericView(cfg.title, cfg.desc, `
          <form id="knowledge-entry-form" data-entity-type="${type}" class="card pad knowledge-form" style="box-shadow:none;margin-bottom:18px">
            <input type="hidden" name="id" value="">
            <label><span class="label">${cfg.singular} title</span><input class="input" name="title" required placeholder="${cfg.placeholder}"></label>
            ${formFields}
            <div class="row" style="flex-wrap:wrap;margin-top:12px"><button class="btn btn-primary" type="submit" data-submit-entity>Save ${cfg.singular}</button><button class="btn" type="button" data-clear-entity>Clear form</button></div>
            ${type === "cases" ? `<p class="subtle">Privacy: use fictionalized or fully de-identified learning notes; never store names, dates of birth, addresses, or other identifying details.</p>` : ""}
          </form>
          <div class="section-head"><h3>${cfg.title} (${list.length})</h3></div>
          ${list.map(item=>`<article class="card pad knowledge-entry" style="margin-top:10px;box-shadow:none"><div class="row between" style="align-items:flex-start"><div style="min-width:0;flex:1"><span class="tag">${escapeHtml(item.category || cfg.singular)}</span><h3 style="margin:8px 0">${escapeHtml(item.title)}</h3><p class="subtle" style="white-space:pre-wrap">${escapeHtml(item.details || "")}</p>${item.url ? `<p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open article ↗</a></p>` : ""}${item.links ? `<p class="subtle"><strong>Related:</strong> ${escapeHtml(item.links)}</p>` : ""}${item.date ? `<p class="subtle">Date: ${escapeHtml(item.date)}${item.rotation ? " · " + escapeHtml(item.rotation) : ""}</p>` : ""}</div><div class="row" style="flex-wrap:wrap"><button type="button" class="btn btn-small" data-edit-entity="${escapeHtml(item.id)}" data-entity-type="${type}">Edit</button><button type="button" class="btn btn-small btn-danger" data-delete-entity="${escapeHtml(item.id)}" data-entity-type="${type}">Delete</button></div></div></article>`).join("") || `<div class="empty">No entries yet. Create your first one above.</div>`}`);
      }
      function flashcardsView() {
        const cards = entityArray("flashcards");
        const due = cards.filter(card => !card.nextReview || card.nextReview <= new Date().toISOString().slice(0,10));
        return genericView("Active Recall & Spaced Repetition", "Create diagnosis, medication, or clinical reasoning cards. Review interval: Hard = 1 day, Medium = 3 days, Easy = 7 days.", `
          <form id="flashcard-form" class="card pad" style="box-shadow:none;margin-bottom:16px"><input type="hidden" name="id"><label><span class="label">Card type</span><select class="input" name="category"><option>Diagnosis</option><option>Medication</option><option>Clinical reasoning</option></select></label><label><span class="label">Front / question</span><input class="input" name="front" required placeholder="Core symptoms of schizophrenia?"></label><label><span class="label">Back / answer</span><textarea class="textarea" name="back" required placeholder="Positive, negative, and cognitive symptoms"></textarea></label><button class="btn btn-primary" type="submit" style="margin-top:10px">Save Flashcard</button></form>
          <div class="notice">Due today: <strong>${due.length}</strong> of ${cards.length} cards · reviewed ${cards.filter(c=>c.lastReviewed).length} at least once.</div>
          ${cards.map(card=>`<article class="card pad" style="margin-top:12px;box-shadow:none"><span class="tag">${escapeHtml(card.category || "Clinical reasoning")}</span><h3>${escapeHtml(card.front)}</h3><details><summary>Reveal answer</summary><p style="white-space:pre-wrap">${escapeHtml(card.back)}</p></details><p class="subtle">Next review: ${escapeHtml(card.nextReview || "Due now")} · Difficulty: ${escapeHtml(card.difficulty || "Not rated")}</p><div class="row" style="flex-wrap:wrap"><button class="btn btn-small" data-review-card="${escapeHtml(card.id)}" data-difficulty="Hard">Hard · tomorrow</button><button class="btn btn-small" data-review-card="${escapeHtml(card.id)}" data-difficulty="Medium">Medium · 3 days</button><button class="btn btn-small" data-review-card="${escapeHtml(card.id)}" data-difficulty="Easy">Easy · 7 days</button><button class="btn btn-small btn-danger" data-delete-entity="${escapeHtml(card.id)}" data-entity-type="flashcards">Delete</button></div></article>`).join("") || `<div class="empty">No flashcards yet.</div>`}`);
      }
      function differentialView() {
        const choices = {
          "Hallucinations":["Schizophrenia spectrum disorder","Bipolar disorder with psychotic features","Substance/medication-induced psychosis","Delirium or another medical cause","Major depression with psychotic features"],
          "Low mood / anhedonia":["Major depressive disorder","Bipolar depression","Adjustment disorder","Substance/medication-induced mood symptoms","Medical causes"],
          "Elevated mood / reduced need for sleep":["Bipolar mania or hypomania","Substance/medication-induced mood symptoms","Sleep deprivation or medical causes","Other specified mood disorder"],
          "Inattention / hyperactivity":["ADHD","Sleep disorder","Anxiety or mood disorder","Substance/medication effects","Learning or neurodevelopmental conditions"]
        };
        return genericView("Differential Diagnosis Tool", "Educational aid for organizing hypotheses, not a diagnostic decision-maker. Assess safety, timeline, medical causes, substances, medications, and context.", `
          <label><span class="label">Presenting feature</span><select id="ddx-feature" class="input">${Object.keys(choices).map(k=>`<option>${k}</option>`).join("")}</select></label>
          <div id="ddx-results" class="grid two-col" style="margin-top:14px">${choices.Hallucinations.map((d,i)=>`<article class="card pad" style="box-shadow:none"><h3>${d}</h3><p class="subtle">Supporting features: evaluate symptom chronology, impairment, context, and associated symptoms.</p><p class="subtle">Against: look for absent expected features and contradictory timeline.</p><p class="subtle">Questions: onset, duration, substances/medications, sleep, mood symptoms, attention/awareness, medical history, and collateral information.</p></article>`).join("")}</div>
          <label style="display:block;margin-top:14px"><span class="label">Personal reasoning notes</span><textarea id="ddx-notes" class="textarea">${escapeHtml(knowledge.differentialNotes || "")}</textarea></label><button type="button" class="btn btn-primary" data-save-ddx style="margin-top:8px">Save reasoning notes</button>`);
      }
      function searchView() {
        return genericView("Global Search", "Search titles, details, tags, and related links across your knowledge base.", `<input class="input" id="knowledge-search" placeholder="Search lithium, bipolar, a case, an article…" value=""><div id="knowledge-search-results" style="margin-top:14px"><p class="subtle">Type to search your knowledge repository.</p></div>`);
      }
      function allKnowledgeEntries() {
        return ["disorders","medications","cases","pearls","articles","flashcards"].flatMap(type=>entityArray(type).map(item=>({...item,type})));
      }
      function renderSearchResults(query) {
        const root=document.getElementById("knowledge-search-results"); if(!root)return;
        const q=String(query||"").trim().toLowerCase();
        if(!q){root.innerHTML='<p class="subtle">Type to search your knowledge repository.</p>';return;}
        const matches=allKnowledgeEntries().filter(item=>JSON.stringify(item).toLowerCase().includes(q));
        root.innerHTML=matches.map(item=>`<article class="card pad" style="margin-top:8px;box-shadow:none"><span class="tag">${escapeHtml(item.type)}</span><strong>${escapeHtml(item.title || item.front || "")}</strong><p class="subtle">${escapeHtml(item.details || item.back || item.links || "")}</p><button class="btn btn-small" data-nav="${item.type}">Open section</button></article>`).join("") || '<div class="empty">No matching entries found.</div>';
      }
      function clearEntityForm(form) { if(!form)return; form.reset(); const id=form.querySelector('[name="id"]'); if(id)id.value=""; }
      function handleEntitySubmit(form) {
        const type=form.dataset.entityType; const data=Object.fromEntries(new FormData(form).entries());
        const title=String(data.title||"").trim(); if(!title)return;
        const list=entityArray(type); const id=String(data.id||"").trim() || type.slice(0,-1)+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
        const item={...data,id,title,updatedAt:new Date().toISOString()};
        if(type==="disorders") item.category="Psychiatric disorder";
        if(type==="cases") item.category="Clinical case";
        if(type==="pearls") item.category=data.category||"Clinical pearl";
        if(type==="articles") item.category=data.category||"Article";
        knowledge[type]=data.id ? list.map(old=>old.id===id?item:old) : list.concat([item]);
        saveWorkspace(); render();
      }
      function loadEntityIntoForm(type,id) {
        const form=document.querySelector(`#knowledge-entry-form[data-entity-type="${type}"]`); if(!form)return;
        const item=entityArray(type).find(x=>x.id===id); if(!item)return;
        Object.keys(item).forEach(key=>{const field=form.elements.namedItem(key); if(field)field.value=item[key]||"";});
        form.scrollIntoView({behavior:"smooth",block:"start"});
      }

      function analyticsView() {
        const weekRows = [1,5,12,24].map(number => {
          const week = getWeek(number);
          const value = weeklyProgress(week);
          return `<div class="bar-row"><div class="bar-label"><strong>Week ${number} · ${escapeHtml(week.title)}</strong><span>${value}%</span></div><div class="chartbar"><span style="width:${value}%"></span></div></div>`;
        }).join("");
        return genericView("Analytics", "Progress is displayed with direct percentage bars.", weekRows);
      }

      function formatTimer(seconds) {
        const safe = Math.max(0, safeNumber(seconds));
        const minutes = Math.floor(safe / 60);
        const remainder = Math.floor(safe % 60);
        return String(minutes).padStart(2,"0") + ":" + String(remainder).padStart(2,"0");
      }

      function render() {
        const titleMap = {
          "dashboard":"Psychiatry Residency Study Planner",
          "study-plan":"24-week Study Plan",
          "weekly-view":"Week " + selectedWeekNumber + " — " + getWeek(selectedWeekNumber).title,
          "daily-log":"Daily Log",
          "tasks":"Tasks",
          "timer":"Focus Timer",
          "analytics":"Analytics",
          "notes":"Notes",
          "rotations":"Rotations",
          "weekly-review":"Weekly Review",
          "knowledge-map":"Psychiatry Knowledge Map",
          "disorders":"Disorder Profiles",
          "disorder-profile": (entityArray("disorders").find(d => d.id === selectedDisorderId) || {}).title || "Disorder Profile",
          "medications":"Medication Database",
          "cases":"Clinical Cases",
          "pearls":"My Psychiatry Pearls",
          "articles":"Articles & Evidence",
          "flashcards":"Active Recall",
          "differential":"Differential Diagnosis",
          "search":"Global Search",
          "settings":"Settings"
        };
        const appRoot = document.getElementById("app");
        if (!appRoot) return;
        appRoot.innerHTML = `
          ${renderSidebar()}
          <main class="main-area">
            <header class="topbar">
              <div><div class="eyebrow">Residency workspace · 24-week foundation plan</div><h1 class="page-title">${escapeHtml(titleMap[activeView] || titleMap.dashboard)}</h1></div>
              <button type="button" class="btn" data-nav="dashboard">Dashboard</button>
            </header>
            ${persistenceError ? `<div class="notice" style="margin-bottom:16px;border-left-color:var(--danger)"><strong>Storage notice</strong><br><span class="subtle">${escapeHtml(persistenceError)}</span></div>` : ''}
            ${persistenceError ? `<div class="psp-storage-warning" role="status">${escapeHtml(persistenceError)} Your planner will remain usable, but changes may not be synced until storage is available.</div>` : ""}
            ${renderView()}
            <footer class="subtle" style="margin-top:36px">For educational organization only. Follow local policies, supervision, and clinical guidance.</footer>
          </main>
          <nav class="mobile-nav" aria-label="ناوبری اصلی">
            <button type="button" class="mobile-nav-item ${activeView === "dashboard" ? "active" : ""}" data-nav="dashboard" aria-label="خانه">
              <span class="mobile-nav-icon" aria-hidden="true">⌂</span><span>خانه</span>
            </button>
            <button type="button" class="mobile-nav-item ${["study-plan","weekly-view","daily-log","tasks","timer","analytics","notes","weekly-review"].includes(activeView) ? "active" : ""}" data-nav="study-plan" aria-label="مطالعه">
              <span class="mobile-nav-icon" aria-hidden="true">▤</span><span>مطالعه</span>
            </button>
            <button type="button" class="mobile-nav-item ${["knowledge-map","disorders","disorder-profile","medications","pearls","articles","flashcards","differential"].includes(activeView) ? "active" : ""}" data-nav="knowledge-map" aria-label="دانش">
              <span class="mobile-nav-icon" aria-hidden="true">◉</span><span>دانش</span>
            </button>
            <button type="button" class="mobile-nav-item ${activeView === "cases" ? "active" : ""}" data-nav="cases" aria-label="Caseهای بالینی">
              <span class="mobile-nav-icon" aria-hidden="true">▣</span><span>Caseها</span>
            </button>
            <button type="button" class="mobile-nav-item mobile-more-trigger ${["rotations","search","settings"].includes(activeView) ? "active" : ""}" data-mobile-more aria-controls="mobile-more-panel" aria-expanded="false" aria-label="بیشتر">
              <span class="mobile-nav-icon" aria-hidden="true">☰</span><span>بیشتر</span>
            </button>
          </nav>
          <button type="button" id="mobile-more-backdrop" class="mobile-more-backdrop" data-mobile-more-close aria-label="بستن منوی بیشتر" tabindex="-1"></button>
          <section id="mobile-more-panel" class="mobile-more-panel" aria-label="سایر بخش‌ها">
            <div class="mobile-more-head"><strong>بخش‌های بیشتر</strong><span>میان‌بُر به ابزارهای برنامه</span></div>
            <div class="mobile-more-group">
              <div class="mobile-more-group-title">مطالعه و پیگیری</div>
              ${[["weekly-view","هفته جاری"],["daily-log","ثبت مطالعه"],["tasks","Taskها"],["timer","تایمر تمرکز"],["analytics","تحلیل پیشرفت"],["notes","یادداشت‌ها"],["weekly-review","مرور هفتگی"]].map(([view,label]) => `<button type="button" class="mobile-more-item ${activeView === view ? "active" : ""}" data-nav="${view}">${label}</button>`).join("")}
            </div>
            <div class="mobile-more-group">
              <div class="mobile-more-group-title">ابزارهای دانش پزشکی</div>
              ${[["disorders","Disorder Profiles"],["medications","داروها"],["flashcards","فلش‌کارت‌ها"],["differential","Differential Diagnosis"],["pearls","Psychiatry Pearls"],["articles","مقالات و شواهد"],["search","جست‌وجوی سراسری"]].map(([view,label]) => `<button type="button" class="mobile-more-item ${activeView === view ? "active" : ""}" data-nav="${view}">${label}</button>`).join("")}
            </div>
            <div class="mobile-more-group">
              <div class="mobile-more-group-title">مدیریت</div>
              ${[["rotations","Rotation فعلی"],["settings","تنظیمات"]].map(([view,label]) => `<button type="button" class="mobile-more-item ${activeView === view ? "active" : ""}" data-nav="${view}">${label}</button>`).join("")}
            </div>
          </section>
        `;
        bindEvents();
      }

      function bindEvents() {
        const medicalSearchForm = document.getElementById("medical-search-form");
        if (medicalSearchForm) medicalSearchForm.addEventListener("submit", async event => {
          event.preventDefault();
          const queryInput = document.getElementById("medical-search-query");
          const sourceInput = document.getElementById("medical-search-source");
          const status = document.getElementById("medical-search-status");
          const query = String(queryInput && queryInput.value || "").trim();
          const source = medicalSearchSources[String(sourceInput && sourceInput.value || "rapidrx")] || medicalSearchSources.rapidrx;
          if (!query) {
            if (status) status.textContent = "ابتدا عبارت جست‌وجو را وارد کن.";
            if (queryInput) queryInput.focus();
            return;
          }
          if (source.mode === "query") {
            const url = source.url + encodeURIComponent(query) + (source.suffix || "");
            const opened = openExternalResource(url);
            if (status) status.textContent = opened
              ? `جست‌وجوی «${query}» در ${source.label} باز شد.`
              : `مرورگر بازشدن تب جدید را مسدود کرد. برای ادامه، جست‌وجو را در ${source.label} باز کن: ${url}`;
            return;
          }
          const opened = openExternalResource(source.url);
          const copied = await copyMedicalSearchTerm(query);
          if (status) {
            if (!opened && !copied) status.textContent = `مرورگر تب جدید و کپی خودکار را مسدود کرد. عبارت جست‌وجو: ${query}`;
            else if (copied && opened) status.textContent = `سایت ${source.label} باز شد و عبارت «${query}» کپی شد؛ آن را در نوار جست‌وجوی سایت Paste کن.`;
            else if (copied) status.textContent = `عبارت «${query}» کپی شد، اما مرورگر تب جدید را مسدود کرد. سایت ${source.label} را باز کن و عبارت را Paste کن.`;
            else if (opened) status.textContent = `سایت ${source.label} باز شد. کپی خودکار ممکن نبود؛ این عبارت را در سایت وارد کن: ${query}`;
          }
        });
        document.querySelectorAll("[data-mobile-more]").forEach(button => button.addEventListener("click", () => {
          const panel = document.getElementById("mobile-more-panel");
          const backdrop = document.getElementById("mobile-more-backdrop");
          if (!panel || !backdrop) return;
          const open = !panel.classList.contains("is-open");
          panel.classList.toggle("is-open", open);
          backdrop.classList.toggle("is-open", open);
          button.classList.toggle("more-open", open);
          button.setAttribute("aria-expanded", String(open));
        }));
        document.querySelectorAll("[data-mobile-more-close]").forEach(button => button.addEventListener("click", () => {
          const panel = document.getElementById("mobile-more-panel");
          const trigger = document.querySelector("[data-mobile-more]");
          if (panel) panel.classList.remove("is-open");
          button.classList.remove("is-open");
          if (trigger) {
            trigger.classList.remove("more-open");
            trigger.setAttribute("aria-expanded", "false");
            trigger.focus({ preventScroll: true });
          }
        }));
        document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => {
          if (button.dataset.disorderId) selectedDisorderId = button.dataset.disorderId;
          if (button.dataset.profileEdit) {
            selectedDisorderId = button.dataset.profileEdit;
            navigate(button.dataset.nav);
            setTimeout(() => loadEntityIntoForm("disorders", selectedDisorderId), 0);
            return;
          }
          navigate(button.dataset.nav);
        }));
        document.querySelectorAll("[data-open-week]").forEach(button => button.addEventListener("click", () => handleOpenWeek(button.dataset.openWeek)));
        document.querySelectorAll("[data-back-plan]").forEach(button => button.addEventListener("click", () => {
          activeView = "study-plan";
          render();
        }));
        document.querySelectorAll("[data-reload-week]").forEach(button => button.addEventListener("click", () => {
          activeView = "weekly-view";
          render();
        }));
        document.querySelectorAll("[data-task]").forEach(input => input.addEventListener("change", () => {
          const task = asArray(tasks).find(item => item.id === input.dataset.task);
          if (task) task.done = input.checked;
          saveWorkspace();
          render();
        }));
        document.querySelectorAll("[data-delete-task]").forEach(button => button.addEventListener("click", () => {
          const id = button.dataset.deleteTask;
          const task = asArray(tasks).find(item => item.id === id);
          if (!task || !window.confirm("Delete this task?")) return;
          tasks = asArray(tasks).filter(item => item.id !== id);
          saveWorkspace();
          render();
        }));
        document.querySelectorAll("[data-topic-week]").forEach(input => input.addEventListener("change", () => {
          const key = input.dataset.topicWeek + "-" + input.dataset.topicIndex;
          topicChecks[key] = input.checked;
          saveWorkspace();
          render();
        }));
        document.querySelectorAll("[data-delete-topic-week]").forEach(button => button.addEventListener("click", () => {
          const weekNumber = safeNumber(button.dataset.deleteTopicWeek, selectedWeekNumber);
          const index = Math.max(0, Math.floor(safeNumber(button.dataset.deleteTopicIndex, 0)));
          if (!window.confirm("Delete this topic?")) return;
          removeTopicAt(weekNumber, index);
          saveWorkspace();
          render();
        }));
        const addTopic = document.querySelector("[data-add-topic]");
        if (addTopic) addTopic.addEventListener("click", () => {
          const input = document.getElementById("custom-topic");
          const text = String(input && input.value || "").trim();
          if (!text) return;
          const target = safeWeeks().find(item => safeNumber(item.number) === safeNumber(selectedWeekNumber));
          if (target) {
            target.topics = getTopics(target).concat([text]);
            input.value = "";
            saveWorkspace();
            render();
          }
        });
        const saveNote = document.querySelector("[data-save-note]");
        if (saveNote) saveNote.addEventListener("click", () => {
          const textarea = document.getElementById("week-notes");
          notesByWeek[selectedWeekNumber] = String(textarea && textarea.value || "");
          saveWorkspace();
          render();
        });
        const saveWeekTitle = document.querySelector("[data-save-week-title]");
        if (saveWeekTitle) saveWeekTitle.addEventListener("click", () => {
          const input = document.getElementById("week-title-input");
          const text = String(input && input.value || "").trim();
          const target = getWeek(selectedWeekNumber);
          target.title = text || "Week " + selectedWeekNumber;
          saveWorkspace();
          render();
        });
        const swapWeek = document.querySelector("[data-swap-week]");
        if (swapWeek) swapWeek.addEventListener("click", () => {
          const select = document.getElementById("swap-week-select");
          const targetWeek = safeNumber(select && select.value, 0);
          if (!targetWeek || targetWeek === selectedWeekNumber) return;
          const sourceTitle = getWeek(selectedWeekNumber).title;
          const targetTitle = getWeek(targetWeek).title;
          if (!window.confirm(`Swap the contents of Week ${selectedWeekNumber} (${sourceTitle}) and Week ${targetWeek} (${targetTitle})?`)) return;
          swapWeekContents(selectedWeekNumber, targetWeek);
          saveWorkspace();
          render();
        });
        document.querySelectorAll("[data-delete-session]").forEach(button => button.addEventListener("click", () => {
          const id = button.dataset.deleteSession;
          if (!window.confirm("Delete this study session?")) return;
          sessions = asArray(sessions).filter(item => item.id !== id);
          saveWorkspace();
          render();
        }));
        document.querySelectorAll("[data-log-current]").forEach(button => button.addEventListener("click", () => {
          sessions = asArray(sessions).concat([{
            id:"session-" + Date.now(),
            weekNumber:selectedWeekNumber,
            minutes:30,
            resource:"Kaplan",
            note:"Focused study session logged from the planner.",
            loggedAt:new Date().toISOString()
          }]);
          saveWorkspace();
          render();
        }));
        document.querySelectorAll("[data-add-task]").forEach(button => button.addEventListener("click", () => {
          const weekNumber = safeNumber(button.dataset.taskWeek || (document.getElementById("new-task-week") || {}).value, selectedWeekNumber);
          const scopedInput = document.getElementById("new-week-task");
          const globalInput = document.getElementById("new-task-title");
          const input = scopedInput || globalInput;
          const text = String(input && input.value || "").trim();
          if (!text) return;
          tasks = asArray(tasks).concat([{
            id:"task-" + Date.now() + "-" + Math.random().toString(36).slice(2,8),
            title:text,
            done:false,
            weekNumber: clamp(Math.floor(weekNumber),1,24)
          }]);
          saveWorkspace();
          render();
        }));

        const rotationForm = document.getElementById("rotation-form");
        if (rotationForm) rotationForm.addEventListener("submit", event => {
          event.preventDefault(); const data=Object.fromEntries(new FormData(rotationForm).entries());
          currentRotation={...currentRotation,...data}; saveWorkspace(); render();
        });
        document.querySelectorAll("#knowledge-entry-form").forEach(form=>form.addEventListener("submit",event=>{event.preventDefault();handleEntitySubmit(form);}));
        document.querySelectorAll("[data-clear-entity]").forEach(button=>button.addEventListener("click",()=>clearEntityForm(button.closest("form"))));
        document.querySelectorAll("[data-edit-entity]").forEach(button=>button.addEventListener("click",()=>loadEntityIntoForm(button.dataset.entityType,button.dataset.editEntity)));
        document.querySelectorAll("[data-delete-entity]").forEach(button=>button.addEventListener("click",()=>{
          const type=button.dataset.entityType,id=button.dataset.deleteEntity;
          if(!window.confirm("Delete this entry?"))return;
          knowledge[type]=entityArray(type).filter(item=>item.id!==id); saveWorkspace(); render();
        }));
        const flashcardForm=document.getElementById("flashcard-form");
        if(flashcardForm)flashcardForm.addEventListener("submit",event=>{
          event.preventDefault();const d=Object.fromEntries(new FormData(flashcardForm).entries());const id="flashcard-"+Date.now();
          knowledge.flashcards=entityArray("flashcards").concat([{id,category:d.category,front:String(d.front||"").trim(),back:String(d.back||"").trim(),difficulty:"",nextReview:"",lastReviewed:""}]);
          saveWorkspace();render();
        });
        document.querySelectorAll("[data-review-card]").forEach(button=>button.addEventListener("click",()=>{
          const card=entityArray("flashcards").find(c=>c.id===button.dataset.reviewCard);if(!card)return;
          const difficulty=button.dataset.difficulty,days=difficulty==="Hard"?1:difficulty==="Medium"?3:7;
          const date=new Date();date.setDate(date.getDate()+days);
          card.difficulty=difficulty;card.lastReviewed=new Date().toISOString().slice(0,10);card.nextReview=date.toISOString().slice(0,10);
          card.reviewCount=safeNumber(card.reviewCount)+1;saveWorkspace();render();
        }));
        const searchInput=document.getElementById("knowledge-search");
        if(searchInput)searchInput.addEventListener("input",()=>renderSearchResults(searchInput.value));
        const ddxFeature=document.getElementById("ddx-feature");
        if(ddxFeature)ddxFeature.addEventListener("change",()=>{
          const root=document.getElementById("ddx-results");if(!root)return;
          const data={
            "Hallucinations":["Schizophrenia spectrum disorder","Bipolar disorder with psychotic features","Substance/medication-induced psychosis","Delirium or another medical cause","Major depression with psychotic features"],
            "Low mood / anhedonia":["Major depressive disorder","Bipolar depression","Adjustment disorder","Substance/medication-induced mood symptoms","Medical causes"],
            "Elevated mood / reduced need for sleep":["Bipolar mania or hypomania","Substance/medication-induced mood symptoms","Sleep deprivation or medical causes","Other specified mood disorder"],
            "Inattention / hyperactivity":["ADHD","Sleep disorder","Anxiety or mood disorder","Substance/medication effects","Learning or neurodevelopmental conditions"]
          }[ddxFeature.value]||[];
          root.innerHTML=data.map(d=>`<article class="card pad" style="box-shadow:none"><h3>${escapeHtml(d)}</h3><p class="subtle">Supporting features: evaluate chronology, impairment, context, and associated symptoms.</p><p class="subtle">Against: assess contradictory findings and missing expected features.</p><p class="subtle">Questions: onset, duration, substances/medications, sleep, mood, attention/awareness, medical history, and collateral information.</p></article>`).join("");
        });
        const saveDdx=document.querySelector("[data-save-ddx]");
        if(saveDdx)saveDdx.addEventListener("click",()=>{knowledge.differentialNotes=String((document.getElementById("ddx-notes")||{}).value||"");saveWorkspace();render();});
        const timerToggle = document.querySelector("[data-timer-toggle]");
        if (timerToggle) timerToggle.addEventListener("click", toggleTimer);
        const timerReset = document.querySelector("[data-timer-reset]");
        if (timerReset) timerReset.addEventListener("click", () => {
          clearInterval(timerHandle);
          timerHandle = null;
          timerSeconds = 25 * 60;
          render();
        });
      }

      function toggleTimer() {
        if (timerHandle) {
          clearInterval(timerHandle);
          timerHandle = null;
          render();
          return;
        }
        timerHandle = setInterval(() => {
          timerSeconds = Math.max(0, timerSeconds - 1);
          const display = document.getElementById("timer-display");
          if (display) display.textContent = formatTimer(timerSeconds);
          if (timerSeconds === 0) {
            clearInterval(timerHandle);
            timerHandle = null;
            render();
          }
        }, 1000);
        render();
      }

      function tasksForWeek(number) {
        return asArray(tasks).filter(task => safeNumber(task.weekNumber, 1) === safeNumber(number));
      }

      function removeTopicAt(weekNumber, index) {
        const week = getWeek(weekNumber);
        const currentTopics = getTopics(week).slice();
        if (index < 0 || index >= currentTopics.length) return;
        const oldChecks = {};
        currentTopics.forEach((_, i) => { oldChecks[i] = !!topicChecks[weekNumber + "-" + i]; });
        currentTopics.splice(index, 1);
        week.topics = currentTopics;
        Object.keys(topicChecks).forEach(key => { if (key.indexOf(weekNumber + "-") === 0) delete topicChecks[key]; });
        currentTopics.forEach((_, i) => {
          const oldIndex = i >= index ? i + 1 : i;
          if (oldChecks[oldIndex]) topicChecks[weekNumber + "-" + i] = true;
        });
      }

      function remapWeekInCollection(collection, fromNumber, toNumber) {
        return asArray(collection).map(item => {
          if (!item || typeof item !== "object") return item;
          const weekNumber = safeNumber(item.weekNumber, 1);
          if (weekNumber === fromNumber) return { ...item, weekNumber: toNumber };
          if (weekNumber === toNumber) return { ...item, weekNumber: fromNumber };
          return item;
        });
      }

      function swapTopicChecks(a, b) {
        const next = {};
        Object.keys(topicChecks || {}).forEach(key => {
          const prefixA = a + "-";
          const prefixB = b + "-";
          if (key.indexOf(prefixA) === 0) next[b + key.slice(prefixA.length)] = !!topicChecks[key];
          else if (key.indexOf(prefixB) === 0) next[a + key.slice(prefixB.length)] = !!topicChecks[key];
          else next[key] = !!topicChecks[key];
        });
        topicChecks = next;
      }

      function swapNotes(a, b) {
        const aNote = Object.prototype.hasOwnProperty.call(notesByWeek, a) ? notesByWeek[a] : undefined;
        const bNote = Object.prototype.hasOwnProperty.call(notesByWeek, b) ? notesByWeek[b] : undefined;
        delete notesByWeek[a];
        delete notesByWeek[b];
        if (bNote !== undefined && bNote !== "") notesByWeek[a] = bNote;
        if (aNote !== undefined && aNote !== "") notesByWeek[b] = aNote;
      }

      function swapWeekContents(a, b) {
        const aWeekIndex = weeks.findIndex(item => safeNumber(item.number) === a);
        const bWeekIndex = weeks.findIndex(item => safeNumber(item.number) === b);
        if (aWeekIndex < 0 || bWeekIndex < 0) return;
        const aWeek = weeks[aWeekIndex];
        const bWeek = weeks[bWeekIndex];
        weeks[aWeekIndex] = { ...bWeek, number: a };
        weeks[bWeekIndex] = { ...aWeek, number: b };
        swapTopicChecks(a, b);
        swapNotes(a, b);
        tasks = remapWeekInCollection(tasks, a, b);
        sessions = remapWeekInCollection(sessions, a, b);
      }

      function migrateWorkspaceState() {
        let dirty = false;
        weeks = asArray(weeks).length ? weeks : makeWeeks();
        const originalWeekCount = weeks.length;
        const originalWeekNumbers = weeks.map(week => safeNumber(week?.number, 0));
        weeks = weeks.slice(0, 24).map((week, index) => ({
          number: index + 1,
          title: String(week?.title || weekTitles[index] || "Week " + (index + 1)),
          kaplan: String(week?.kaplan || kaplanChapters[index] || "Kaplan"),
          objective: String(week?.objective || "مطالعه و مرور مباحث این هفته"),
          tasman: asArray(week?.tasman),
          targetHours: Math.max(0, safeNumber(week?.targetHours, 8)),
          topics: getTopics(week)
        }));
        while (weeks.length < 24) { weeks.push(makeWeeks()[weeks.length]); dirty = true; }
        if (originalWeekCount !== 24 || originalWeekNumbers.some((number, index) => number !== index + 1)) dirty = true;

        const beforeTaskCount = asArray(tasks).length;
        const beforeTasksWithWeek = asArray(tasks).filter(task => task && Object.prototype.hasOwnProperty.call(task, "weekNumber")).length;
        tasks = asArray(tasks)
          .filter(task => task && typeof task === "object")
          .filter(task => !["morning-report", "lithium-monitoring"].includes(String(task.id || "")))
          .map((task, index) => ({
            id: String(task.id || ("task-legacy-" + index)),
            title: String(task.title || "Untitled task"),
            done: !!task.done,
            weekNumber: clamp(Math.floor(safeNumber(task.weekNumber, 1)), 1, 24)
          }));
        if (tasks.length !== beforeTaskCount || beforeTasksWithWeek !== asArray(tasks).length) dirty = true;

        const beforeSessionCount = asArray(sessions).length;
        sessions = asArray(sessions)
          .filter(session => session && !["session-1", "session-2"].includes(String(session.id || "")))
          .map(session => ({ ...session, weekNumber: clamp(Math.floor(safeNumber(session.weekNumber, 1)), 1, 24) }));
        if (sessions.length !== beforeSessionCount) dirty = true;

        const migratedChecks = {};
        Object.keys(topicChecks || {}).forEach(key => {
          if (["5-0","5-1","5-2"].includes(String(key))) { dirty = true; return; }
          migratedChecks[key] = !!topicChecks[key];
        });
        topicChecks = migratedChecks;
        if (String(notesByWeek[5] || "") === "Link symptoms, duration, and collateral history when reviewing bipolar presentations.") {
          delete notesByWeek[5];
          dirty = true;
        }
        selectedWeekNumber = clamp(Math.floor(safeNumber(selectedWeekNumber, 1)), 1, 24);
        migrationDirty = migrationDirty || dirty;
      }

      function currentWorkspace() {
        return {
          weeks:safeWeeks(),
          tasks:asArray(tasks),
          sessions:asArray(sessions),
          topicChecks:topicChecks && typeof topicChecks === "object" ? topicChecks : {},
          notesByWeek:notesByWeek && typeof notesByWeek === "object" ? notesByWeek : {},
          currentRotation,
          knowledge
        };
      }

      function applyWorkspace(workspace) {
        if (!workspace || typeof workspace !== "object") return;
        if (Array.isArray(workspace.weeks) && workspace.weeks.length) weeks = workspace.weeks;
        if (Array.isArray(workspace.tasks)) tasks = workspace.tasks;
        if (Array.isArray(workspace.sessions)) sessions = workspace.sessions;
        if (workspace.topicChecks && typeof workspace.topicChecks === "object") topicChecks = workspace.topicChecks;
        if (workspace.notesByWeek && typeof workspace.notesByWeek === "object") notesByWeek = workspace.notesByWeek;
        if (workspace.currentRotation && typeof workspace.currentRotation === "object") currentRotation = { ...currentRotation, ...workspace.currentRotation };
        if (workspace.knowledge && typeof workspace.knowledge === "object") knowledge = { ...knowledge, ...workspace.knowledge };
        migrateWorkspaceState();
      }

      async function initializePersistence() {
        try {
          if (!PSP_CONFIG.restUrl) {
            persistenceReady = false;
            persistenceError = 'WordPress storage endpoint is not configured.';
            render();
            return;
          }

          const result = await fetch(PSP_CONFIG.restUrl, {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'X-WP-Nonce': PSP_CONFIG.nonce || '' }
          });

          if (!result.ok) {
            throw new Error('Storage request failed (' + result.status + ').');
          }

          const payload = await result.json();
          if (payload && payload.data) {
            try {
              applyWorkspace(typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data);
            } catch (error) {
              console.warn('Saved workspace could not be parsed; keeping safe defaults.', error);
            }
          }

          persistenceReady = true;
          persistenceError = '';
          if (migrationDirty) {
            migrationDirty = false;
            await saveWorkspace();
          }
          render();
        } catch (error) {
          persistenceReady = false;
          persistenceError = error instanceof Error ? error.message : 'Saved workspace could not be loaded.';
          console.error('Psychiatry Study Planner load error:', error);
          render();
        }
      }

      async function saveWorkspace() {
        if (!PSP_CONFIG.restUrl || !persistenceReady) return;

        saveQueue = saveQueue.then(async () => {
          try {
            const result = await fetch(PSP_CONFIG.restUrl, {
              method: 'PUT',
              credentials: 'same-origin',
              headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': PSP_CONFIG.nonce || ''
              },
              body: JSON.stringify(currentWorkspace())
            });

            if (!result.ok) {
              let message = 'Workspace could not be saved.';
              try {
                const errorPayload = await result.json();
                message = errorPayload?.message || message;
              } catch (_) {}
              throw new Error(message);
            }

            persistenceError = '';
          } catch (error) {
            persistenceError = error instanceof Error ? error.message : 'Workspace could not be saved.';
            console.error('Psychiatry Study Planner save error:', error);
          }
        });

        return saveQueue;
      }

      document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        const panel = document.getElementById("mobile-more-panel");
        const backdrop = document.getElementById("mobile-more-backdrop");
        const trigger = document.querySelector("[data-mobile-more]");
        if (!panel || !panel.classList.contains("is-open")) return;
        panel.classList.remove("is-open");
        if (backdrop) backdrop.classList.remove("is-open");
        if (trigger) {
          trigger.classList.remove("more-open");
          trigger.setAttribute("aria-expanded", "false");
          trigger.focus({ preventScroll: true });
        }
      });

      migrateWorkspaceState();
      render();
      void initializePersistence();
    })();
