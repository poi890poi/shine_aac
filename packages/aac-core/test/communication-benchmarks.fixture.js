import { ProjectCoreUniversalCoreWords } from "../src/index.js";

export const CommunicationBenchmarkSources = Object.freeze({
  projectCoreUniversalCore: Object.freeze({
    title: "Project Core Universal Core Vocabulary",
    url: "https://project-core.com/communication-systems/",
    notes: [
      "Uses a 36-word Universal Core vocabulary for flexible communication across topics and partners.",
      "Introduces GO, LIKE, and NOT through repeated real-world teaching opportunities."
    ]
  }),
  ashaAacPracticePortal: Object.freeze({
    title: "ASHA AAC Practice Portal",
    url: "https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/",
    notes: [
      "Describes AAC as supporting expression of thoughts, wants and needs, feelings, and ideas.",
      "Describes direct selection and scanning as access methods that must fit individual abilities."
    ]
  }),
  lightMcnaughtonCommunicativeCompetence: Object.freeze({
    title: "Light & McNaughton communicative competence model",
    url: "https://arxiv.org/abs/1411.6568",
    notes: [
      "Frames AAC communication around functional competence across linguistic, operational, social, and strategic demands."
    ]
  }),
  shineRegression: Object.freeze({
    title: "SHINE AAC current-app regression",
    url: "docs/TESTING_REPORT.md",
    notes: [
      "Existing app sequences are regression checks only; they must not drive case-specific ranking rules."
    ]
  }),
  shineZhTwFunctionalVocabulary: Object.freeze({
    title: "SHINE zh-TW built-in functional vocabulary",
    url: "docs/ZHTW_PHONETIC_ACCESS_DESIGN.md",
    notes: [
      "Measures the current Traditional Chinese board surface for urgent daily needs, comfort, care, positioning, people, preference, and repair.",
      "These are product-surface coverage tasks, not academic sentence examples."
    ]
  }),
  shineZhTwTelegraphicUtterances: Object.freeze({
    title: "SHINE zh-TW telegraphic AAC utterances",
    url: "docs/QUALITY_TARGET_METRICS.md",
    notes: [
      "Uses existing zh-TW functional phrases as short AAC utterances across ASHA and Light/McNaughton communication functions.",
      "These are benchmark probes for current UI reachability, not generated natural-language corpus sentences."
    ]
  }),
  shineZhTwPhoneticCore: Object.freeze({
    title: "SHINE zh-TW phonetic core regression",
    url: "docs/QUALITY_TARGET_METRICS.md",
    notes: [
      "Uses source-backed zh-TW dictionary entries and virtual row/column selection to measure whether daily words can be composed without browser timing.",
      "Counts tile activations for reachability and efficiency; real-time scanning is covered separately by browser smoke tests."
    ]
  })
});

