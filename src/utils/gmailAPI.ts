import { EmailMessage, EmailHeader, Person, Conversation } from '../types';

// Add global type declarations
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => any;
          revoke: (token: string, callback: () => void) => void;
        }
      }
    }
  }
}

// API Configuration
const SCOPES = process.env.NEXT_PUBLIC_GMAIL_SCOPES ? 
  process.env.NEXT_PUBLIC_GMAIL_SCOPES.split(',') : 
  [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.send',
  ];

// Maximum results to fetch per API call
const MAX_RESULTS = 50;

// Store the token client globally
let tokenClient: any = null;

/**
 * Load the Gmail API client library
 */
export const loadGmailApi = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Loading Gmail API client library...');
      gapi.load('client', async () => {
        try {
          console.log('Initializing GAPI client with API key:', process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.substring(0, 5) + '...');
          
          // Initialize the GAPI client
          await gapi.client.init({
            apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
          });
          
          console.log('GAPI client initialized successfully');
          console.log('Initializing token client with client ID:', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.substring(0, 10) + '...');
          console.log('Using scopes:', SCOPES.join(' '));
          
          // Initialize the token client
          tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
            scope: SCOPES.join(' '),
            prompt: 'consent',
            callback: (response: any) => {
              console.log('Token client callback triggered');
              if (response && 'error' in response) {
                console.error('Auth error:', response.error);
                reject(response);
                return;
              }
              
              if (response && 'access_token' in response) {
                // Store the access token in session storage
                sessionStorage.setItem('gmail_access_token', response.access_token);
                console.log('Access token stored in session storage');
                
                // Set the token for API requests
                gapi.client.setToken(response as any);
                console.log('Token set for API requests');
                
                resolve();
              } else {
                console.error('No access token in response');
                reject(new Error('No access token received'));
              }
            }
          });
          
          // We only initialize the client here, but don't request tokens yet
          // That will happen in the signIn method
          console.log('Token client initialized successfully');
          resolve();
        } catch (error) {
          console.error('Error initializing GAPI client:', error);
          
          // Log more specific error details
          if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
          
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error loading GAPI client library:', error);
      reject(error);
    }
  });
};

/**
 * Check if a user is currently signed in
 */
export const isUserSignedIn = (): boolean => {
  // Check if we have an access token in session storage
  const hasToken = !!sessionStorage.getItem('gmail_access_token');
  console.log('Checking if user is signed in:', hasToken);
  return hasToken;
};

/**
 * Sign in the user to Gmail
 */
export const signIn = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      console.error('Token client not initialized');
      reject(new Error('Token client not initialized'));
      return;
    }
    
    console.log('Starting Gmail sign-in process...');
    
    // Clear any existing token to force a fresh login
    sessionStorage.removeItem('gmail_access_token');
    gapi.client.setToken(null as any);
    
    // Use the callback already set in loadGmailApi
    // This callback will either resolve or reject the promise
    console.log('Requesting access token with prompt:consent');
    
    try {
      tokenClient.requestAccessToken({ 
        prompt: 'consent',
        hint: '' // Empty hint to show account selector
      });
      
      // The promise will be resolved in the callback
      // This is just to handle cases where requestAccessToken doesn't throw but also doesn't call the callback
      setTimeout(() => {
        // If we get here and there's still no token, something went wrong
        if (!sessionStorage.getItem('gmail_access_token')) {
          console.warn('Sign-in timeout - no callback received');
          reject(new Error('Sign-in timeout - no callback received'));
        }
      }, 60000); // 60 second timeout
    } catch (error) {
      console.error('Error requesting access token:', error);
      reject(error);
    }
  });
};

/**
 * Sign out the user from Gmail
 */
export const signOut = async (): Promise<void> => {
  const token = sessionStorage.getItem('gmail_access_token');
  if (token) {
    window.google.accounts.oauth2.revoke(token, () => {
      sessionStorage.removeItem('gmail_access_token');
      gapi.client.setToken(null as any);
    });
  }
};

/**
 * Get the user's Gmail profile info
 */
