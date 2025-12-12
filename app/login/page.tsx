export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  // すでにログインしている場合は句会一覧へ
  if (user) {
    redirect("/meetings");
  }

  async function login(formData: FormData) {
    "use server";

    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    if (!identifier || !password) {
      return;
    }

    const supabase = await createClient();

    // identifier がメールか俳号かを判定
    let email = identifier;

    if (!identifier.includes("@")) {
      // 俳号として扱い、profiles から対応する email を取得
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("haigo", identifier)
        .limit(1)
        .single();

      if (profileError || !profile?.email) {
        // 俳号が見つからない場合は何もせず戻る（エラー画面にはしない）
        return;
      }

      email = profile.email;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // パスワード違いなど。画面はそのままにして静かに失敗。
      return;
    }

    // ログイン成功
    redirect("/meetings");
  }

  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <p>
        <Link href="/">← トップに戻る</Link>
      </p>

      <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 12 }}>
        ログイン
      </h1>

      <p style={{ marginTop: 8, color: "#555", lineHeight: 1.7 }}>
        俳号（漢字可）またはメールアドレスと、パスワードを入力してください。
      </p>

      <form
        action={login}
        style={{ marginTop: 16, display: "grid", gap: 12 }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>俳号 または メールアドレス</span>
          <input
            type="text"
            name="identifier"
            placeholder="例：虚子 ／ you@example.com"
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>パスワード</span>
          <input
            type="password"
            name="password"
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 10,
            }}
          />
        </label>

        <div
          style={{
            marginTop: 8,
            padding: 12,
            border: "2px solid #111",
            borderRadius: 12,
          }}
        >
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "2px solid #111",
              fontWeight: 900,
            }}
          >
            ログイン
          </button>
        </div>

        <p style={{ marginTop: 8, fontSize: 12, color: "#777", lineHeight: 1.6 }}>
          ※ 俳号は漢字・ひらがな・カタカナも使用できます。<br />
          ※ 誤った俳号／パスワードの場合はログインされませんが、
          エラー画面にはなりません。
        </p>
      </form>
    </main>
  );
}
