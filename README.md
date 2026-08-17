# 风险事件提醒网站

这是一个无需构建的静态页面。事件数据统一维护在根目录的
[`events.json`](./events.json)，页面会读取这份数据，显示今日状态、当日事件和未来七天事件，并自动计算北京时间。

## 本地预览

在项目根目录运行：

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000/>。请通过本地 HTTP 服务访问，不要直接双击
`index.html`；直接使用 `file://` 打开时，浏览器可能阻止页面读取 `events.json`。

## 维护 `events.json`

文件内容必须是 JSON 数组。数组中的每一项代表一个事件，字段如下：

| 字段 | 类型与允许值 | 说明 |
| --- | --- | --- |
| `date` | 字符串，`YYYY-MM-DD` | 事件日期。 |
| `type` | `CPI`、`PPI`、`NFP`、`FOMC`、`POWELL_SPEECH`、`GDP`、`BTC_EVENT`、`OTHER` | 事件类型。 |
| `name` | 非空字符串 | 页面显示的事件名称。 |
| `time_et` | `HH:mm` 字符串（ET 24 小时制）或 `null` | 美国东部时间；没有明确公布时刻时填写 `null`。必须使用两位小时和分钟，例如 `08:30`、`14:00`。 |
| `importance` | `high`、`medium`、`low` | 重要度，页面分别显示为高、中、低。 |
| `note` | 字符串，可省略 | 备注；省略时按空备注处理。 |

`time_et` 必须填写 ET 24 小时制或 `null`。不要手动添加或维护北京时间：页面会根据
`date` 和 `time_et` 自动换算到 `Asia/Shanghai`，并在跨日时标注“次日”或“前日”。
当天和未来七天的筛选也按该换算后的北京时间日期进行；`time_et: null` 表示日期型事件，
无法换算时刻，因此筛选时直接使用它的 `date` 字段。

示例：

```json
[
  {
    "date": "2026-08-19",
    "type": "FOMC",
    "name": "FOMC 会议纪要公布",
    "time_et": "14:00",
    "importance": "high",
    "note": "关注措辞变化"
  },
  {
    "date": "2026-08-24",
    "type": "BTC_EVENT",
    "name": "比特币政策听证会",
    "time_et": null,
    "importance": "high",
    "note": "时间待官方确认"
  }
]
```

编辑完成后，在项目根目录运行测试：

```bash
npm test
```

确认测试通过后刷新浏览器页面，检查今日状态、事件卡片、ET/北京时间、重要度和备注是否符合预期。数据缺失或格式无效时，页面应显示加载失败提示；请修正 `events.json` 后重新测试并刷新。
