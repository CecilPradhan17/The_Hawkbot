export const buildQuestionCurationSource = ({ question, answer }) => `Use the answer as the evidence for every stored fact.
Use the question only to identify the subject and scope, resolve pronouns or references, and expand a context-dependent answer into a self-contained statement.
Never treat an assumption or unconfirmed claim in the question as established fact.
An answer such as "Yes", "No", "Tomorrow", "At 5 PM", or "In the library" must never be stored as that fragment alone. Rewrite it with the subject and any necessary qualifiers from the question.
Copy dates, times, names, and other qualifiers from the question when they define what the answer refers to, but do not invent a missing qualifier or calendar date.
Do not add factual claims unsupported by the answer. Words taken from the question solely to name the answer's subject or scope are context, not new evidence.

Question: "${question}"
Answer: "${answer}"`;
