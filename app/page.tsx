export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>オンライン句会</h1>
      <p style={{ marginTop: 8, color: "#555", lineHeight: 1.8 }}>
        俳号でログインして、投句・選句・結果発表までをオンラインで行うためのページです。
      </p>

      {user ? (
        <>
          <p style={{ marginTop: 16, color: "#333" }}>
            ログイン中：<b>{user.email}</b>
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/meetings"
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "2px solid #111",
                textDecoration: "none",
                fontWeight: 900,
              }}
            >
              句会一覧へ
            </Link>
            <Link
              href="/protected/account"
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #999",
                textDecoration: "none",
              }}
            >
              パスワード変更
            </Link>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 20 }}>
          <Link
            href="/login"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "2px solid #111",
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            ログイン（俳号＋パスワード）
          </Link>
        </div>
      )}
    </main>
  );
}
