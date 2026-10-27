import { getReportsSnapshot, isAdmin } from "@/src/lib/app-data";
import { buildDetailRows, buildSummaryRows, exportFileName, toCsv, type ExportKind } from "@/src/lib/payroll-export";
import { getSessionProfile } from "@/src/lib/session";

export const runtime = "nodejs";

// Payroll / HR export for one month. Admins and managers only.
export async function GET(request: Request) {
  const { profile } = await getSessionProfile();
  if (!profile) return new Response("Sign in required.", { status: 401 });
  if (!isAdmin(profile)) return new Response("Admin access required.", { status: 403 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  const kind = (url.searchParams.get("type") ?? "summary") as ExportKind;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Response("month must be YYYY-MM.", { status: 400 });
  if (kind !== "summary" && kind !== "detail") return new Response("type must be summary or detail.", { status: 400 });

  const snapshot = await getReportsSnapshot();
  const rows = kind === "summary" ? buildSummaryRows(snapshot, month) : buildDetailRows(snapshot, month);
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(kind, month)}"`,
      "Cache-Control": "no-store",
    },
  });
}
