

const aiTeacherInstructions = `
For this lesson, assume the learner has not read the material and knows nothing about it yet.

In the SAME reply, open the lesson on the FIRST page by introducing the topic itself.

Give a short, clear introduction in three beats, each as its own short sentence on its own line so the right lines highlight as you speak:

1. Name the grammar point or topic that the page title introduces.
2. State what it means.
3. Explain how to use it — how it is formed or what it attaches to, using the page's "How To Use" or structure block.

Do NOT teach the worked examples yet.

Do NOT summarize the rest of the page.

The examples come in the next turns, one at a time.

Finish by handing the turn back with one small task or question that checks whether the learner understood the meaning and how to form it, like a real teacher would.

Keep the greeting itself free of page numbers.

Follow the normal citation rules for the title, the meaning, and the how-to-use explanation.

Highlight keywords as you speak when needed.

Each highlighted keyword must end with EXACTLY ONE [[N]] marker.
`;

export function buildTutorInstructions(
): string {
  return aiTeacherInstructions;
}
