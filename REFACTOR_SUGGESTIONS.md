# Future Refactoring Suggestions

This file contains a list of hardcoded constants that were identified as potential candidates for configuration via environment variables. They are currently lower priority but can be externalized in the future to further increase the flexibility of the application.

| File (`src/...`) | Constant/Value | Description | Suggested Env Var Name |
| :--- | :--- | :--- | :--- |
| **`api/index.ts`** | `'用主題預設文字'` | Quick reply button label. | `QUICK_REPLY_USE_DEFAULT_TEXT` |
| | `'請 AI 生成祝福語'` | Quick reply button label. | `QUICK_REPLY_USE_AI_TEXT` | 
| **`image.ts`** | `'LXGWWenKaiMonoTC-Regular.ttf'` | Main font file name. | `FONT_FILE_MAIN` |
| | `'NotoColorEmoji-Regular.ttf'` | Emoji fallback font file name. | `FONT_FILE_EMOJI` |
| | `'LXGW WenKai Mono TC', 'sans-serif'` | CSS `font-family` style. | `IMAGE_FONT_FAMILY` |
| | `1.2` | Line height multiplier. | `IMAGE_LINE_HEIGHT_MULTIPLIER` |
| | `fontSize / 4` | Padding to font size ratio divisor. | `IMAGE_PADDING_RATIO_DIVISOR` |
| | `(fontSize * 1.5)` | Text block bottom margin multiplier. | `IMAGE_TEXT_MARGIN_BOTTOM_MULTIPLIER` |
| | `https://.../twemoji/.../{...}.png` | URL template for loading emoji images. | `EMOJI_IMAGE_URL_TEMPLATE` |
