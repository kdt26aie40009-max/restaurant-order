// ジルアーナ＝マチャラ亭 メニューデータ
// 商品を追加するときは、MENU の配列に 1 行足す（id は重複させない）

// 料金
const PRICE = {
  tabehodai: 2500, // 食べ放題（1人）
  drinkbar: 1000, // ドリンクバー（1人）
};

// カテゴリ（表示順）
const CATEGORIES = [
  { id: "chicken", name: "鶏肉食べ放題" },
  { id: "soft", name: "ソフトドリンク" },
  { id: "alcohol", name: "アルコール" },
  { id: "dessert", name: "デザート" },
];

// 扱うアレルギー（特定原材料 8 品目＋大豆）
const ALLERGENS = ["えび", "かに", "くるみ", "小麦", "そば", "卵", "乳", "落花生", "大豆"];

// メニュー一覧
// price：食べ放題（鶏肉・デザート）は 0 円、ドリンクは単品価格
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
  { id: "M26", name: "ささみ", category: "chicken", price: 0, allergens: [] },

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
  { id: "M28", name: "芋焼酎", category: "alcohol", price: 450, allergens: [] },
  { id: "M29", name: "焼酎オレンジ割り", category: "alcohol", price: 400, allergens: [] },
  { id: "M30", name: "焼酎カルピス割り", category: "alcohol", price: 400, allergens: ["乳"] },
  { id: "M31", name: "コーラハイボール", category: "alcohol", price: 450, allergens: [] },
  { id: "M32", name: "翠ジンソーダ", category: "alcohol", price: 450, allergens: [] },

  // デザート（食べ放題）
  { id: "M27", name: "アイスクリーム", category: "dessert", price: 0, allergens: ["乳", "卵"] },
];

// おすすめ料理（年代ごとに 2 品）
const RECOMMEND_FOOD = {
  "10代": ["M08", "M27"],
  "20代": ["M01", "M06"],
  "30代": ["M02", "M05"],
  "40代": ["M03", "M07"],
  "50代": ["M04", "M26"],
  "60代以上": ["M26", "M01"],
};

// おすすめドリンク（性別ごとに 1 品。adult：20歳以上、minor：20歳未満）
const RECOMMEND_DRINK = {
  "男性": { adult: "M20", minor: "M17" },
  "女性": { adult: "M22", minor: "M19" },
  "回答しない": { adult: "M21", minor: "M15" },
};