export const getUserProfile = async (): Promise<{email: string; name: string; picture?: string}> => {
  try {
    console.log('Fetching user profile...');
    
    // Ensure we have a token set
    const token = sessionStorage.getItem('gmail_access_token');
    if (!token) {
      console.error('No access token found when trying to get user profile');
      throw new Error('No access token available');
    }
    
    // Make sure the token is set for this request
    gapi.client.setToken({ access_token: token });
    
    // Make the request to get user profile
    const response = await gapi.client.request({
      path: 'https://www.googleapis.com/userinfo/v2/me',
    });
    
    console.log('User profile response:', response);
    
    if (response.status !== 200) {
      console.error('Error fetching user profile:', response);
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    
    const profile = JSON.parse(response.body);
    console.log('Successfully fetched user profile:', profile.email);
    
    return {
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture,
    };
  } catch (error) {
    console.error('Failed to get user profile:', error);
    
    // If we get a 401 error, the token is invalid
    if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
      console.log('Token appears to be invalid (401 error), clearing session');
      sessionStorage.removeItem('gmail_access_token');
    }
    
    throw error;
  }
};

/**
 * Fetch messages from Gmail
 */
export const fetchMessages = async (pageToken?: string): Promise<{
  messages: EmailMessage[];
  nextPageToken?: string;
}> => {
  try {
    console.log('Fetching messages from Gmail API...');
    
    // Ensure we have a token set
    const token = sessionStorage.getItem('gmail_access_token');
    if (!token) {
      console.error('No access token found when trying to fetch messages');
      throw new Error('No access token available');
    }
    
    // Make sure the token is set for this request
    gapi.client.setToken({ access_token: token });
    
    // First, try with inbox query
    let listResponse;
    try {
      // First, get message IDs
      listResponse = await gapi.client.gmail.users.messages.list({
        userId: 'me',
        maxResults: MAX_RESULTS,
        pageToken,
        // Fetch from inbox by default to ensure we get user's emails
        q: 'in:inbox',
      });
    } catch (inboxError) {
      console.error('Error fetching inbox messages, trying without query:', inboxError);
      
      // If inbox query fails, try without any query
      listResponse = await gapi.client.gmail.users.messages.list({
        userId: 'me',
        maxResults: MAX_RESULTS,
        pageToken
      });
    }

    console.log('List response received:', listResponse);
    
    // Check if we have a valid response
    if (!listResponse || !listResponse.result) {
      console.error('Invalid response from Gmail API:', listResponse);
      return { messages: [] };
    }
    
    const messageIds = listResponse.result.messages || [];
    
    console.log(`Found ${messageIds.length} message IDs`);
    
    if (!messageIds.length) {
      console.log('No messages found in Gmail account');
      return { messages: [] };
    }

    // Then batch get full messages
    console.log('Fetching full message details...');
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

    console.log(`Successfully fetched ${messages.length} full messages`);
    return {
      messages,
      nextPageToken: listResponse.result.nextPageToken || undefined,
    };
  } catch (error) {
    console.error('Error fetching messages:', error);
    // Add more detailed error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else if (typeof error === 'object' && error !== null) {
      console.error('Error details:', JSON.stringify(error));
      
      // If we get a 401 error, the token is invalid
      if ('status' in error && error.status === 401) {
        console.log('Token appears to be invalid (401 error), clearing session');
        sessionStorage.removeItem('gmail_access_token');
      }
    }
    throw error;
  }
};

/**
 * Parse email headers to extract sender or primary recipient
 */
export const extractPersonFromHeaders = (headers: EmailHeader[], userEmail: string): Person | null => {
  console.log('Extracting person from headers for message, user email:', userEmail);
  
  const fromHeader = headers.find(header => header.name.toLowerCase() === 'from');
  const toHeader = headers.find(header => header.name.toLowerCase() === 'to');
  const subjectHeader = headers.find(header => header.name.toLowerCase() === 'subject');
  const dateHeader = headers.find(header => header.name.toLowerCase() === 'date');
  
  let person: Person | null = null;
  
  // Function to parse email address from header value
  const parseEmail = (headerValue: string): { email: string; name?: string } => {
    console.log('Parsing email from header value:', headerValue);
    
    // Handle multiple formats:
    // - "Name <email@example.com>"
    // - "email@example.com (Name)"
    // - "email@example.com"
    
    // Format: "Name <email@example.com>"
    const angleFormat = headerValue.match(/([^<]+)<([^>]+)>/);
    if (angleFormat) {
      const name = angleFormat[1].trim();
      const email = angleFormat[2].trim();
      console.log('Extracted using angle format:', { name, email });
      return { name, email };
    }
    
    // Format: "email@example.com (Name)"
    const parenthesisFormat = headerValue.match(/([^\s]+)\s*\(([^)]+)\)/);
    if (parenthesisFormat) {
      const email = parenthesisFormat[1].trim();
      const name = parenthesisFormat[2].trim();
      console.log('Extracted using parenthesis format:', { name, email });
      return { name, email };
    }
    
    // Just an email
    // Look for any text that looks like an email address
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const emailMatch = headerValue.match(emailRegex);
    if (emailMatch) {
      const email = emailMatch[1].trim();
      console.log('Extracted using regex format:', { email });
      return { email };
    }
    
    // Fallback: just use the whole string as the email
    console.log('Using fallback format:', { email: headerValue.trim() });
    return { email: headerValue.trim() };
  };
  
  // First try to extract from the From header if present
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
      console.log('Created person from FROM header:', person);
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
        console.log('Created person from TO header:', person);
        break;
      }
    }
  }
  
  return person;
};

