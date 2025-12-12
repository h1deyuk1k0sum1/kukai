export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminMeetingsPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  if (!user) redirect("/login");

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id,title,theme,status,submission_limit,created_at")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>管理：句会一覧</h1>

        <Link
          href="/protected/admin/meetings/new"
          style={{
            padding: "10px 14px",
            border: "2px solid #111",
            borderRadius: 12,
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          ＋ 新規句会
        </Link>
      </div>

      {error && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      )}

      <div style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 960 }}>
        {(meetings ?? []).map((m) => (
          <div key={m.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{m.title}</div>
              <div style={{ color: "#666" }}>{m.status}</div>
            </div>

            <div style={{ marginTop: 6, color: "#666" }}>
              兼題：{m.theme ?? "なし"} / 投句上限：{m.submission_limit}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
              <Link
                href={`/protected/admin/meetings/${m.id}`}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #ccc",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                管理画面を開く
              </Link>

              <Link
                href={`/meetings/${m.id}`}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #ccc",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                参加者画面を開く
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
