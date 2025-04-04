import { EmailMessage } from '../types';

/**
 * Helper functions for OpenAI API integration
 */

// Function to detect if an email is from a real human
export const isRealHumanEmail = async (message: EmailMessage): Promise<boolean> => {
  try {
    const fromHeader = message.payload.headers.find(
      header => header.name.toLowerCase() === 'from'
    );

    if (!fromHeader) return false;

    const fromValue = fromHeader.value;
    const subjectHeader = message.payload.headers.find(
      header => header.name.toLowerCase() === 'subject'
    );
    const subject = subjectHeader?.value || '';
    const snippet = message.snippet || '';

    // Prepare API request body
    const requestBody = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at identifying if an email is from a real human or an automated system. Respond only with 'true' if it appears to be from a real person having a conversation, or 'false' if it's promotional, a newsletter, an automated notification, or any other non-personal communication."
        },
        {
          role: "user",
          content: `From: ${fromValue}\nSubject: ${subject}\nSnippet: ${snippet}`
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    };

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      // Fallback to non-AI method if OpenAI fails
      return !isAutomatedEmail(message);
    }

    const result = data.choices[0]?.message?.content?.trim().toLowerCase();
    return result === 'true';
  } catch (error) {
    console.error('Error checking if email is from real human:', error);
    // Fallback to non-AI method if there's an error
    return !isAutomatedEmail(message);
  }
};

// Fallback function to detect automated emails using patterns
const isAutomatedEmail = (message: EmailMessage): boolean => {
  // Check if message has CATEGORY_PROMOTIONS label
  if (message.labelIds && message.labelIds.includes('CATEGORY_PROMOTIONS')) {
    return true;
  }
  
  // Common automated sender patterns
  const fromHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'from');
  if (fromHeader) {
    const fromLower = fromHeader.value.toLowerCase();
    const automatedSenders = [
      'noreply', 'no-reply', 'donotreply', 'notification', 'alert', 'updates',
      'billing', 'payment', 'newsletter', 'info@', 'support@', 'help@'
    ];
    
    if (automatedSenders.some(sender => fromLower.includes(sender))) {
      return true;
    }
  }
  
  // Check for list-unsubscribe header
  const hasUnsubscribe = message.payload.headers.some(h => 
    h.name.toLowerCase() === 'list-unsubscribe'
  );
  
  if (hasUnsubscribe) {
    return true;
  }
  
  // Check for commonly automated subjects
  const subjectHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'subject');
  if (subjectHeader) {
    const subjectLower = subjectHeader.value.toLowerCase();
    const automatedSubjects = [
      'receipt', 'invoice', 'order', 'shipping', 'delivered', 'notification',
      'verification', 'security', 'password', 'subscription', 'newsletter'
    ];
    
    if (automatedSubjects.some(subject => subjectLower.includes(subject))) {
      return true;
    }
  }
  
  return false;
};

// Function to detect actions needed for an email
export const detectActionNeeded = async (message: EmailMessage): Promise<string | null> => {
  try {
    const subjectHeader = message.payload.headers.find(
      header => header.name.toLowerCase() === 'subject'
    );
    const subject = subjectHeader?.value || '';
    const snippet = message.snippet || '';

    // Prepare API request body
    const requestBody = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an assistant that identifies if an email requires action. First, determine if any action is needed. If an action is needed, respond with a brief action description (max 5 words). If no action is needed, respond with 'null'. Be specific about what needs to be done."
        },
        {
          role: "user",
          content: `Subject: ${subject}\nEmail snippet: ${snippet}`
        }
      ],
      temperature: 0.3,
      max_tokens: 20
    };

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return null;
    }

    const result = data.choices[0]?.message?.content?.trim();
    return result === 'null' ? null : result;
  } catch (error) {
    console.error('Error detecting action needed:', error);
    return null;
  }
};

// Function to generate AI message suggestions
export const generateMessageSuggestion = async (
  messages: EmailMessage[],
  prompt?: string
): Promise<string> => {
  try {
    // Get the last few messages for context (max 3)
    const recentMessages = messages.slice(-3);
    let conversationContext = '';
    
    recentMessages.forEach(message => {
      const fromHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'from');
      const fromValue = fromHeader?.value || 'Unknown';
      conversationContext += `From: ${fromValue}\nContent: ${message.snippet}\n\n`;
    });

    // Prepare API request body
    const requestBody = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an email assistant that generates helpful, concise, and professional email responses based on conversation context. Keep responses under 100 words and focus on being helpful and natural."
        },
        {
          role: "user",
          content: `Here's the recent conversation context:\n\n${conversationContext}\n\nGenerate a response${prompt ? ' that ' + prompt : ''}.`
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    };

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return "I'd be happy to help you with this. Let me know if you need anything else.";
    }

    return data.choices[0]?.message?.content?.trim() || 
      "I'd be happy to help you with this. Let me know if you need anything else.";
  } catch (error) {
    console.error('Error generating message suggestion:', error);
    return "I'd be happy to help you with this. Let me know if you need anything else.";
  }
}; 