/**
 * Check if a message is promotional or newsletter
 */
export const isPromotionalEmail = (message: EmailMessage): boolean => {
  // Check if message has CATEGORY_PROMOTIONS label
  if (message.labelIds && message.labelIds.includes('CATEGORY_PROMOTIONS')) {
    return true;
  }
  
  // Common newsletter/promotional keywords in subject
  const subjectHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'subject');
  if (subjectHeader) {
    const promoKeywords = ['newsletter', 'offer', 'deal', 'discount', 'sale', 'promo', 'unsubscribe', 
                          'subscription', 'marketing', 'update', 'news', 'weekly', 'monthly'];
    
    const subjectLower = subjectHeader.value.toLowerCase();
    if (promoKeywords.some(keyword => subjectLower.includes(keyword))) {
      return true;
    }
  }
  
  // Check for common marketing senders
  const fromHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'from');
  if (fromHeader) {
    const marketingSenders = ['noreply', 'no-reply', 'donotreply', 'newsletter', 'marketing', 'notifications', 'updates'];
    const fromLower = fromHeader.value.toLowerCase();
    
    if (marketingSenders.some(sender => fromLower.includes(sender))) {
      return true;
    }
  }
  
  // Check for list-unsubscribe header (common in newsletters)
  const hasUnsubscribe = message.payload.headers.some(h => 
    h.name.toLowerCase() === 'list-unsubscribe'
  );
  
  if (hasUnsubscribe) {
    return true;
  }
  
  return false;
};

/**
 * Group emails by person (sender or primary recipient)
 */
export const groupMessagesByPerson = (
  messages: EmailMessage[],
  userEmail: string
): Record<string, Conversation> => {
  console.log(`Grouping ${messages.length} messages by person for user: ${userEmail}`);
  const conversations: Record<string, Conversation> = {};
  let ungroupedCount = 0;
  let promotionalCount = 0;
  
  messages.forEach(message => {
    // Skip promotional emails in conversation grouping
    if (isPromotionalEmail(message)) {
      promotionalCount++;
      return;
    }
    
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
    } else {
      // Handle messages where we couldn't identify a sender/recipient
      ungroupedCount++;
      
      // Try to get subject and use that as identifier
      const subjectHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'subject');
      const subject = subjectHeader?.value || 'Unknown';
      
      // Create a synthetic email for grouping
      const syntheticEmail = `unknown-${subject.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}@unknown.com`;
      
      if (!conversations[syntheticEmail]) {
        conversations[syntheticEmail] = {
          person: {
            email: syntheticEmail,
            name: subject || 'Unknown Sender',
            lastMessageDate: '',
            lastMessageSnippet: '',
            unreadCount: 0,
          },
          messages: [],
        };
      }
      
      conversations[syntheticEmail].messages.push(message);
    }
  });
  
  console.log(`Grouped into ${Object.keys(conversations).length} conversations (${ungroupedCount} messages couldn't be grouped by sender/recipient, ${promotionalCount} promotional emails filtered)`);
  
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
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      html = decodeEmailBody(part.body);
    } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      text = decodeEmailBody(part.body);
    }
    
    // Process nested parts
    if (part.parts) {
      part.parts.forEach(processPart);
    }
  };
  
  processPart(payload);
  
  return { html, text };
};

/**
 * Send an email via Gmail API
 */
export const sendEmail = async (to: string, subject: string, body: string, userEmail: string): Promise<boolean> => {
  try {
    // Create the email content in RFC 2822 format
    const emailContent = [
      `From: ${userEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body
    ].join('\r\n');

    // Encode the email in base64 format suitable for the Gmail API
    const base64EncodedEmail = btoa(
      unescape(encodeURIComponent(emailContent))
    ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Send the email using the Gmail API
    const response = await gapi.client.gmail.users.messages.send({
      userId: 'me',
      resource: {
        raw: base64EncodedEmail
      }
    });

    if (response && response.status === 200) {
      return true;
    } else {
      console.error('Error sending email:', response);
      return false;
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}; 