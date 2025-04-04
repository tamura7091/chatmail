import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  loadGmailApi,
  isUserSignedIn,
  signIn,
  signOut,
  getUserProfile,
  fetchMessages,
  groupMessagesByPerson,
  sendEmail
} from '../utils/gmailAPI';
import { EmailMessage, Person, Conversation, UserProfile, SpecialFolder, Group, Contact, TagContact } from '../types';
import { mockUserProfile, mockConversations, mockMessages } from '../mocks/mockData';
import { v4 as uuidv4 } from 'uuid';

interface GmailContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  userProfile: UserProfile | null;
  conversations: Record<string, Conversation>;
  messages: EmailMessage[];
  currentPerson: string | null;
  loadingMessages: boolean;
  error: string | null;
  specialFolders: Record<string, SpecialFolder>;
  groups: Record<string, Group>;
  contacts: Record<string, Contact>;
  contactTags: Record<string, TagContact>;
  selectedView: 'conversation' | 'special_folder' | 'group';
  selectedId: string | null;
  handleSignIn: () => Promise<void>;
  handleSignOut: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  selectPerson: (email: string) => void;
  selectSpecialFolder: (id: string) => void;
  selectGroup: (id: string) => void;
  updatePersonStatus: (email: string, status: string) => void;
  createGroup: (name: string, members: string[], description?: string) => void;
  addToGroup: (groupId: string, memberEmail: string) => void;
  removeFromGroup: (groupId: string, memberEmail: string) => void;
  sendMessage: (to: string, body: string) => Promise<boolean>;
  createNewConversation: () => void;
  createContact: (contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateContact: (id: string, contactData: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>) => boolean;
  deleteContact: (id: string) => boolean;
  getContactByEmail: (email: string) => Contact | null;
  createContactTag: (name: string, color?: string) => string;
  updateContactTag: (id: string, name: string, color?: string) => boolean;
  deleteContactTag: (id: string) => boolean;
  addContactToTag: (contactId: string, tagId: string) => boolean;
  removeContactFromTag: (contactId: string, tagId: string) => boolean;
}

const GmailContext = createContext<GmailContextType | undefined>(undefined);

interface GmailProviderProps {
  children: ReactNode;
}

