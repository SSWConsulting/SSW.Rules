// Shared by the chat API and the chat window, so the window never sends what the server would refuse.
export const MAX_MESSAGE_CHARS = 2000;
// The questions an answer sees: the new one and the ones just before it, for follow-ups like "and for emails?".
export const MAX_HISTORY_QUESTIONS = 3;
export const MAX_CITED_RULES = 100;
