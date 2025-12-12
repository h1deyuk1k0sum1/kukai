import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HaikuVertical } from "@/components/HaikuVertical";

type Params = { id: string } | Promise<{ id: string }>;

export default async function EntriesPage({ params }: { params: Params }) {
  const { id: meetingId } = await Promise.resolve(params);
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id,title,status")
    .eq("id", meetingId)
    .single();

  const { data, error } = await supabase.rpc("get_public_entries", { p_meeting_id: meetingId });

  const entriesSorted = [...(data ?? [])].sort(
    (a: any, b: any) => (a.entry_no ?? 0) - (b.entry_no ?? 0)
  );

  return (
    <main style={{ padding: 24 }}>
      <p><Link href={`/meetings/${meetingId}`}>← 句会詳細へ</Link></p>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>
        伏せ句一覧：{meeting?.title ?? ""}
      </h1>

      <div style={{ marginTop: 8, color: "#666" }}>
        状態：<b>{meeting?.status ?? ""}</b>
      </div>

      {error && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      )}

      {!error && (
        <div style={{ marginTop: 16, display: "grid", gap: 16, maxWidth: 980 }}>
          {entriesSorted.map((e: any) => (
            <div key={e.entry_no} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>No.{e.entry_no}</div>
              <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 12 }}>
                <HaikuVertical text={e.body} fontSize={20} prefaceFontSize={14} minBodyChars={17} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
