"use client";

import { useMemo, useState } from "react";

export type SimpleRule = { label: string; points: number; max_picks: number };
export type Preset = { id: string; name: string; rules: SimpleRule[] };

function normalizeRules(input: any): SimpleRule[] {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((r) => ({
      label: String(r.label ?? "").trim(),
      points: Number(r.points ?? 0),
      max_picks: Number(r.max_picks ?? 1),
    }))
    .map((r) => ({
      label: r.label,
      points: Number.isFinite(r.points) ? r.points : 0,
      max_picks: Number.isFinite(r.max_picks) ? r.max_picks : 1,
    }))
    .filter((r) => r.label.length > 0);
}

export function VotingRulesEditor(props: {
  initialRules: SimpleRule[];
  presets: Preset[];
  savePresetAction: (formData: FormData) => Promise<void>;
  deletePresetAction: (formData: FormData) => Promise<void>;
}) {
  const [rules, setRules] = useState<SimpleRule[]>(
    props.initialRules.length
      ? props.initialRules
      : [{ label: "特選", points: 2, max_picks: 1 }, { label: "入選", points: 1, max_picks: 2 }]
  );
  const [presetName, setPresetName] = useState("");

  const rulesJson = useMemo(() => JSON.stringify(rules), [rules]);

  function updateRule(i: number, patch: Partial<SimpleRule>) {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRule() {
    setRules((prev) => (prev.length >= 10 ? prev : [...prev, { label: "", points: 0, max_picks: 1 }]));
  }

  function removeRule(i: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== i));
  }

  function applyPreset(p: Preset) {
    setRules(normalizeRules(p.rules));
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>選の種類（最大10個）</div>
        <button
          type="button"
          onClick={addRule}
          disabled={rules.length >= 10}
          style={{ padding: "8px 12px", border: "1px solid #333", borderRadius: 10, fontWeight: 800 }}
        >
          ＋ 追加
        </button>
      </div>

      <div style={{ color: "#666", marginTop: 8, lineHeight: 1.8 }}>
        ・各「選」ごとに「名前」「点数」「その選で選べる句数（最大選択数）」を設定します。<br />
        ・結果は、投票された点数を合算して表示します（同じ選で複数選ぶと、その分加算）。
      </div>

      {/* 親フォームへ */}
      <input type="hidden" name="voting_rules_json" value={rulesJson} />

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {rules.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 160px 220px 80px",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={r.label}
              onChange={(e) => updateRule(i, { label: e.target.value })}
              placeholder="選の名前（例：特選）"
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }}
            />

            <input
              type="number"
              step={1}
              value={Number.isFinite(r.points) ? r.points : 0}
              onChange={(e) => updateRule(i, { points: Number(e.target.value) })}
              placeholder="点数"
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }}
            />

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#666" }}>最大選択数（半角数字）</span>
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isFinite(r.max_picks) ? r.max_picks : 1}
                onChange={(e) => updateRule(i, { max_picks: Number(e.target.value) })}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }}
              />
            </label>

            <button
              type="button"
              onClick={() => removeRule(i)}
              style={{ padding: "10px 12px", border: "1px solid #999", borderRadius: 10 }}
            >
              削除
            </button>
          </div>
        ))}
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ fontWeight: 900 }}>お気に入り（保存／復元／削除）</div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          name="preset_name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="お気に入り名"
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10, minWidth: 320 }}
        />

        <button
          formAction={props.savePresetAction}
          type="submit"
          style={{ padding: "10px 14px", border: "2px solid #111", borderRadius: 12, fontWeight: 900 }}
        >
          この選の種類をお気に入り保存
        </button>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {props.presets.length === 0 && <div style={{ color: "#666" }}>（まだお気に入りがありません）</div>}

        {props.presets.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 800 }}>{p.name}</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => applyPreset(p)}
                style={{ padding: "8px 12px", border: "1px solid #333", borderRadius: 10, fontWeight: 800 }}
              >
                ワンクリックで復元
              </button>

              <button
                type="submit"
                formAction={props.deletePresetAction}
                name="preset_id"
                value={p.id}
                style={{ padding: "8px 12px", border: "1px solid #999", borderRadius: 10 }}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, color: "#666" }}>
        ※「復元」は画面上の選の種類を差し替えます（保存ボタンを押すまで句会には反映されません）。
      </div>
    </div>
  );
}
