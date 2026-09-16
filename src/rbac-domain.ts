// rbac-domain.ts — who may do what (client A, BRD v1.0 §22 «الصلاحيات المقترحة», NFR-001/007), and which
// operations are written to the audit log (NFR-002). Slice S7.
//
// Until this slice there was one credential, ADMIN_TOKEN, and it could do everything. It still can: the
// environment token is «مدير النظام» and nothing here narrows it, so no deploy of this slice can lock the
// founder out. Users are ADDED beside it, each with one of the BRD's five roles, and every /admin route names
// the permission it needs in ROUTE_PERMISSIONS below. A route that is not in the table is open to the system
// administrator only — a new route is closed until someone decides who may use it, never open by omission
// (scripts/check-rbac-routes.mjs asserts every registered /admin route is listed).
//
// PURE. can() and the tables are serialised into the page, which hides what a role cannot use; the server is
// the authority and refuses it anyway.

// ---------------------------------------------------------------------------------------- roles

export const ROLES = ["exec", "product_manager", "sales", "partner", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  exec: "تنفيذي", product_manager: "مدير منتج", sales: "مبيعات", partner: "شريك", admin: "مدير نظام",
};
export const ROLE_DESCRIPTIONS: Readonly<Record<Role, string>> = {
  exec: "يرى لوحات الأداء والتقارير وكل الشاشات، ولا يعدّل.",
  product_manager: "يدير المنتجات ومعرفتها والمؤشرات والحملات ومستهدفات الشركاء.",
  sales: "يدير الفرص والعملاء ونتائج التواصل، ويرى المؤشرات والمعرفة والحملات.",
  partner: "يسجّل نتائج تواصل شركته فقط، ويرى مستهدفها وإنجازها.",
  admin: "كل الصلاحيات، ومنها المستخدمون والإعدادات وسجل التدقيق.",
};

// ---------------------------------------------------------------------------------------- permissions

