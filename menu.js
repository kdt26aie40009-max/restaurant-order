// ジルアーナマチャラ亭 メニューデータ
// 商品を追加するときは、MENU の配列に 1 行足す（id は重複させない）

// 料金
const PRICE = {
  tabehodai: 2500, // 食べ放題（1人）
  nomihodai: 1000, // 飲み放題（1人）
};

// カテゴリ（表示順）
const CATEGORIES = [
  { id: "chicken", name: "鶏肉食べ放題" },
  { id: "ippin", name: "一品料理" },
  { id: "soft", name: "ソフトドリンク" },
  { id: "alcohol", name: "アルコール" },
  { id: "dessert", name: "デザート" },
];

// 扱うアレルギー（特定原材料 8 品目＋大豆）
const ALLERGENS = ["えび", "かに", "くるみ", "小麦", "そば", "卵", "乳", "落花生", "大豆"];

// メニュー一覧
// price：鶏肉食べ放題は 0 円、ドリンクは単品価格
const MENU = [
  // 鶏肉食べ放題（塩のみ）
  { id: "M01", name: "鶏もも", category: "chicken", price: 0, allergens: [] },
  { id: "M02", name: "せせり", category: "chicken", price: 0, allergens: [] },
  { id: "M03", name: "砂ずり", category: "chicken", price: 0, allergens: [] },
  { id: "M04", name: "鶏ハツ", category: "chicken", price: 0, allergens: [] },
  { id: "M05", name: "鶏皮", category: "chicken", price: 0, allergens: [] },
  { id: "M06", name: "ぼんじり", category: "chicken", price: 0, allergens: [] },
  { id: "M07", name: "ヤゲン軟骨", category: "chicken", price: 0, allergens: [] },
  { id: "M08", name: "手羽先", category: "chicken", price: 0, allergens: [] },

  // 一品料理
  { id: "M09", name: "鶏の唐揚げ", category: "ippin", price: 500, allergens: ["小麦", "卵", "大豆"] },
  { id: "M10", name: "手羽先唐揚げ", category: "ippin", price: 500, allergens: ["小麦", "大豆"] },
  { id: "M11", name: "鶏皮ポン酢", category: "ippin", price: 400, allergens: ["小麦", "大豆"] },
  { id: "M12", name: "枝豆", category: "ippin", price: 300, allergens: ["大豆"] },
  { id: "M13", name: "フライドポテト", category: "ippin", price: 400, allergens: [] },
  { id: "M14", name: "キャベツ", category: "ippin", price: 300, allergens: [] },

  // ソフトドリンク
  { id: "M15", name: "ウーロン茶", category: "soft", price: 300, allergens: [] },
  { id: "M16", name: "緑茶", category: "soft", price: 300, allergens: [] },
  { id: "M17", name: "コーラ", category: "soft", price: 300, allergens: [] },
  { id: "M18", name: "ジンジャーエール", category: "soft", price: 300, allergens: [] },
  { id: "M19", name: "オレンジジュース", category: "soft", price: 300, allergens: [] },

  // アルコール
  { id: "M20", name: "生ビール", category: "alcohol", price: 500, allergens: [] },
  { id: "M21", name: "ハイボール", category: "alcohol", price: 450, allergens: [] },
  { id: "M22", name: "レモンサワー", category: "alcohol", price: 400, allergens: [] },
  { id: "M23", name: "梅酒（ロック／ソーダ）", category: "alcohol", price: 450, allergens: [] },

  // デザート
  { id: "M24", name: "バニラアイス", category: "dessert", price: 300, allergens: ["乳", "卵"] },
  { id: "M25", name: "杏仁豆腐", category: "dessert", price: 350, allergens: ["乳"] },
];

// おすすめ料理（年代ごとに 2 品）
const RECOMMEND_FOOD = {
  "10代": ["M09", "M13"],
  "20代": ["M10", "M01"],
  "30代": ["M02", "M11"],
  "40代": ["M03", "M12"],
  "50代": ["M07", "M04"],
  "60代以上": ["M01", "M14"],
};

// おすすめドリンク（性別ごとに 1 品。adult：20歳以上、minor：20歳未満）
const RECOMMEND_DRINK = {
  "男性": { adult: "M20", minor: "M17" },
  "女性": { adult: "M22", minor: "M19" },
  "回答しない": { adult: "M21", minor: "M15" },
};
