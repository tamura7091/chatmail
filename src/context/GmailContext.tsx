import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  loadGmailApi,
  isUserSignedIn,
  signIn,
  signOut,
  getUserProfile,
  fetchMessages,
  groupMessagesByPerson,
  sendEmail,
  isPromotionalEmail,
  extractPersonFromHeaders
} from '../utils/gmailAPI';
import { 
  isRealHumanEmail, 
  detectActionNeeded 
} from '../utils/openaiHelper';
import { EmailMessage, Person, Conversation, UserProfile, SpecialFolder, Group, Contact, TagContact } from '../types';
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
  refreshMessages: () => Promise<boolean>;
  isAutoRefreshEnabled: boolean;
  toggleAutoRefresh: () => void;
  lastRefresh: Date;
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
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
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

  // Generate AI-powered action suggestions for conversations
  const generateActionSuggestions = (
    conversations: Record<string, Conversation>,
    allMessages: EmailMessage[] = []
  ): Record<string, Conversation> => {
    console.log('Generating action suggestions for conversations...');
    
    // Create a copy of the conversations to avoid mutating the original
    const enhancedConversations = { ...conversations };
    
    // Map to track the messages we've processed
    const processedMessageIds = new Set();
    
    // Process each conversation
    Object.values(enhancedConversations).forEach(conversation => {
      // Keep track of messages in this conversation
      conversation.messages.forEach(message => {
        processedMessageIds.add(message.id);
      });
      
      // Check if any message in this conversation has an AI-detected action
      const messagesWithActions = conversation.messages.filter(message => message.actionNeeded);
      
      if (messagesWithActions.length > 0) {
        // Use the AI-detected action for the most recent message with an action
        const mostRecentActionMessage = messagesWithActions.sort(
          (a, b) => parseInt(b.internalDate) - parseInt(a.internalDate)
        )[0];
        
        conversation.person.action = mostRecentActionMessage.actionNeeded;
      } else {
        // Fallback to the original action suggestion logic for messages without AI-detected actions
        const allUnreadCount = conversation.messages.filter(
          msg => msg.labelIds && msg.labelIds.includes('UNREAD')
        ).length;
    
        // Add random action suggestions for demo purposes
        if (conversation.person.email.includes('urgent') || 
            conversation.person.email.includes('important')) {
          conversation.person.action = 'Urgent: Respond ASAP';
        } else if (allUnreadCount > 2) {
          conversation.person.action = 'Reply: Multiple unread messages';
        } else if (conversation.messages.some(msg => msg.snippet.includes('?'))) {
          conversation.person.action = 'Reply: Question asked';
        } else if (conversation.messages.some(
          msg => msg.snippet.toLowerCase().includes('document') || 
                msg.snippet.toLowerCase().includes('review')
        )) {
          conversation.person.action = 'Review: Document sent';
        } else if (
          conversation.messages.length > 0 && 
          Date.now() - parseInt(conversation.messages[conversation.messages.length - 1].internalDate) > 
          7 * 24 * 60 * 60 * 1000
        ) {
          conversation.person.action = 'Waiting: No response in a week';
        }
      }
    });
    
    // Check for messages with actions that aren't yet in a conversation
    // This can happen if we haven't processed all messages through groupMessagesByPerson
    if (allMessages && allMessages.length > 0) {
      allMessages.forEach(message => {
        if (!processedMessageIds.has(message.id) && message.actionNeeded) {
          const person = extractPersonFromMessage(message);
          if (person && !enhancedConversations[person.email.toLowerCase()]) {
            enhancedConversations[person.email.toLowerCase()] = {
              person: {
                ...person,
                action: message.actionNeeded
              },
              messages: [message]
            };
          }
        }
      });
    }
    
    return enhancedConversations;
  };

  // Helper function to extract a person from a message
  const extractPersonFromMessage = (message: EmailMessage): Person | null => {
    const fromHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'from');
    const subjectHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'subject');
    const dateHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'date');
    
    if (!fromHeader) return null;
    
    const emailMatch = fromHeader.value.match(/<(.+?)>/) || [null, fromHeader.value.trim()];
    const email = emailMatch[1] || fromHeader.value.trim();
    const nameMatch = fromHeader.value.match(/^([^<]+)/) || [null, email.split('@')[0]];
    const name = nameMatch[1]?.trim() || email.split('@')[0];
    
    return {
      email,
      name,
      lastMessageDate: dateHeader?.value || '',
      lastMessageSnippet: message.snippet || '',
      unreadCount: message.labelIds?.includes('UNREAD') ? 1 : 0
    };
  };

  // Initialize the API
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

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
      } catch (err) {
        console.error('Unexpected error during initialization:', err);
        setError('An unexpected error occurred. Please reload the app.');
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const loadInitialMessages = async (): Promise<boolean> => {
    try {
      if (!isAuthenticated) {
        console.log('Not authenticated, skipping message loading');
        return false;
      }
      
      console.log('Loading initial messages...');
      setLoadingMessages(true);
      
      // Import storage helpers dynamically
      const { 
        storeMessages, 
        getAllMessages, 
        storeDerivedData,
        getDerivedData,
        storeUserProfile
      } = await import('../utils/storageHelper');
      
      let messages: EmailMessage[] = [];
      let token: string | undefined;
      
      // Always use real API in this context
      console.log('Fetching messages from Gmail API...');
      // Fetch messages from Gmail API
      const { messages: fetchedMessages, nextPageToken } = await fetchMessages();
      messages = fetchedMessages;
      token = nextPageToken;
      setNextPageToken(token);
      
      // Store messages in local cache
      await storeMessages(messages);
      
      // Set messages
      setMessages(messages);
      
      // If userProfile is not available yet, try to get it
      if (!userProfile) {
        try {
          console.log('Fetching user profile...');
          const profile = await getUserProfile();
          setUserProfile(profile);
          
          // Store user profile in local cache
          await storeUserProfile(profile);
        } catch (error) {
          console.error('Failed to get user profile:', error);
          setError('Failed to get user profile');
          setLoadingMessages(false);
          return false;
        }
      }
      
      // If no messages or no user profile, show error
      if (messages.length === 0 || !userProfile) {
        console.log('No messages found or user profile missing');
        setLoadingMessages(false);
        return false;
      }
      
      // Store the most recent automated messages for the "Others" folder
      const recentAutomatedMessages: EmailMessage[] = [];
      
      // Check if messages already have isRealHuman and actionNeeded properties
      // If not, process in batches to avoid too many simultaneous API calls
      console.log(`Processing ${messages.length} messages...`);
      
      const BATCH_SIZE = 5;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        await Promise.all(batch.map(async (message) => {
          // Check if we already have processed data for this message
          const derivedData = await getDerivedData(message.id);
          
          if (derivedData) {
            // Use stored data
            message.isRealHuman = derivedData.isRealHuman;
            message.actionNeeded = derivedData.actionNeeded;
          } else {
            // Process with OpenAI
            try {
              // Check if the message is from a real human
              const isRealHuman = await isRealHumanEmail(message);
              message.isRealHuman = isRealHuman;
              
              // Store the result
              await storeDerivedData(message.id, { isRealHuman });
              
              // If it's not a real human, add to recent automated messages
              if (!isRealHuman) {
                recentAutomatedMessages.push(message);
              } else {
                // Only detect actions for real human messages to save API calls
                try {
                  const actionNeeded = await detectActionNeeded(message);
                  if (actionNeeded) {
                    message.actionNeeded = actionNeeded;
                    
                    // Update derived data with action
                    await storeDerivedData(message.id, { 
                      isRealHuman, 
                      actionNeeded 
                    });
                    
                    console.log(`Action needed for message from ${message.id}: ${actionNeeded}`);
                  }
                } catch (actionError) {
                  console.error('Error detecting action needed:', actionError);
                }
              }
            } catch (aiError) {
              console.error('Error processing message with AI:', aiError);
              // Handle fallback - assume it's a real human if AI fails
              message.isRealHuman = true;
            }
          }
        }));
      }
      
      // Update the Others folder with count of promotional/automated emails
      console.log(`Found ${recentAutomatedMessages.length} automated messages`);
      
      const othersFolder = {
        ...specialFolders.others,
        unreadCount: recentAutomatedMessages.length
      };
      
      // Get last promotional email for the folder summary
      if (recentAutomatedMessages.length > 0) {
        const sortedAutomatedMessages = recentAutomatedMessages.sort(
          (a, b) => parseInt(b.internalDate) - parseInt(a.internalDate)
        );
        const latestAutomated = sortedAutomatedMessages[0];
        
        const dateHeader = latestAutomated.payload.headers.find(h => h.name.toLowerCase() === 'date');
        if (dateHeader) {
          othersFolder.lastMessageDate = dateHeader.value;
        }
        
        othersFolder.lastMessageSnippet = latestAutomated.snippet;
      }
      
      // Update special folders
      setSpecialFolders(prev => ({
        ...prev,
        others: othersFolder
      }));
      
      // Group messages by person
      if (userProfile) {
        const userEmailToUse = userProfile.email;
        
        // Only group the real human messages for conversations
        const realHumanMessages = messages.filter(msg => !!msg.isRealHuman);
        
        console.log(`Grouping ${realHumanMessages.length} real human messages by person`);
        const groupedConversations = groupMessagesByPerson(realHumanMessages, userEmailToUse);
        
        // Add action suggestions
        const conversationsWithActions = generateActionSuggestions(groupedConversations, messages);
        setConversations(conversationsWithActions);
        
        // If no conversation is selected, auto-select the first one
        if (!currentPerson && Object.keys(conversationsWithActions).length > 0) {
          const firstConversationKey = Object.keys(conversationsWithActions)[0];
          setCurrentPerson(firstConversationKey);
        }
      }
      
      setLoadingMessages(false);
      setLastRefresh(new Date());
      return true;
    } catch (error) {
      console.error('Error loading initial messages:', error);
      setError('Failed to load messages');
      setLoadingMessages(false);
      return false;
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Starting sign-in process...');
      
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
      
      // Real sign out with Gmail API
      await signOut();
      
      // Reset all state
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

  // Toggle auto-refresh functionality
  const toggleAutoRefresh = useCallback(() => {
    setIsAutoRefreshEnabled(prevState => !prevState);
  }, []);

  // Refresh messages function to fetch latest emails
  const refreshMessages = useCallback(async (): Promise<boolean> => {
    if (loadingMessages || !isAuthenticated) {
      console.log("Cannot refresh: loading in progress or not authenticated");
      return false;
    }

    try {
      setLoadingMessages(true);
      console.log("Refreshing messages...");
      
      // Fetch new messages
      await loadInitialMessages();
      
      // Update last refresh time
      setLastRefresh(new Date());
      
      return true;
    } catch (error) {
      console.error("Error refreshing messages:", error);
      setError("Failed to refresh messages");
      return false;
    } finally {
      setLoadingMessages(false);
    }
  }, [loadingMessages, isAuthenticated, loadInitialMessages]);

  // Set up auto-refresh interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isAutoRefreshEnabled && isAuthenticated) {
      console.log("Auto-refresh enabled, setting up interval");
      intervalId = setInterval(() => {
        console.log("Auto-refreshing messages");
        refreshMessages();
      }, 60000); // Refresh every minute
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoRefreshEnabled, isAuthenticated, refreshMessages]);

  const sendMessage = async (to: string, body: string): Promise<boolean> => {
    try {
      setLoadingMessages(true);
      
      if (!userProfile || !userProfile.email) {
        console.error('Cannot send message: user profile or email is missing');
        setError('Cannot send message: user profile is missing');
        return false;
      }
      
      console.log(`Attempting to send message to: ${to}`);
      
      // Get current date
      const currentDate = new Date().toISOString();
      const subject = "New message"; // Default subject
      
      // Create a temporary message to show immediately in the UI
      const tempMessageId = `temp-${Date.now()}`;
      
      // Safely encode body content
      let encodedBody;
      try {
        encodedBody = btoa(unescape(encodeURIComponent(body)));
      } catch (encodingError) {
        console.error('Error encoding message body:', encodingError);
        setError('Failed to encode message content');
        return false;
      }
      
      const tempMessage: EmailMessage = {
        id: tempMessageId,
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
            data: encodedBody,
          },
        },
        sizeEstimate: body.length,
        historyId: Date.now().toString(),
        internalDate: Date.now().toString(),
        isRealHuman: true // Mark as real human since it's from the user
      };
      
      // Update conversations state immediately to show the sent message
      const recipientEmail = to.toLowerCase();
      const updatedConversations = {...conversations};
      
      if (updatedConversations[recipientEmail]) {
        // Add to existing conversation
        updatedConversations[recipientEmail].messages = [
          ...updatedConversations[recipientEmail].messages, 
          tempMessage
        ];
        
        // Sort messages by date
        updatedConversations[recipientEmail].messages.sort(
          (a, b) => parseInt(a.internalDate) - parseInt(b.internalDate)
        );
        
        updatedConversations[recipientEmail].person.lastMessageDate = currentDate;
        updatedConversations[recipientEmail].person.lastMessageSnippet = tempMessage.snippet;
      } else {
        // Create new conversation
        updatedConversations[recipientEmail] = {
          person: {
            email: recipientEmail,
            name: recipientEmail.split('@')[0], // Use email username as name
            lastMessageDate: currentDate,
            lastMessageSnippet: tempMessage.snippet,
            unreadCount: 0,
          },
          messages: [tempMessage]
        };
      }
      
      // Update state immediately to show the message
      setConversations(updatedConversations);
      
      // Also add to messages
      setMessages(prev => [...prev, tempMessage]);
      
      // Send the actual email through the API
      console.log('Sending email via Gmail API...');
      const success = await sendEmail(to, subject, body, userProfile.email);
      
      if (success) {
        console.log('Email sent successfully');
        
        // After sending email, refresh to get the actual sent message
        setTimeout(() => {
          console.log('Refreshing messages to get the sent message from the API');
          refreshMessages();
        }, 2000); // Wait 2 seconds before refreshing
        
        // If this is to a new recipient, select them
        if (!conversations[recipientEmail]) {
          setCurrentPerson(recipientEmail);
        }
        
        return true;
      } else {
        console.error('Failed to send email via Gmail API');
        
        // If sending failed, remove the temporary message
        const filteredConversations = {...updatedConversations};
        if (filteredConversations[recipientEmail]) {
          filteredConversations[recipientEmail].messages = filteredConversations[recipientEmail].messages
            .filter(msg => msg.id !== tempMessageId);
            
          if (filteredConversations[recipientEmail].messages.length === 0) {
            delete filteredConversations[recipientEmail];
          } else {
            // Update the last message info
            const lastMsg = filteredConversations[recipientEmail].messages[filteredConversations[recipientEmail].messages.length - 1];
            const lastDateHeader = lastMsg.payload.headers.find(h => h.name.toLowerCase() === 'date');
            filteredConversations[recipientEmail].person.lastMessageDate = lastDateHeader?.value || '';
            filteredConversations[recipientEmail].person.lastMessageSnippet = lastMsg.snippet;
          }
        }
        
        setConversations(filteredConversations);
        setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
        
        setError('Failed to send message via Gmail API');
        return false;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    refreshMessages,
    isAutoRefreshEnabled,
    toggleAutoRefresh,
    lastRefresh,
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

  return (
    <GmailContext.Provider
      value={{
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
        refreshMessages,
        isAutoRefreshEnabled,
        toggleAutoRefresh,
        lastRefresh,
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
      }}
    >
      {children}
    </GmailContext.Provider>
  );
};

export const useGmail = (): GmailContextType => {
  const context = useContext(GmailContext);
  if (context === undefined) {
    throw new Error('useGmail must be used within a GmailProvider');
  }
  return context;
}; 