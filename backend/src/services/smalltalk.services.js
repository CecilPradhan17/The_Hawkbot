const GREETING_REPLIES = [
  "Hey! What can I help you figure out around campus?",
  "Hi there! What would you like to know?",
  "Hey! Ask me anything about ULM.",
  "Hello! What's on your mind?",
];

const WELLBEING_REPLIES = [
  "I'm doing well—ready to help. What's on your mind?",
  "Pretty good! What can I help you find around campus?",
  "I'm good! What are we figuring out today?",
  "Doing great—thanks for asking! How can I help?",
];

const normalize = message => message
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9'\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const selectReply = (replies, random) => {
  const index = Math.floor(random() * replies.length);
  return { response: replies[index], matched: true, sourceType: "smalltalk" };
};

export function tryHandleSmalltalk(message, random = Math.random) {
  if (typeof message !== "string") return null;
  const normalized = normalize(message);

  const wellbeing = /^(?:(?:hi|hello|hey)(?: there)?\s+)?(?:how are you|how are you doing|how's it going|how is it going)$/;
  if (wellbeing.test(normalized)) return selectReply(WELLBEING_REPLIES, random);

  const greeting = /^(?:hi|hello|hey|hi there|hello there|hey there|good morning|good afternoon|good evening)$/;
  if (greeting.test(normalized)) return selectReply(GREETING_REPLIES, random);

  return null;
}
