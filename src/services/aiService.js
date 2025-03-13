const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

exports.generateSummary = async (text) => {
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that summarizes project updates.'
        },
        {
          role: 'user',
          content: `Summarize this project update: ${text}`
        }
      ]
    });
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI error:', error);
    return 'Unable to generate summary at this time.';
  }
};
