export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { HaikuVertical } from "@/components/HaikuVertical";

type Params = { id: string } | Promise<{ id: string }>;
type Rule = { label: string; max_picks: number; points: number };

type BallotRow = {
  id: string;
  entry_id: string;
  category: string;
  comment: string | null;
};

export default async function VotePage({ params }: { params: Params }) {
  const { id: meetingId } = await Promise.resolve(params);
  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id,title,status,voting_rules")
    .eq("id", meetingId)
    .single();

  if (meetingError) {
    return (
      <main style={{ padding: 24 }}>
        <p>
          <Link href={`/meetings/${meetingId}`}>← 句会詳細へ</Link>
        </p>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(meetingError, null, 2)}
        </pre>
      </main>
    );
  }

  const open = meeting.status === "VOTING_OPEN";
  const rules = (meeting.voting_rules ?? []) as Rule[];

  const { data: entries, error: entriesError } = await supabase.rpc(
    "get_public_entries",
    {
      p_meeting_id: meetingId,
    }
  );

  const entriesSorted = [...(entries ?? [])].sort(
    (a: any, b: any) => (a.entry_no ?? 0) - (b.entry_no ?? 0)
  );

  // No. → 俳句本文のスニペット（横書き）へのマップ
  const entryTextByNo = new Map<number, string>();
  for (const e of entriesSorted as any[]) {
    const no = e.entry_no;
    if (no == null) continue;
    const raw = String(e.body ?? "");
    const snippet = raw.replace(/\s+/g, " ").slice(0, 30);
    entryTextByNo.set(no, snippet);
  }

  const { data: entryMap, error: mapError } = await supabase.rpc(
    "map_entry_no_to_id",
    {
      p_meeting_id: meetingId,
    }
  );

  const { data: myBallots } = await supabase
    .from("ballots")
    .select("id,entry_id,category,comment")
    .eq("meeting_id", meetingId)
    .eq("voter_id", userId ?? "");

  const selectedByCategory = new Map<string, { entry_id: string; comment: string }[]>();
  for (const b of (myBallots ?? []) as BallotRow[]) {
    const arr = selectedByCategory.get(b.category) ?? [];
    arr.push({
      entry_id: b.entry_id,
      comment: b.comment ?? "",
    });
    selectedByCategory.set(b.category, arr);
  }

  async function saveVote(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) throw new Error("Not logged in");

    const meetingId = String(formData.get("meeting_id"));
    const category = String(formData.get("category"));

    const rawEntryIds = formData.getAll("entry_id");
    const rawComments = formData.getAll("comment");

    const pairs: { entry_id: string; comment: string }[] = [];
    const n = Math.max(rawEntryIds.length, rawComments.length);

    for (let i = 0; i < n; i++) {
      const eid = String(rawEntryIds[i] ?? "").trim();
      const cmt = String(rawComments[i] ?? "").trim();
      if (!eid) continue;
      let trimmed = cmt;
      if (trimmed.length > 300) {
        trimmed = trimmed.slice(0, 300);
      }
      pairs.push({ entry_id: eid, comment: trimmed });
    }

    const { error: delErr } = await supabase
      .from("ballots")
      .delete()
      .eq("meeting_id", meetingId)
      .eq("voter_id", userId)
      .eq("category", category);

    if (delErr) throw new Error(delErr.message);

    if (pairs.length > 0) {
      const rows = pairs.map((p) => ({
        meeting_id: meetingId,
        voter_id: userId,
        entry_id: p.entry_id,
        category,
        comment: p.comment || null,
      }));
      const { error: insErr } = await supabase.from("ballots").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    revalidatePath(`/meetings/${meetingId}/vote`);
  }

  return (
    <main style={{ padding: 24 }}>
      <p>
        <Link href={`/meetings/${meetingId}`}>← 句会詳細へ</Link>
      </p>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>
        選句：{meeting.title}
      </h1>

      <div style={{ marginTop: 8, color: "#666" }}>
        状態：<b>{meeting.status}</b>
      </div>

      {!open && (
        <p style={{ marginTop: 12, color: "#666" }}>
          ※選句受付中（VOTING_OPEN）のときだけ投票できます。
        </p>
      )}

      {(entriesError || mapError) && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
          {JSON.stringify({ entriesError, mapError }, null, 2)}
        </pre>
      )}

      <hr style={{ margin: "16px 0" }} />

      <h2 style={{ fontSize: 18, fontWeight: 700 }}>選句（カテゴリ別）</h2>

      <div style={{ display: "grid", gap: 16, marginTop: 12, maxWidth: 760 }}>
        {rules.map((r) => {
          const picks = selectedByCategory.get(r.label) ?? [];
          const max = r.max_picks ?? 0;

          return (
            <div
              key={r.label}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {r.label}（最大 {max}つ / {r.points}点）
              </div>

              <form action={saveVote}>
                <input type="hidden" name="meeting_id" value={meetingId} />
                <input type="hidden" name="category" value={r.label} />

                <div style={{ display: "grid", gap: 12 }}>
                  {Array.from({ length: max }).map((_, i) => {
                    const sel = picks[i] ?? { entry_id: "", comment: "" };
                    return (
                      <div
                        key={i}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 10,
                          padding: 8,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <select
                          name="entry_id"
                          defaultValue={sel.entry_id ?? ""}
                          disabled={!open}
                          style={{
                            padding: 8,
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            fontSize: 14,
                          }}
                        >
                          <option value="">（未選択）</option>
                          {(entryMap ?? []).map((x: any) => {
                            const snippet =
                              entryTextByNo.get(x.entry_no) ?? "";
                            const label = snippet
                              ? `No.${x.entry_no}　${snippet}`
                              : `No.${x.entry_no}`;
                            return (
                              <option key={x.entry_id} value={x.entry_id}>
                                {label}
                              </option>
                            );
                          })}
                        </select>

                        <textarea
                          name="comment"
                          defaultValue={sel.comment ?? ""}
                          placeholder="この選句の選評（300文字まで・任意）"
                          style={{
                            width: "100%",
                            minHeight: 60,
                            padding: 6,
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            fontSize: 13,
                          }}
                          maxLength={300}
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  disabled={!open}
                  style={{
                    marginTop: 12,
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "2px solid #111",
                    fontWeight: 900,
                    background: "white",
                  }}
                >
                  このカテゴリを保存
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Link
          href={`/meetings/${meetingId}`}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "2px solid #111",
            textDecoration: "none",
            fontWeight: 900,
            background: "white",
          }}
        >
          選句を終えて句会詳細に戻る
        </Link>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h2 style={{ fontSize: 18, fontWeight: 700 }}>
        伏せ句（No.1が右端、右→左に並ぶ）
      </h2>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "row-reverse",
          flexWrap: "nowrap",
          gap: 16,
          overflowX: "auto",
          paddingBottom: 12,
        }}
      >
        {entriesSorted.map((e: any) => (
          <div
            key={e.entry_no}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              minWidth: 220,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              No.{e.entry_no}
            </div>
            <div
              style={{
                border: "1px dashed #ccc",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <HaikuVertical
                text={e.body}
                height={320}
                fontSize={18}
                prefaceFontSize={14}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
