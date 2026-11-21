import type { Article } from "../../src/core/auto.ts";

const briefs = [
  ["廓形", "风衣搭配长裙和阔腿裤，风衣下摆留出空间，拉长了整套造型。"],
  ["结构", "剪裁、肩线和褶皱改变了外套比例，肩线抬高后，衣身向下垂落。"],
  ["材质", "设计师把薄纱叠在蕾丝和针织之上，让领口和衣摆都保留了透光的层次。"],
  ["色彩", "这组造型使用红色、黑色和白色，红色集中在上半身。"],
  ["风格", "这一组女装把极简与复古并置，克制的线条和浪漫细节形成了清楚的对比。"],
  ["场合", "通勤、度假和派对造型使用同一套搭配，通勤款保留了活动空间。"],
];

/** 合成输入，用于在不随仓库分发原文的情况下测试抽取和渲染。 */
export const articles: Article[] = briefs.flatMap(([topic, text], i) =>
  ["甲", "乙"].map((edition) => ({
    id: `TEST-${i}-${edition}`,
    title: `示例报道${edition}：${topic}`,
    url: `https://articles.example/${i}/${encodeURIComponent(edition)}`,
    date: "2026-10-01",
    source: `示例媒体${edition}`,
    text: `${text} ${edition === "甲" ? "这段文字用于验证自动抽取。 " : "该造型也出现在第二组示例中。"}`,
    image: `assets/img/test-${i}.jpg`,
  })),
);
