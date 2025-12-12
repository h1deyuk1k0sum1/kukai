export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  if (!user) {
    redirect("/login");
  }

  async function changePassword(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;

    if (!user) {
      redirect("/login");
    }

    const newPassword = String(formData.get("new_password") ?? "").trim();
    const confirm = String(formData.get("confirm_password") ?? "").trim();

    // どれかが空なら何もしない
    if (!newPassword || !confirm) {
      return;
    }

    // 2回の入力が違う場合も何もしない
    if (newPassword !== confirm) {
      return;
    }

    // 短すぎるパスワードは弾く（8文字未満は無視）
    if (newPassword.length < 8) {
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    // エラーがあっても画面をクラッシュさせず、そのまま戻る
    // （「前と同じパスワード」や「強度不足」のときもここに来る）
    if (error) {
      return;
    }

    revalidatePath("/protected/account");
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <p>
        <Link href="/meetings">← 句会一覧へ戻る</Link>
      </p>

      <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 12 }}>
        アカウント設定
      </h1>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900 }}>パスワードの変更</h2>
        <p style={{ marginTop: 8, color: "#555", lineHeight: 1.7 }}>
          現在ログイン中のアカウント（メールアドレス：
          <b>{user?.email}</b>
          ）のパスワードを変更します。
          <br />
          新しいパスワードを同じ内容で2回入力してください（8文字以上を推奨）。
        </p>

        <form
          action={changePassword}
          style={{ marginTop: 16, display: "grid", gap: 12 }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>新しいパスワード</span>
            <input
              type="password"
              name="new_password"
              style={{
                padding: 10,
                border: "1px solid #ccc",
                borderRadius: 10,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>新しいパスワード（確認）</span>
            <input
              type="password"
              name="confirm_password"
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
                border: "2px solid #111",
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              パスワードを変更する
            </button>
          </div>

          <p style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
            ※ 入力が空 / 2回の入力が違う / 8文字未満 / 旧パスワードと同じなどの場合は、
            パスワードは変更されません（エラー画面にもなりません）。
          </p>
        </form>
      </section>
    </main>
  );
}
