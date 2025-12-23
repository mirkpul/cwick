const llmService = require('../src/services/llmService');
const logger = require('../src/config/logger');

// Mock logger to suppress output during test
logger.debug = () => { };
logger.error = console.error;

// Mock OpenAI client
const mockOpenAI = {
    chat: {
        completions: {
            create: async () => ({
                model: 'gpt-4-test',
                usage: { total_tokens: 10 },
                choices: [
                    {
                        finish_reason: 'stop',
                        message: {
                            content: null // This caused the crash
                        }
                    }
                ]
            })
        }
    }
};

// Inject mock
llmService.openai = mockOpenAI;

async function runVerification() {
    console.log('Starting verification...');

    try {
        const result = await llmService.generateResponse(
            'openai',
            'gpt-4-test',
            [{ sender: 'user', content: 'hello' }],
            'system prompt'
        );

        if (result.content === '') {
            console.log('SUCCESS: Handled null content correctly (returned empty string)');
        } else {
            console.error('FAILURE: Unexpected content:', result.content);
            process.exit(1);
        }
    } catch (error) {
        console.error('FAILURE: crashed with error:', error);
        process.exit(1);
    }
}

runVerification();
