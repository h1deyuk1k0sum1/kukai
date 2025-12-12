type HaikuVerticalProps = {
  text: string;
  height?: number;
  fontSize?: number;
  prefaceFontSize?: number;
};

type Token =
  | { type: "text"; text: string }
  | { type: "ruby"; base: string; ruby: string };

// ｜遠山（とおやま） 形式のルビを分解
function parseRuby(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const bar = text.indexOf("｜", i);
    if (bar === -1) {
      if (i < text.length) {
        tokens.push({ type: "text", text: text.slice(i) });
      }
      break;
    }

    if (bar > i) {
      tokens.push({ type: "text", text: text.slice(i, bar) });
    }

    const open = text.indexOf("（", bar + 1);
    const close = open >= 0 ? text.indexOf("）", open + 1) : -1;

    if (open === -1 || close === -1) {
      // 途中で終わっていたら残りは素の文字列として扱う
      tokens.push({ type: "text", text: text.slice(bar) });
      break;
    }

    const base = text.slice(bar + 1, open);
    const ruby = text.slice(open + 1, close);
    tokens.push({ type: "ruby", base, ruby });

    i = close + 1;
  }

  return tokens;
}

function renderTokens(tokens: Token[], fontSize: number) {
  return tokens.map((t, idx) => {
    if (t.type === "text") {
      return (
        <span key={idx} style={{ fontSize }}>
          {t.text}
        </span>
      );
    }
    return (
      <ruby key={idx} style={{ fontSize }}>
        {t.base}
        <rt style={{ fontSize: fontSize * 0.7 }}>{t.ruby}</rt>
      </ruby>
    );
  });
}

export function HaikuVertical({
  text,
  height = 500,
  fontSize = 18,
  prefaceFontSize = 14,
}: HaikuVerticalProps) {
  let preface: string | null = null;
  let body = text;

  // 文頭が（（ 〜 ））なら前書きとして切り出す
  if (body.startsWith("（（")) {
    const end = body.indexOf("））");
    if (end !== -1) {
      preface = body.slice(2, end);
      body = body.slice(end + 2).trimStart();
    }
  }

  const bodyTokens = parseRuby(body);
  const prefaceTokens = preface ? parseRuby(preface) : [];

   return (
    <div
      style={{
        display: "flex",
        flexDirection: "row-reverse", // 右側 → 左側 の順に並ぶ
        alignItems: "stretch",
        justifyContent: "center",
        gap: 8,
        height,
        maxHeight: height,
        overflow: "hidden",
      }}
    >
      {/* 右端：前書き（あれば） */}
      {preface && (
        <div
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            whiteSpace: "pre-wrap",
            lineHeight: 1.8,
            opacity: 0.85,
          }}
        >
          {renderTokens(prefaceTokens, prefaceFontSize)}
        </div>
      )}

      {/* その左：本文 */}
      <div
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          whiteSpace: "pre-wrap",
          lineHeight: 1.8,
        }}
      >
        {renderTokens(bodyTokens, fontSize)}
      </div>
    </div>
  );
}
