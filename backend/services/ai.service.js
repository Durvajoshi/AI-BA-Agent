const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function callGroq(systemPrompt, userPrompt) {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: String(systemPrompt || "")
      },
      {
        role: "user",
        content: String(userPrompt || "")
      }
    ]
  });

  return String(response.choices[0].message.content);
}

module.exports = { callGroq };
