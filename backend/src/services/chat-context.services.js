const MAX_RECENT_TURNS = 8;
const MAX_TURN_LENGTH = 500;
const MAX_CLARIFICATIONS = 2;

const normalizeText = (value, max = MAX_TURN_LENGTH) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const sanitizeChatContext = input => {
  const recentTurns = Array.isArray(input?.recentTurns)
    ? input.recentTurns.slice(-MAX_RECENT_TURNS).flatMap(turn => {
        const role = turn?.role === "assistant" ? "assistant" : turn?.role === "user" ? "user" : null;
        const content = normalizeText(turn?.content);
        return role && content ? [{ role, content }] : [];
      })
    : [];

  const raw = input?.clarification;
  const originalQuery = normalizeText(raw?.originalQuery, 250);
  const exchanges = Array.isArray(raw?.exchanges)
    ? raw.exchanges.slice(0, MAX_CLARIFICATIONS).flatMap(exchange => {
        const question = normalizeText(exchange?.question, 250);
        const answer = normalizeText(exchange?.answer, 250);
        return question ? [{ question, ...(answer ? { answer } : {}) }] : [];
      })
    : [];
  const clarification = originalQuery && exchanges.length
    ? { originalQuery, exchanges, count: Math.min(exchanges.length, MAX_CLARIFICATIONS) }
    : null;

  return { recentTurns, clarification };
};

const isContextDependent = message => {
  const text = String(message || "").trim().toLowerCase();
  if (!text) return false;
  return text.split(/\s+/).length <= 7
    || /^(?:and|also|what about|how about|when|where|why|how much|does it|is it|are they|can i|tomorrow|today)\b/.test(text)
    || /\b(?:it|that|they|them|there|tomorrow|then|same)\b/.test(text);
};

export const buildContextualQuery = (message, context = {}) => {
  const current = normalizeText(message, 250);
  const clarification = context.clarification;
  if (clarification) {
    const chain = [clarification.originalQuery];
    for (const exchange of clarification.exchanges) {
      chain.push(`Clarifying question: ${exchange.question}`);
      if (exchange.answer) chain.push(`User clarification: ${exchange.answer}`);
    }
    chain.push(`Current reply: ${current}`);
    return chain.filter(Boolean).join("\n");
  }
  if (!isContextDependent(current)) return current;
  // Prior assistant prose is never reused as retrieval evidence. Recent user
  // questions provide enough topic context for elliptical follow-ups while
  // every factual answer is still grounded in freshly retrieved evidence.
  const prior = (context.recentTurns || []).filter(turn => turn.role === "user").slice(-3)
    .map(turn => `Earlier user question: ${turn.content}`);
  return prior.length ? `${prior.join("\n")}\nUser: ${current}` : current;
};

export const buildClarificationState = (context, originalQuery, question) => {
  const prior = context?.clarification;
  const exchanges = prior ? [...prior.exchanges] : [];
  if (exchanges.length >= MAX_CLARIFICATIONS) return null;
  exchanges.push({ question: normalizeText(question, 250) });
  return {
    originalQuery: prior?.originalQuery || normalizeText(originalQuery, 250),
    exchanges,
    count: exchanges.length,
  };
};

export const canClarify = context => (context?.clarification?.count || 0) < MAX_CLARIFICATIONS;
