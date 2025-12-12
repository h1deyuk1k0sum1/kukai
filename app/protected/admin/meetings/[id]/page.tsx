import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  VotingRulesEditor,
  type Preset,
  type SimpleRule,
} from "@/components/VotingRulesEditor";

type Params = { id: string } | Promise<{ id: string }>;

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

  const seen = new Set<string>();
  for (const r of normalized) {
    if (seen.has(r.label)) throw new Error(`選の名前が重複しています：${r.label}`);
    seen.add(r.label);
  }

  for (const r of normalized) {
    if (!Number.isInteger(r.points))
      throw new Error(`点数は整数にしてください：${r.label}`);
    if (!Number.isInteger(r.max_picks) || r.max_picks < 1) {
      throw new Error(`最大選択数は1以上の整数にしてください：${r.label}`);
    }
  }

  return normalized.map((r) => ({
    label: r.label,
    points: r.points,
    max_picks: r.max_picks,
  }));
}

export default async function AdminMeetingDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await Promise.resolve(params);
  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) redirect("/login");

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select(
      "id,title,theme,status,submission_limit,created_by,submission_period,voting_period,results_announcement,voting_rules,created_at"
    )
    .eq("id", id)
    .single();

  if (meetingError || !meeting) {
    return (
      <main style={{ padding: 24 }}>
        <p>
          <Link href="/protected/admin/meetings">← 管理：句会一覧へ</Link>
        </p>
        <p>句会が見つかりません。</p>
      </main>
    );
  }

  if (meeting.created_by !== user.id) {
    return (
      <main style={{ padding: 24 }}>
        <p>
          <Link href="/protected/admin/meetings">← 管理：句会一覧へ</Link>
        </p>
        <p>この句会を編集する権限がありません。</p>
      </main>
    );
  }

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

  const initialRules: SimpleRule[] =
    Array.isArray(meeting.voting_rules) && meeting.voting_rules.length
      ? meeting.voting_rules.map((r: any) => ({
          label: String(r.label ?? "").trim(),
          points: Number(r.points ?? 0),
          max_picks: Number(r.max_picks ?? 1),
        }))
      : [
          { label: "特選", points: 2, max_picks: 1 },
          { label: "入選", points: 1, max_picks: 2 },
        ];

  // ここから下は「サーバーアクション群」とヘルパー

  async function updateMeeting(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) redirect("/login");

    const title = String(formData.get("title") ?? "").trim();
    const submissionLimitRaw = String(
      formData.get("submission_limit") ?? ""
    ).trim();
    const theme = String(formData.get("theme") ?? "").trim();
    const submissionPeriod = String(
      formData.get("submission_period") ?? ""
    ).trim();
    const votingPeriod = String(formData.get("voting_period") ?? "").trim();
    const resultsAnnouncement = String(
      formData.get("results_announcement") ?? ""
    ).trim();
    const rulesJson = String(formData.get("voting_rules_json") ?? "").trim();

    if (!title) throw new Error("句会の名前が空です。");
    if (!/^\d+$/.test(submissionLimitRaw))
      throw new Error("投句上限数は半角数字で入力してください。");
    const submission_limit = Number(submissionLimitRaw);
    if (!Number.isFinite(submission_limit) || submission_limit < 1)
      throw new Error("投句上限数は1以上にしてください。");

    const voting_rules = parseRulesJson(rulesJson);

    const { error } = await supabase
      .from("meetings")
      .update({
        title,
        theme: theme || null,
        submission_limit,
        submission_period: submissionPeriod || null,
        voting_period: votingPeriod || null,
        results_announcement: resultsAnnouncement || null,
        voting_rules,
      })
      .eq("id", id)
      .eq("created_by", user.id);

    if (error) throw new Error(error.message);

    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/protected/admin/meetings`);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/meetings/${id}`);
    revalidatePath(`/meetings/${id}/submit`);
    revalidatePath(`/meetings/${id}/entries`);
    revalidatePath(`/meetings/${id}/vote`);
    revalidatePath(`/meetings/${id}/results`);
  }

  async function savePresetAction(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) redirect("/login");

    const presetName = String(formData.get("preset_name") ?? "").trim();
    const rulesJson = String(formData.get("voting_rules_json") ?? "").trim();
    if (!presetName) throw new Error("お気に入り名が空です。");

    const rules = parseRulesJson(rulesJson);

    const { error } = await supabase.from("voting_rule_presets").insert({
      created_by: user.id,
      name: presetName,
      rules,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/protected/admin/meetings/${id}`);
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

    revalidatePath(`/protected/admin/meetings/${id}`);
  }

  async function openSubmissions() {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_open_submissions", {
      p_meeting_id: id,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/protected/admin/meetings`);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/meetings/${id}`);
    revalidatePath(`/meetings/${id}/submit`);
    revalidatePath(`/meetings/${id}/entries`);
    revalidatePath(`/meetings/${id}/vote`);
    revalidatePath(`/meetings/${id}/results`);
  }

  async function closeSubmissionsAndNumber() {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc(
      "admin_close_submissions_and_number",
      { p_meeting_id: id }
    );
    if (error) throw new Error(error.message);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/protected/admin/meetings`);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/meetings/${id}`);
    revalidatePath(`/meetings/${id}/submit`);
    revalidatePath(`/meetings/${id}/entries`);
    revalidatePath(`/meetings/${id}/vote`);
    revalidatePath(`/meetings/${id}/results`);
  }

  async function openVoting() {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_open_voting", {
      p_meeting_id: id,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/protected/admin/meetings`);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/meetings/${id}`);
    revalidatePath(`/meetings/${id}/submit`);
    revalidatePath(`/meetings/${id}/entries`);
    revalidatePath(`/meetings/${id}/vote`);
    revalidatePath(`/meetings/${id}/results`);
  }

  async function publishResults() {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_publish_results", {
      p_meeting_id: id,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/protected/admin/meetings`);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/meetings/${id}`);
    revalidatePath(`/meetings/${id}/submit`);
    revalidatePath(`/meetings/${id}/entries`);
    revalidatePath(`/meetings/${id}/vote`);
    revalidatePath(`/meetings/${id}/results`);
  }

  async function forceSetStatus(formData: FormData) {
    "use server";
    const nextStatus = String(formData.get("next_status") ?? "").trim();
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_status", {
      p_meeting_id: id,
      p_status: nextStatus,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/protected/admin/meetings`);
    revalidatePath(`/protected/admin/meetings/${id}`);
    revalidatePath(`/meetings/${id}`);
    revalidatePath(`/meetings/${id}/submit`);
    revalidatePath(`/meetings/${id}/entries`);
    revalidatePath(`/meetings/${id}/vote`);
    revalidatePath(`/meetings/${id}/results`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <p>
        <Link href="/protected/admin/meetings">← 管理：句会一覧へ</Link>
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "baseline",
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            marginTop: 12,
          }}
        >
          管理：{meeting.title}
        </h1>
        <Link
          href={`/meetings/${id}`}
          style={{
            padding: "8px 12px",
            border: "1px solid #999",
            borderRadius: 10,
            textDecoration: "none",
          }}
        >
          参加者画面を見る
        </Link>
      </div>

      <div style={{ marginTop: 8, color: "#666" }}>
        現在の状態：<b>{meeting.status}</b>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h2 style={{ fontSize: 18, fontWeight: 900 }}>状態を進める（句会の進行）</h2>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 12,
        }}
      >
        <form action={openSubmissions}>
          <button
            type="submit"
            disabled={meeting.status !== "DRAFT"}
          >
            投句開始
          </button>
        </form>
        <form action={closeSubmissionsAndNumber}>
          <button
            type="submit"
            disabled={meeting.status !== "SUBMISSION_OPEN"}
          >
            投句締切 → 採番
          </button>
        </form>
        <form action={openVoting}>
          <button
            type="submit"
            disabled={meeting.status !== "SUBMISSION_CLOSED"}
          >
            選句開始
          </button>
        </form>
        <form action={publishResults}>
          <button
            type="submit"
            disabled={meeting.status !== "VOTING_OPEN"}
          >
            結果公開（作者公開）
          </button>
        </form>
      </div>

      <p style={{ marginTop: 10, color: "#666", lineHeight: 1.8 }}>
        ※「投句締切→採番」を押すと伏せ句にNo.が付きます。<br />
        ※「結果公開」を押すと作者が表示され、点数集計が見えるようになります。
      </p>

      <h2
        style={{
          fontSize: 18,
          fontWeight: 900,
          marginTop: 22,
        }}
      >
        状態を直接変更（戻す／飛ばす）
      </h2>
      <form
        action={forceSetStatus}
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 12,
          alignItems: "center",
        }}
      >
        <select
          name="next_status"
          defaultValue={meeting.status}
          style={{
            padding: "10px 12px",
            border: "1px solid #999",
            borderRadius: 10,
          }}
        >
          <option value="DRAFT">DRAFT（準備中）</option>
          <option value="SUBMISSION_OPEN">SUBMISSION_OPEN（投句中）</option>
          <option value="SUBMISSION_CLOSED">
            SUBMISSION_CLOSED（投句締切／採番済）
          </option>
          <option value="VOTING_OPEN">VOTING_OPEN（選句中）</option>
          <option value="RESULTS_PUBLISHED">
            RESULTS_PUBLISHED（結果公開）
          </option>
        </select>
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            border: "2px solid #111",
            borderRadius: 10,
            fontWeight: 900,
          }}
        >
          この状態にする
        </button>
      </form>
      <p style={{ marginTop: 10, color: "#666", lineHeight: 1.8 }}>
        ※「Bad status.」が出るのは、今の状態と押したボタンが合っていないだけです。
        ここで状態を合わせてから、上の進行ボタンを使ってください。
      </p>

      <hr style={{ margin: "16px 0" }} />

      <h2 style={{ fontSize: 18, fontWeight: 900 }}>
        句会情報の編集（名前・兼題・期間・選の種類）
      </h2>

      <form
        action={updateMeeting}
        style={{ marginTop: 12, display: "grid", gap: 14 }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>句会の名前</span>
          <input
            name="title"
            defaultValue={meeting.title ?? ""}
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>投句上限数（半角数字）</span>
          <input
            name="submission_limit"
            type="number"
            min={1}
            step={1}
            defaultValue={meeting.submission_limit ?? 1}
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>テーマ、兼題</span>
          <input
            name="theme"
            defaultValue={meeting.theme ?? ""}
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>投句期間</span>
          <input
            name="submission_period"
            defaultValue={meeting.submission_period ?? ""}
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>選句期間</span>
          <input
            name="voting_period"
            defaultValue={meeting.voting_period ?? ""}
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>結果発表</span>
          <input
            name="results_announcement"
            defaultValue={meeting.results_announcement ?? ""}
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 10,
            }}
          />
        </label>

        <VotingRulesEditor
          initialRules={initialRules}
          presets={presets}
          savePresetAction={savePresetAction}
          deletePresetAction={deletePresetAction}
        />

        <div
          style={{
            marginTop: 6,
            padding: 12,
            border: "2px solid #111",
            borderRadius: 12,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              border: "2px solid #111",
              borderRadius: 10,
              fontWeight: 900,
            }}
          >
            変更を保存
          </button>
        </div>
      </form>
    </main>
  );
}
