export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Meeting = {
  id: string;
  title: string | null;
  theme: string | null;
  status: string;
  created_at: string;
};

export default async function MeetingsPage() {
  const supabase = await createClient();

  // ログインユーザー情報を取得
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  if (!user) {
    redirect("/login");
  }

  // プロファイルから俳号を取得（無ければメールをそのまま表示）
  const { data: profile } = await supabase
    .from("profiles")
    .select("haigo")
    .eq("id", user.id)
    .limit(1)
    .single();

  const displayName = profile?.haigo ?? user.email ?? "（名無し）";

  // 句会一覧を取得
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id,title,theme,status,created_at")
    .order("created_at", { ascending: false });

  const list: Meeting[] = (meetings ?? []) as Meeting[];

  // ログアウト用サーバーアクション
  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main style={{ padding: 24, maxWidth: 960 }}>
      {/* 上部のユーザー情報バー */}
      <header
        style={{
          padding: 12,
          marginBottom: 16,
          border: "1px solid #ccc",
          borderRadius: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: "#666" }}>ログイン中の俳号</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{displayName}</div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/protected/account"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #999",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            パスワード変更
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "2px solid #111",
                fontSize: 14,
                fontWeight: 900,
                background: "white",
              }}
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      {/* 句会一覧 */}
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>句会一覧</h1>

      {list.length === 0 ? (
        <p style={{ marginTop: 12 }}>現在参加可能な句会はありません。</p>
      ) : (
        <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none" }}>
          {list.map((m) => (
            <li
              key={m.id}
              style={{
                padding: 12,
                marginBottom: 10,
                border: "1px solid #ddd",
                borderRadius: 12,
              }}
            >
              <Link
                href={`/meetings/${m.id}`}
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  textDecoration: "none",
                }}
              >
                {m.title || "無題の句会"}
              </Link>
              <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
                {m.theme ? <>兼題・テーマ：{m.theme}</> : "兼題・テーマ：未設定"}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#999" }}>
                状態：{m.status}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