export const GmailProvider: React.FC<GmailProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [currentPerson, setCurrentPerson] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialFolders, setSpecialFolders] = useState<Record<string, SpecialFolder>>({
    others: {
      id: 'others',
      name: 'Others',
      type: 'others',
      lastMessageDate: new Date().toString(),
      lastMessageSnippet: 'Promotional emails, newsletters, and other non-personal messages',
      unreadCount: 0
    },
    reply_needed: {
      id: 'reply_needed',
      name: 'Reply Needed',
      type: 'reply_needed',
      lastMessageDate: new Date().toString(),
      lastMessageSnippet: 'Emails that need your response',
      unreadCount: 0
    }
  });
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [contactTags, setContactTags] = useState<Record<string, TagContact>>({});
  const [selectedView, setSelectedView] = useState<'conversation' | 'special_folder' | 'group'>('conversation');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreatingNewConversation, setIsCreatingNewConversation] = useState(false);

  // Check if we should use mock data
  const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  // Generate AI-powered action suggestions for conversations
  const generateActionSuggestions = (conversations: Record<string, Conversation>) => {
    // In a real implementation, this would use an AI service
    // For now, we'll use some simple rules to generate suggestions
    const updatedConversations = { ...conversations };
    
    Object.keys(updatedConversations).forEach(key => {
      const conv = updatedConversations[key];
      const lastMessage = conv.messages[conv.messages.length - 1];
      
      // Skip if it's a message sent by the user
      const fromHeader = lastMessage.payload.headers.find(
        header => header.name.toLowerCase() === 'from'
      );
      const fromEmail = fromHeader?.value;
      
      if (userProfile && fromEmail && fromEmail.includes(userProfile.email)) {
        // If the user sent the last message, suggest "Waiting for reply"
        conv.person.action = "Waiting for reply";
        return;
      }
      
      // Check if the message has a question mark
      if (lastMessage.snippet.includes('?')) {
        conv.person.action = "Reply to question";
        return;
      }
      
      // Check for urgent keywords
      const urgentKeywords = ['urgent', 'asap', 'immediately', 'deadline', 'important'];
      const hasUrgentKeyword = urgentKeywords.some(keyword => 
        lastMessage.snippet.toLowerCase().includes(keyword)
      );
      
      if (hasUrgentKeyword) {
        conv.person.action = "Urgent reply needed";
        return;
      }
      
      // Check for task requests
      const taskKeywords = ['can you', 'could you', 'please', 'would you', 'review', 'send', 'update'];
      const hasTaskKeyword = taskKeywords.some(keyword => 
        lastMessage.snippet.toLowerCase().includes(keyword)
      );
      
      if (hasTaskKeyword) {
        conv.person.action = "Task requested";
        return;
      }
      
      // Default for other cases
      conv.person.action = "Review message";
    });
    
    return updatedConversations;
  };

  // Initialize the API or load mock data
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (useMockData) {
          // Use mock data
          console.log('Using mock data for initialization');
          setTimeout(() => {
            setIsAuthenticated(true);
            setUserProfile(mockUserProfile);
            setMessages(mockMessages);
            
            // Add action suggestions to mock conversations
            const conversationsWithActions = generateActionSuggestions(mockConversations);
            setConversations(conversationsWithActions);
            
            // Add demo group
            const demoGroup: Group = {
              id: 'demo-group',
              name: 'Marketing Team',
              members: [
                { email: 'colleague@company.com', name: 'Work Colleague' },
                { email: mockUserProfile.email, name: mockUserProfile.name }
              ],
              conversations: {},
              lastMessageDate: new Date().toString(),
              lastMessageSnippet: 'Demo group for collaboration',
              unreadCount: 0
            };
            
            setGroups({ 'demo-group': demoGroup });
            setIsLoading(false);
          }, 1000); // Simulate loading delay
        } else {
          // Use real API
          console.log('Initializing with real Gmail API');
          
          try {
            // First, just initialize the GAPI client
            await loadGmailApi();
            console.log('Gmail API loaded successfully');
            
            // Check if user is already signed in
            const signedIn = isUserSignedIn();
            console.log('Initial auth check - User is signed in:', signedIn);
            
            if (signedIn) {
              console.log('User is already signed in, fetching profile');
              setIsAuthenticated(true);
              
              try {
                // Get user profile
                const profile = await getUserProfile();
                console.log('User profile fetched:', profile);
                setUserProfile(profile);
                
                // Load initial messages
                console.log('Loading initial messages...');
                await loadInitialMessages();
              } catch (profileError) {
                console.error('Error fetching user data:', profileError);
                // If we can't fetch profile or messages, the token may be invalid or expired
                console.log('Token may be invalid, clearing and requiring sign-in');
                sessionStorage.removeItem('gmail_access_token');
                setIsAuthenticated(false);
                setError('Session expired. Please sign in again.');
              }
            } else {
              console.log('User not signed in. Waiting for sign-in.');
              // User will need to sign in manually
              setIsAuthenticated(false);
            }
          } catch (apiError) {
            console.error('Error initializing Gmail API:', apiError);
            setError('Failed to initialize Gmail API. Please try again.');
            setIsAuthenticated(false);
          }
          
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error during initialization:', err);
        setError('An unexpected error occurred. Please reload the app.');
        setIsLoading(false);
      }
    };

    initialize();
  }, [useMockData]);

  const loadInitialMessages = async () => {
    try {
      console.log('Starting to load initial messages...');
      setLoadingMessages(true);
      setError(null);
      
      if (!useMockData) {
        console.log('Using real Gmail API to fetch messages');
        try {
          const { messages: newMessages, nextPageToken: token } = await fetchMessages();
          
          console.log(`Fetched ${newMessages.length} messages, nextPageToken: ${token ? 'present' : 'not present'}`);
          
          if (newMessages && newMessages.length > 0) {
            setMessages(newMessages);
            setNextPageToken(token);
            
            // Get the current user profile 
            const currentUser = userProfile;
            
            // If userProfile state isn't set yet, try to get it directly
            if (!currentUser || !currentUser.email) {
              try {
                console.log('User profile not available in state, fetching directly');
                const profile = await getUserProfile();
                console.log('Got user profile directly:', profile);
                setUserProfile(profile);
                
                // Use the fetched profile to group messages
                console.log(`Grouping messages by person using email: ${profile.email}`);
                const groupedConversations = groupMessagesByPerson(newMessages, profile.email);
                console.log(`Created ${Object.keys(groupedConversations).length} conversations`);
                
                // Add action suggestions
                const conversationsWithActions = generateActionSuggestions(groupedConversations);
                setConversations(conversationsWithActions);
                
                // Auto-select the first conversation
                const firstConversationKey = Object.keys(conversationsWithActions)[0];
                if (firstConversationKey) {
                  console.log('Auto-selecting first conversation:', firstConversationKey);
                  setCurrentPerson(firstConversationKey);
                }
              } catch (profileError) {
                console.error('Failed to fetch user profile directly:', profileError);
                setError('Could not determine user email for message grouping');
              }
            } else {
              // Use the existing userProfile
              console.log(`Grouping messages by person using email: ${currentUser.email}`);
              const groupedConversations = groupMessagesByPerson(newMessages, currentUser.email);
              console.log(`Created ${Object.keys(groupedConversations).length} conversations`);
              
              // Add action suggestions
              const conversationsWithActions = generateActionSuggestions(groupedConversations);
              setConversations(conversationsWithActions);
              
              // Auto-select the first conversation
              const firstConversationKey = Object.keys(conversationsWithActions)[0];
              if (firstConversationKey) {
                console.log('Auto-selecting first conversation:', firstConversationKey);
                setCurrentPerson(firstConversationKey);
              }
            }
          } else {
            console.log('No messages found or empty response');
            // Set empty state
            setMessages([]);
            setConversations({});
          }
        } catch (fetchError) {
          console.error('Error in fetchMessages:', fetchError);
          setError('Failed to fetch messages from Gmail');
          
          // Try using a different query if fetching inbox fails
          try {
            console.log('Attempting to fetch with different parameters...');
            const listResponse = await gapi.client.gmail.users.messages.list({
              userId: 'me',
              maxResults: 10,
              q: '',  // Empty query to get any messages
            });
            
            console.log('Alternative fetch response:', listResponse);
            if (listResponse.result.messages && listResponse.result.messages.length > 0) {
              console.log(`Found ${listResponse.result.messages.length} messages with alternative query`);
            } else {
              console.log('No messages found with alternative query');
            }
          } catch (altFetchError) {
            console.error('Alternative fetch also failed:', altFetchError);
          }
        }
      } else {
        // Use mock data
        console.log('Using mock data instead of real API');
        setTimeout(() => {
          setMessages(mockMessages);
          // Add action suggestions to mock conversations
          const conversationsWithActions = generateActionSuggestions(mockConversations);
          setConversations(conversationsWithActions);
          
          // Auto-select the first conversation for mock data too
          const firstConversationKey = Object.keys(conversationsWithActions)[0];
          if (firstConversationKey) {
            console.log('Auto-selecting first mock conversation:', firstConversationKey);
            setCurrentPerson(firstConversationKey);
          }
        }, 500); // Simulate loading delay
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoadingMessages(false);
      console.log('Finished loading messages process');
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Starting sign-in process...');
      
      if (useMockData) {
        // Use mock data for sign in
        console.log('Using mock data for sign-in');
        setTimeout(() => {
          setIsAuthenticated(true);
          setUserProfile(mockUserProfile);
          setMessages(mockMessages);
          
          // Add action suggestions to mock conversations
          const conversationsWithActions = generateActionSuggestions(mockConversations);
          setConversations(conversationsWithActions);
          
          // Add demo group
          const demoGroup: Group = {
            id: 'demo-group',
            name: 'Marketing Team',
            members: [
              { email: 'colleague@company.com', name: 'Work Colleague' },
              { email: mockUserProfile.email, name: mockUserProfile.name }
            ],
            conversations: {},
            lastMessageDate: new Date().toString(),
            lastMessageSnippet: 'Demo group for collaboration',
            unreadCount: 0
          };
          
          setGroups({ 'demo-group': demoGroup });
          setIsLoading(false);
        }, 1000); // Simulate loading delay
      } else {
        // Real Gmail API authentication
        console.log('Signing in with real Gmail API');
        
        try {
          // First sign in to get authenticated
          await signIn();
          console.log('Sign-in successful, checking authentication status');
          
          // Verify we have a valid token
          if (isUserSignedIn()) {
            console.log('Authentication confirmed, fetching user profile');
            setIsAuthenticated(true);
            
            try {
              // Get the user profile
              const profile = await getUserProfile();
              console.log('User profile fetched:', profile);
              
              // Make sure the profile is set in state BEFORE trying to load messages
              setUserProfile(profile);
              
              // Wait for profile to be set before continuing
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Load messages
              console.log('Loading messages after successful sign-in');
              await loadInitialMessages();
              
              // Initialize empty groups for real API usage
              setGroups({});
              console.log('Sign-in and data loading complete');
            } catch (dataError) {
              console.error('Error loading user data after sign-in:', dataError);
              setError('Failed to load your email data');
              // Still keep authenticated status so the user can retry
            }
          } else {
            console.error('Authentication failed - no valid token after sign-in');
            throw new Error('Failed to authenticate with Gmail');
          }
        } catch (authError) {
          console.error('Authentication error:', authError);
          setIsAuthenticated(false);
          setError('Failed to sign in to Gmail. Please try again.');
        }
        
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Failed to sign in to Gmail');
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      
      if (!useMockData) {
        // Real sign out with Gmail API
        await signOut();
      }
      
      // Reset all state regardless of mock/real mode
      setIsAuthenticated(false);
      setUserProfile(null);
      setMessages([]);
      setConversations({});
      setNextPageToken(undefined);
      setCurrentPerson(null);
      setSpecialFolders({
        others: {
          id: 'others',
          name: 'Others',
          type: 'others',
          lastMessageDate: new Date().toString(),
          lastMessageSnippet: 'Promotional emails, newsletters, and other non-personal messages',
          unreadCount: 0
        },
        reply_needed: {
          id: 'reply_needed',
          name: 'Reply Needed',
          type: 'reply_needed',
          lastMessageDate: new Date().toString(),
          lastMessageSnippet: 'Emails that need your response',
          unreadCount: 0
        }
      });
      setGroups({});
      setError(null);
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Failed to sign out from Gmail');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    try {
      if (loadingMessages || !nextPageToken) return;
      
      setLoadingMessages(true);
      setError(null);
      
      if (useMockData) {
        // Simulate loading more messages with mock data
        setTimeout(() => {
          // In a real implementation, we would fetch more messages
          // For mock data, we'll just show the same messages again
          setMessages(prevMessages => [...prevMessages, ...mockMessages]);
          
          // Pretend we've reached the end of the list
          setNextPageToken(undefined);
          
          // Update conversations
          const allMessages = [...messages, ...mockMessages];
          if (userProfile) {
            const groupedConversations = groupMessagesByPerson(allMessages, userProfile.email);
            const conversationsWithActions = generateActionSuggestions(groupedConversations);
            setConversations(conversationsWithActions);
          }
          
          setLoadingMessages(false);
        }, 1000);
      } else {
        // Real Gmail API pagination
        const { messages: newMessages, nextPageToken: token } = await fetchMessages(nextPageToken);
        
        if (newMessages && newMessages.length > 0) {
          setMessages(prevMessages => [...prevMessages, ...newMessages]);
          setNextPageToken(token);
          
          // Update conversations with all messages
          const allMessages = [...messages, ...newMessages];
          if (userProfile && userProfile.email) {
            const groupedConversations = groupMessagesByPerson(allMessages, userProfile.email);
            const conversationsWithActions = generateActionSuggestions(groupedConversations);
            setConversations(conversationsWithActions);
          }
        } else {
          // No more messages
          setNextPageToken(undefined);
        }
        
        setLoadingMessages(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
      setError('Failed to load more messages');
      setLoadingMessages(false);
    }
  };

  const selectPerson = (email: string) => {
    setSelectedView('conversation');
    setSelectedId(email);
    setCurrentPerson(email);
    setIsCreatingNewConversation(false);
  };

  const selectSpecialFolder = (id: string) => {
    setSelectedView('special_folder');
    setSelectedId(id);
    setCurrentPerson(null);
    setIsCreatingNewConversation(false);
  };

  const selectGroup = (id: string) => {
    setSelectedView('group');
    setSelectedId(id);
    setCurrentPerson(null);
    setIsCreatingNewConversation(false);
  };

  const updatePersonStatus = (email: string, status: string) => {
    setConversations(prev => {
      if (prev[email]) {
        const updated = {
          ...prev,
          [email]: {
            ...prev[email],
            person: {
              ...prev[email].person,
              status
            }
          }
        };
        return updated;
      }
      return prev;
    });
  };

  // Contact Management Methods
  const createContact = (contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const newContact: Contact = {
      ...contactData,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    setContacts(prev => ({
      ...prev,
      [id]: newContact
    }));
    
    // Update existing conversations if they match this contact's emails
    setConversations(prev => {
      const updatedConversations = { ...prev };
      
      // Check each conversation's person email
      Object.keys(updatedConversations).forEach(key => {
        const person = updatedConversations[key].person;
        const isPrimaryEmail = person.email.toLowerCase() === contactData.primaryEmail.toLowerCase();
        const isAlternateEmail = contactData.alternateEmails.some(
          email => email.toLowerCase() === person.email.toLowerCase()
        );
        
        if (isPrimaryEmail || isAlternateEmail) {
          // Update the person with contact information
          updatedConversations[key].person = {
            ...person,
            contactId: id,
            name: contactData.name,
            alternateEmails: contactData.alternateEmails,
            tags: contactData.tags
          };
        }
      });
      
      return updatedConversations;
    });
    
    return id;
  };
  
  const updateContact = (id: string, contactData: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>) => {
    if (!contacts[id]) return false;
    
    const updatedContact: Contact = {
      ...contacts[id],
      ...contactData,
      updatedAt: new Date().toISOString()
    };
    
    setContacts(prev => ({
      ...prev,
      [id]: updatedContact
    }));
    
    // Update existing conversations if they match this contact's emails
    setConversations(prev => {
      const updatedConversations = { ...prev };
      const contact = updatedContact;
      
      Object.keys(updatedConversations).forEach(key => {
        const person = updatedConversations[key].person;
        
        if (person.contactId === id) {
          // Update contact information
          updatedConversations[key].person = {
            ...person,
            name: contact.name,
            alternateEmails: contact.alternateEmails,
            tags: contact.tags
          };
        }
      });
      
      return updatedConversations;
    });
    
    return true;
  };
  
  const deleteContact = (id: string) => {
    if (!contacts[id]) return false;
    
    // Remove contact
    setContacts(prev => {
      const newContacts = { ...prev };
      delete newContacts[id];
      return newContacts;
    });
    
    // Update conversations to remove contact association
    setConversations(prev => {
      const updatedConversations = { ...prev };
      
      Object.keys(updatedConversations).forEach(key => {
        const person = updatedConversations[key].person;
        
        if (person.contactId === id) {
          // Remove contact association
          const { contactId, alternateEmails, tags, ...restPerson } = person;
          updatedConversations[key].person = restPerson;
        }
      });
      
      return updatedConversations;
    });
    
    // Remove from contact tags
    setContactTags(prev => {
      const updatedTags = { ...prev };
      
      Object.keys(updatedTags).forEach(tagId => {
        const tag = updatedTags[tagId];
        if (tag.contactIds.includes(id)) {
          updatedTags[tagId] = {
            ...tag,
            contactIds: tag.contactIds.filter(cId => cId !== id)
          };
        }
      });
      
      return updatedTags;
    });
    
    return true;
  };
  
  // Contact tag management
  const createContactTag = (name: string, color?: string): string => {
    const id = uuidv4();
    const newTag: TagContact = {
      id,
      name,
      color: color || generateRandomColor(),
      contactIds: []
    };
    
    setContactTags(prev => ({
      ...prev,
      [id]: newTag
    }));
    
    return id;
  };
  
  const updateContactTag = (id: string, name: string, color?: string): boolean => {
    if (!contactTags[id]) return false;
    
    setContactTags(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        name,
        ...(color && { color })
      }
    }));
    
    return true;
  };
  
  const deleteContactTag = (id: string): boolean => {
    if (!contactTags[id]) return false;
    
    const updatedTags = { ...contactTags };
    delete updatedTags[id];
    setContactTags(updatedTags);
    
    // Remove this tag from all contacts
    const updatedContacts = { ...contacts };
    Object.keys(updatedContacts).forEach(contactId => {
      if (updatedContacts[contactId].tags.includes(id)) {
        updatedContacts[contactId] = {
          ...updatedContacts[contactId],
          tags: updatedContacts[contactId].tags.filter(tagId => tagId !== id)
        };
      }
    });
    setContacts(updatedContacts);
    
    return true;
  };
  
  const addContactToTag = (contactId: string, tagId: string): boolean => {
    if (!contacts[contactId] || !contactTags[tagId]) return false;
    
    // Add tag to contact
    if (!contacts[contactId].tags.includes(tagId)) {
      setContacts(prev => ({
        ...prev,
        [contactId]: {
          ...prev[contactId],
          tags: [...prev[contactId].tags, tagId]
        }
      }));
    }
    
    // Add contact to tag
    if (!contactTags[tagId].contactIds.includes(contactId)) {
      setContactTags(prev => ({
        ...prev,
        [tagId]: {
          ...prev[tagId],
          contactIds: [...prev[tagId].contactIds, contactId]
        }
      }));
    }
    
    return true;
  };
  
  const removeContactFromTag = (contactId: string, tagId: string): boolean => {
    if (!contacts[contactId] || !contactTags[tagId]) return false;
    
    // Remove tag from contact
    if (contacts[contactId].tags.includes(tagId)) {
      setContacts(prev => ({
        ...prev,
        [contactId]: {
          ...prev[contactId],
          tags: prev[contactId].tags.filter(id => id !== tagId)
        }
      }));
    }
    
    // Remove contact from tag
    if (contactTags[tagId].contactIds.includes(contactId)) {
      setContactTags(prev => ({
        ...prev,
        [tagId]: {
          ...prev[tagId],
          contactIds: prev[tagId].contactIds.filter(id => id !== contactId)
        }
      }));
    }
    
    return true;
  };
  
  const getContactByEmail = (email: string) => {
    const normalizedEmail = email.toLowerCase();
    
    const contactId = Object.values(contacts).find(contact => 
      contact.primaryEmail.toLowerCase() === normalizedEmail || 
      contact.alternateEmails.some(altEmail => altEmail.toLowerCase() === normalizedEmail)
    )?.id;
    
    return contactId ? contacts[contactId] : null;
  };

  // Create Group method update
  const createGroup = (name: string, members: string[], description?: string) => {
    const id = `group-${Date.now()}`;
    const memberObjects = members.map(email => {
      const contact = getContactByEmail(email);
      return {
        email,
        name: contact?.name,
        contactId: contact?.id
      };
    });
    
    const newGroup: Group = {
      id,
      name,
      description,
      members: memberObjects,
      conversations: {},
      lastMessageDate: new Date().toString(),
      lastMessageSnippet: `New group: ${name}`,
      unreadCount: 0
    };
    
    setGroups(prev => ({
      ...prev,
      [id]: newGroup
    }));
    
    // Update contacts to include this group
    memberObjects.forEach(member => {
      if (member.contactId) {
        addContactToTag(member.contactId, id);
      }
    });
  };

  const sendMessage = async (to: string, body: string): Promise<boolean> => {
    try {
      setLoadingMessages(true);
      
      if (userProfile) {
        // Get current date
        const currentDate = new Date().toISOString();
        const subject = "New message"; // Default subject
        
        if (useMockData) {
          // Mock implementation - add simulated delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Create a mock message for display
          const mockMessage: EmailMessage = {
            id: `msg-${Date.now()}`,
            threadId: `thread-${Date.now()}`,
            labelIds: ['SENT'],
            snippet: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
            payload: {
              mimeType: 'text/html',
              headers: [
                { name: 'From', value: `${userProfile.name} <${userProfile.email}>` },
                { name: 'To', value: to },
                { name: 'Subject', value: subject },
                { name: 'Date', value: currentDate },
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
          
          // Update conversations state
          const recipientEmail = to.toLowerCase();
          const updatedConversations = {...conversations};
          
          if (updatedConversations[recipientEmail]) {
            // Add to existing conversation
            updatedConversations[recipientEmail].messages.push(mockMessage);
            updatedConversations[recipientEmail].person.lastMessageDate = currentDate;
            updatedConversations[recipientEmail].person.lastMessageSnippet = mockMessage.snippet;
          } else {
            // Create new conversation
            updatedConversations[recipientEmail] = {
              person: {
                email: recipientEmail,
                name: recipientEmail.split('@')[0], // Use email username as name
                lastMessageDate: currentDate,
                lastMessageSnippet: mockMessage.snippet,
                unreadCount: 0,
                action: "Waiting for reply"
              },
              messages: [mockMessage]
            };
          }
          
          setConversations(updatedConversations);
          return true;
        } else {
          // Real implementation using Gmail API
          const success = await sendEmail(to, subject, body, userProfile.email);
          
          if (success) {
            // After sending email, refresh conversations to include the sent message
            await loadInitialMessages();
            
            // If this is to a new recipient, select them
            if (!conversations[to.toLowerCase()]) {
              setCurrentPerson(to.toLowerCase());
            }
            
            return true;
          }
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      return false;
    } finally {
      setLoadingMessages(false);
    }
  };

  const createNewConversation = () => {
    setSelectedView('conversation');
    setSelectedId(null);
    setCurrentPerson(null);
    setIsCreatingNewConversation(true);
  };

  // Add to group method
  const addToGroup = (groupId: string, memberEmail: string) => {
    setGroups(prev => {
      if (prev[groupId]) {
        const existingMember = prev[groupId].members.find(
          m => m.email.toLowerCase() === memberEmail.toLowerCase()
        );
        
        if (existingMember) return prev;
        
        const person = Object.values(conversations).find(c => 
          c.person.email.toLowerCase() === memberEmail.toLowerCase()
        )?.person;
        
        // Check if this email is associated with a contact
        const contact = getContactByEmail(memberEmail);
        const contactId = contact?.id;
        
        const updated = {
          ...prev,
          [groupId]: {
            ...prev[groupId],
            members: [
              ...prev[groupId].members,
              {
                email: memberEmail,
                name: person?.name || contact?.name || memberEmail,
                contactId
              }
            ]
          }
        };
        
        // If there's a contact, also update the contact's tags
        if (contactId) {
          addContactToTag(contactId, groupId);
        }
        
        return updated;
      }
      return prev;
    });
  };

  // Remove from group method
  const removeFromGroup = (groupId: string, memberEmail: string) => {
    setGroups(prev => {
      if (prev[groupId]) {
        // Find the member to be removed
        const memberToRemove = prev[groupId].members.find(
          m => m.email.toLowerCase() === memberEmail.toLowerCase()
        );
        
        // If the member has a contactId, update the contact's tags
        if (memberToRemove?.contactId) {
          removeContactFromTag(memberToRemove.contactId, groupId);
        }
        
        const updated = {
          ...prev,
          [groupId]: {
            ...prev[groupId],
            members: prev[groupId].members.filter(
              m => m.email.toLowerCase() !== memberEmail.toLowerCase()
            )
          }
        };
        return updated;
      }
      return prev;
    });
  };

  // Generate a random color for tags
  const generateRandomColor = (): string => {
    const colors = [
      '#EF4444', // red
      '#F59E0B', // amber
      '#10B981', // emerald
      '#3B82F6', // blue
      '#8B5CF6', // violet
      '#EC4899', // pink
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const value = {
    isLoading,
    isAuthenticated,
    userProfile,
    conversations,
    messages,
    currentPerson,
    loadingMessages,
    error,
    specialFolders,
    groups,
    contacts,
    contactTags,
    selectedView,
    selectedId,
    handleSignIn,
    handleSignOut,
    loadMoreMessages,
    selectPerson,
    selectSpecialFolder,
    selectGroup,
    updatePersonStatus,
    createGroup,
    addToGroup,
    removeFromGroup,
    sendMessage,
    createNewConversation,
    createContact,
    updateContact,
    deleteContact,
    getContactByEmail,
    createContactTag,
    updateContactTag,
    deleteContactTag,
    addContactToTag,
    removeContactFromTag,
  };

  return <GmailContext.Provider value={value}>{children}</GmailContext.Provider>;
};

export const useGmail = (): GmailContextType => {
  const context = useContext(GmailContext);
  if (context === undefined) {
    throw new Error('useGmail must be used within a GmailProvider');
  }
  return context;
}; 