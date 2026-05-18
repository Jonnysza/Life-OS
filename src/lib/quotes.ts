const QUOTES: { text: string; author: string }[] = [
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
  { text: "The future depends on what you do today.", author: "Gandhi" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", author: "Aristotle" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { text: "Motivation gets you going, but discipline keeps you growing.", author: "John C. Maxwell" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "The only way out is through.", author: "Robert Frost" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "If it's important to you, you'll find a way. If not, you'll find an excuse.", author: "Ryan Blair" },
  { text: "Either you run the day, or the day runs you.", author: "Jim Rohn" },
  { text: "What is not started today is never finished tomorrow.", author: "Goethe" },
  { text: "Don't count the days. Make the days count.", author: "Muhammad Ali" },
  { text: "Compounding works for everything you do.", author: "Naval Ravikant" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "How we spend our days is how we spend our lives.", author: "Annie Dillard" },
  { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
  { text: "You will never always be motivated. You have to learn to be disciplined.", author: "Unknown" },
  { text: "Sometimes later becomes never. Do it now.", author: "Unknown" },
  { text: "A river cuts through rock not because of its power, but because of its persistence.", author: "James N. Watkins" },
  { text: "Tiny gains compound.", author: "James Clear" },
  { text: "You are what you do, not what you say you'll do.", author: "Carl Jung" },
  { text: "Everything you've ever wanted is on the other side of consistency.", author: "Unknown" },
];

export function quoteForToday() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
