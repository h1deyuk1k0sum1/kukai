import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EntryEditCard } from "@/components/EntryEditCard";

type Params = { id: string } | Promise<{ id: string }>;

export default async function SubmitPage({ params }: { params: Params }) {
  const { id: meetingId } = await Promise.resolve(params);
  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id,title,status,submission_limit")
    .eq("id", meetingId)
    .single();

  if (meetingError) {
    return (
      <main style={{ padding: 24 }}>
        <p><Link href={`/meetings/${meetingId}`}>← 句会詳細へ</Link></p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(meetingError, null, 2)}</pre>
      </main>
    );
  }

  const { data: myEntries, error: entriesError } = await supabase
    .from("entries")
    .select("id,body,updated_at")
    .eq("meeting_id", meetingId)
    .eq("author_id", userId ?? "")
    .order("updated_at", { ascending: false });

  async function addEntry(formData: FormData) {
    "use server";
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) throw new Error("Not logged in");

    const { error } = await supabase.from("entries").insert({
      meeting_id: meetingId,
      author_id: userId,
      body,
    });

    if (error) throw new Error(error.message);
    revalidatePath(`/meetings/${meetingId}/submit`);
  }

  async function updateEntry(formData: FormData) {
    "use server";
    const entryId = String(formData.get("entry_id") ?? "");
    const body = String(formData.get("body") ?? "").trim();
    if (!entryId || !body) return;

    const supabase = await createClient();
    const { error } = await supabase.from("entries").update({ body }).eq("id", entryId);
    if (error) throw new Error(error.message);

    revalidatePath(`/meetings/${meetingId}/submit`);
  }

  const open = meeting.status === "SUBMISSION_OPEN";
  const limit = meeting.submission_limit ?? 0;
  const count = myEntries?.length ?? 0;

  return (
    <main style={{ padding: 24 }}>
      <p>
        <Link href={`/meetings/${meetingId}`}>← 句会詳細へ</Link>
      </p>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>
        投句：{meeting.title}
      </h1>

      <div style={{ marginTop: 12, lineHeight: 1.8 }}>
        <div>状態：<b>{meeting.status}</b></div>
        <div>あなたの投句数：{count} / {limit}</div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12, maxWidth: 900 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>作品投稿時に使える記法</div>
        <div style={{ color: "#555", lineHeight: 1.8 }}>
          <div>・前書き：冒頭に（（…））</div>
          <div>・ルビ：｜語（よみ）  ※全角の縦棒「｜」＋全角括弧「（ ）」</div>
          <div>・前書きを前書き扱いしたくない：先頭を「｜（（」から始める</div>
        </div>
      </div>

      {entriesError && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
          {JSON.stringify(entriesError, null, 2)}
        </pre>
      )}

      <hr style={{ margin: "16px 0" }} />

      {!open && <p style={{ color: "#666" }}>※投句は締め切られています。</p>}

      {open && count < limit && (
        <form action={addEntry} style={{ marginTop: 12, maxWidth: 900 }}>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>新規投句</div>
                    <textarea
            name="body"
            placeholder="ここに句を入力してください"
            style={{
              width: "100%",
              minHeight: 200,
              padding: 10,
              border: "2px solid #111",
              borderRadius: 10,
              fontSize: 16,
              lineHeight: 1.8,
            }}
          />
          <div style={{ marginTop: 8 }}>
                      <button
            type="submit"
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "2px solid #111",
              fontWeight: 900,
              marginTop: 8,
              background: "white",
            }}
          >
            投句
          </button>
          </div>
        </form>
      )}

      {open && count >= limit && (
        <p style={{ marginTop: 12, color: "#666" }}>
          ※投句上限に達しています（これ以上追加できません）。
        </p>
      )}

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>
        あなたの投句（プレビュー）
      </h2>

      <div style={{ display: "grid", gap: 12, marginTop: 12, maxWidth: 900 }}>
        {(myEntries ?? []).map((e) => (
          <EntryEditCard
            key={e.id}
            entryId={e.id}
            body={e.body}
            open={open}
            updateAction={updateEntry}
          />
        ))}
      </div>
    </main>
  );
}
