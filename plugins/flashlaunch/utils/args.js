/**
 * 把用户填写的启动参数拆成数组，避免经过 shell 解析。
 * 支持单/双引号包裹，以及 \" \' \\ 转义。
 */
function splitArgs(input) {
  const text = String(input == null ? "" : input);
  const args = [];
  let current = "";
  let quote = "";

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      if (ch === quote) {
        quote = "";
        continue;
      }
      if (ch === "\\" && (text[i + 1] === quote || text[i + 1] === "\\")) {
        current += text[i + 1];
        i += 1;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    if (ch === "\\" && (text[i + 1] === '"' || text[i + 1] === "'" || text[i + 1] === "\\")) {
      current += text[i + 1];
      i += 1;
      continue;
    }

    current += ch;
  }

  if (current) args.push(current);
  return args;
}

module.exports = { splitArgs };
