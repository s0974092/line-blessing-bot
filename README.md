🪷 LINE AI 長輩圖生成系統規格書

版本： v1.0
建立日期： 2025-10-20
專案名稱： 「LINE AI 長輩圖生成器」
產品類型： LINE Chatbot + AI 圖像生成服務
主要目的：
讓使用者可透過 LINE Bot，選擇主題與風格，快速生成一張可愛、有祝福語的長輩圖，並能一鍵分享給好友或群組。

🧭 一、系統目標 (System Objective)

提供使用者簡單的三步驟互動：
選主題 → 選風格 → 輸入祝福文字 → 生成圖片

自動生成風格化長輩圖，並加上使用者或預設的祝福語。

可在 LINE 中直接預覽並分享圖片。

圖片生成過程自動化，使用者無需理解 AI prompt。

🌈 二、使用者互動流程 (User Flow)
Step 1. 選擇主題

「請選擇今天想傳的祝福主題 🌸」
選項：

🌅 早安問候

🌙 晚安祝福

🎂 生日快樂

🌻 健康平安

❤️ 節慶祝福

💪 鼓勵打氣

Step 2. 選擇風格

「想要哪一種風格的長輩圖？」
選項（Carousel 或 Quick Reply）：

🌸 柔光寫實風

🎨 插畫風

🪷 東方水墨風

🌈 夢幻糖果風

🕊️ 佛系禪風

💖 懷舊復古風

Step 3. 輸入祝福文字

「要加上祝福語嗎？（可略過）」
範例：「祝你平安喜樂、天天開心 🌻」

Step 4. 圖片生成與回傳

Bot 回傳圖片 + 分享按鈕：

「✅ 生成完成！
點我傳送這張祝福圖給好友 💌」

🧩 三、系統架構 (System Architecture)
LINE User
   ↓
LINE Messaging API
   ↓
LINE Bot Server (Node.js)
   ├─ 主題選擇模組 (Theme Selector)
   ├─ 風格選擇模組 (Style Selector)
   ├─ 文字輸入模組 (Text Input Handler)
   ├─ Prompt 組合模組 (Prompt Composer)
   ├─ AI 圖像生成模組 (Image Generator)
   ├─ 圖片疊字模組 (Text Overlay)
   ├─ 圖片儲存模組 (Cloudinary)
   └─ 回傳模組 (LINE Reply/Push)

⚙️ 四、技術規格 (Technical Specification)
模組名稱	功能說明	技術 / API
LINE Bot API	接收與回覆使用者訊息	@line/bot-sdk
圖片生成 (AI)	根據主題與風格生成圖片	OpenAI DALL·E 3 / Replicate / Flux
圖片疊字	將祝福文字疊加在生成圖上	node-canvas / Cloudinary Text Overlay
儲存與 CDN	儲存圖片並生成公開連結	Cloudinary / Supabase Storage
Config 管理	管理主題與風格資料	JSON (themes.json, styles.json)
部署	運行 Bot 伺服器	Vercel / Render / Railway
資料快取	暫存使用者流程狀態	Redis / In-memory cache
🧱 五、資料結構 (Data Structure)
(1) themes.json
{
  "themes": [
    {
      "id": "good_morning",
      "name": "早安問候",
      "defaultText": "早安～祝你開心每一天 ☀️",
      "prompt": "morning sunlight, coffee, cozy room, {stylePrompt}"
    },
    {
      "id": "good_night",
      "name": "晚安祝福",
      "defaultText": "晚安好夢 🌙",
      "prompt": "night sky, stars, moonlight, warm light, {stylePrompt}"
    },
    {
      "id": "birthday",
      "name": "生日快樂",
      "defaultText": "生日快樂 🎂",
      "prompt": "colorful cake, balloons, candles, {stylePrompt}"
    },
    {
      "id": "health",
      "name": "健康平安",
      "defaultText": "祝你健康平安 🌻",
      "prompt": "sunny meadow, flowers, nature, {stylePrompt}"
    }
  ]
}

(2) styles.json
{
  "styles": [
    {
      "id": "soft_realism",
      "name": "柔光寫實風",
      "prompt": "soft lighting, cinematic realism, warm tone, cozy atmosphere"
    },
    {
      "id": "illustration",
      "name": "插畫風",
      "prompt": "cute digital illustration, pastel tone, kawaii style"
    },
    {
      "id": "ink_painting",
      "name": "東方水墨風",
      "prompt": "Chinese ink painting, watercolor, minimal brush strokes"
    },
    {
      "id": "zen_style",
      "name": "佛系禪風",
      "prompt": "Buddhist Zen style, lotus, sunlight, misty calm"
    },
    {
      "id": "dreamy",
      "name": "夢幻糖果風",
      "prompt": "dreamy pastel colors, floating hearts and clouds, soft focus"
    },
    {
      "id": "vintage",
      "name": "懷舊復古風",
      "prompt": "vintage film photo, nostalgic warm color, soft grain"
    }
  ]
}

🧠 六、AI Prompt 組合邏輯 (Prompt Composition Logic)
// Example pseudo-code
const themePrompt = selectedTheme.prompt;
const stylePrompt = selectedStyle.prompt;

const finalPrompt = themePrompt.replace("{stylePrompt}", stylePrompt);


例子：

主題：「早安問候」

風格：「插畫風」
→ 最終 Prompt：

morning sunlight, coffee, cozy room, cute digital illustration, pastel tone, kawaii style

🖼️ 七、圖片文字疊加邏輯 (Text Overlay Spec)

使用 node-canvas 或 Cloudinary API 疊加

字型建議：Noto Sans TC / 思源黑體

顏色建議：#FFAA33（早安） / #334477（晚安） / #E65A41（節慶）

位置：圖片底部中間對齊

📡 八、API 規格 (Backend Endpoints)
Method	Endpoint	說明
POST	/webhook	LINE webhook 接收使用者訊息
GET	/themes	回傳可選主題清單
GET	/styles	回傳風格清單
POST	/generate	接收主題、風格、祝福文字，生成圖片並回傳 URL
/generate 輸入範例
{
  "themeId": "good_morning",
  "styleId": "illustration",
  "text": "祝你今天元氣滿滿 ☀️"
}

回傳範例
{
  "imageUrl": "https://res.cloudinary.com/xxx/generated/abc123.png"
}

🪄 九、系統流程圖 (System Flow)
[使用者] → [選主題]
          ↓
       [選風格]
          ↓
      [輸入文字]
          ↓
   [Bot 組合 Prompt]
          ↓
   [AI 生成圖片 API]
          ↓
   [文字疊加處理]
          ↓
   [Cloudinary 儲存]
          ↓
   [LINE 回傳圖片 + 分享按鈕]

📅 十、開發時程建議 (Development Phases)
階段	任務	預估時間
Phase 1	建立 LINE Bot + 選單互動	2 週
Phase 2	整合 AI 圖片生成 API	1 週
Phase 3	圖片疊字與上傳 CDN	1 週
Phase 4	分享與排版優化	1 週
合計	MVP 可上線時間	約 5 週
🔮 十一、未來擴充方向 (Future Enhancements)

✨ 增加「每日自動祝福推播」功能

🪷 支援「語音祝福」(TTS)

📆 加入節慶主題自動上架（母親節、中秋節）

🖋️ 支援使用者自訂模板、上傳照片背景

💾 紀錄使用者常用主題偏好