import Groq from "groq-sdk";

const groq = new Groq();

const response = await groq.chat.completions.create({
  model: "openai/gpt-oss-120b",
  messages: [
    { role: "user", content: "What is the meaning of life? Answer in 2 sentences." },
  ],
});

console.log(response.choices[0].message.content);
