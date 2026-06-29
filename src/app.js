import {
  ORIGINAL_ADMIN_EMAIL,
  PTO_ALLOWANCE_HOURS,
  approveRequest,
  buildRequest,
  calculateHours,
  canAccessAdmin,
  canAccessEmployee,
  getRoleForLogin,
  verifyMakeupEntry
} from "./pto.js";

const todayISO = "2026-06-27";

const seed = {
  profiles: [
    {
      id: "owner",
      email: ORIGINAL_ADMIN_EMAIL,
      fullName: "Anusha Patel",
      role: "Admin",
      status: "Active",
      protectedOwner: true
    },
    {
      id: "employee-1",
      email: "employee@example.com",
      fullName: "Demo Employee",
      role: "Employee",
      status: "Active",
      protectedOwner: false
    }
  ],
  balances: {
    "employee-1": {
      employeeId: "employee-1",
      calendarYear: 2026,
      annualAllowanceHours: PTO_ALLOWANCE_HOURS,
      usedHours: 8,
      remainingHours: 40,
      expiresOn: "2026-12-31"
    }
  },
  requests: [],
  auditEvents: []
};

const store = {
  read() {
    const saved = localStorage.getItem("pto-demo-state");
    return saved ? JSON.parse(saved) : structuredClone(seed);
  },
  write(state) {
    localStorage.setItem("pto-demo-state", JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem("pto-demo-state");
  }
};

let state = store.read();
let currentUser = JSON.parse(sessionStorage.getItem("pto-current-user") || "null");

function save() {
  store.write(state);
  sessionStorage.setItem("pto-current-user", JSON.stringify(currentUser));
  render();
}

function audit(action, targetType, targetId) {
  state.auditEvents.unshift({
    id: crypto.randomUUID(),
    actorEmail: currentUser?.email || "system",
    action,
    targetType,
    targetId,
    createdAt: new Date().toISOString()
  });
}

function signIn(email, fullName) {
  const normalized = email.trim().toLowerCase();
  let profile = state.profiles.find((item) => item.email.toLowerCase() === normalized);
  const loginRole = getRoleForLogin(normalized, profile);
  if (!profile) {
    profile = {
      id: crypto.randomUUID(),
      email: normalized,
      fullName: fullName || normalized.split("@")[0],
      ...loginRole
    };
    state.profiles.push(profile);
    audit("user.login_pending_created", "user_profile", profile.id);
  }
  if (normalized === ORIGINAL_ADMIN_EMAIL && (profile.role !== "Admin" || profile.status !== "Active")) {
    profile.role = "Admin";
    profile.status = "Active";
    profile.protectedOwner = true;
    audit("owner.bootstrap_admin", "user_profile", profile.id);
  }
  if (!state.balances[profile.id] && profile.role === "Employee") {
    state.balances[profile.id] = {
      employeeId: profile.id,
      calendarYear: 2026,
      annualAllowanceHours: PTO_ALLOWANCE_HOURS,
      usedHours: 0,
      remainingHours: PTO_ALLOWANCE_HOURS,
      expiresOn: "2026-12-31"
    };
  }
  currentUser = profile;
  save();
}

function updateProfile(id, changes) {
  const profile = state.profiles.find((item) => item.id === id);
  if (!profile || profile.protectedOwner) return;
  Object.assign(profile, changes, {
    roleAssignedBy: currentUser.email,
    roleAssignedAt: new Date().toISOString()
  });
  if (!state.balances[profile.id] && profile.role === "Employee") {
    state.balances[profile.id] = {
      employeeId: profile.id,
      calendarYear: 2026,
      annualAllowanceHours: PTO_ALLOWANCE_HOURS,
      usedHours: 0,
      remainingHours: PTO_ALLOWANCE_HOURS,
      expiresOn: "2026-12-31"
    };
  }
  audit("admin.user_role_or_status_changed", "user_profile", profile.id);
  save();
}

function submitRequest(form) {
  const type = form.get("type");
  const segments = collectRows("request-segment").filter((row) => row.date && row.startTime && row.endTime);
  const makeupEntries = collectRows("makeup-entry").filter((row) => row.date && row.startTime && row.endTime);
  if (!segments.length) return alert("Add at least one requested time block.");
  if (type !== "PTO" && !makeupEntries.length) return alert("Additional or emergency time off needs a make-up plan.");
  const request = buildRequest({
    employeeId: currentUser.id,
    type,
    reason: form.get("reason"),
    segments,
    makeupEntries,
    todayISO
  });
  state.requests.unshift(request);
  audit("employee.time_off_submitted", "time_off_request", request.id);
  save();
}

function collectRows(className) {
  return [...document.querySelectorAll(`.${className}`)].map((row) => ({
    date: row.querySelector("[data-date]").value,
    startTime: row.querySelector("[data-start]").value,
    endTime: row.querySelector("[data-end]").value,
    note: row.querySelector("[data-note]")?.value || ""
  }));
}

function actOnRequest(id, status) {
  const request = state.requests.find((item) => item.id === id);
  if (!request || !canAccessAdmin(currentUser)) return;
  if (status === "Approved") {
    const balance = state.balances[request.employeeId];
    const result = approveRequest(request, balance, currentUser.email);
    Object.assign(request, result.request);
    state.balances[request.employeeId] = result.balance;
    audit("admin.time_off_approved", "time_off_request", request.id);
  } else {
    request.status = "Rejected";
    request.approverEmail = currentUser.email;
    request.approvedAt = new Date().toISOString();
    audit("admin.time_off_rejected", "time_off_request", request.id);
  }
  save();
}

function verifyMakeup(requestId, entryIndex, status) {
  const request = state.requests.find((item) => item.id === requestId);
  request.makeupEntries[entryIndex] = verifyMakeupEntry(
    request.makeupEntries[entryIndex],
    status,
    currentUser.email
  );
  audit(`admin.makeup_${status.toLowerCase().replace(" ", "_")}`, "makeup_plan_entry", `${requestId}:${entryIndex}`);
  save();
}

function addRow(target, className) {
  const container = document.querySelector(target);
  container.insertAdjacentHTML("beforeend", rowTemplate(className));
  bindCalculators();
}

function rowTemplate(className) {
  return `
    <div class="time-row ${className}">
      <input data-date type="date" value="2026-07-15" />
      <input data-start type="time" value="09:00" />
      <input data-end type="time" value="12:00" />
      <input data-note type="text" placeholder="Optional note" />
      <strong data-hours>3h</strong>
    </div>
  `;
}

function bindCalculators() {
  document.querySelectorAll(".time-row").forEach((row) => {
    const update = () => {
      row.querySelector("[data-hours]").textContent = `${calculateHours(
        row.querySelector("[data-start]").value,
        row.querySelector("[data-end]").value
      )}h`;
    };
    row.querySelectorAll("input").forEach((input) => input.addEventListener("input", update));
    update();
  });
}

function layout(content) {
  return `
    <section class="shell">
      <aside>
        <div class="brand">
          <span>G</span>
          <div>
            <h1>Gramercy Time Off</h1>
            <p>Hour-based PTO and make-up approvals</p>
          </div>
        </div>
        ${currentUser ? `
          <nav>
            <button data-view="employee">My time off</button>
            ${canAccessAdmin(currentUser) ? '<button data-view="admin">Admin</button>' : ""}
            <button data-view="reports">Reports</button>
          </nav>
          <div class="signed-in">
            <strong>${currentUser.fullName}</strong>
            <span>${currentUser.email}</span>
            <small>${currentUser.role} · ${currentUser.status}</small>
            <button class="ghost" data-action="logout">Sign out</button>
          </div>
        ` : ""}
      </aside>
      <section class="content">${content}</section>
    </section>
  `;
}

function loginView() {
  return layout(`
    <div class="login-panel">
      <p class="eyebrow">Google OAuth MVP</p>
      <h2>Sign in with your approved Google account</h2>
      <p>In production this button connects to Supabase Google Auth. This local build simulates the same role flow, including first-admin bootstrap and pending access.</p>
      <form id="login-form">
        <input name="fullName" placeholder="Full name" value="Anusha Patel" />
        <input name="email" type="email" placeholder="Google email" value="${ORIGINAL_ADMIN_EMAIL}" />
        <button>Continue with Google</button>
      </form>
      <div class="hint">Try ${ORIGINAL_ADMIN_EMAIL} for Admin or a new email to see Access Pending.</div>
    </div>
  `);
}

function pendingView() {
  return layout(`
    <div class="login-panel">
      <p class="eyebrow">Access pending</p>
      <h2>Your account is waiting for admin approval</h2>
      <p>An admin must activate your profile and assign a role before you can use the PTO platform.</p>
      <button data-action="logout">Use another account</button>
    </div>
  `);
}

function employeeView() {
  const balance = state.balances[currentUser.id] || { annualAllowanceHours: 48, usedHours: 0, remainingHours: 48 };
  const requests = state.requests.filter((item) => item.employeeId === currentUser.id);
  return layout(`
    <header class="page-header">
      <div>
        <p class="eyebrow">Employee portal</p>
        <h2>Request time off</h2>
      </div>
      <div class="metric"><span>${balance.remainingHours}</span><small>hours left</small></div>
    </header>
    <section class="grid two">
      <form class="panel" id="request-form">
        <h3>New request</h3>
        <label>Request type
          <select name="type">
            <option>PTO</option>
            <option>Additional Time Off</option>
            <option>Emergency/Exception</option>
          </select>
        </label>
        <label>Reason
          <textarea name="reason" placeholder="Brief written request"></textarea>
        </label>
        <div class="section-heading">
          <strong>Requested hours</strong>
          <button type="button" class="ghost" data-add-row="#request-segments">Add day</button>
        </div>
        <div id="request-segments">${rowTemplate("request-segment")}</div>
        <div class="section-heading">
          <strong>Make-up plan</strong>
          <button type="button" class="ghost" data-add-row="#makeup-entries">Add make-up day</button>
        </div>
        <div id="makeup-entries">${rowTemplate("makeup-entry")}</div>
        <button>Submit written request</button>
      </form>
      <section class="panel">
        <h3>My balance</h3>
        <div class="balance-bar"><span style="width:${(balance.usedHours / balance.annualAllowanceHours) * 100}%"></span></div>
        <div class="split">
          <span>Used: ${balance.usedHours}h</span>
          <span>Annual: ${balance.annualAllowanceHours}h</span>
        </div>
        <h3>My requests</h3>
        ${requests.length ? requests.map(requestCard).join("") : '<p class="empty">No requests yet.</p>'}
      </section>
    </section>
  `);
}

function adminView() {
  const pendingUsers = state.profiles.filter((profile) => !profile.protectedOwner);
  return layout(`
    <header class="page-header">
      <div>
        <p class="eyebrow">Admin dashboard</p>
        <h2>Approvals, users, and make-up verification</h2>
      </div>
      <div class="metric"><span>${state.requests.filter((item) => item.status === "Pending").length}</span><small>pending</small></div>
    </header>
    <section class="grid two">
      <section class="panel">
        <h3>Time-off approvals</h3>
        ${state.requests.length ? state.requests.map(adminRequestCard).join("") : '<p class="empty">No requests submitted.</p>'}
      </section>
      <section class="panel">
        <h3>User roles</h3>
        ${pendingUsers.map(userRow).join("")}
      </section>
    </section>
  `);
}

function reportsView() {
  const upcoming = state.requests.flatMap((request) =>
    request.makeupEntries.map((entry, index) => ({ request, entry, index }))
  );
  return layout(`
    <header class="page-header">
      <div>
        <p class="eyebrow">Reports</p>
        <h2>Make-up reminders and audit trail</h2>
      </div>
    </header>
    <section class="grid two">
      <section class="panel">
        <h3>Make-up work report</h3>
        ${upcoming.length ? upcoming.map(({ request, entry }) => `
          <div class="list-row">
            <strong>${employeeName(request.employeeId)}</strong>
            <span>${entry.date} · ${entry.startTime}-${entry.endTime} · ${entry.plannedHours}h</span>
            <small>${entry.verificationStatus}</small>
          </div>
        `).join("") : '<p class="empty">No make-up entries yet.</p>'}
      </section>
      <section class="panel">
        <h3>Audit events</h3>
        ${state.auditEvents.map((event) => `
          <div class="list-row">
            <strong>${event.action}</strong>
            <span>${event.actorEmail}</span>
            <small>${new Date(event.createdAt).toLocaleString()}</small>
          </div>
        `).join("")}
      </section>
    </section>
  `);
}

function requestCard(request) {
  return `
    <article class="request-card">
      <div><strong>${request.type}</strong><span>${request.totalRequestedHours} requested hours</span></div>
      <small class="${request.status.toLowerCase()}">${request.status}</small>
      ${request.isLateNotice ? '<p class="warning">Late notice: under 14 calendar days.</p>' : ""}
    </article>
  `;
}

function adminRequestCard(request) {
  return `
    <article class="request-card">
      <div>
        <strong>${employeeName(request.employeeId)} · ${request.type}</strong>
        <span>${request.totalRequestedHours}h requested · ${request.totalMakeupHours}h make-up planned</span>
      </div>
      <small class="${request.status.toLowerCase()}">${request.status}</small>
      ${request.isLateNotice ? '<p class="warning">Late notice: under 14 calendar days.</p>' : ""}
      <div class="actions">
        <button data-approve="${request.id}" ${request.status !== "Pending" ? "disabled" : ""}>Approve</button>
        <button class="ghost" data-reject="${request.id}" ${request.status !== "Pending" ? "disabled" : ""}>Reject</button>
      </div>
      ${request.makeupEntries.map((entry, index) => `
        <div class="makeup-line">
          <span>${entry.date} · ${entry.startTime}-${entry.endTime} · ${entry.plannedHours}h · ${entry.verificationStatus}</span>
          <button class="ghost" data-worked="${request.id}:${index}">Worked</button>
          <button class="ghost" data-not-worked="${request.id}:${index}">Not worked</button>
        </div>
      `).join("")}
    </article>
  `;
}

function userRow(profile) {
  return `
    <div class="user-row">
      <div>
        <strong>${profile.fullName}</strong>
        <span>${profile.email}</span>
      </div>
      <select data-role="${profile.id}">
        <option ${profile.role === "Employee" ? "selected" : ""}>Employee</option>
        <option ${profile.role === "Admin" ? "selected" : ""}>Admin</option>
      </select>
      <select data-status="${profile.id}">
        <option ${profile.status === "Pending" ? "selected" : ""}>Pending</option>
        <option ${profile.status === "Active" ? "selected" : ""}>Active</option>
        <option ${profile.status === "Disabled" ? "selected" : ""}>Disabled</option>
      </select>
    </div>
  `;
}

function employeeName(id) {
  return state.profiles.find((profile) => profile.id === id)?.fullName || "Unknown employee";
}

function render() {
  const view = location.hash.replace("#", "") || "employee";
  if (!currentUser) {
    app.innerHTML = loginView();
  } else if (!canAccessEmployee(currentUser)) {
    app.innerHTML = pendingView();
  } else if (view === "admin" && canAccessAdmin(currentUser)) {
    app.innerHTML = adminView();
  } else if (view === "reports") {
    app.innerHTML = reportsView();
  } else {
    app.innerHTML = employeeView();
  }
  bindEvents();
  bindCalculators();
}

function bindEvents() {
  document.querySelector("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    signIn(new FormData(event.target).get("email"), new FormData(event.target).get("fullName"));
  });
  document.querySelector("#request-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitRequest(new FormData(event.target));
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = button.dataset.view;
      render();
    });
  });
  document.querySelectorAll("[data-add-row]").forEach((button) => {
    button.addEventListener("click", () => addRow(button.dataset.addRow, button.dataset.addRow.includes("makeup") ? "makeup-entry" : "request-segment"));
  });
  document.querySelectorAll("[data-approve]").forEach((button) => button.addEventListener("click", () => actOnRequest(button.dataset.approve, "Approved")));
  document.querySelectorAll("[data-reject]").forEach((button) => button.addEventListener("click", () => actOnRequest(button.dataset.reject, "Rejected")));
  document.querySelectorAll("[data-worked]").forEach((button) => button.addEventListener("click", () => {
    const [requestId, index] = button.dataset.worked.split(":");
    verifyMakeup(requestId, Number(index), "Worked");
  }));
  document.querySelectorAll("[data-not-worked]").forEach((button) => button.addEventListener("click", () => {
    const [requestId, index] = button.dataset.notWorked.split(":");
    verifyMakeup(requestId, Number(index), "Not Worked");
  }));
  document.querySelectorAll("[data-role]").forEach((select) => {
    select.addEventListener("change", () => updateProfile(select.dataset.role, { role: select.value }));
  });
  document.querySelectorAll("[data-status]").forEach((select) => {
    select.addEventListener("change", () => updateProfile(select.dataset.status, { status: select.value }));
  });
  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", () => {
      currentUser = null;
      sessionStorage.removeItem("pto-current-user");
      render();
    });
  });
}

window.addEventListener("hashchange", render);
render();
