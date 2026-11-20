(() => {
  const root = document.documentElement;
  const sidebar = document.querySelector("#app-sidebar");
  const drawerButton = document.querySelector("[data-drawer-open]");
  const drawerScrim = document.querySelector("[data-drawer-close]");
  const themeButton = document.querySelector("[data-theme-toggle]");
  const themeLabel = document.querySelector("[data-theme-label]");
  const languageSelect = document.querySelector("#language-select");
  const toast = document.querySelector("[data-toast]");
  const routes = [...document.querySelectorAll("[data-route]")];
  const views = [...document.querySelectorAll("[data-page-view]")];
  const currentTitle = document.querySelector("[data-current-title]");
  let toastTimer;

  const messages = {
    theme: {
      light: { label: "Dark theme", next: "Switch to dark theme" },
      dark: { label: "Light theme", next: "Switch to light theme" },
    },
    navigation: { open: "Open navigation", close: "Close navigation" },
    language: "More language translations will be added in stages.",
    localeError: "Could not load this language. The previous language is still selected.",
    requestSaved: "Saved in this browser. Reference:",
    requestSaveError: "This browser could not save the request. Check storage settings and try again.",
    removePrompt: "Remove this local prototype request?",
    removed: "Local request removed.",
    emptyBookings: "No saved requests yet. Start from Passenger services.",
    removeRequest: "Remove request",
    coachSeat: "Coach / seat",
    detailBags: "Bags",
    detailPickup: "Pickup",
    detailDropoff: "Drop-off",
    detailMeal: "Meal preference",
    detailPeople: "People",
    detailFacility: "Support requested",
    detailInstructions: "Instructions",
    vegetarian: "Vegetarian",
    nonVegetarian: "Non-vegetarian",
    firstAid: "First aid",
    wheelchair: "Wheelchair assistance",
    medicalRoom: "Medical room / staff",
    other: "Other",
    applicationSaved: "Saved in this browser. Reference:",
    applicationSaveError: "This browser could not save the application. Check storage settings and try again.",
    removeApplicationPrompt: "Remove this local prototype application?",
    applicationRemoved: "Local application removed.",
    emptyApplications: "No local applications yet.",
    removeApplication: "Remove application",
    hoursPerDay: "h/day",
    age: "Age",
    gender: "Gender",
    salary: "Expected salary",
    motivation: "Reason for applying",
  };

  const serviceNames = {
    porter: "Coolie / porter assistance",
    meal: "Meals on the journey",
    medical: "Medical support request",
  };
  const roleNames = {
    manager: "Manager",
    porter: "Coolie / porter",
    medical: "Medical staff",
    catering: "Catering / delivery",
  };
  const bookingStorageKey = "guide-motion-prototype-bookings-v1";
  const applicationStorageKey = "guide-motion-prototype-applications-v1";
  const facilityState = { records: [], category: "all", dictionary: {}, selected: "", loading: true };
  let localeDictionary = {};
  let facilityDirectoryInitialized = false;
  let localeLoadId = 0;

  function updateThemeControls() {
    const isDark = root.dataset.theme === "dark";
    themeButton?.setAttribute("aria-pressed", String(isDark));
    themeButton?.setAttribute("aria-label", messages.theme[isDark ? "dark" : "light"].next);
    if (themeLabel) themeLabel.textContent = messages.theme[isDark ? "dark" : "light"].label;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#111923" : "#f2f4f7");
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function scrollToPageTop() {
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previousBehavior;
  }

  function setDrawer(open) {
    if (!sidebar || !drawerButton || !drawerScrim) return;
    const wasOpen = sidebar.classList.contains("is-open");
    sidebar.classList.toggle("is-open", open);
    sidebar.inert = !open && window.matchMedia("(max-width: 900px)").matches;
    drawerScrim.hidden = !open;
    drawerButton.setAttribute("aria-expanded", String(open));
    drawerButton.setAttribute("aria-label", open ? messages.navigation.close : messages.navigation.open);
    document.body.classList.toggle("drawer-open", open);
    if (open) sidebar.querySelector("[aria-current='page']")?.focus({ preventScroll: true });
    else if (wasOpen && window.matchMedia("(max-width: 900px)").matches) drawerButton.focus({ preventScroll: true });
  }

  function navigate({ scroll = true } = {}) {
    const requested = window.location.hash.slice(1);
    const route = routes.some((link) => link.dataset.route === requested) ? requested : "overview";
    for (const view of views) view.hidden = view.id !== route;
    for (const link of routes) {
      if (link.dataset.route === route) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    const activeView = document.getElementById(route);
    const titleKey = activeView?.dataset.titleKey;
    const translatedTitle = titleKey ? document.querySelector(`[data-i18n="${CSS.escape(titleKey)}"]`)?.textContent : "";
    if (currentTitle && translatedTitle) currentTitle.textContent = translatedTitle;
    document.title = `${translatedTitle || "Guide Motion"} · Guide Motion`;
    setDrawer(false);
    if (scroll) scrollToPageTop();
    if (route === "management") renderManagement();
  }

  function readBookings() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(bookingStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.reference === "string") : [];
    } catch (_) {
      return [];
    }
  }

  function readApplications() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(applicationStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.reference === "string") : [];
    } catch (_) {
      return [];
    }
  }

  function localize(key, fallback = "") {
    return localeDictionary[key] || fallback;
  }

  function formatSavedDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(root.lang || "en", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function renderManagement() {
    const bookingBody = document.querySelector("#management-bookings-body");
    const applicationBody = document.querySelector("#management-applications-body");
    if (!bookingBody || !applicationBody) return;
    const bookingQuery = normalizeSearch(document.querySelector('[data-management-search="bookings"]')?.value);
    const applicationQuery = normalizeSearch(document.querySelector('[data-management-search="applications"]')?.value);
    const bookings = readBookings().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const applications = readApplications().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const filteredBookings = bookings.filter((item) => normalizeSearch([
      item.reference, serviceNames[item.service], item.name, item.email, item.phone, item.station, item.train, item.travelDate,
    ].join(" ")).includes(bookingQuery));
    const filteredApplications = applications.filter((item) => normalizeSearch([
      item.reference, roleNames[item.role], item.name, item.email, item.phone, item.qualification,
    ].join(" ")).includes(applicationQuery));
    bookingBody.replaceChildren();
    applicationBody.replaceChildren();
    for (const booking of filteredBookings) {
      const row = document.createElement("tr");
      row.append(
        tableCell(booking.reference, "table-reference"),
        tableCell(serviceNames[booking.service] || localize("management.unknownService", "Passenger service")),
        tableCell(booking.name || "—", "", booking.phone),
        tableCell([booking.station, booking.train].filter(Boolean).join(" · ") || "—", "", booking.travelDate || ""),
        tableCell(formatSavedDate(booking.createdAt)),
        makeDetailButton("booking", booking.reference),
      );
      bookingBody.append(row);
    }
    for (const application of filteredApplications) {
      const row = document.createElement("tr");
      row.append(
        tableCell(application.reference, "table-reference"),
        tableCell(roleNames[application.role] || "Staff application"),
        tableCell(application.name || "—", "", application.qualification || ""),
        tableCell(application.email || "—", "", application.phone || ""),
        tableCell(formatSavedDate(application.createdAt)),
        makeDetailButton("application", application.reference),
      );
      applicationBody.append(row);
    }
    const bookingEmpty = document.querySelector('[data-management-empty="bookings"]');
    const applicationEmpty = document.querySelector('[data-management-empty="applications"]');
    if (bookingEmpty) {
      bookingEmpty.hidden = filteredBookings.length > 0;
      bookingEmpty.textContent = bookings.length ? localize("management.noSearchBookings", "No passenger requests match this search.") : localize("management.noBookings", "There are no local passenger requests yet.");
    }
    if (applicationEmpty) {
      applicationEmpty.hidden = filteredApplications.length > 0;
      applicationEmpty.textContent = applications.length ? localize("management.noSearchApplications", "No staff applications match this search.") : localize("management.noApplications", "There are no local staff applications yet.");
    }
    const countTemplate = (count, key, fallback) => (localize(key, fallback)).replace("{count}", new Intl.NumberFormat(root.lang || "en").format(count));
    const bookingCount = document.querySelector('[data-management-count="bookings"]');
    const applicationCount = document.querySelector('[data-management-count="applications"]');
    if (bookingCount) bookingCount.textContent = countTemplate(filteredBookings.length, "management.bookingCount", "{count} records");
    if (applicationCount) applicationCount.textContent = countTemplate(filteredApplications.length, "management.applicationCount", "{count} records");
  }

  function normalizeSearch(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase(root.lang || "en").trim();
  }

  function tableCell(value, className = "", subtext = "") {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.append(document.createTextNode(value || "—"));
    if (subtext) {
      const secondary = document.createElement("span");
      secondary.className = "table-subtext";
      secondary.textContent = subtext;
      cell.append(secondary);
    }
    return cell;
  }

  function makeDetailButton(kind, reference) {
    const cell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-action";
    button.dataset.detailKind = kind;
    button.dataset.detailReference = reference;
    button.textContent = localize("management.viewDetails", "View details");
    button.setAttribute("aria-label", localize("management.viewDetailsFor", "View details for {reference}").replace("{reference}", reference));
    cell.append(button);
    return cell;
  }

  function openManagementDetail(kind, reference) {
    const dialog = document.querySelector("#management-detail-dialog");
    const title = dialog?.querySelector("[data-detail-title]");
    const content = dialog?.querySelector("[data-detail-content]");
    if (!dialog || !title || !content) return;
    const booking = kind === "booking" ? readBookings().find((item) => item.reference === reference) : null;
    const application = kind === "application" ? readApplications().find((item) => item.reference === reference) : null;
    const record = booking || application;
    if (!record) return;
    const isBooking = Boolean(booking);
    const titleTemplate = localize(isBooking ? "management.detailBookingTitle" : "management.detailApplicationTitle", "Record {reference}");
    title.textContent = titleTemplate.replace("{reference}", record.reference);
    content.replaceChildren();
    const add = (key, value, fallback = "") => {
      if (value === undefined || value === null || String(value).trim() === "") return;
      const term = document.createElement("dt");
      term.textContent = localize(key, fallback || key);
      const description = document.createElement("dd");
      description.textContent = String(value);
      content.append(term, description);
    };
    if (isBooking) {
      add("management.reference", record.reference, "Reference");
      add("management.service", serviceNames[record.service] || record.service, "Service");
      add("management.fullName", record.name, "Full name");
      add("management.email", record.email, "Email");
      add("management.phone", record.phone, "Phone");
      add("management.station", record.station, "Station");
      add("management.train", record.train, "Train");
      add("management.travelDate", record.travelDate, "Travel date");
      add("management.coachSeat", record.coachSeat, "Coach / seat");
      const detailLabels = { bags: "management.bags", pickup: "management.pickup", dropoff: "management.dropoff", mealChoice: "management.meal", people: "management.people", facility: "management.support", instructions: "management.instructions" };
      const storedValueLabels = { vegetarian: "form.vegetarian", "non-vegetarian": "form.nonVegetarian", "first-aid": "form.firstAid", wheelchair: "form.wheelchair", "medical-room": "form.medicalRoom", other: "form.otherSupport" };
      for (const [key, value] of Object.entries(record.details || {})) add(detailLabels[key] || "management.otherDetails", localize(storedValueLabels[value], value), key);
    } else {
      add("management.reference", record.reference, "Reference");
      add("management.role", roleNames[record.role] || record.role, "Role");
      add("management.fullName", record.name, "Full name");
      add("management.age", record.age, "Age");
      add("management.gender", record.gender, "Gender");
      add("management.email", record.email, "Email");
      add("management.phone", record.phone, "Phone");
      add("management.qualification", record.qualification, "Qualification");
      add("management.salary", record.salary, "Expected salary");
      add("management.motivation", record.motivation, "Reason for applying");
      add("management.hours", record.hours, "Hours per day");
    }
    add("management.savedAt", formatSavedDate(record.createdAt), "Saved");
    if (!dialog.open) dialog.showModal();
  }

  function setupManagement() {
    const tabs = [...document.querySelectorAll("[data-management-tab]")];
    const panels = [...document.querySelectorAll("[data-management-panel]")];
    const selectTab = (selected) => {
      for (const tab of tabs) {
        const active = tab === selected;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      }
      for (const panel of panels) panel.hidden = panel.dataset.managementPanel !== selected?.dataset.managementTab;
    };
    for (const tab of tabs) {
      tab.addEventListener("click", () => selectTab(tab));
      tab.addEventListener("keydown", (event) => {
        const currentIndex = tabs.indexOf(tab);
        let nextIndex = currentIndex;
        const forwardKey = root.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
        const backwardKey = root.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
        if (event.key === forwardKey) nextIndex = (currentIndex + 1) % tabs.length;
        else if (event.key === backwardKey) nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        tabs[nextIndex].focus();
        selectTab(tabs[nextIndex]);
      });
    }
    for (const input of document.querySelectorAll("[data-management-search]")) input.addEventListener("input", renderManagement);
    document.querySelector("#management")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-detail-kind]");
      if (button) openManagementDetail(button.dataset.detailKind, button.dataset.detailReference);
    });
    document.querySelector("[data-close-detail]")?.addEventListener("click", () => document.querySelector("#management-detail-dialog")?.close());
    document.querySelector("#management-detail-dialog")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
    window.addEventListener("storage", (event) => {
      if (event.key === null || [bookingStorageKey, applicationStorageKey].includes(event.key)) renderManagement();
    });
    renderManagement();
  }

  function applyLocale(locale, dictionary, persist) {
    root.lang = locale;
    root.dir = dictionary["locale.direction"] || "ltr";
    localeDictionary = dictionary;
    for (const element of document.querySelectorAll("[data-i18n]")) {
      const value = dictionary[element.dataset.i18n];
      if (typeof value === "string") element.textContent = value;
    }
    for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
      const value = dictionary[element.dataset.i18nPlaceholder];
      if (typeof value === "string") element.placeholder = value;
    }
    for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
      const value = dictionary[element.dataset.i18nAriaLabel];
      if (typeof value === "string") element.setAttribute("aria-label", value);
    }
    messages.theme.light = {
      label: dictionary["controls.darkTheme"] || "Dark theme",
      next: dictionary["controls.switchToDarkTheme"] || "Switch to dark theme",
    };
    messages.theme.dark = {
      label: dictionary["controls.lightTheme"] || "Light theme",
      next: dictionary["controls.switchToLightTheme"] || "Switch to light theme",
    };
    messages.navigation = {
      open: dictionary["navigation.open"] || "Open navigation",
      close: dictionary["navigation.close"] || "Close navigation",
    };
    const messageKeys = {
      language: "language.moreComing",
      localeError: "dynamic.localeError",
      requestSaved: "dynamic.requestSaved",
      requestSaveError: "dynamic.requestSaveError",
      removePrompt: "dynamic.removePrompt",
      removed: "dynamic.removed",
      emptyBookings: "dynamic.emptyBookings",
      removeRequest: "dynamic.removeRequest",
      coachSeat: "form.coachSeat",
      detailBags: "form.bagsLabel",
      detailPickup: "form.pickupLabel",
      detailDropoff: "form.dropoffLabel",
      detailMeal: "form.mealChoiceLabel",
      detailPeople: "form.peopleLabel",
      detailFacility: "form.facilityLabel",
      detailInstructions: "form.instructionsLabel",
      vegetarian: "form.vegetarian",
      nonVegetarian: "form.nonVegetarian",
      firstAid: "form.firstAid",
      wheelchair: "form.wheelchair",
      medicalRoom: "form.medicalRoom",
      other: "form.otherSupport",
      applicationSaved: "dynamic.applicationSaved",
      applicationSaveError: "dynamic.applicationSaveError",
      removeApplicationPrompt: "dynamic.removeApplicationPrompt",
      applicationRemoved: "dynamic.applicationRemoved",
      emptyApplications: "dynamic.emptyApplications",
      removeApplication: "dynamic.removeApplication",
      hoursPerDay: "application.hoursPerDay",
      age: "application.age",
      gender: "application.genderLabel",
      salary: "application.salaryLabel",
      motivation: "application.motivationLabel",
    };
    for (const [message, key] of Object.entries(messageKeys)) {
      if (typeof dictionary[key] === "string") messages[message] = dictionary[key];
    }
    Object.assign(serviceNames, {
      porter: dictionary["services.porterTitle"] || serviceNames.porter,
      meal: dictionary["services.mealTitle"] || serviceNames.meal,
      medical: dictionary["services.medicalTitle"] || serviceNames.medical,
    });
    Object.assign(roleNames, {
      manager: dictionary["roles.manager"] || roleNames.manager,
      porter: dictionary["roles.porter"] || roleNames.porter,
      medical: dictionary["roles.medical"] || roleNames.medical,
      catering: dictionary["roles.catering"] || roleNames.catering,
    });
    if (languageSelect) languageSelect.value = locale;
    if (persist) {
      try { window.localStorage.setItem("guide-motion-locale", locale); } catch (_) { /* Preference remains active for this page. */ }
    }
    updateThemeControls();
    drawerButton?.setAttribute("aria-label", sidebar?.classList.contains("is-open") ? messages.navigation.close : messages.navigation.open);
    if (toast) toast.hidden = true;
    setFeedback("");
    setApplicationFeedback("");
    renderBookings();
    renderApplications();
    renderManagement();
    if (!facilityDirectoryInitialized) {
      facilityDirectoryInitialized = true;
      setupFacilityDirectory(dictionary);
    } else {
      facilityState.dictionary = dictionary;
      facilityState.drawMapMarkers?.();
      facilityState.render?.();
      facilityState.refreshMapStatus?.();
    }
    navigate({ scroll: false });
  }

  async function loadLocale(locale, persist = false) {
    const allowedLocales = new Set(["en", "hi"]);
    if (!allowedLocales.has(locale)) return;
    const loadId = ++localeLoadId;
    if (languageSelect) {
      languageSelect.value = locale;
      languageSelect.disabled = true;
    }
    try {
      const response = await fetch(`./locales/${locale}.json`);
      if (!response.ok) throw new Error("Locale resource unavailable");
      const dictionary = await response.json();
      if (loadId !== localeLoadId) return;
      applyLocale(locale, dictionary, persist);
    } catch (_) {
      if (loadId === localeLoadId) {
        if (languageSelect) languageSelect.value = root.lang || "en";
        showToast(messages.localeError);
      }
    } finally {
      if (loadId === localeLoadId && languageSelect) languageSelect.disabled = false;
    }
  }

  function getSavedLocale() {
    try {
      const saved = window.localStorage.getItem("guide-motion-locale");
      return ["en", "hi"].includes(saved) ? saved : "en";
    } catch (_) {
      return "en";
    }
  }

  function setFeedback(message, state = "") {
    const feedback = document.querySelector("#request-feedback");
    if (!feedback) return;
    feedback.textContent = message;
    if (state) feedback.dataset.state = state;
    else delete feedback.dataset.state;
  }

  function renderBookings() {
    const list = document.querySelector("#booking-list");
    if (!list) return;
    list.replaceChildren();
    const bookings = readBookings().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    if (!bookings.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = messages.emptyBookings;
      list.append(empty);
      return;
    }
    for (const booking of bookings) {
      const card = document.createElement("article");
      card.className = "booking-card";
      const copy = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = serviceNames[booking.service] || "Passenger service request";
      const ref = document.createElement("p");
      ref.className = "booking-ref";
      ref.textContent = booking.reference;
      const journey = document.createElement("p");
      journey.textContent = [booking.station, booking.train, booking.travelDate].filter(Boolean).join(" · ");
      const contact = document.createElement("p");
      contact.textContent = [booking.name, booking.phone].filter(Boolean).join(" · ");
      copy.append(title, ref, journey, contact);
      const details = booking.details || {};
      const detailEntries = {
        porter: [[messages.detailBags, details.bags], [messages.detailPickup, details.pickup], [messages.detailDropoff, details.dropoff]],
        meal: [[messages.detailMeal, details.mealChoice], [messages.detailPeople, details.people]],
        medical: [[messages.detailFacility, details.facility]],
      }[booking.service] || [];
      const detailValues = {
        vegetarian: messages.vegetarian,
        "non-vegetarian": messages.nonVegetarian,
        "first-aid": messages.firstAid,
        wheelchair: messages.wheelchair,
        "medical-room": messages.medicalRoom,
        other: messages.other,
      };
      for (const entry of detailEntries) entry[1] = detailValues[entry[1]] || entry[1];
      if (booking.coachSeat) detailEntries.push([messages.coachSeat, booking.coachSeat]);
      if (details.instructions) detailEntries.push([messages.detailInstructions, details.instructions]);
      for (const [label, value] of detailEntries) {
        if (!value) continue;
        const line = document.createElement("p");
        line.textContent = `${label}: ${value}`;
        copy.append(line);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-booking";
      remove.dataset.removeBooking = booking.reference;
      remove.textContent = messages.removeRequest;
      card.append(copy, remove);
      list.append(card);
    }
  }

  function renderApplications() {
    const list = document.querySelector("#application-list");
    if (!list) return;
    list.replaceChildren();
    const applications = readApplications().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    if (!applications.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = messages.emptyApplications;
      list.append(empty);
      return;
    }
    for (const application of applications) {
      const card = document.createElement("article");
      card.className = "booking-card";
      const copy = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = roleNames[application.role] || "Staff application";
      const ref = document.createElement("p");
      ref.className = "booking-ref";
      ref.textContent = application.reference;
      const contact = document.createElement("p");
      contact.textContent = [application.name, application.email, application.phone].filter(Boolean).join(" · ");
      const info = document.createElement("p");
      info.textContent = [application.qualification, application.hours ? `${application.hours} ${messages.hoursPerDay}` : ""].filter(Boolean).join(" · ");
      copy.append(title, ref, contact);
      if (info.textContent) copy.append(info);
      for (const [label, value] of [[messages.age, application.age], [messages.gender, application.gender], [messages.salary, application.salary], [messages.motivation, application.motivation]]) {
        if (!value) continue;
        const detail = document.createElement("p");
        detail.textContent = `${label}: ${value}`;
        copy.append(detail);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-booking";
      remove.dataset.removeApplication = application.reference;
      remove.textContent = messages.removeApplication;
      card.append(copy, remove);
      list.append(card);
    }
  }

  function setApplicationFeedback(message, state = "") {
    const feedback = document.querySelector("#application-feedback");
    if (!feedback) return;
    feedback.textContent = message;
    if (state) feedback.dataset.state = state;
    else delete feedback.dataset.state;
  }

  function setupApplicationForm() {
    const form = document.querySelector("#staff-application-form");
    const roleSelect = document.querySelector("#application-role");
    if (!form || !roleSelect) return;
    const ageInput = form.elements.namedItem("age");
    const updateFields = () => {
      for (const group of document.querySelectorAll("[data-role-fields]")) {
        const roles = group.dataset.roleFields.split(",");
        const active = roles.includes(roleSelect.value);
        group.hidden = !active;
        for (const control of group.querySelectorAll("input, select, textarea")) control.disabled = !active;
      }
      if (ageInput) ageInput.required = ["manager", "medical"].includes(roleSelect.value);
      setApplicationFeedback("");
    };
    roleSelect.addEventListener("change", updateFields);
    updateFields();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const application = {
        reference: createReference(readApplications(), "GA"),
        role: String(data.get("role") || ""),
        name: String(data.get("name") || "").trim(),
        age: String(data.get("age") || "").trim(),
        gender: String(data.get("gender") || "").trim(),
        email: String(data.get("email") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        qualification: String(data.get("qualification") || "").trim(),
        salary: String(data.get("salary") || "").trim(),
        motivation: String(data.get("motivation") || "").trim(),
        hours: String(data.get("hours") || "").trim(),
        createdAt: new Date().toISOString(),
      };
      try {
        const existing = readApplications();
        existing.push(application);
        window.localStorage.setItem(applicationStorageKey, JSON.stringify(existing));
      } catch (_) {
        setApplicationFeedback(messages.applicationSaveError, "error");
        return;
      }
      renderApplications();
      setApplicationFeedback(`${messages.applicationSaved} ${application.reference}`);
      form.reset();
      updateFields();
    });
  }

  function setupFacilityDirectory(dictionary) {
    const searchInput = document.querySelector("#facility-search");
    const clearButton = document.querySelector("#facility-clear");
    const resultCount = document.querySelector("#facility-result-count");
    const grid = document.querySelector("#facility-grid");
    const mapMarkers = document.querySelector("#facility-map-markers");
    const mapLegend = document.querySelector("#facility-map-legend");
    const mapStatus = document.querySelector("#map-selection-status");
    const schematic = document.querySelector("#facility-schematic");
    if (!searchInput || !clearButton || !resultCount || !grid || !mapMarkers || !mapLegend) return;
    facilityState.dictionary = dictionary;
    const categoryButtons = [...document.querySelectorAll("[data-facility-category]")];

    const lookup = (key) => facilityState.dictionary[key] || "";
    const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase(root.lang || "en").trim();
    const render = () => {
      if (facilityState.loading) {
        resultCount.textContent = lookup("station.loading") || "Loading sample facilities…";
        grid.replaceChildren();
        return;
      }
      const query = normalize(searchInput.value);
      const filtered = facilityState.records.filter((facility) => {
        if (facilityState.category !== "all" && facility.category !== facilityState.category) return false;
        if (!query) return true;
        const searchable = [
          lookup(facility.nameKey), lookup(facility.locationKey), lookup(facility.descriptionKey),
          lookup(facility.accessKey), lookup(facility.keywordsKey), lookup(`station.category.${facility.category}`),
        ].join(" ");
        return normalize(searchable).includes(query);
      });
      grid.replaceChildren();
      if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "facility-empty";
        empty.textContent = facilityState.records.length ? (lookup("station.noResults") || "No facilities match.") : (lookup("station.loadError") || "Sample directory unavailable.");
        grid.append(empty);
      } else {
        for (const facility of filtered) {
          const card = document.createElement("article");
          card.className = "facility-card";
          card.setAttribute("role", "listitem");
          card.dataset.facilityCard = facility.id;
          card.dataset.selected = String(facility.id === facilityState.selected);
          const top = document.createElement("div");
          top.className = "facility-card-top";
          const name = document.createElement("h3");
          name.textContent = lookup(facility.nameKey) || facility.id;
          const category = document.createElement("span");
          category.className = "facility-category-label";
          category.textContent = lookup(`station.category.${facility.category}`) || facility.category;
          top.append(name, category);
          const location = document.createElement("p");
          location.className = "facility-location";
          location.textContent = lookup(facility.locationKey);
          const description = document.createElement("p");
          description.className = "facility-description";
          description.textContent = lookup(facility.descriptionKey);
          card.append(top, location, description);
          const access = lookup(facility.accessKey);
          if (access) {
            const accessibility = document.createElement("p");
            accessibility.className = "facility-accessibility";
            accessibility.textContent = `${lookup("facility.accessibilityLabel")}: ${access}`;
            card.append(accessibility);
          }
          const mapLink = document.createElement("button");
          mapLink.type = "button";
          mapLink.className = "map-link";
          mapLink.dataset.showMap = facility.id;
          mapLink.textContent = lookup("facility.showMap") || "Show on sketch";
          mapLink.setAttribute("aria-label", (lookup("facility.showOnMapAria") || "Show {name} on the sketch").replace("{name}", lookup(facility.nameKey)));
          card.append(mapLink);
          grid.append(card);
        }
      }
      if (facilityState.records.length === 0) {
        resultCount.textContent = lookup("station.loadError") || "Sample directory unavailable.";
      } else if (filtered.length === 0) {
        resultCount.textContent = lookup("station.noResults") || "No facilities match.";
      } else {
        const plural = new Intl.PluralRules(root.lang || "en").select(filtered.length);
        const countTemplate = lookup(`station.resultCount.${plural}`) || lookup(filtered.length === 1 ? "station.resultCountOne" : "station.resultCountMany") || "{count} facilities";
        resultCount.textContent = countTemplate.replace("{count}", new Intl.NumberFormat(root.lang || "en").format(filtered.length));
      }
    };
    facilityState.render = render;

    const updateSelection = () => {
      for (const button of [...mapMarkers.children, ...mapLegend.children]) {
        button.setAttribute("aria-pressed", String(button.dataset.facilityId === facilityState.selected));
      }
      for (const card of grid.querySelectorAll("[data-facility-card]")) {
        card.dataset.selected = String(card.dataset.facilityCard === facilityState.selected);
      }
    };
    const refreshMapStatus = () => {
      if (!mapStatus) return;
      const selected = facilityState.records.find((item) => item.id === facilityState.selected);
      if (!selected) {
        mapStatus.textContent = lookup("station.mapHint");
        return;
      }
      const selectedTemplate = lookup("station.mapSelected") || "Selected: {name} · {location}";
      mapStatus.textContent = selectedTemplate.replace("{name}", lookup(selected.nameKey)).replace("{location}", lookup(selected.locationKey));
    };
    facilityState.refreshMapStatus = refreshMapStatus;
    const selectFacility = (facilityId, revealCard) => {
      const facility = facilityState.records.find((item) => item.id === facilityId);
      if (!facility) return;
      facilityState.selected = facilityId;
      if (revealCard) {
        searchInput.value = "";
        facilityState.category = facility.category;
        for (const button of categoryButtons) button.setAttribute("aria-pressed", String(button.dataset.facilityCategory === facility.category));
      }
      render();
      updateSelection();
      refreshMapStatus();
      if (revealCard) {
        const card = grid.querySelector(`[data-facility-card="${CSS.escape(facilityId)}"]`);
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.querySelector("[data-show-map]")?.focus({ preventScroll: true });
        }
      } else {
        schematic?.scrollIntoView({ behavior: "smooth", block: "start" });
        mapMarkers.querySelector(`[data-facility-id="${CSS.escape(facilityId)}"]`)?.focus({ preventScroll: true });
      }
    };
    const drawMapMarkers = () => {
      mapMarkers.replaceChildren();
      mapLegend.replaceChildren();
      for (const facility of facilityState.records) {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "map-marker";
        marker.dataset.facilityId = facility.id;
        marker.style.left = `${Math.max(4, Math.min(96, Number(facility.map?.x) || 50))}%`;
        marker.style.top = `${Math.max(4, Math.min(96, Number(facility.map?.y) || 50))}%`;
        marker.textContent = String(facility.map?.number || "•");
        marker.setAttribute("aria-label", (lookup("station.mapMarkerLabel") || "Show {name} in the sample layout").replace("{name}", lookup(facility.nameKey)));
        marker.setAttribute("aria-pressed", String(facility.id === facilityState.selected));
        mapMarkers.append(marker);

        const legendItem = document.createElement("button");
        legendItem.type = "button";
        legendItem.className = "map-legend-item";
        legendItem.dataset.facilityId = facility.id;
        legendItem.setAttribute("aria-pressed", String(facility.id === facilityState.selected));
        const number = document.createElement("span");
        number.className = "map-legend-number";
        number.textContent = marker.textContent;
        const copy = document.createElement("span");
        copy.className = "map-legend-copy";
        const name = document.createElement("strong");
        name.textContent = lookup(facility.nameKey);
        const location = document.createElement("small");
        location.textContent = lookup(facility.locationKey);
        copy.append(name, location);
        legendItem.append(number, copy);
        mapLegend.append(legendItem);
      }
    };
    facilityState.drawMapMarkers = drawMapMarkers;

    searchInput.addEventListener("input", render);
    for (const button of categoryButtons) {
      button.addEventListener("click", () => {
        facilityState.category = button.dataset.facilityCategory;
        for (const item of categoryButtons) item.setAttribute("aria-pressed", String(item === button));
        render();
      });
    }
    mapMarkers.addEventListener("click", (event) => {
      const marker = event.target.closest("[data-facility-id]");
      if (marker) selectFacility(marker.dataset.facilityId, true);
    });
    mapLegend.addEventListener("click", (event) => {
      const item = event.target.closest("[data-facility-id]");
      if (item) selectFacility(item.dataset.facilityId, true);
    });
    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-show-map]");
      if (button) selectFacility(button.dataset.showMap, false);
    });
    clearButton.addEventListener("click", () => {
      searchInput.value = "";
      facilityState.category = "all";
      for (const button of categoryButtons) button.setAttribute("aria-pressed", String(button.dataset.facilityCategory === "all"));
      render();
      searchInput.focus();
    });

    fetch("./data/sample-facilities.json")
      .then((response) => {
        if (!response.ok) throw new Error("Sample facilities unavailable");
        return response.json();
      })
      .then((data) => {
        facilityState.records = Array.isArray(data.facilities) ? data.facilities : [];
        facilityState.loading = false;
        drawMapMarkers();
        render();
      })
      .catch(() => {
        facilityState.records = [];
        facilityState.loading = false;
        drawMapMarkers();
        render();
      });
  }

  function setupServiceForm() {
    const form = document.querySelector("#service-request-form");
    const serviceSelect = document.querySelector("#request-service");
    if (!form || !serviceSelect) return;
    const dateInput = form.elements.namedItem("travelDate");
    if (dateInput) {
      const now = new Date();
      dateInput.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }
    const updateFields = () => {
      for (const group of document.querySelectorAll("[data-service-fields]")) {
        const active = group.dataset.serviceFields === serviceSelect.value;
        group.hidden = !active;
        for (const control of group.querySelectorAll("input, select, textarea")) {
          control.disabled = !active;
        }
      }
      setFeedback("");
    };
    serviceSelect.addEventListener("change", updateFields);
    updateFields();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const booking = {
        reference: createReference(readBookings()),
        service: String(data.get("service") || ""),
        name: String(data.get("name") || "").trim(),
        email: String(data.get("email") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        station: String(data.get("station") || "").trim(),
        train: String(data.get("train") || "").trim(),
        travelDate: String(data.get("travelDate") || ""),
        coachSeat: String(data.get("coachSeat") || "").trim(),
        createdAt: new Date().toISOString(),
        details: {},
      };
      const detailKeys = {
        porter: ["bags", "pickup", "dropoff"],
        meal: ["mealChoice", "people"],
        medical: ["facility"],
      };
      for (const key of detailKeys[booking.service] || []) {
        booking.details[key] = String(data.get(key) || "").trim();
      }
      booking.details.instructions = String(data.get("instructions") || "").trim();
      try {
        const existing = readBookings();
        existing.push(booking);
        window.localStorage.setItem(bookingStorageKey, JSON.stringify(existing));
      } catch (_) {
        setFeedback(messages.requestSaveError, "error");
        return;
      }
      renderBookings();
      setFeedback(`${messages.requestSaved} ${booking.reference}`);
      form.reset();
      updateFields();
    });
  }

  function createReference(existing, prefix = "GM") {
    const known = new Set(existing.map((item) => item.reference));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      let part;
      try {
        const values = new Uint32Array(1);
        window.crypto.getRandomValues(values);
        part = values[0].toString(36).slice(-6).toUpperCase().padStart(6, "0");
      } catch (_) {
        part = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
      }
      const reference = `${prefix}-${new Date().getFullYear()}-${part}`;
      if (!known.has(reference)) return reference;
    }
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }

  themeButton?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = nextTheme;
    try { window.localStorage.setItem("guide-motion-theme", nextTheme); } catch (_) { /* Private browsing may block storage. */ }
    updateThemeControls();
  });

  drawerButton?.addEventListener("click", () => setDrawer(true));
  drawerScrim?.addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar?.classList.contains("is-open")) setDrawer(false);
    if (event.key === "Tab" && sidebar?.classList.contains("is-open")) {
      const items = [...sidebar.querySelectorAll("a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  window.matchMedia("(max-width: 900px)").addEventListener("change", (event) => {
    if (!event.matches && sidebar) setDrawer(false);
    if (event.matches && sidebar && !sidebar.classList.contains("is-open")) sidebar.inert = true;
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    const route = link?.getAttribute("href")?.slice(1);
    if (!route || !routes.some((item) => item.dataset.route === route)) return;
    event.preventDefault();
    if (window.location.hash !== `#${route}`) window.history.pushState({}, "", `#${route}`);
    navigate();
  });
  window.addEventListener("hashchange", navigate);
  window.addEventListener("load", () => {
    if (window.location.hash) scrollToPageTop();
  }, { once: true });
  languageSelect?.addEventListener("change", () => loadLocale(languageSelect.value, true));
  document.querySelector("#booking-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-booking]");
    if (!button || !window.confirm(messages.removePrompt)) return;
    const remaining = readBookings().filter((booking) => booking.reference !== button.dataset.removeBooking);
    try {
      window.localStorage.setItem(bookingStorageKey, JSON.stringify(remaining));
      renderBookings();
      showToast(messages.removed);
    } catch (_) {
      showToast(messages.requestSaveError);
    }
  });
  document.querySelector("#application-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-application]");
    if (!button || !window.confirm(messages.removeApplicationPrompt)) return;
    const remaining = readApplications().filter((application) => application.reference !== button.dataset.removeApplication);
    try {
      window.localStorage.setItem(applicationStorageKey, JSON.stringify(remaining));
      renderApplications();
      showToast(messages.applicationRemoved);
    } catch (_) {
      showToast(messages.applicationSaveError);
    }
  });

  updateThemeControls();
  renderBookings();
  renderApplications();
  setupServiceForm();
  setupApplicationForm();
  setupManagement();
  if (sidebar) sidebar.inert = window.matchMedia("(max-width: 900px)").matches;
  navigate();

  loadLocale(getSavedLocale());
})();
