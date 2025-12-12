import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HaikuVertical } from "@/components/HaikuVertical";

type Params = { id: string } | Promise<{ id: string }>;

type Rule = {
  label: string;
  max_picks: number;
  points: number;
};

type ResultRow = {
  entry_no: number;
  body: string;
  score: number;
  author: string | null;
  comments: {
    voter: string | null;
    comment: string | null;
    category: string | null;
  }[];
};

export default async function MeetingResultsPage({ params }: { params: Params }) {
  const { id: meetingId } = await Promise.resolve(params);
  const supabase = await createClient();

  // 句会情報
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id,title,status,voting_rules")
    .eq("id", meetingId)
    .single();

  if (meetingError || !meeting) {
    return (
      <main style={{ padding: 24 }}>
        <p>
          <Link href={`/meetings/${meetingId}`}>← 句会詳細へ</Link>
        </p>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>
          {JSON.stringify(meetingError ?? "句会が見つかりません", null, 2)}
        </pre>
      </main>
    );
  }

  const rules = (meeting.voting_rules ?? []) as Rule[];

  // 「特選→入選…」の順序を点数から作る
  const pointsByLabel = new Map<string, number>();
  for (const r of rules) {
    pointsByLabel.set(r.label, r.points);
  }

  // 集計済み結果
  const { data: rawResults, error: resultsError } = await supabase.rpc(
    "get_meeting_results",
    { p_meeting_id: meetingId }
  );

  const rows: ResultRow[] = (rawResults ?? []).map((r: any) => ({
    entry_no: r.entry_no,
    body: r.body,
    score: r.score,
    author: r.author,
    comments: (r.comments ?? []) as ResultRow["comments"],
  }));

  // 点数→句番号の順でソート
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry_no - b.entry_no;
  });

  // 同点グループごとにまとめる
  const groups: { score: number; items: ResultRow[] }[] = [];
  for (const row of rows) {
    const found = groups.find((g) => g.score === row.score);
    if (found) {
      found.items.push(row);
    } else {
      groups.push({ score: row.score, items: [row] });
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <p>
        <Link href={`/meetings/${meetingId}`}>← 句会詳細へ</Link>
      </p>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>
        結果発表：{meeting.title}
      </h1>

      <div style={{ marginTop: 8, color: "#666" }}>
        状態：<b>{meeting.status}</b>
      </div>

      <p style={{ marginTop: 4, color: "#999", fontSize: 12 }}>
        ※作者名および選評文は俳号で表示されます。
      </p>

      {resultsError && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>
          {JSON.stringify(resultsError, null, 2)}
        </pre>
      )}

      {groups.map((group, index) => {
        const rank = index + 1;

        return (
          <section
            key={`${group.score}-${index}`}
            style={{
              marginTop: 24,
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              第{rank}位（合計 {group.score} 点）
            </div>

            <div style={{ fontSize: 12, marginBottom: 4 }}>選評</div>

            {group.items.map((row) => {
              // 句ごとに「カテゴリ → [選評]」でまとめる
              const byCategory = new Map<
                string,
                { voter: string; comment: string }[]
              >();

              for (const c of row.comments ?? []) {
                const label = c.category ?? "カテゴリ不明";
                const arr = byCategory.get(label) ?? [];
                arr.push({
                  voter: c.voter ?? "（俳号未設定）",
                  comment: c.comment ?? "",
                });
                byCategory.set(label, arr);
              }

              // 「特選→入選→…」の順になるよう並べ替え
              const orderedLabels = Array.from(byCategory.keys()).sort((a, b) => {
                const pa = pointsByLabel.get(a) ?? 0;
                const pb = pointsByLabel.get(b) ?? 0;
                if (pa !== pb) return pb - pa;
                return a.localeCompare(b, "ja");
              });

              // 1つの縦書きテキストとして結合
              const segments: string[] = [];
              for (const label of orderedLabels) {
                const items = byCategory.get(label) ?? [];
                if (items.length === 0) continue;

                // 見出し
                segments.push(`【${label}】`);

                // 各選評
                for (const item of items) {
                  const line = `${item.comment}　　　――${item.voter}`;
                  segments.push(line);
                }
              }

              const commentsText = segments.join("\n\n");

              return (
                <div
                  key={row.entry_no}
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #eee",
                    display: "grid",
                    // 左：選評（可変） / 右：俳句（220〜260px に固定）
                    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 260px)",
                    columnGap: 16,
                    alignItems: "stretch",
                  }}
                >
                  {/* 左：全員分の選評をまとめた縦書きボックス */}
                  <div
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 8,
                      minHeight: 500,
                      maxHeight: 500,
                      overflowX: "auto", // 横スクロールで全部読める
                      overflowY: "hidden",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* 中身を flex 右寄せにして、縦書きテキストが右端に寄るようにする */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        minWidth: "100%",
                      }}
                    >
                      <div
                        style={{
                          writingMode: "vertical-rl",
                          textOrientation: "mixed",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.8,
                          fontSize: 14,
                        }}
                      >
                        {commentsText}
                      </div>
                    </div>
                  </div>

                  {/* 右：俳句＋俳号（細い柱にする） */}
                  <div
                    style={{
                      border: "1px dashed #ccc",
                      borderRadius: 12,
                      padding: 12,
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      justifyContent: "center",
                      minWidth: 220,
                      maxWidth: 260,
                      width: "100%",
                    }}
                  >
                    <HaikuVertical
                      text={`${row.body}　　　${
                        row.author ?? "（俳号未設定）"
                      }`}
                      height={500}
                      fontSize={18}
                      prefaceFontSize={14}
                    />
                    <div
                      style={{
                        marginTop: 4,
                        textAlign: "right",
                        fontSize: 12,
                      }}
                    >
                      No.{row.entry_no}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}