const ProjectCoreWordBenchmarks = Object.freeze(
  ProjectCoreUniversalCoreWords.map((word) => Object.freeze({
    id: `project-core-word-${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    source: "projectCoreUniversalCore",
    sourceExample: "Project Core Universal Core word list item.",
    purpose: "universal-core-word",
    targetConcepts: [word.toUpperCase()],
    acceptableTokenSequences: [[word]],
    maxSelections: Math.max(2, word.length + 1)
  }))
);

const ZhTwFunctionalPhraseBenchmarks = Object.freeze([
  ...[
    ["drink-water", "喝水", "need"],
    ["eat", "吃飯", "need"],
    ["toilet", "廁所", "need"],
    ["rest", "休息", "need"],
    ["sleep", "睡覺", "need"],
    ["stop", "停", "refusal-control"],
    ["uncomfortable", "不舒服", "body-comfort"],
    ["hot", "熱", "body-comfort"],
    ["cold", "冷", "body-comfort"],
    ["tired", "累", "body-comfort"],
    ["nausea", "想吐", "body-comfort"],
    ["dizzy", "頭暈", "body-comfort"],
    ["afraid", "怕", "body-comfort"],
    ["family", "家人", "people"],
    ["nurse", "護理師", "care-people"],
    ["yes", "是", "quick-response"],
    ["not", "不", "refusal-control"],
    ["help", "幫忙", "care-help"],
    ["pain", "痛", "body-comfort"]
  ].map(([id, phrase, purpose]) => Object.freeze({
    id: `zhtw-first-page-${id}`,
    profileId: "zh-TW",
    source: "shineZhTwFunctionalVocabulary",
    sourceExample: "First-page zh-TW functional board item.",
    purpose,
    targetConcepts: [phrase],
    acceptableTokenSequences: [[phrase]],
    maxSelections: 1
  })),
  ...[
    ["doctor", "醫生", "care-people"],
    ["medicine", "藥", "care-health"],
    ["position", "姿勢", "positioning"],
    ["wait", "等一下", "repair-wait"],
    ["can", "可以", "permission"],
    ["up", "上", "positioning"],
    ["down", "下", "positioning"],
    ["left", "左", "positioning"],
    ["right", "右", "positioning"],
    ["sit-up", "坐起來", "positioning"],
    ["lie-down", "躺下", "positioning"],
    ["turn-over", "翻身", "positioning"],
    ["pillow", "枕頭", "comfort-object"],
    ["mom", "媽媽", "people"],
    ["dad", "爸爸", "people"]
  ].map(([id, phrase, purpose]) => Object.freeze({
    id: `zhtw-second-page-${id}`,
    profileId: "zh-TW",
    source: "shineZhTwFunctionalVocabulary",
    sourceExample: "Second-page zh-TW functional board item.",
    purpose,
    targetConcepts: [phrase],
    acceptableTokenSequences: [["更多", phrase]],
    maxSelections: 2
  })),
  ...[
    ["caregiver", "照顧者", "care-people"],
    ["friend", "朋友", "people"],
    ["me", "我", "identity"],
    ["not-yes", "不是", "quick-response"],
    ["want", "要", "need"],
    ["cannot", "不可以", "permission-refusal"],
    ["good", "好", "preference"],
    ["bad", "不好", "preference"],
    ["know", "知道", "conversation"],
    ["dont-know", "不知道", "conversation"],
    ["like", "喜歡", "preference"],
    ["dislike", "不喜歡", "preference-refusal"],
    ["again", "再一次", "repair-repeat"],
    ["finish", "結束", "repair-close"]
  ].map(([id, phrase, purpose]) => Object.freeze({
    id: `zhtw-third-page-${id}`,
    profileId: "zh-TW",
    source: "shineZhTwFunctionalVocabulary",
    sourceExample: "Third-page zh-TW functional board item.",
    purpose,
    targetConcepts: [phrase],
    acceptableTokenSequences: [["更多", "更多", phrase]],
    maxSelections: 3
  }))
]);

const ZhTwTelegraphicUtteranceBenchmarks = Object.freeze([
  Object.freeze({
    id: "zhtw-utterance-help-position",
    profileId: "zh-TW",
    source: "shineZhTwTelegraphicUtterances",
    sourceExample: "Care request plus positioning need.",
    purpose: "care-positioning",
    targetConcepts: ["幫忙", "姿勢"],
    acceptableTokenSequences: [["幫忙", "更多", "姿勢"]],
    maxSelections: 3
  }),
  Object.freeze({
    id: "zhtw-utterance-wait-repeat",
    profileId: "zh-TW",
    source: "shineZhTwTelegraphicUtterances",
    sourceExample: "Pacing plus repair request.",
    purpose: "repair-wait",
    targetConcepts: ["等一下", "再一次"],
    acceptableTokenSequences: [["更多", "等一下", "更多", "更多", "再一次"]],
    maxSelections: 5
  }),
  Object.freeze({
    id: "zhtw-utterance-dont-know-repeat",
    profileId: "zh-TW",
    source: "shineZhTwTelegraphicUtterances",
    sourceExample: "Conversation uncertainty plus repair request.",
    purpose: "conversation-repair",
    targetConcepts: ["不知道", "再一次"],
    acceptableTokenSequences: [["更多", "更多", "不知道", "更多", "更多", "再一次"]],
    maxSelections: 6
  }),
  Object.freeze({
    id: "zhtw-utterance-sit-up-pillow",
    profileId: "zh-TW",
    source: "shineZhTwTelegraphicUtterances",
    sourceExample: "Positioning plus comfort object.",
    purpose: "positioning-comfort",
    targetConcepts: ["坐起來", "枕頭"],
    acceptableTokenSequences: [["更多", "坐起來", "更多", "枕頭"]],
    maxSelections: 4
  }),
  Object.freeze({
    id: "zhtw-utterance-nausea-doctor",
    profileId: "zh-TW",
    source: "shineZhTwTelegraphicUtterances",
    sourceExample: "Body status plus care person.",
    purpose: "body-care",
    targetConcepts: ["想吐", "醫生"],
    acceptableTokenSequences: [["想吐", "更多", "醫生"]],
    maxSelections: 3
  }),
  Object.freeze({
    id: "zhtw-utterance-finish",
    profileId: "zh-TW",
    source: "shineZhTwTelegraphicUtterances",
    sourceExample: "Conversation close / stop interaction.",
    purpose: "repair-close",
    targetConcepts: ["結束"],
    acceptableTokenSequences: [["更多", "更多", "結束"]],
    maxSelections: 3
  })
]);

const ZhTwPhoneticCoreBenchmarks = Object.freeze([
  Object.freeze({
    id: "zhtw-phonetic-home-podcast",
    profileId: "zh-TW",
    source: "shineZhTwPhoneticCore",
    sourceExample: "Home setting request to listen to a specific program title.",
    purpose: "home-media-request",
    targetConcepts: ["聽", "新", "資料", "夾"],
    acceptableTokenSequences: [["聽", "新", "資料", "夾"]],
    expectedFinalMessages: ["聽新資料夾"],
    maxSelections: 18
  }),
  Object.freeze({
    id: "zhtw-multilingual-home-podcast",
    profileId: "zh-TW",
    source: "shineZhTwPhoneticCore",
    sourceExample: "Home setting request with embedded English media word in a zh-TW sentence.",
    purpose: "multilingual-home-media-request",
    targetConcepts: ["聽", "podcast", "新", "資料", "夾"],
    acceptableTokenSequences: [["聽", " podcast ", "新", "資料", "夾"]],
    expectedFinalMessages: ["聽 podcast 新資料夾"],
    maxSelections: 30
  }),
  Object.freeze({
    id: "zhtw-multilingual-audio-repair",
    profileId: "zh-TW",
    source: "shineZhTwPhoneticCore",
    sourceExample: "Home setting media repair with an embedded English source label.",
    purpose: "multilingual-home-audio-repair",
    targetConcepts: ["podcast", "音量", "小"],
    acceptableTokenSequences: [["podcast ", "音量", "小"]],
    expectedFinalMessages: ["podcast 音量小"],
    maxSelections: 23
  }),
  Object.freeze({
    id: "zhtw-phonetic-home-drink",
    profileId: "zh-TW",
    source: "shineZhTwPhoneticCore",
    sourceExample: "Home setting drink request with modifiers and assistive object.",
    purpose: "home-drink-request",
    targetConcepts: ["冰", "紅茶", "少", "冰", "不要", "太", "甜", "等", "一下", "喝", "用", "吸管"],
    acceptableTokenSequences: [["冰", "紅茶", "少", "冰", "不要", "太", "甜", "等", "一下", "喝", "用", "吸管"]],
    expectedFinalMessages: ["冰紅茶少冰不要太甜等一下喝用吸管"],
    maxSelections: 54
  }),
  Object.freeze({
    id: "zhtw-phonetic-home-audio-repair",
    profileId: "zh-TW",
    source: "shineZhTwPhoneticCore",
    sourceExample: "Home setting media repair: volume and location in a program.",
    purpose: "home-audio-repair",
    targetConcepts: ["音量", "小", "從", "剛剛", "那裡"],
    acceptableTokenSequences: [["音量", "小", "從", "剛剛", "那裡"]],
    expectedFinalMessages: ["音量小從剛剛那裡"],
    maxSelections: 28
  }),
  Object.freeze({
    id: "zhtw-phonetic-home-feeling",
    profileId: "zh-TW",
    source: "shineZhTwPhoneticCore",
    sourceExample: "Home setting complex feeling and social expression.",
    purpose: "feeling-social-expression",
    targetConcepts: ["今天", "比較", "累", "但是", "心情", "好", "想", "聽", "你", "講", "這樣", "很", "舒服", "謝謝"],
    acceptableTokenSequences: [["今天", "比較", "累", "但是", "心情", "好", "想", "聽", "你", "講", "這樣", "很", "舒服", "謝謝"]],
    expectedFinalMessages: ["今天比較累但是心情好想聽你講這樣很舒服謝謝"],
    maxSelections: 70
  })
]);

export const CommunicationBenchmarks = Object.freeze([
  ...ProjectCoreWordBenchmarks,
  ...ZhTwFunctionalPhraseBenchmarks,
  ...ZhTwTelegraphicUtteranceBenchmarks,
  ...ZhTwPhoneticCoreBenchmarks,
  Object.freeze({
    id: "project-core-go",
    source: "projectCoreUniversalCore",
    sourceExample: "Moving from one place to another or one position to another is used as a teaching opportunity for GO.",
    purpose: "request-or-transition",
    targetConcepts: ["GO"],
    acceptableTokenSequences: [["go"]],
    maxSelections: 1
  }),
  Object.freeze({
    id: "project-core-like",
    source: "projectCoreUniversalCore",
    sourceExample: "Visible pleasure during an activity or food experience is used as a teaching opportunity for LIKE.",
    purpose: "preference",
    targetConcepts: ["LIKE"],
    acceptableTokenSequences: [["like"]],
    maxSelections: 2
  }),
  Object.freeze({
    id: "project-core-refuse-drink",
    source: "projectCoreUniversalCore",
    sourceExample: "Turning the head to refuse a drink is modeled as NOT wanting a drink.",
    purpose: "refusal",
    targetConcepts: ["NOT", "WANT", "DRINK"],
    acceptableTokenSequences: [["no", "drink"], ["don't", "want", "drink"], ["not", "want", "drink"]],
    maxSelections: 4
  }),
  Object.freeze({
    id: "asha-wants-needs-help",
    source: "ashaAacPracticePortal",
    sourceExample: "AAC supports expression of wants and needs.",
    purpose: "wants-needs",
    targetConcepts: ["I", "NEED", "HELP"],
    acceptableTokenSequences: [["I", "need", "help"], ["need", "help"], ["help"]],
    maxSelections: 3
  }),
  Object.freeze({
    id: "asha-feelings-sick",
    source: "ashaAacPracticePortal",
    sourceExample: "AAC supports expression of feelings and ideas.",
    purpose: "feelings",
    targetConcepts: ["FEEL", "SICK"],
    acceptableTokenSequences: [["feel", "sick"], ["sick"]],
    maxSelections: 4
  }),
  Object.freeze({
    id: "light-operational-repair",
    source: "lightMcnaughtonCommunicativeCompetence",
    sourceExample: "Operational competence includes effective use of the AAC system itself, including repair.",
    purpose: "operational-repair",
    targetConcepts: ["UNDO"],
    setupTokenSequence: ["I"],
    acceptableTokenSequences: [["UNDO"]],
    expectedFinalMessages: [""],
    maxSelections: 1
  }),
  Object.freeze({
    id: "shine-current-want-water",
    source: "shineRegression",
    sourceExample: "Current visible one-switch sequence used by SHINE AAC smoke tests.",
    purpose: "app-regression",
    targetConcepts: ["I", "WANT", "WATER"],
    acceptableTokenSequences: [["I", "want", "water"]],
    maxSelections: 3
  })
]);
