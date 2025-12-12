"use client";

import { useEffect, useState } from "react";
import { HaikuVertical } from "@/components/HaikuVertical";

export function EntryEditCard(props: {
  entryId: string;
  body: string;
  open: boolean;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const { entryId, body, open, updateAction } = props;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);

  // 保存後にページが再描画されたら、編集状態を閉じて内容も同期
  useEffect(() => {
    setText(body);
    setEditing(false);
  }, [body]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 12 }}>
          <HaikuVertical text={body} fontSize={18} prefaceFontSize={14} />
        </div>

        <div style={{ flex: "1 1 420px", minWidth: 320 }}>
          {!open && (
            <div style={{ color: "#666", lineHeight: 1.8 }}>
              ※投句が締め切られているため修正できません。
            </div>
          )}

          {open && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{
                padding: "10px 14px",
                border: "1px solid #333",
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              修正
            </button>
          )}

          {open && editing && (
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                修正（記法込みの原文）
              </div>

              <form action={updateAction}>
                <input type="hidden" name="entry_id" value={entryId} />

                <textarea
                  name="body"
                  rows={8}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  style={{ width: "100%" }}
                />

                {/* ここが「枠を作ってわかりやすく」の部分 */}
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    border: "2px solid #111",
                    borderRadius: 12,
                    display: "flex",
                    gap: 10,
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
                      fontWeight: 800,
                    }}
                  >
                    修正して保存
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setText(body);
                      setEditing(false);
                    }}
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #999",
                      borderRadius: 10,
                    }}
                  >
                    キャンセル
                  </button>

                  <span style={{ color: "#666" }}>
                    ※保存すると編集欄は自動で閉じます
                  </span>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
