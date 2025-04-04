import { EmailMessage, EmailHeader, Person, Conversation } from '../types';

// API Configuration
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Maximum results to fetch per API call
const MAX_RESULTS = 50;

/**
 * Load the Gmail API client library
 */
export const loadGmailApi = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    gapi.load('client:auth2', async () => {
      try {
        await gapi.client.init({
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
          scope: SCOPES.join(' '),
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};

/**
 * Check if a user is currently signed in
 */
export const isUserSignedIn = (): boolean => {
  return gapi.auth2?.getAuthInstance()?.isSignedIn?.get() || false;
};

/**
 * Sign in the user to Gmail
 */
export const signIn = async (): Promise<void> => {
  await gapi.auth2.getAuthInstance().signIn();
};

/**
 * Sign out the user from Gmail
 */
export const signOut = async (): Promise<void> => {
  await gapi.auth2.getAuthInstance().signOut();
};

/**
 * Get the user's Gmail profile info
 */
export const getUserProfile = async (): Promise<{email: string; name: string; picture?: string}> => {
  const response = await gapi.client.request({
    path: 'https://www.googleapis.com/userinfo/v2/me',
  });
  
  const profile = JSON.parse(response.body);
  return {
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  };
};

/**
 * Fetch messages from Gmail
 */
export const fetchMessages = async (pageToken?: string): Promise<{
  messages: EmailMessage[];
  nextPageToken?: string;
}> => {
  try {
    // First, get message IDs
    const listResponse = await gapi.client.gmail.users.messages.list({
      userId: 'me',
      maxResults: MAX_RESULTS,
      pageToken,
      // Filter out categories if needed
      // q: 'category:primary',
    });

    const messageIds = listResponse.result.messages || [];
    
    if (!messageIds.length) {
      return { messages: [] };
    }

    // Then batch get full messages
    const messages = await Promise.all(
      messageIds.map(async (message) => {
        if (!message.id) {
          throw new Error('Message ID is missing');
        }
        
        const fullMessage = await gapi.client.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });
        
        return fullMessage.result as EmailMessage;
      })
    );

    return {
      messages,
      nextPageToken: listResponse.result.nextPageToken || undefined,
    };
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

/**
 * Parse email headers to extract sender or primary recipient
 */
export const extractPersonFromHeaders = (headers: EmailHeader[], userEmail: string): Person | null => {
  const fromHeader = headers.find(header => header.name.toLowerCase() === 'from');
  const toHeader = headers.find(header => header.name.toLowerCase() === 'to');
  const subjectHeader = headers.find(header => header.name.toLowerCase() === 'subject');
  const dateHeader = headers.find(header => header.name.toLowerCase() === 'date');
  
  let emailMatch;
  let person: Person | null = null;
  
  // Function to parse email address from header value
  const parseEmail = (headerValue: string): { email: string; name?: string } => {
    // Extract name and email from format: "Name <email@example.com>" or just "email@example.com"
    const match = headerValue.match(/"?([^"<]+)"?\s*<?([^>]*)>?/);
    
    if (match && match[2]) {
      return {
        name: match[1].trim(),
        email: match[2].trim(),
      };
    } else {
      return {
        email: headerValue.trim(),
      };
    }
  };
  
  if (fromHeader) {
    const parsedFrom = parseEmail(fromHeader.value);
    
    // If this is a message FROM someone else TO the user
    if (parsedFrom.email.toLowerCase() !== userEmail.toLowerCase()) {
      person = {
        email: parsedFrom.email,
        name: parsedFrom.name,
        lastMessageDate: dateHeader?.value || '',
        lastMessageSnippet: subjectHeader?.value || '',
        unreadCount: 0,
      };
    }
  }
  
  // If we couldn't find a person from the From header (it's a message from the user),
  // try to extract from the To header
  if (!person && toHeader) {
    const recipients = toHeader.value.split(',');
    
    // Find first recipient that isn't the user
    for (const recipient of recipients) {
      const parsedTo = parseEmail(recipient);
      
      if (parsedTo.email.toLowerCase() !== userEmail.toLowerCase()) {
        person = {
          email: parsedTo.email,
          name: parsedTo.name,
          lastMessageDate: dateHeader?.value || '',
          lastMessageSnippet: subjectHeader?.value || '',
          unreadCount: 0,
        };
        break;
      }
    }
  }
  
  return person;
};

/**
 * Group emails by person (sender or primary recipient)
 */
export const groupMessagesByPerson = (
  messages: EmailMessage[],
  userEmail: string
): Record<string, Conversation> => {
  const conversations: Record<string, Conversation> = {};
  
  messages.forEach(message => {
    const person = extractPersonFromHeaders(message.payload.headers, userEmail);
    
    if (person) {
      const personEmail = person.email.toLowerCase();
      
      if (!conversations[personEmail]) {
        conversations[personEmail] = {
          person,
          messages: [],
        };
      }
      
      conversations[personEmail].messages.push(message);
    }
  });
  
  // Sort messages within each conversation by date
  Object.values(conversations).forEach(conversation => {
    conversation.messages.sort((a, b) => {
      return parseInt(a.internalDate) - parseInt(b.internalDate);
    });
    
    // Update the person's lastMessageDate and snippet
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const dateHeader = lastMessage.payload.headers.find(h => h.name.toLowerCase() === 'date');
    
    if (dateHeader) {
      conversation.person.lastMessageDate = dateHeader.value;
      conversation.person.lastMessageSnippet = lastMessage.snippet;
    }
  });
  
  return conversations;
};

/**
 * Decode email body content from base64
 */
export const decodeEmailBody = (body?: { data?: string }): string => {
  if (!body || !body.data) return '';
  
  // Replace URL-safe characters
  const sanitized = body.data.replace(/-/g, '+').replace(/_/g, '/');
  
  try {
    return decodeURIComponent(
      atob(sanitized)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (error) {
    console.error('Error decoding email body:', error);
    return '';
  }
};

/**
 * Extract plain text or HTML content from email parts
 */
export const extractEmailContent = (payload: any): { html: string; text: string } => {
  let html = '';
  let text = '';
  
  const processPart = (part: any) => {
    if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      text = decodeEmailBody(part.body);
    } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
      html = decodeEmailBody(part.body);
    }
    
    // Process nested parts if any
    if (part.parts && part.parts.length) {
      part.parts.forEach(processPart);
    }
  };
  
  // Process the main body
  if (payload.body && payload.body.data) {
    if (payload.mimeType === 'text/plain') {
      text = decodeEmailBody(payload.body);
    } else if (payload.mimeType === 'text/html') {
      html = decodeEmailBody(payload.body);
    }
  }
  
  // Process parts if main body doesn't have content
  if (payload.parts && payload.parts.length) {
    payload.parts.forEach(processPart);
  }
  
  return { html, text };
};

// Add a sendEmail function implementation here

export const sendEmail = async (to: string, subject: string, body: string, userEmail: string) => {
  // In a real implementation, this would use Gmail API to send emails
  // For now, we'll simulate sending an email and add it to the message list
  
  // Create a mock email message
  const newMessage = {
    id: `msg-${Date.now()}`,
    threadId: `thread-${Date.now()}`,
    labelIds: ['SENT'],
    snippet: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
    payload: {
      mimeType: 'text/html',
      headers: [
        { name: 'From', value: `${userEmail}` },
        { name: 'To', value: to },
        { name: 'Subject', value: subject },
        { name: 'Date', value: new Date().toISOString() },
      ],
      body: {
        size: body.length,
        data: btoa(body),
      },
    },
    sizeEstimate: body.length,
    historyId: Date.now().toString(),
    internalDate: Date.now().toString(),
  };
  
  // In a real app, we would call the Gmail API here
  // But for now, we'll return the mock message
  return { message: newMessage, success: true };
}; 