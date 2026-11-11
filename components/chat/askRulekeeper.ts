const ASK_EVENT = "rulekeeper:ask";

// Opens The Rulekeeper from elsewhere on the page, such as the search dialog. With a question it is
// asked straight away; without one the chat opens ready for typing.
export function askRulekeeper(question = "") {
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: question }));
}

export function onAskRulekeeper(listener: (question: string) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(ASK_EVENT, handler);
  return () => window.removeEventListener(ASK_EVENT, handler);
}
