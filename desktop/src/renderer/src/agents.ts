import type { Shape } from './components/AgentIcon'

// Placeholder agents and conversations, to shape the UI until real agents exist.

export type Message = { from: 'user' | 'agent'; text: string; time: string }

export type Agent = {
  id: string
  name: string
  role: string
  shape: Shape
  messages: Message[]
}

export const AGENTS: Agent[] = [
  {
    id: 'scout',
    name: 'Scout',
    role: 'Research',
    shape: 'blob',
    messages: [
      {
        from: 'user',
        text: 'Can you keep an eye on apartment listings in Vake? Two bedrooms, under $900, near a metro or a bus line.',
        time: 'Yesterday 21:14',
      },
      {
        from: 'agent',
        text: "Sure. I'll check the main listing sites every hour and only ping you when something actually fits.",
        time: 'Yesterday 21:14',
      },
      {
        from: 'agent',
        text: 'Overnight I went through 214 new listings. 3 match everything you asked for:\n\n• Chavchavadze Ave, 2BR, 68 m², $850, 4 min to the bus stop\n• Paliashvili St, 2BR, 72 m², $880, balcony, agent fee\n• Abashidze St, 2BR, 60 m², $790, newly renovated\n\nI asked the Abashidze owner whether pets are allowed and will tell you when they reply.',
        time: '07:02',
      },
      { from: 'user', text: 'Nice! The Abashidze one looks good. Can I see it this week?', time: '08:40' },
      {
        from: 'agent',
        text: 'The owner can do Thursday at 18:30 or Saturday at 11:00. Pets are fine, and a 1-month deposit. Which slot do you want?',
        time: '09:15',
      },
    ],
  },
  {
    id: 'inbox',
    name: 'Inbox Zero',
    role: 'Email',
    shape: 'bean',
    messages: [
      { from: 'user', text: 'Please sort my inbox every morning and tell me only what needs me.', time: 'Mon 09:00' },
      {
        from: 'agent',
        text: "Done for today. 63 new emails since last night:\n\n• 41 newsletters, archived\n• 14 notifications, labelled\n• 6 replies I drafted for you to check\n• 2 that need you: the contract from Nino (she needs it signed by Friday) and a question from your landlord about the heater repair",
        time: '07:30',
      },
      { from: 'user', text: 'Send the landlord reply, the draft is fine.', time: '07:52' },
      { from: 'agent', text: 'Sent. I put a reminder on Thursday in case the repair date slips.', time: '07:52' },
    ],
  },
  {
    id: 'ledger',
    name: 'Ledger',
    role: 'Finances',
    shape: 'square',
    messages: [
      { from: 'user', text: 'How much did I spend on subscriptions last month?', time: 'Sun 18:20' },
      {
        from: 'agent',
        text: '$86.40 across 9 subscriptions. Two look unused:\n\n• A cloud storage plan you also have through work ($9.99)\n• A meditation app not opened since June ($12.99)\n\nCancelling both saves about $275 a year.',
        time: 'Sun 18:21',
      },
      { from: 'user', text: 'Cancel the meditation one.', time: 'Sun 18:30' },
      {
        from: 'agent',
        text: "It's cancelled. Access stays until the 24th. I'll check next month's statement to make sure they don't charge again.",
        time: 'Sun 18:34',
      },
    ],
  },
  {
    id: 'planner',
    name: 'Planner',
    role: 'Calendar',
    shape: 'pill',
    messages: [
      {
        from: 'user',
        text: 'Find a time for a 1-hour call with Giorgi and Ana next week, mornings if possible.',
        time: 'Fri 16:05',
      },
      {
        from: 'agent',
        text: "Ana is in Berlin next week, so mornings for you are 8:00-10:00 for her. The first slot where all three of you are free is Tuesday 10:00-11:00. I've held it on your calendar and sent them both an invite.",
        time: 'Fri 16:09',
      },
      { from: 'agent', text: 'Giorgi accepted. Ana suggested 10:30 instead, so I moved it. Everyone is in.', time: 'Sat 11:47' },
    ],
  },
  {
    id: 'courier',
    name: 'Courier',
    role: 'Travel',
    shape: 'crescent',
    messages: [
      { from: 'user', text: 'Watch flights to Lisbon for the first week of December. Tell me if it drops under $300.', time: 'Oct 2' },
      {
        from: 'agent',
        text: 'Watching. Right now the cheapest round trip is $412, with one stop in Istanbul.',
        time: 'Oct 2',
      },
      {
        from: 'agent',
        text: 'It dropped: $287 round trip, Dec 2-8, one stop in Istanbul (1h 50m layover), cabin bag included. Prices like this usually last a day or two.',
        time: '03:41',
      },
    ],
  },
  {
    id: 'archivist',
    name: 'Archivist',
    role: 'Notes',
    shape: 'pear',
    messages: [
      { from: 'user', text: 'What did we decide about the logo colors in last week\'s meeting?', time: '12:10' },
      {
        from: 'agent',
        text: "From your notes on the 3rd: you kept the black background and picked the periwinkle accent (#8b9cff). The green option was dropped because it clashed with success messages. Lasha was going to send the final files by the 10th, and I don't see them in your email yet.",
        time: '12:10',
      },
    ],
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    role: 'Monitoring',
    shape: 'diamond',
    messages: [
      { from: 'user', text: 'Check my website every 5 minutes and wake me only if it is really down.', time: 'Sep 28' },
      {
        from: 'agent',
        text: 'Heads up: the site returned errors for 3 checks in a row (02:10-02:20). It was the database connection limit. It recovered by itself at 02:22, so I didn\'t wake you. Raising the pool size would probably stop it happening again.',
        time: '02:24',
      },
      { from: 'user', text: 'Thanks. Leave it for now, but tell me if it happens again this week.', time: '08:05' },
      { from: 'agent', text: "Will do. It's been all green since.", time: '08:05' },
    ],
  },
  {
    id: 'muse',
    name: 'Muse',
    role: 'Writing',
    shape: 'plus',
    messages: [
      { from: 'user', text: 'Draft a short post announcing that Open Assistant is open source.', time: '14:00' },
      {
        from: 'agent',
        text: "Here's a first draft:\n\nOpen Assistant is now open source. It's an AI agent that keeps working in the cloud after you close your laptop: watching, sorting and following up while you're away. Read the code, run it yourself, and tell us what you'd build with it.\n\nWant it shorter, or with a link to the repo?",
        time: '14:01',
      },
      { from: 'user', text: 'Shorter, and add the link.', time: '14:03' },
      {
        from: 'agent',
        text: 'Open Assistant is open source: an AI agent that keeps working after you close your laptop. github.com/lortkipa/open-assistant',
        time: '14:03',
      },
    ],
  },
]

const REPLIES = [
  "Got it. I'll start on that now and message you when there's something worth your attention.",
  "On it. This may take a while, so feel free to close the app. I'll keep working in the background.",
  'Sure. I added it to my list and will report back with what I find.',
  "Understood. I'll check on it every hour and only ping you if something changes.",
]

// A canned answer until agents are real; questions get their own.
export function fakeReply(text: string) {
  if (text.trim().endsWith('?')) return "Good question. Let me look into it and I'll get back to you shortly."
  return REPLIES[Math.floor(Math.random() * REPLIES.length)]
}
