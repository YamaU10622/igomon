### @sabaki/sgf で「メインラインだけ」を取り出す手順

---

#### 1. 全体の流れ

1. **SGF 文字列をパース**してノード木（GameTree）を取得
2. **各ノードの `children` 配列を「先頭要素だけ残す」** ことで枝分かれ（variation）をすべて削除
3. **木をふたたび SGF 文字列に変換** (`sgf.stringify`)
4. 得られた SGF を **WGo.js** へ渡して表示

---

#### 2. 実装サンプル

    import * as sgf from '@sabaki/sgf';   // または const sgf = require('@sabaki/sgf');

    // 分岐が含まれる SGF 例
    const sgfData = `
    (;FF[4]CA[UTF-8]AP[Sabaki]SZ[19]
      ;B[pd];W[dd]
      (;B[pq];W[dp])      // ← 分岐①
      (;B[dp];W[pp])      // ← 分岐②
    )
    `;

    // 1. パース
    const roots = sgf.parse(sgfData);     // 配列 → ゲームツリー集合

    // 2. メインラインだけ残す再帰関数
    function keepMainLine(node) {
      if (node.children && node.children.length > 0) {
        keepMainLine(node.children[0]);       // 先頭枝を辿る
        node.children = [node.children[0]];   // 先頭以外を削除
      }
    }

    // すべてのルートに対して剪定
    for (const root of roots) keepMainLine(root);

    // 3. SGF に戻す
    const mainLineSgf = sgf.stringify(roots);

    console.log(mainLineSgf);  // → 分岐なし SGF

---

#### 3. 補足ポイント

| 項目                           | 説明                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| **複数ゲームが入っている SGF** | `sgf.parse` は「ツリー配列」を返すので `for` ループで全ツリーを剪定すると安全。        |
| **文字列整形**                 | `sgf.stringify(roots, { linebreak: '', indent: '' })` で改行・インデントを除去できる。 |
| **削除される情報**             | 分岐側だけに付いたコメント・マークなどは失われる。必要なら事前にコピーする。           |
| **再帰の深さ**                 | 非常に長い対局（数万手）では再帰が深くなる。ループ実装に書き換えれば安全。             |

---

#### 4. まとめ

- **`children` の先頭要素を残す**だけで簡単に分岐を除去できる
- 変換後は **通常の SGF** として WGo.js 等に渡せる
- 削除された分岐のコメント・注釈が必要ないかを確認すれば OK
