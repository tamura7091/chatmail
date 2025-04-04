import { EmailMessage } from '../types';

/**
 * Helper functions for OpenAI API integration
 */

// Function to detect if an email is from a real human
export const isRealHumanEmail = async (message: EmailMessage): Promise<boolean> => {
  try {
    // Skip very short messages
    if (!message.snippet || message.snippet.length < 10) {
      return true; // Default to true for very short messages
    }
    
    // Try to load from storage first
    try {
      const { getDerivedData } = await import('./storageHelper');
      const derivedData = await getDerivedData(message.id);
      
      // If we have previously analyzed this message, use the stored result
      if (derivedData && derivedData.isRealHuman !== undefined) {
        console.log(`Using cached AI classification for message ${message.id}: isRealHuman=${derivedData.isRealHuman}`);
        return derivedData.isRealHuman;
      }
    } catch (storageError) {
      console.log('Could not access storage for message classification, will use AI:', storageError);
    }
    
    // First check if OpenAI API key is configured
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      console.error('OpenAI API key not configured for isRealHumanEmail');
      return true; // Default to treating as real human if we can't check
    }
    
    const fromHeader = message.payload.headers.find(
      header => header.name.toLowerCase() === 'from'
    );
    const from = fromHeader?.value || '';
    
    const subjectHeader = message.payload.headers.find(
      header => header.name.toLowerCase() === 'subject'
    );
    const subject = subjectHeader?.value || '';
    const snippet = message.snippet || '';
    
    // Get the message body safely
    let messageBody = '';
    if (message.payload.body && message.payload.body.data) {
      try {
        messageBody = atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } catch (e) {
        console.log('Could not decode message body, using snippet instead');
        messageBody = snippet;
      }
    } else {
      messageBody = snippet;
    }
    
    // Truncate body if too long to avoid excessive tokens
    if (messageBody.length > 800) {
      messageBody = messageBody.substring(0, 800) + '...';
    }

    // Prepare API request with a clear prompt
    const requestBody = {
      model: "gpt-3.5-turbo", 
      messages: [
        {
          role: "system",
          content: "You analyze emails to determine if they're from a real human or automated/marketing messages. Reply ONLY with 'true' for real human emails or 'false' for automated messages like newsletters, promotional content, or system notifications. Consider factors like personalization, formatting, and content."
        },
        {
          role: "user",
          content: `From: ${from}\nSubject: ${subject}\nEmail content: ${messageBody}`
        }
      ],
      temperature: 0.3,
      max_tokens: 10
    };

    console.log(`Checking if email from "${from}" is from a real human...`);
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error (${response.status}):`, errorText);
      
      // On error, fallback to pattern matching
      const isAutomated = isAutomatedEmail(message);
      const result = !isAutomated;
      
      // Store the result for future use
      try {
        const { storeDerivedData } = await import('./storageHelper');
        await storeDerivedData(message.id, { isRealHuman: result });
      } catch (storageError) {
        console.error('Error storing derived data:', storageError);
      }
      
      return result;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      
      // On error, fallback to pattern matching
      const isAutomated = isAutomatedEmail(message);
      const result = !isAutomated;
      
      // Store the result for future use
      try {
        const { storeDerivedData } = await import('./storageHelper');
        await storeDerivedData(message.id, { isRealHuman: result });
      } catch (storageError) {
        console.error('Error storing derived data:', storageError);
      }
      
      return result;
    }

    const result = data.choices[0]?.message?.content?.trim().toLowerCase();
    const isHuman = result === 'true';
    
    console.log(`Email from "${from}" isRealHuman: ${isHuman}`);
    
    // Store the result for future use
    try {
      const { storeDerivedData } = await import('./storageHelper');
      await storeDerivedData(message.id, { isRealHuman: isHuman });
    } catch (storageError) {
      console.error('Error storing derived data:', storageError);
    }
    
    return isHuman;
  } catch (error) {
    console.error('Error checking if email is from real human:', error);
    return true; // Default to true on error
  }
};

// Fallback function to detect automated emails using patterns
const isAutomatedEmail = (message: EmailMessage): boolean => {
  // Check if message has promotion-related labels
  if (message.labelIds && (
    message.labelIds.includes('CATEGORY_PROMOTIONS') ||
    message.labelIds.includes('CATEGORY_UPDATES') ||
    message.labelIds.includes('CATEGORY_FORUMS') ||
    message.labelIds.includes('CATEGORY_SOCIAL')
  )) {
    return true;
  }
  
  // Common automated sender patterns
  const fromHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'from');
  if (fromHeader) {
    const fromLower = fromHeader.value.toLowerCase();
    const automatedSenders = [
      'noreply', 'no-reply', 'do-not-reply', 'donotreply', 'notification', 'alert', 'updates',
      'billing', 'payment', 'newsletter', 'info@', 'support@', 'help@', 'news@',
      'marketing', 'confirm', 'confirmation', 'welcome', 'team@', 'digest', 'automated',
      'campaign', 'service@', 'contact@', 'hello@', 'social', 'community', 'invite'
    ];
    
    if (automatedSenders.some(sender => fromLower.includes(sender))) {
      return true;
    }
  }
  
  // Check for list-unsubscribe header (strong indicator of bulk email)
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
      'verification', 'security', 'password', 'subscription', 'newsletter',
      'confirm', 'welcome', 'update', 'invitation', 'verify', 'alert',
      'reminder', 'statement', 'report', 'summary', 'digest', 'offer',
      'discount', 'sale', 'promo', 'deal', 'news', 'new', 'featured',
      'free', 'limited', 'exclusive', 'join', 'weekly', 'monthly', 'now available'
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
    // Skip trying to detect actions for very short messages
    if (!message.snippet || message.snippet.length < 15) {
      return null;
    }
    
    // Try to load from storage first
    try {
      const { getDerivedData } = await import('./storageHelper');
      const derivedData = await getDerivedData(message.id);
      
      // If we have previously analyzed this message, use the stored result
      if (derivedData && derivedData.actionNeeded !== undefined) {
        console.log(`Using cached action needed for message ${message.id}: ${derivedData.actionNeeded}`);
        return derivedData.actionNeeded;
      }
    } catch (storageError) {
      console.log('Could not access storage for action detection, will use AI:', storageError);
    }
    
    // First check if OpenAI API key is configured
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      console.error('OpenAI API key not configured for detectActionNeeded');
      return null;
    }
    
    const fromHeader = message.payload.headers.find(
      header => header.name.toLowerCase() === 'from'
    );
    const from = fromHeader?.value || '';
    
    const subjectHeader = message.payload.headers.find(
      header => header.name.toLowerCase() === 'subject'
    );
    const subject = subjectHeader?.value || '';
    const snippet = message.snippet || '';
    
    // Get the full message body if available
    let messageBody = '';
    if (message.payload.body && message.payload.body.data) {
      try {
        messageBody = atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } catch (e) {
        console.log('Could not decode message body for action detection, using snippet instead');
        messageBody = snippet;
      }
    } else {
      messageBody = snippet;
    }
    
    // Truncate body if too long
    if (messageBody.length > 1000) {
      messageBody = messageBody.substring(0, 1000) + '...';
    }

    // Prepare API request body with improved prompt
    const requestBody = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You analyze emails to determine if specific action is required from the recipient. Only identify explicit requests or necessary actions like replying, sending information, scheduling meetings, confirming attendance, or reviewing documents. If action is truly needed, respond with a very brief action description (2-5 words). If no clear action is needed or it's just for information, respond only with the word 'null'. Be conservative - only flag emails that clearly require the recipient to do something specific."
        },
        {
          role: "user",
          content: `From: ${from}\nSubject: ${subject}\nEmail content: ${messageBody}`
        }
      ],
      temperature: 0.3,
      max_tokens: 20
    };

    console.log(`Checking if action is needed for email from "${from}"...`);
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error (${response.status}):`, errorText);
      
      // Store null result for future reference
      try {
        const { storeDerivedData } = await import('./storageHelper');
        await storeDerivedData(message.id, { actionNeeded: undefined });
      } catch (storageError) {
        console.error('Error storing derived data:', storageError);
      }
      
      return null;
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      
      // Store null result for future reference
      try {
        const { storeDerivedData } = await import('./storageHelper');
        await storeDerivedData(message.id, { actionNeeded: undefined });
      } catch (storageError) {
        console.error('Error storing derived data:', storageError);
      }
      
      return null;
    }

    const result = data.choices[0]?.message?.content?.trim();
    console.log(`Action detection for message from ${from}: ${result}`);
    
    // Only return if it's not null and not an empty string
    if (result && result.toLowerCase() !== 'null' && result.trim() !== '') {
      // Store the result for future use
      try {
        const { storeDerivedData } = await import('./storageHelper');
        await storeDerivedData(message.id, { actionNeeded: result });
      } catch (storageError) {
        console.error('Error storing derived data:', storageError);
      }
      
      return result;
    }
    
    // Store null result for future reference
    try {
      const { storeDerivedData } = await import('./storageHelper');
      await storeDerivedData(message.id, { actionNeeded: undefined });
    } catch (storageError) {
      console.error('Error storing derived data:', storageError);
    }
    
    return null;
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
    // Check if OpenAI API key is configured
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return "AI suggestions unavailable. Please configure your OpenAI API key.";
    }
    
    // Get the last few messages for context (max 3)
    const recentMessages = messages.slice(-3);
    let conversationContext = '';
    
    if (recentMessages.length === 0) {
      return "There's no message history available to generate a response from.";
    }
    
    recentMessages.forEach(message => {
      const fromHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'from');
      const fromValue = fromHeader?.value || 'Unknown';
      conversationContext += `From: ${fromValue}\nContent: ${message.snippet || 'No content'}\n\n`;
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

    console.log('Calling OpenAI API with API key:', process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'Available' : 'Not available');
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown API error' } }));
      console.error('OpenAI API error status:', response.status, errorData);
      return `AI suggestion failed: ${errorData.error?.message || response.statusText || 'Unknown error'}`;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return `AI suggestion error: ${data.error.message || 'Unknown error'}`;
    }

    return data.choices[0]?.message?.content?.trim() || 
      "I'd be happy to help you with this. Let me know if you need anything else.";
  } catch (error) {
    console.error('Error generating message suggestion:', error);
    return "Sorry, I couldn't generate a suggestion at this time. Please try again later.";
  }
}; 