export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { VotingRulesEditor, type Preset, type SimpleRule } from "@/components/VotingRulesEditor";

function parseRulesJson(raw: string) {
  const v = JSON.parse(raw);
  if (!Array.isArray(v)) throw new Error("選の種類(JSON)が壊れています。");
  if (v.length === 0) throw new Error("選の種類が空です。");
  if (v.length > 10) throw new Error("選の種類は最大10個です。");

  const normalized = v
    .map((r: any) => ({
      label: String(r.label ?? "").trim(),
      points: Number(r.points ?? 0),
      max_picks: Number(r.max_picks ?? 1),
    }))
    .filter((r: any) => r.label.length > 0);

  if (normalized.length === 0) throw new Error("選の種類が空です。");

  // ラベル重複禁止
  const seen = new Set<string>();
  for (const r of normalized) {
    if (seen.has(r.label)) throw new Error(`選の名前が重複しています：${r.label}`);
    seen.add(r.label);
  }

  for (const r of normalized) {
    if (!Number.isInteger(r.points)) throw new Error(`点数は整数にしてください：${r.label}`);
    if (!Number.isInteger(r.max_picks) || r.max_picks < 1) throw new Error(`最大選択数は1以上の整数にしてください：${r.label}`);
  }

  // meetings.voting_rules 互換（vote画面がmax_picksを読む）
  return normalized.map((r) => ({ label: r.label, points: r.points, max_picks: r.max_picks }));
}

export default async function NewMeetingPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) redirect("/login");

  const { data: presetRows } = await supabase
    .from("voting_rule_presets")
    .select("id,name,rules,created_at")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  const presets: Preset[] = (presetRows ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    rules: (Array.isArray(p.rules) ? p.rules : []).map((r: any) => ({
      label: String(r.label ?? "").trim(),
      points: Number(r.points ?? 0),
      max_picks: Number(r.max_picks ?? 1),
    })),
  }));

  const initialRules: SimpleRule[] = [
    { label: "特選", points: 2, max_picks: 1 },
    { label: "入選", points: 1, max_picks: 2 },
  ];

  async function savePresetAction(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) redirect("/login");

    const presetName = String(formData.get("preset_name") ?? "").trim();
    const rulesJson = String(formData.get("voting_rules_json") ?? "").trim();
    if (!presetName) throw new Error("お気に入り名が空です。");

    const rules = parseRulesJson(rulesJson).map((r: any) => ({
      label: r.label,
      points: r.points,
      max_picks: r.max_picks,
    }));

    const { error } = await supabase.from("voting_rule_presets").insert({
      created_by: user.id,
      name: presetName,
      rules,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/protected/admin/meetings/new");
  }

  async function deletePresetAction(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) redirect("/login");

    const presetId = String(formData.get("preset_id") ?? "").trim();
    if (!presetId) return;

    const { error } = await supabase
      .from("voting_rule_presets")
      .delete()
      .eq("id", presetId)
      .eq("created_by", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/protected/admin/meetings/new");
  }

  async function createMeeting(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) redirect("/login");

    const title = String(formData.get("title") ?? "").trim();
    const submissionLimitRaw = String(formData.get("submission_limit") ?? "").trim();
    const theme = String(formData.get("theme") ?? "").trim();
    const submissionPeriod = String(formData.get("submission_period") ?? "").trim();
    const votingPeriod = String(formData.get("voting_period") ?? "").trim();
    const resultsAnnouncement = String(formData.get("results_announcement") ?? "").trim();
    const rulesJson = String(formData.get("voting_rules_json") ?? "").trim();

    if (!title) throw new Error("句会の名前が空です。");
    if (!/^\d+$/.test(submissionLimitRaw)) throw new Error("投句上限数は半角数字で入力してください。");
    const submission_limit = Number(submissionLimitRaw);
    if (!Number.isFinite(submission_limit) || submission_limit < 1) throw new Error("投句上限数は1以上にしてください。");

    const voting_rules = parseRulesJson(rulesJson);

    const { data, error } = await supabase
      .from("meetings")
      .insert({
        title,
        theme: theme || null,
        status: "DRAFT",
        submission_limit,
        voting_rules,
        created_by: user.id,
        submission_period: submissionPeriod || null,
        voting_period: votingPeriod || null,
        results_announcement: resultsAnnouncement || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    redirect(`/protected/admin/meetings/${data.id}`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 960 }}>
      <p><Link href="/protected/admin/meetings">← 管理：句会一覧へ</Link></p>

      <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 12 }}>新規句会</h1>

      <form action={createMeeting} style={{ marginTop: 16, display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>句会の名前（必須）</span>
          <input name="title" type="text" style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>投句上限数（必須・半角数字）</span>
          <input name="submission_limit" type="number" min={1} step={1} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>テーマ、兼題</span>
          <input name="theme" type="text" style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>投句期間</span>
          <input name="submission_period" type="text" style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>選句期間</span>
          <input name="voting_period" type="text" style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>結果発表</span>
          <input name="results_announcement" type="text" style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }} />
        </label>

        <VotingRulesEditor
          initialRules={initialRules}
          presets={presets}
          savePresetAction={savePresetAction}
          deletePresetAction={deletePresetAction}
        />

        <div style={{ marginTop: 6, padding: 12, border: "2px solid #111", borderRadius: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button type="submit" style={{ padding: "10px 14px", border: "2px solid #111", borderRadius: 10, fontWeight: 900 }}>
            作成して管理画面へ
          </button>
          <Link href="/protected/admin/meetings" style={{ padding: "10px 14px", border: "1px solid #999", borderRadius: 10, textDecoration: "none" }}>
            キャンセル
          </Link>
        </div>
      </form>
    </main>
  );
}
