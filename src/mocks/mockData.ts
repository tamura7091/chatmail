import { EmailMessage, Person, Conversation, UserProfile } from '../types';

// Mock user profile
export const mockUserProfile: UserProfile = {
  email: 'you@example.com',
  name: 'Your Name',
  picture: 'https://ui-avatars.com/api/?name=Your+Name&background=0D8ABC&color=fff',
};

// Generate a mock email message
const createMockMessage = (
  id: string,
  threadId: string,
  from: string,
  fromName: string,
  to: string,
  toName: string,
  subject: string,
  body: string,
  date: string,
  isFromUser: boolean
): EmailMessage => {
  return {
    id,
    threadId,
    labelIds: ['INBOX'],
    snippet: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
    payload: {
      mimeType: 'text/html',
      headers: [
        { name: 'From', value: `${fromName} <${from}>` },
        { name: 'To', value: `${toName} <${to}>` },
        { name: 'Subject', value: subject },
        { name: 'Date', value: date },
      ],
      body: {
        size: body.length,
        data: btoa(body),
      },
    },
    sizeEstimate: body.length,
    historyId: '12345',
    internalDate: new Date(date).getTime().toString(),
  };
};

// Generate mock conversations with multiple people
const generateMockConversations = (): Record<string, Conversation> => {
  const conversations: Record<string, Conversation> = {};
  const userEmail = mockUserProfile.email;
  const userName = mockUserProfile.name;

  // Conversation 1 - Work colleague
  const colleague: Person = {
    email: 'colleague@company.com',
    name: 'Work Colleague',
    lastMessageDate: new Date('2023-04-03T09:30:00Z').toString(),
    lastMessageSnippet: 'Let me know if you need anything else for the project!',
    unreadCount: 2,
  };

  const colleagueConversation: EmailMessage[] = [
    createMockMessage(
      '1001',
      'thread1',
      colleague.email,
      colleague.name || '',
      userEmail,
      userName,
      'Project Update',
      'Hi there! Just wanted to check in about the status of the project. We\'re making good progress but I\'d like to get your thoughts on the timeline.',
      'Mon, 03 Apr 2023 09:15:00 +0000',
      false
    ),
    createMockMessage(
      '1002',
      'thread1',
      userEmail,
      userName,
      colleague.email,
      colleague.name || '',
      'Re: Project Update',
      'Thanks for checking in! I think we\'re on track to meet the deadline. I\'ve completed about 75% of my assigned tasks.',
      'Mon, 03 Apr 2023 09:20:00 +0000',
      true
    ),
    createMockMessage(
      '1003',
      'thread1',
      colleague.email,
      colleague.name || '',
      userEmail,
      userName,
      'Re: Project Update',
      'That\'s great to hear! Do you think we should schedule a meeting with the team to go over the remaining tasks? Also, let me know if you need anything else for the project!',
      'Mon, 03 Apr 2023 09:30:00 +0000',
      false
    ),
  ];

  // Conversation 2 - Friend
  const friend: Person = {
    email: 'friend@personal.com',
    name: 'Best Friend',
    lastMessageDate: new Date('2023-04-02T18:45:00Z').toString(),
    lastMessageSnippet: 'Can\'t wait! See you there at 7.',
    unreadCount: 0,
  };

  const friendConversation: EmailMessage[] = [
    createMockMessage(
      '2001',
      'thread2',
      userEmail,
      userName,
      friend.email,
      friend.name || '',
      'Dinner plans',
      'Hey! Do you want to grab dinner this weekend? There\'s a new restaurant downtown I\'ve been wanting to try.',
      'Sun, 02 Apr 2023 14:30:00 +0000',
      true
    ),
    createMockMessage(
      '2002',
      'thread2',
      friend.email,
      friend.name || '',
      userEmail,
      userName,
      'Re: Dinner plans',
      'That sounds awesome! What day were you thinking? I\'m free Saturday evening.',
      'Sun, 02 Apr 2023 15:20:00 +0000',
      false
    ),
    createMockMessage(
      '2003',
      'thread2',
      userEmail,
      userName,
      friend.email,
      friend.name || '',
      'Re: Dinner plans',
      'Saturday works for me! How about 7pm? I can make a reservation.',
      'Sun, 02 Apr 2023 16:15:00 +0000',
      true
    ),
    createMockMessage(
      '2004',
      'thread2',
      friend.email,
      friend.name || '',
      userEmail,
      userName,
      'Re: Dinner plans',
      'Can\'t wait! See you there at 7.',
      'Sun, 02 Apr 2023 18:45:00 +0000',
      false
    ),
  ];

  // Conversation 3 - Service Provider
  const service: Person = {
    email: 'support@service.com',
    name: 'Customer Support',
    lastMessageDate: new Date('2023-04-01T11:00:00Z').toString(),
    lastMessageSnippet: 'Your issue has been resolved. Please let us know if you have any other questions.',
    unreadCount: 1,
  };

  const serviceConversation: EmailMessage[] = [
    createMockMessage(
      '3001',
      'thread3',
      userEmail,
      userName,
      service.email,
      service.name || '',
      'Support Request #12345',
      'I\'m having trouble accessing my account. Can you please help me reset my password?',
      'Sat, 01 Apr 2023 09:00:00 +0000',
      true
    ),
    createMockMessage(
      '3002',
      'thread3',
      service.email,
      service.name || '',
      userEmail,
      userName,
      'Re: Support Request #12345',
      'Thank you for contacting us. We\'ve sent a password reset link to your email. Please check your inbox and follow the instructions.',
      'Sat, 01 Apr 2023 09:30:00 +0000',
      false
    ),
    createMockMessage(
      '3003',
      'thread3',
      userEmail,
      userName,
      service.email,
      service.name || '',
      'Re: Support Request #12345',
      'I received the link but it says it has expired. Could you please send a new one?',
      'Sat, 01 Apr 2023 10:15:00 +0000',
      true
    ),
    createMockMessage(
      '3004',
      'thread3',
      service.email,
      service.name || '',
      userEmail,
      userName,
      'Re: Support Request #12345',
      'We\'ve sent a new password reset link to your email. This link will be valid for 24 hours. Your issue has been resolved. Please let us know if you have any other questions.',
      'Sat, 01 Apr 2023 11:00:00 +0000',
      false
    ),
  ];

  // Add conversations to the record
  conversations[colleague.email.toLowerCase()] = {
    person: colleague,
    messages: colleagueConversation,
  };

  conversations[friend.email.toLowerCase()] = {
    person: friend,
    messages: friendConversation,
  };

  conversations[service.email.toLowerCase()] = {
    person: service,
    messages: serviceConversation,
  };

  return conversations;
};

// Export mock data
export const mockConversations = generateMockConversations();
export const mockMessages = Object.values(mockConversations).flatMap(conv => conv.messages); 