export const PERMISSIONS = [
  "dashboards.view",
  "conversations.view", "conversations.act",
  "customers.view", "customers.edit",
  "indicators.view", "indicators.edit",
  "knowledge.view", "knowledge.edit",
  "campaigns.view", "campaigns.create", "campaigns.launch",
  "opps.view", "opps.edit",
  "partners.view", "partners.manage", "partner_results.edit",
  "settings.view", "org.manage", "audit.view",
  "messaging.raw",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** §22, row by row. «عرض» is the .view permission; «محدود» is taken as view without the write; «✓» is both.
 *  Where the matrix is silent (conversations, settings, partners) the grant follows the BRD's own user column:
 *  partner targets are the product manager's (BR-PRT-001), human control of a conversation is sales' (BR-AI-006). */
export const ROLE_GRANTS: Readonly<Record<Role, readonly Permission[]>> = {
  exec: ["dashboards.view", "conversations.view", "customers.view", "indicators.view", "knowledge.view", "campaigns.view", "opps.view", "partners.view", "settings.view"],
  product_manager: ["dashboards.view", "conversations.view", "conversations.act", "customers.view", "customers.edit", "indicators.view", "indicators.edit",
    // campaigns.launch stays with the system administrator (DEC-14): a launch sends WhatsApp to real customers, and
    // who may do that is the founder's decision (CLAUDE.md §7), not one this slice takes for him.
    "knowledge.view", "knowledge.edit", "campaigns.view", "campaigns.create", "opps.view", "partners.view", "partners.manage", "settings.view"],
  sales: ["dashboards.view", "conversations.view", "conversations.act", "customers.view", "customers.edit", "indicators.view", "knowledge.view", "campaigns.view",
    "opps.view", "opps.edit", "partners.view", "partner_results.edit", "settings.view"],
  // A partner sees ITS OWN company on «شركاء المبيعات» and records its results. The routes it reaches scope the
  // data to its partner id (partnerScope below); nothing else — no customers, conversations or reports (NFR-007).
  partner: ["partners.view", "partner_results.edit"],
  admin: PERMISSIONS,
};

export function can(role: unknown, permission: unknown): boolean {
  var grants = (ROLE_GRANTS as Record<string, readonly string[]>)[String(role)];
  return !!grants && grants.indexOf(String(permission)) >= 0;
}

/** The §22 table as the users screen prints it: each function, and per role ✓ / عرض / —. */
export const MATRIX_ROWS: readonly { label: string; view: Permission; edit: Permission | null }[] = [
  { label: "عرض لوحات الأداء", view: "dashboards.view", edit: null },
  { label: "إدارة العملاء", view: "customers.view", edit: "customers.edit" },
  { label: "إدارة المؤشرات", view: "indicators.view", edit: "indicators.edit" },
  { label: "إدارة معرفة المنتج", view: "knowledge.view", edit: "knowledge.edit" },
  { label: "إنشاء/إطلاق حملة", view: "campaigns.view", edit: "campaigns.create" },
  { label: "إدارة الفرص", view: "opps.view", edit: "opps.edit" },
  { label: "تحديث نتائج التواصل", view: "partners.view", edit: "partner_results.edit" },
  { label: "المحادثات والتدخل", view: "conversations.view", edit: "conversations.act" },
  { label: "إدارة الهيكل والصلاحيات", view: "org.manage", edit: "org.manage" },
];
export function matrixCell(role: unknown, row: { view: string; edit: string | null }): "full" | "view" | "none" {
  var v = can(role, row.view), e = row.edit ? can(role, row.edit) : v;
  return v && e ? "full" : v ? "view" : "none";
}

// ---------------------------------------------------------------------------------------- routes

/** Every /admin route and the permission it needs. `label` is what the audit log prints for a write. */
export const ROUTE_PERMISSIONS: readonly { method: string; url: string; permission: Permission; label: string }[] = [
  // the shell every screen boots from — each strips what the role may not see (see index.ts)
  { method: "GET", url: "/admin/me", permission: "partners.view", label: "" },
  { method: "GET", url: "/admin/state", permission: "partners.view", label: "" },
  { method: "GET", url: "/admin/tags", permission: "partners.view", label: "" },
  // conversations
  { method: "GET", url: "/admin/customer/:phone", permission: "conversations.view", label: "" },
  { method: "GET", url: "/admin/insights", permission: "conversations.view", label: "" },
  { method: "POST", url: "/admin/contact/human", permission: "conversations.act", label: "تغيير تحكم المساعد في محادثة" },
  { method: "POST", url: "/admin/contact/outcome", permission: "conversations.act", label: "تغيير نتيجة محادثة" },
  { method: "POST", url: "/admin/contact/props", permission: "conversations.act", label: "تعديل بيانات محادثة" },
  { method: "POST", url: "/admin/contact/tags", permission: "conversations.act", label: "تعديل اهتمام عميل" },
  { method: "POST", url: "/admin/contact/test", permission: "conversations.act", label: "تصنيف محادثة كتجريبية" },
  { method: "GET", url: "/admin/answer-reviews", permission: "conversations.view", label: "" },
  { method: "POST", url: "/admin/answer-reviews", permission: "conversations.act", label: "تقييم دقة رد المساعد" },
  { method: "GET", url: "/admin/tasks", permission: "customers.view", label: "" },
  { method: "POST", url: "/admin/tasks", permission: "customers.edit", label: "إنشاء مهمة" },
  { method: "PATCH", url: "/admin/tasks/:id", permission: "customers.edit", label: "تعديل مهمة" },
  { method: "DELETE", url: "/admin/tasks/:id", permission: "customers.edit", label: "حذف مهمة" },
  { method: "GET", url: "/admin/notes", permission: "customers.view", label: "" },
  { method: "POST", url: "/admin/notes", permission: "customers.edit", label: "إضافة ملاحظة" },
  { method: "PATCH", url: "/admin/notes/:id", permission: "customers.edit", label: "تعديل ملاحظة" },
  { method: "DELETE", url: "/admin/notes/:id", permission: "customers.edit", label: "حذف ملاحظة" },
  // customers
  { method: "GET", url: "/admin/accounts", permission: "customers.view", label: "" },
  { method: "POST", url: "/admin/accounts", permission: "customers.edit", label: "إضافة عميل" },
  { method: "GET", url: "/admin/accounts/:id", permission: "customers.view", label: "" },
  { method: "PATCH", url: "/admin/accounts/:id", permission: "customers.edit", label: "تعديل عميل" },
  { method: "POST", url: "/admin/accounts/:id/approval", permission: "customers.edit", label: "اعتماد عميل أو رفضه" },
  { method: "GET", url: "/admin/entities", permission: "customers.view", label: "" },
  { method: "POST", url: "/admin/entities", permission: "customers.edit", label: "إضافة جهات استهداف" },
  { method: "POST", url: "/admin/entities/delete", permission: "customers.edit", label: "حذف جهات استهداف" },
  { method: "POST", url: "/admin/entities/import", permission: "customers.edit", label: "استيراد جهات استهداف" },
  { method: "POST", url: "/admin/entities/tag", permission: "customers.edit", label: "وسم جهات استهداف بمنتج" },
  { method: "POST", url: "/admin/entity/facts", permission: "customers.edit", label: "تعديل معلومات عميل" },
  { method: "GET", url: "/admin/segments/presets", permission: "customers.view", label: "" },
  { method: "POST", url: "/admin/segments/preview", permission: "customers.view", label: "" },
  // indicators
  { method: "GET", url: "/admin/indicators", permission: "indicators.view", label: "" },
  { method: "POST", url: "/admin/indicators", permission: "indicators.edit", label: "إنشاء مؤشر استخدام" },
  { method: "GET", url: "/admin/indicators/:id", permission: "indicators.view", label: "" },
  { method: "PATCH", url: "/admin/indicators/:id", permission: "indicators.edit", label: "تعديل مؤشر استخدام" },
  { method: "POST", url: "/admin/indicators/:id/status", permission: "indicators.edit", label: "تغيير حالة مؤشر" },
  { method: "GET", url: "/admin/indicators/for-customer/:phone", permission: "indicators.view", label: "" },
  { method: "GET", url: "/admin/indicators/membership", permission: "indicators.view", label: "" },
  { method: "POST", url: "/admin/indicators/preview", permission: "indicators.edit", label: "" },
  { method: "GET", url: "/admin/campaign-suggestions", permission: "campaigns.view", label: "" },
  { method: "POST", url: "/admin/campaign-suggestions/dismiss", permission: "campaigns.create", label: "تجاهل فرصة استهداف" },
  { method: "POST", url: "/admin/campaign-suggestions/restore", permission: "campaigns.create", label: "استعادة فرصة استهداف" },
  // knowledge and products
  { method: "GET", url: "/admin/products", permission: "knowledge.view", label: "" },
  { method: "POST", url: "/admin/products", permission: "knowledge.edit", label: "إنشاء منتج" },
  { method: "PATCH", url: "/admin/products", permission: "knowledge.edit", label: "تعديل منتج" },
  { method: "POST", url: "/admin/products/archive", permission: "knowledge.edit", label: "أرشفة منتج أو استعادته" },
  { method: "GET", url: "/admin/products/impact", permission: "knowledge.view", label: "" },
  { method: "GET", url: "/admin/products/knowledge", permission: "knowledge.view", label: "" },
  { method: "POST", url: "/admin/products/knowledge/approve", permission: "knowledge.edit", label: "اعتماد معرفة منتج" },
  { method: "POST", url: "/admin/products/knowledge/approve-current", permission: "knowledge.edit", label: "اعتماد النص الحالي لمعرفة منتج" },
  { method: "POST", url: "/admin/products/knowledge/discard", permission: "knowledge.edit", label: "تجاهل مسودة معرفة" },
  { method: "POST", url: "/admin/products/knowledge/draft", permission: "knowledge.edit", label: "حفظ مسودة معرفة" },
  { method: "GET", url: "/admin/products/performance", permission: "dashboards.view", label: "" },
  { method: "POST", url: "/admin/products/reconcile", permission: "knowledge.edit", label: "ربط ملف بمنتج" },
  { method: "GET", url: "/admin/kb", permission: "knowledge.view", label: "" },
  { method: "POST", url: "/admin/kb/upload", permission: "knowledge.edit", label: "رفع ملف معرفة" },
  { method: "POST", url: "/admin/product-asset/upload", permission: "knowledge.edit", label: "رفع ملف تعريفي" },
  { method: "GET", url: "/admin/product-assets", permission: "knowledge.view", label: "" },
  { method: "POST", url: "/admin/tags", permission: "knowledge.edit", label: "إضافة منتج" },
  { method: "POST", url: "/admin/tags/delete", permission: "knowledge.edit", label: "حذف منتج" },
  { method: "POST", url: "/admin/tags/rename", permission: "knowledge.edit", label: "إعادة تسمية منتج" },
  { method: "GET", url: "/admin/packages", permission: "knowledge.view", label: "" },
  { method: "POST", url: "/admin/packages", permission: "knowledge.edit", label: "إضافة باقة" },
  { method: "PATCH", url: "/admin/packages/:id", permission: "knowledge.edit", label: "تعديل باقة" },
  { method: "POST", url: "/admin/packages/:id/retire", permission: "knowledge.edit", label: "تقاعد باقة" },
  { method: "GET", url: "/admin/sectors", permission: "knowledge.view", label: "" },
  // campaigns
  { method: "GET", url: "/admin/campaigns", permission: "campaigns.view", label: "" },
  { method: "GET", url: "/admin/campaigns/:id/results", permission: "campaigns.view", label: "" },
  { method: "GET", url: "/admin/templates", permission: "campaigns.view", label: "" },
  { method: "POST", url: "/admin/compose", permission: "campaigns.create", label: "" },
  { method: "POST", url: "/admin/campaign/repeat-check", permission: "campaigns.create", label: "" },
  { method: "POST", url: "/admin/campaign/test", permission: "campaigns.launch", label: "تعليم حملة كتجريبية" },
  { method: "POST", url: "/admin/campaign/launch", permission: "campaigns.launch", label: "إطلاق حملة" },
  { method: "POST", url: "/admin/send-test", permission: "messaging.raw", label: "إرسال رسالة اختبار" },
  { method: "POST", url: "/admin/send-template", permission: "messaging.raw", label: "إرسال قالب" },
  // opportunities
  { method: "GET", url: "/admin/opps", permission: "opps.view", label: "" },
  { method: "POST", url: "/admin/opps", permission: "opps.edit", label: "إنشاء فرصة بيع" },
  { method: "PATCH", url: "/admin/opps/:id", permission: "opps.edit", label: "تحديث فرصة بيع" },
  { method: "DELETE", url: "/admin/opps/:id", permission: "opps.edit", label: "حذف فرصة بيع" },
  { method: "GET", url: "/admin/opps/:id/work", permission: "opps.view", label: "" },
  { method: "POST", url: "/admin/opps/:id/activities", permission: "opps.edit", label: "تسجيل نشاط على فرصة" },
  { method: "DELETE", url: "/admin/opp-activities/:id", permission: "opps.edit", label: "حذف نشاط" },
  { method: "POST", url: "/admin/opps/:id/quotes", permission: "opps.edit", label: "إضافة عرض سعر" },
  { method: "POST", url: "/admin/opp-quotes/:id/status", permission: "opps.edit", label: "تغيير حالة عرض سعر" },
  { method: "POST", url: "/admin/opps/:id/escalate", permission: "opps.edit", label: "تصعيد فرصة" },
  { method: "GET", url: "/admin/escalations", permission: "opps.view", label: "" },
  { method: "POST", url: "/admin/escalations/:id/resolve", permission: "opps.edit", label: "إغلاق تصعيد" },
  { method: "GET", url: "/admin/actions/stalled", permission: "opps.view", label: "" },
  { method: "POST", url: "/admin/actions/:id/close", permission: "opps.edit", label: "إغلاق إجراء متعثر" },
  // dashboards and reports
  { method: "GET", url: "/admin/kpis", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/reports", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/reports/:id", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/reports/pipeline", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/reports/rollups", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/intel/winloss", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/gate-a", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/sales/performance", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/sales/quarters", permission: "dashboards.view", label: "" },
  { method: "GET", url: "/admin/sales/sectors", permission: "dashboards.view", label: "" },
  { method: "POST", url: "/admin/sales/targets", permission: "knowledge.edit", label: "تحديد مستهدف منتج" },
  // partners
  { method: "GET", url: "/admin/partners", permission: "partners.view", label: "" },
  { method: "POST", url: "/admin/partners", permission: "partners.manage", label: "إضافة شريك" },
  { method: "PATCH", url: "/admin/partners/:id", permission: "partners.manage", label: "تعديل شريك" },
  { method: "PUT", url: "/admin/partners/:id/targets", permission: "partners.manage", label: "تحديد مستهدف شريك" },
  { method: "POST", url: "/admin/partners/:id/results", permission: "partner_results.edit", label: "تسجيل نتائج تواصل شريك" },
  { method: "PATCH", url: "/admin/partner-results/:id", permission: "partner_results.edit", label: "تعديل نتيجة تواصل" },
  { method: "DELETE", url: "/admin/partner-results/:id", permission: "partner_results.edit", label: "حذف نتيجة تواصل" },
  // settings, users, audit
  { method: "GET", url: "/admin/config", permission: "settings.view", label: "" },
  { method: "POST", url: "/admin/config/stages", permission: "org.manage", label: "إضافة مرحلة بيع" },
  { method: "PATCH", url: "/admin/config/stages/:key", permission: "org.manage", label: "تعديل مرحلة بيع" },
  { method: "DELETE", url: "/admin/config/stages/:key", permission: "org.manage", label: "حذف مرحلة بيع" },
  { method: "POST", url: "/admin/config/divisions", permission: "org.manage", label: "إضافة قسم" },
  { method: "PATCH", url: "/admin/config/divisions/:id", permission: "org.manage", label: "تعديل قسم" },
  { method: "DELETE", url: "/admin/config/divisions/:id", permission: "org.manage", label: "حذف قسم" },
  { method: "POST", url: "/admin/config/team", permission: "org.manage", label: "إضافة عضو فريق" },
  { method: "PATCH", url: "/admin/config/team/:id", permission: "org.manage", label: "تعديل عضو فريق" },
  { method: "DELETE", url: "/admin/config/team/:id", permission: "org.manage", label: "حذف عضو فريق" },
  { method: "GET", url: "/admin/users", permission: "org.manage", label: "" },
  { method: "POST", url: "/admin/users", permission: "org.manage", label: "إضافة مستخدم" },
  { method: "PATCH", url: "/admin/users/:id", permission: "org.manage", label: "تعديل مستخدم" },
  { method: "POST", url: "/admin/users/:id/token", permission: "org.manage", label: "إصدار رمز دخول جديد لمستخدم" },
  { method: "GET", url: "/admin/audit", permission: "audit.view", label: "" },
];

/** The permission a request needs, or null when the route is unlisted (administrator only). */
export function permissionFor(method: unknown, url: unknown): { permission: Permission; label: string } | null {
  var m = String(method || "").toUpperCase(), u = String(url || "");
  if (m === "HEAD") m = "GET";   // Fastify answers HEAD from the GET route; it needs what the GET needs
  for (var i = 0; i < ROUTE_PERMISSIONS.length; i++) {
    var r = ROUTE_PERMISSIONS[i];
    if (r.method === m && r.url === u) return { permission: r.permission, label: r.label };
  }
  return null;
}

/** NFR-002: which requests are written to the audit log. Every successful write, and the one read that exposes a
 *  secret-bearing list (users) is not a write so it is not logged; reads are not audited. */
export function isAuditable(method: unknown, status: unknown): boolean {
  var m = String(method || "").toUpperCase(), s = Number(status) || 0;
  return (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") && s >= 200 && s < 400;
}

// ---------------------------------------------------------------------------------------- the page's doors

/** What a role needs to see each door of the dashboard. The page hides a door the role cannot open. */
export const DOOR_PERMISSIONS: Readonly<Record<string, Permission>> = {
  home: "dashboards.view", opps: "opps.view", customers: "customers.view", products: "knowledge.view",
  kmon: "campaigns.view", reports: "dashboards.view", settings: "settings.view",
  // sub-routes that need more than their door
  triage: "conversations.view", pipeline: "conversations.view", customer: "conversations.view", indicators: "indicators.view",
  indicator: "indicators.view", aimkt: "campaigns.create", kb: "knowledge.view", sector: "knowledge.view", targets: "customers.view", partners: "partners.view",
  perf: "dashboards.view",
  // «الهيكل التنظيمي» only READS the sectors, departments and team; every write on it hands off to
  // «الأقسام» / «الفريق», which stay org.manage. Gating the reading on org.manage would hide the
  // company's own shape from the executive who is asked about it.
  org: "settings.view", board: "opps.view",
  team: "org.manage", divisions: "org.manage", users: "org.manage", audit: "audit.view",
  accounts: "customers.view", account: "customers.view", tasks: "customers.view", notes: "customers.view", product: "knowledge.view",
};
export function canOpen(role: unknown, route: unknown): boolean {
  var p = DOOR_PERMISSIONS[String(route || "")];
  return p ? can(role, p) : String(role) === "admin";
}
/** Where a role lands when it opens the dashboard. */
export function homeRouteFor(role: unknown): string {
  return String(role) === "partner" ? "partners" : "home";
}

// ---------------------------------------------------------------------------------------- users

export const USER_NAME_MAX = 80;

export type UserValue = { name: string; role: Role; partnerId: number | null; memberId: number | null };

/** A user: a name, one role, and for a partner the company it records for. */
export function checkUser(input: { name?: unknown; role?: unknown; partnerId?: unknown; memberId?: unknown }, partnerIds: readonly number[], memberIds: readonly number[]):
  { ok: true; value: UserValue } | { ok: false; field: string; reason: string } {
  var name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2) return { ok: false, field: "name", reason: "اكتب اسم المستخدم" };
  // The environment token signs as «اللوحة» and shows as «مدير النظام»; a user by either name would pass as it.
  if (name === "اللوحة" || name === "مدير النظام") return { ok: false, field: "name", reason: "هذا الاسم محجوز لمدير النظام" };
  if (name.length > USER_NAME_MAX) return { ok: false, field: "name", reason: "الاسم أطول من " + USER_NAME_MAX + " حرفًا" };
  var role = typeof input.role === "string" ? input.role : "";
  if (ROLES.indexOf(role as Role) < 0) return { ok: false, field: "role", reason: "اختر الدور" };
  var pid = input.partnerId == null || input.partnerId === "" ? null : Number(input.partnerId);
  if (role === "partner") {
    if (pid == null || !Number.isInteger(pid) || partnerIds.indexOf(pid) < 0) return { ok: false, field: "partnerId", reason: "اختر الشريك الذي يسجّل له هذا المستخدم" };
  } else pid = null;
  var mid = input.memberId == null || input.memberId === "" ? null : Number(input.memberId);
  if (mid != null && (!Number.isInteger(mid) || memberIds.indexOf(mid) < 0)) return { ok: false, field: "memberId", reason: "عضو الفريق غير موجود" };
  return { ok: true, value: { name: name, role: role as Role, partnerId: pid, memberId: mid } };
}

// ---------------------------------------------------------------------------------------- the seam

const DOMAIN_FNS = [can, matrixCell, canOpen, homeRouteFor, checkUser] as const;

export const RBAC_DOMAIN_JS: string = [
  "/* ===== rbac-domain (generated from src/rbac-domain.ts — do not edit here) ===== */",
  "var ROLES = " + JSON.stringify(ROLES) + ";",
  "var ROLE_LABELS = " + JSON.stringify(ROLE_LABELS) + ";",
  "var ROLE_DESCRIPTIONS = " + JSON.stringify(ROLE_DESCRIPTIONS) + ";",
  "var ROLE_GRANTS = " + JSON.stringify(ROLE_GRANTS) + ";",
  "var MATRIX_ROWS = " + JSON.stringify(MATRIX_ROWS) + ";",
  "var DOOR_PERMISSIONS = " + JSON.stringify(DOOR_PERMISSIONS) + ";",
  "var USER_NAME_MAX = " + USER_NAME_MAX + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");
