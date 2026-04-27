let _isDemoMode = false;

export function setDemoMode(on: boolean): void {
  _isDemoMode = Boolean(on);
}

export function isDemoMode(): boolean {
  return _isDemoMode;
}

export const DEMO_CHANNELS = [
  { id: "demo-strategy", name: "#product-strategy" },
  { id: "demo-general", name: "#general" },
  { id: "demo-incidents", name: "#incidents" },
];

export const DEMO_CHANNEL_UNREAD: Record<string, number> = {
  "demo-strategy": 12,
  "demo-general": 3,
  "demo-incidents": 1,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEMO_MESSAGES_BY_CHANNEL: Record<string, any[]> = {
  "demo-strategy": [
    {
      id: "dm-1",
      user: "Jordan Lee",
      initials: "JL",
      color: "#0A84FF",
      time: "9:41 AM",
      text: "Morning team! The Q3 roadmap deck passed legal and compliance last night. We're clear to greenlight Phase 1 — but before we hit the ground running, we need to nail down the ballpark figure for infrastructure costs. Marketing is already breathing down our necks.",
      reactions: ["🚀 4", "👍 3"],
    },
    {
      id: "dm-2",
      user: "Priya Nair",
      initials: "PN",
      color: "#30D158",
      time: "9:44 AM",
      text: "I've run the numbers — we're looking at $40K–$60K for cloud provisioning. Heads up though: the legacy auth layer is a ticking time bomb. If we don't refactor it before launch, we might end up back at the drawing board mid-sprint.",
      reactions: ["⚠️ 2", "🔥 3"],
    },
    {
      id: "dm-3",
      user: "Marcus Webb",
      initials: "MW",
      color: "#BF5AF2",
      time: "9:47 AM",
      text: "From a design standpoint, the onboarding flow is solid. But the accessibility audit came back with six WCAG blockers. If we sweep those under the rug now, they'll bite us in Q4 compliance review.",
      reactions: ["👁️ 3"],
    },
    {
      id: "dm-4",
      user: "Taylor Rhodes",
      initials: "TR",
      color: "#FF9F0A",
      time: "9:51 AM",
      text: "Big picture: everyone needs to be on the same page before we pull the trigger. Last quarter we bit off more than we could chew with the payments integration and burned two entire sprints. Let's not repeat that.",
      reactions: ["💯 5", "👍 4"],
    },
    {
      id: "dm-5",
      user: "Sam Kim",
      initials: "SK",
      color: "#FF453A",
      time: "9:55 AM",
      text: "Agreed. API test coverage is at 67% — that's not going to cut it for a production launch. We need to burn the midnight oil this week or push the date.",
      reactions: ["😓 2", "✅ 3"],
    },
    {
      id: "dm-6",
      user: "Jordan Lee",
      initials: "JL",
      color: "#0A84FF",
      time: "9:58 AM",
      text: "Sam, what's your bandwidth like? If we pair you with Priya for 48 hours, can we get coverage to 85%? That's the low-hanging fruit before we tackle performance benchmarks.",
      reactions: ["💪 3"],
    },
    {
      id: "dm-7",
      user: "Priya Nair",
      initials: "PN",
      color: "#30D158",
      time: "10:02 AM",
      text: "Doable — but I need the API contracts locked first. Right now they're moving targets, and moving targets are a recipe for rework. Can we finalize them by EOD Tuesday?",
      reactions: ["👀 2"],
    },
    {
      id: "dm-8",
      user: "You",
      initials: "ME",
      color: "#0f67b7",
      time: "10:05 AM",
      text: "Contracts are 90% locked. The only open question is the pagination schema. I'll sync with the backend team and get a concrete answer before 3 PM.",
      reactions: ["✅ 4", "👍 2"],
    },
    {
      id: "dm-9",
      user: "Marcus Webb",
      initials: "MW",
      color: "#BF5AF2",
      time: "10:08 AM",
      text: "While we're at it — design tokens for the accessibility rebrand still need brand sign-off. Sent the deck Friday but they're sitting on the fence. If we don't hear back by Wednesday, I'll escalate to move the needle.",
      reactions: ["⏳ 2"],
    },
    {
      id: "dm-10",
      user: "Taylor Rhodes",
      initials: "TR",
      color: "#FF9F0A",
      time: "10:12 AM",
      text: "Let's cut through the noise. I want a clear go/no-go decision ready for Thursday's board meeting. That means a proper risk register and mitigation plan — not just gut feelings. Who owns the risk doc?",
      reactions: ["🎯 6", "💯 3"],
    },
    {
      id: "dm-11",
      user: "Jordan Lee",
      initials: "JL",
      color: "#0A84FF",
      time: "10:15 AM",
      text: "I'll own the risk doc. Draft ready by tomorrow EOD. Priya — tag the tech risks. Marcus — add the accessibility blockers. Sam — document the testing gaps.",
      reactions: ["👍 5"],
    },
    {
      id: "dm-12",
      user: "Sam Kim",
      initials: "SK",
      color: "#FF453A",
      time: "10:18 AM",
      text: "On it. One more red flag: the third-party analytics SDK we integrated is calling home every 30 seconds. That's going to be a blocker for GDPR reviewers. We need to throttle it or rip it out entirely.",
      reactions: ["🚨 4", "❗ 3"],
    },
    {
      id: "dm-13",
      user: "Priya Nair",
      initials: "PN",
      color: "#30D158",
      time: "10:21 AM",
      text: "Adding that to the risk register. It's a hairy problem — the SDK doesn't expose a config option for poll intervals. We'd need to either fork it or build a proxy layer, and neither is a quick fix.",
      reactions: ["😬 2"],
    },
    {
      id: "dm-14",
      user: "Marcus Webb",
      initials: "MW",
      color: "#BF5AF2",
      time: "10:24 AM",
      text: "Let's table the SDK discussion and keep our eye on the ball. If we keep pulling threads, the risk doc will never get off the ground. Jordan, define the MVP scope for Thursday and park the rest in the backlog.",
      reactions: ["💡 3", "👏 2"],
    },
    {
      id: "dm-15",
      user: "Taylor Rhodes",
      initials: "TR",
      color: "#FF9F0A",
      time: "10:28 AM",
      text: "Agreed. Keep it tight, keep it actionable. The board doesn't need the kitchen sink — they need three clear signals: are we on track, what could derail us, and what's the ask. Let's reconvene at 4 PM for a dry run.",
      reactions: ["✅ 7", "🙌 4"],
    },
  ],
  "demo-general": [
    {
      id: "dg-1",
      user: "Jordan Lee",
      initials: "JL",
      color: "#0A84FF",
      time: "8:30 AM",
      text: "Heads up — office HVAC is under maintenance until noon. Stay hydrated and dress in layers.",
      reactions: ["👍 8"],
    },
    {
      id: "dg-2",
      user: "Priya Nair",
      initials: "PN",
      color: "#30D158",
      time: "8:45 AM",
      text: "Quick note: the CI pipeline has been flaky since yesterday's deployment. Rolling back the node version now. Should be back to green in ~30 minutes.",
      reactions: ["🔧 3", "✅ 4"],
    },
    {
      id: "dg-3",
      user: "Marcus Webb",
      initials: "MW",
      color: "#BF5AF2",
      time: "9:00 AM",
      text: "Figma components library is now synced with the latest brand guide. Pull from main. Don't forget to flush your local cache or you'll be chasing ghosts.",
      reactions: ["🎨 5", "👍 3"],
    },
  ],
  "demo-incidents": [
    {
      id: "di-1",
      user: "Ops Bot",
      initials: "OB",
      color: "#FF453A",
      time: "7:12 AM",
      text: "P1 alert: API gateway latency has spiked to 1,200ms average over the last 5 minutes. All hands on standby. Incident bridge open.",
      reactions: ["🚨 6", "👀 5"],
    },
    {
      id: "di-2",
      user: "Sam Kim",
      initials: "SK",
      color: "#FF453A",
      time: "7:18 AM",
      text: "Root cause identified: cache invalidation loop from last night's deployment. Rolled back the config flag. ETA to full recovery: 10 minutes.",
      reactions: ["💪 4", "✅ 3"],
    },
    {
      id: "di-3",
      user: "Ops Bot",
      initials: "OB",
      color: "#FF453A",
      time: "7:29 AM",
      text: "Latency restored to baseline (98ms avg). Incident resolved. Post-mortem scheduled for Friday 2 PM.",
      reactions: ["🎉 8", "✅ 6"],
    },
  ],
};

// ─── Mock understand results ─────────────────────────────────────────────────

interface IdiomEntry {
  phrase: string;
  meaning: string;
  localized_equivalent: string;
  category: string;
}

interface UnderstandResult {
  simplified: string;
  explanation: string;
  idioms: IdiomEntry[];
  tone_hint: string;
  translated: string;
}

const DEMO_FALLBACK_UNDERSTAND: UnderstandResult = {
  simplified: "This message has been rewritten in plain language for easier reading.",
  explanation: "This is a professional workplace message with standard business language.",
  idioms: [],
  tone_hint: "Professional",
  translated: "",
};

const DEMO_UNDERSTAND_LOOKUP: Array<{ match: string; result: UnderstandResult }> = [
  {
    match: "hit the ground running",
    result: {
      simplified: "Good morning! The Q3 plan passed legal review. We can start Phase 1. First, we need a rough cost estimate for servers. The marketing team is pushing us to move fast.",
      explanation: "Jordan announces that Phase 1 is approved after clearing legal and compliance review. He asks for a cost estimate before starting and notes that marketing is applying pressure to begin quickly.",
      idioms: [
        { phrase: "hit the ground running", meaning: "To begin something immediately and energetically, without any delay.", localized_equivalent: "start at full speed immediately", category: "idiom" },
        { phrase: "ballpark figure", meaning: "A rough or approximate estimate, not a precise number.", localized_equivalent: "rough estimate", category: "idiom" },
        { phrase: "breathing down our necks", meaning: "Putting strong pressure on someone by watching closely or urging them to hurry.", localized_equivalent: "pressuring us urgently", category: "idiom" },
      ],
      tone_hint: "Urgent / Business-formal",
      translated: "",
    },
  },
  {
    match: "ticking time bomb",
    result: {
      simplified: "My estimate is $40K–$60K for cloud setup. Warning: the old login system has a growing hidden problem. If we don't fix it before launch, we may have to restart the whole sprint.",
      explanation: "Priya gives a cloud cost estimate and flags a critical technical risk: the legacy authentication system could fail catastrophically if not refactored before the launch.",
      idioms: [
        { phrase: "ticking time bomb", meaning: "A problem that will eventually cause serious damage or failure if not resolved.", localized_equivalent: "serious risk that will cause damage soon", category: "metaphor" },
        { phrase: "back at the drawing board", meaning: "To start a project completely over from the beginning after a major failure or problem.", localized_equivalent: "start from scratch again", category: "idiom" },
      ],
      tone_hint: "Technical / Cautionary",
      translated: "",
    },
  },
  {
    match: "sweep those under the rug",
    result: {
      simplified: "The onboarding screens look good, but the accessibility review found six problems we must fix. Ignoring them now will create bigger compliance problems in Q4.",
      explanation: "Marcus reports that the onboarding design is complete but six WCAG blockers were found in the accessibility audit. He warns that deferring these fixes will cause compliance issues in Q4.",
      idioms: [
        { phrase: "sweep those under the rug", meaning: "To hide a problem and pretend it does not exist rather than dealing with it honestly.", localized_equivalent: "ignore and hide the problem", category: "idiom" },
        { phrase: "bite us in Q4", meaning: "A consequence that will cause serious problems for us later (Q4 = fourth quarter of the year).", localized_equivalent: "cause serious problems for us later", category: "idiom" },
      ],
      tone_hint: "Design / Risk-aware",
      translated: "",
    },
  },
  {
    match: "on the same page",
    result: {
      simplified: "Everyone needs to agree on the plan before we make the final decision. Last quarter we tried to do too much at once with the payments feature and wasted two full sprints. Let's not repeat that.",
      explanation: "Taylor (CEO) stresses team alignment before committing to the launch. He references the failed payments integration as a cautionary example of overcommitment.",
      idioms: [
        { phrase: "on the same page", meaning: "When everyone in a group shares the same understanding or agreement about a topic.", localized_equivalent: "in full agreement", category: "idiom" },
        { phrase: "pull the trigger", meaning: "To finally commit to a decision and take action on it.", localized_equivalent: "make the final decision", category: "idiom" },
        { phrase: "bit off more than we could chew", meaning: "To take on a task or commitment that is too large or difficult to complete successfully.", localized_equivalent: "took on too much at once", category: "idiom" },
      ],
      tone_hint: "Leadership / Strategic",
      translated: "",
    },
  },
  {
    match: "burn the midnight oil",
    result: {
      simplified: "I agree. Only 67% of the new API features have automated tests. That is not safe enough for a live release. We need to work very hard this week or move the launch date back.",
      explanation: "Sam reports that API test coverage is below the acceptable threshold for a production launch. He presents two options: intensive extra work this week, or delaying the release.",
      idioms: [
        { phrase: "not going to cut it", meaning: "Something that does not meet the required standard and is therefore unacceptable.", localized_equivalent: "not acceptable / not sufficient", category: "phrasal_verb" },
        { phrase: "burn the midnight oil", meaning: "To work very late into the night, putting in extra hours to finish something important.", localized_equivalent: "work overtime / stay up late working", category: "idiom" },
      ],
      tone_hint: "Quality / Direct",
      translated: "",
    },
  },
  {
    match: "low-hanging fruit",
    result: {
      simplified: "Sam, how much time do you have? If you and Priya work together for 48 hours, can you get test coverage to 85%? That is the easiest and most impactful improvement before we tackle performance.",
      explanation: "Jordan suggests pairing Sam and Priya for focused work to raise test coverage to the required level, identifying this as the most impactful, lowest-effort improvement before launch.",
      idioms: [
        { phrase: "bandwidth", meaning: "In a work context, the time, energy, or capacity someone has available for tasks.", localized_equivalent: "available time and capacity", category: "jargon" },
        { phrase: "low-hanging fruit", meaning: "The easiest tasks or goals to achieve, requiring minimal effort for significant benefit.", localized_equivalent: "easiest improvements with the biggest payoff", category: "metaphor" },
      ],
      tone_hint: "Collaborative / Problem-solving",
      translated: "",
    },
  },
  {
    match: "moving targets",
    result: {
      simplified: "Yes, I can do it — but I need the final API specifications first. Right now the requirements keep changing, which forces us to redo completed work. Can we finalize them by Tuesday evening?",
      explanation: "Priya agrees to the pairing but conditions it on having stable API contracts. Changing requirements lead to wasted effort, so she requests a firm deadline of EOD Tuesday.",
      idioms: [
        { phrase: "moving targets", meaning: "Goals or requirements that keep changing, making it difficult to complete work correctly.", localized_equivalent: "constantly changing requirements", category: "metaphor" },
        { phrase: "recipe for rework", meaning: "A situation that will inevitably lead to having to redo completed work.", localized_equivalent: "guaranteed to cause repeated work", category: "metaphor" },
      ],
      tone_hint: "Technical / Conditional",
      translated: "",
    },
  },
  {
    match: "sitting on the fence",
    result: {
      simplified: "Also — the new color design files still need approval from the brand team. I sent them the presentation on Friday but they have not decided yet. If they don't reply by Wednesday, I will push harder to get a decision.",
      explanation: "Marcus reports that design token sign-off from the brand team is still pending. He has already shared materials and will escalate to get a decision if no response by Wednesday.",
      idioms: [
        { phrase: "sitting on the fence", meaning: "To avoid making a decision or commitment, especially when a choice must be made between two options.", localized_equivalent: "unable or unwilling to make a decision", category: "idiom" },
        { phrase: "move the needle", meaning: "To make a meaningful and measurable difference or improvement in a situation.", localized_equivalent: "make real progress / get a result", category: "idiom" },
      ],
      tone_hint: "Design / Follow-up",
      translated: "",
    },
  },
  {
    match: "cut through the noise",
    result: {
      simplified: "Let's stop wasting time. I want a clear yes-or-no launch decision ready for the board on Thursday. That means a real risk document with plans — not just opinions. Who is responsible for writing it?",
      explanation: "Taylor cuts through the discussion and requests a formal go/no-go decision document for the board meeting. He wants a risk register with mitigation plans, not informal opinions.",
      idioms: [
        { phrase: "cut through the noise", meaning: "To ignore distractions and minor details and focus only on what is most important.", localized_equivalent: "focus on what matters most", category: "idiom" },
        { phrase: "gut feelings", meaning: "Instinctive reactions or intuitions, not based on data or formal analysis.", localized_equivalent: "personal opinions without supporting evidence", category: "idiom" },
      ],
      tone_hint: "Executive / Decisive",
      translated: "",
    },
  },
  {
    match: "calling home",
    result: {
      simplified: "I am on it. One more problem: the analytics tool we added sends data to its maker's servers every 30 seconds. Privacy law (GDPR) will flag this. We need to limit it or remove it entirely.",
      explanation: "Sam flags a GDPR compliance issue: the analytics SDK makes frequent data transfers to external servers. He proposes two solutions: throttle the polling frequency or remove the SDK entirely.",
      idioms: [
        { phrase: "calling home", meaning: "When software regularly sends data back to its creator's servers, often discussed in security and privacy contexts.", localized_equivalent: "sending data to its servers", category: "jargon" },
        { phrase: "red flag", meaning: "A warning sign that indicates a serious problem requiring immediate attention.", localized_equivalent: "serious warning sign", category: "idiom" },
      ],
      tone_hint: "Compliance / Urgent",
      translated: "",
    },
  },
  {
    match: "hairy problem",
    result: {
      simplified: "Adding that to the risk document. It is a complicated problem — the analytics tool has no setting to control how often it contacts its server. We would need to copy and modify it ourselves, or build something to intercept it. Neither option is quick.",
      explanation: "Priya elaborates on the SDK's technical complexity. There is no built-in configuration option, so the team would need to fork the SDK or build a proxy layer — both significant engineering efforts.",
      idioms: [
        { phrase: "hairy problem", meaning: "A problem that is complicated, messy, or unexpectedly difficult to solve.", localized_equivalent: "complicated and difficult problem", category: "slang" },
      ],
      tone_hint: "Technical / Problem-assessment",
      translated: "",
    },
  },
  {
    match: "keep our eye on the ball",
    result: {
      simplified: "Let's stop discussing the analytics tool for now and focus on what matters most. If we keep opening new issues, the risk document will never be finished. Jordan, define the basic launch requirements for Thursday and put everything else on hold.",
      explanation: "Marcus urges the team to stop expanding scope and focus on completing the risk document. He suggests deferring secondary issues to the backlog and defining minimum scope for Thursday.",
      idioms: [
        { phrase: "table the discussion", meaning: "To postpone or delay a discussion for a later time.", localized_equivalent: "postpone this topic", category: "phrasal_verb" },
        { phrase: "keep our eye on the ball", meaning: "To stay focused on the most important goal and not become distracted by minor issues.", localized_equivalent: "stay focused on the main goal", category: "idiom" },
        { phrase: "pulling threads", meaning: "Following minor or tangential details that lead to endless investigation and distraction.", localized_equivalent: "following minor issues endlessly", category: "metaphor" },
        { phrase: "get off the ground", meaning: "To successfully start or launch something.", localized_equivalent: "get started / be completed", category: "idiom" },
      ],
      tone_hint: "Pragmatic / Redirecting",
      translated: "",
    },
  },
  {
    match: "kitchen sink",
    result: {
      simplified: "Agreed. Stay focused and be clear. The board wants only three things: are we on schedule, what might go wrong, and what do they need to provide. Let's meet at 4 PM today to practice before Thursday.",
      explanation: "Taylor closes the discussion by reinforcing brevity and focus. He defines exactly what the board needs — status, risks, and asks — and schedules a 4 PM dry run.",
      idioms: [
        { phrase: "kitchen sink", meaning: "Used as 'not the kitchen sink' to mean not including everything imaginable — being selective and focused.", localized_equivalent: "everything possible / too much information", category: "idiom" },
        { phrase: "dry run", meaning: "A rehearsal or practice session before the real event to verify everything works correctly.", localized_equivalent: "practice session / rehearsal", category: "idiom" },
      ],
      tone_hint: "Leadership / Closing",
      translated: "",
    },
  },
];

export async function getDemoUnderstandResult(text: string): Promise<UnderstandResult> {
  const delay = 200 + Math.random() * 200;
  await new Promise((resolve) => setTimeout(resolve, delay));
  const lower = String(text || "").toLowerCase();
  for (const entry of DEMO_UNDERSTAND_LOOKUP) {
    if (lower.includes(entry.match.toLowerCase())) {
      return entry.result;
    }
  }
  return DEMO_FALLBACK_UNDERSTAND;
}

export const DEMO_SUMMARIZE_RESULT = {
  bullets: [
    "Phase 1 roadmap cleared legal review; cloud infrastructure estimated at $40K–$60K.",
    "Legacy auth system has critical technical debt — must be refactored before launch.",
    "Accessibility audit found 6 WCAG blockers; design token sign-off pending from brand team.",
    "API test coverage is at 67%; team target is 85% before production deployment.",
    "Third-party analytics SDK violates GDPR by polling its servers every 30 seconds.",
    "A formal go/no-go decision is required for Thursday's board meeting.",
  ],
  decisions: [
    "Jordan to own the risk register and deliver a full draft by EOD tomorrow.",
    "Priya and Sam to pair for 48 hours to raise test coverage from 67% to 85%.",
    "Team to reconvene at 4 PM today for a board presentation dry run.",
  ],
  action_items: [
    "Jordan: complete risk register with all team inputs by EOD tomorrow.",
    "Priya: tag all technical risk items; scope the legacy auth refactor.",
    "Marcus: add 6 accessibility blockers to risk doc; escalate brand sign-off by Wednesday.",
    "Sam: document all testing gaps; propose resolution for the analytics SDK GDPR issue.",
    "Backend team: finalize API contracts and pagination schema by 3 PM today.",
  ],
  message_count: 15,
  cached: false,
};
