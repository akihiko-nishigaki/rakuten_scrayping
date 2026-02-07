// Rakuten Genre IDs for ranking
// Reference: https://webservice.rakuten.co.jp/documentation/ichiba-genre-search

export interface RakutenCategory {
    id: string;
    name: string;
    nameJa: string;
}

// Updated from Rakuten API IchibaGenre/Search (2025-02-07)
export const RAKUTEN_CATEGORIES: RakutenCategory[] = [
    { id: "0", name: "All", nameJa: "総合" },
    { id: "100371", name: "Women's Fashion", nameJa: "レディースファッション" },
    { id: "551177", name: "Men's Fashion", nameJa: "メンズファッション" },
    { id: "100433", name: "Innerwear", nameJa: "インナー・下着・ナイトウェア" },
    { id: "216131", name: "Bags & Accessories", nameJa: "バッグ・小物・ブランド雑貨" },
    { id: "558885", name: "Shoes", nameJa: "靴" },
    { id: "558929", name: "Watch", nameJa: "腕時計" },
    { id: "216129", name: "Jewelry", nameJa: "ジュエリー・アクセサリー" },
    { id: "100533", name: "Kids & Baby", nameJa: "キッズ・ベビー・マタニティ" },
    { id: "566382", name: "Toys", nameJa: "おもちゃ" },
    { id: "101070", name: "Sports & Outdoor", nameJa: "スポーツ・アウトドア" },
    { id: "562637", name: "Electronics", nameJa: "家電" },
    { id: "211742", name: "TV & Audio", nameJa: "TV・オーディオ・カメラ" },
    { id: "100026", name: "PC & Peripherals", nameJa: "パソコン・周辺機器" },
    { id: "564500", name: "Smartphone & Tablet", nameJa: "スマートフォン・タブレット" },
    { id: "100227", name: "Food", nameJa: "食品" },
    { id: "551167", name: "Sweets", nameJa: "スイーツ・お菓子" },
    { id: "100316", name: "Beverages", nameJa: "水・ソフトドリンク" },
    { id: "510915", name: "Beer & Wine", nameJa: "ビール・洋酒" },
    { id: "510901", name: "Sake & Shochu", nameJa: "日本酒・焼酎" },
    { id: "100804", name: "Interior & Bedding", nameJa: "インテリア・寝具・収納" },
    { id: "215783", name: "Daily Goods & Stationery", nameJa: "日用品雑貨・文房具・手芸" },
    { id: "558944", name: "Kitchen & Dining", nameJa: "キッチン用品・食器・調理器具" },
    { id: "200162", name: "Books & Comics", nameJa: "本・雑誌・コミック" },
    { id: "101240", name: "CD & DVD", nameJa: "CD・DVD" },
    { id: "101205", name: "Games", nameJa: "テレビゲーム" },
    { id: "101164", name: "Hobby", nameJa: "ホビー" },
    { id: "112493", name: "Musical Instruments", nameJa: "楽器・音響機器" },
    { id: "503190", name: "Car & Bike Parts", nameJa: "車用品・バイク用品" },
    { id: "100939", name: "Beauty & Cosmetics", nameJa: "美容・コスメ・香水" },
    { id: "100938", name: "Diet & Health", nameJa: "ダイエット・健康" },
    { id: "551169", name: "Medicine & Contact", nameJa: "医薬品・コンタクト・介護" },
    { id: "101213", name: "Pets", nameJa: "ペット・ペットグッズ" },
    { id: "100005", name: "Flowers & Garden", nameJa: "花・ガーデン・DIY" },
    { id: "101438", name: "Service & Reform", nameJa: "サービス・リフォーム" },
];

// Default category for new settings
export const DEFAULT_CATEGORY_ID = "0"; // 総合ランキング

// Helper function to get category name by ID
export function getCategoryName(categoryId: string): string {
    const category = RAKUTEN_CATEGORIES.find(c => c.id === categoryId);
    return category?.nameJa ?? categoryId;
}
