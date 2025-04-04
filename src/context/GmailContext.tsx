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

        if (useMockData) {
          // Use mock data
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
          await loadGmailApi();
          
          if (isUserSignedIn()) {
            setIsAuthenticated(true);
            const profile = await getUserProfile();
            setUserProfile(profile);
            await loadInitialMessages();
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error initializing Gmail API:', err);
        setError('Failed to initialize Gmail API');
        setIsLoading(false);
      }
    };

    initialize();
  }, [useMockData]);

  const loadInitialMessages = async () => {
    try {
      setLoadingMessages(true);
      const { messages: newMessages, nextPageToken: token } = await fetchMessages();
      setMessages(newMessages);
      setNextPageToken(token);
      
      if (userProfile && userProfile.email) {
        const groupedConversations = groupMessagesByPerson(newMessages, userProfile.email);
        // Add action suggestions
        const conversationsWithActions = generateActionSuggestions(groupedConversations);
        setConversations(conversationsWithActions);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      
      if (useMockData) {
        // Use mock data for sign in
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
        // Use real API for sign in
        await signIn();
        setIsAuthenticated(true);
        
        const profile = await getUserProfile();
        setUserProfile(profile);
        
        await loadInitialMessages();
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error signing in:', err);
      setError('Failed to sign in');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (!useMockData) {
        await signOut();
      }
      
      setIsAuthenticated(false);
      setUserProfile(null);
      setMessages([]);
      setConversations({});
      setNextPageToken(undefined);
      setCurrentPerson(null);
      setSelectedView('conversation');
      setSelectedId(null);
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out');
    }
  };

  const loadMoreMessages = async () => {
    if (useMockData || !nextPageToken || loadingMessages) return;
    
    try {
      setLoadingMessages(true);
      const { messages: newMessages, nextPageToken: token } = await fetchMessages(nextPageToken);
      
      // Combine with existing messages
      const updatedMessages = [...messages, ...newMessages];
      setMessages(updatedMessages);
      setNextPageToken(token);
      
      if (userProfile && userProfile.email) {
        const groupedConversations = groupMessagesByPerson(updatedMessages, userProfile.email);
        // Add action suggestions
        const conversationsWithActions = generateActionSuggestions(groupedConversations);
        setConversations(conversationsWithActions);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
      setError('Failed to load more messages');
    } finally {
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
      if (!userProfile) return false;
      
      // Create a subject line based on the first few words of the message
      const subject = body.split(' ').slice(0, 5).join(' ') + '...';
      
      // Call the sendEmail function
      const { message, success } = await sendEmail(
        to, 
        subject, 
        body, 
        userProfile.email
      );
      
      if (success && message) {
        // Add the message to our state
        setMessages(prev => [...prev, message]);
        
        // Add to the conversation
        setConversations(prev => {
          // Check if a conversation with this person already exists
          const lowerCaseEmail = to.toLowerCase();
          if (prev[lowerCaseEmail]) {
            // Update existing conversation
            return {
              ...prev,
              [lowerCaseEmail]: {
                ...prev[lowerCaseEmail],
                messages: [...prev[lowerCaseEmail].messages, message],
                person: {
                  ...prev[lowerCaseEmail].person,
                  lastMessageDate: new Date().toString(),
                  lastMessageSnippet: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
                  action: "Waiting for reply" // Set action after sending
                }
              }
            };
          } else {
            // Create a new conversation
            const newPerson: Person = {
              email: to,
              lastMessageDate: new Date().toString(),
              lastMessageSnippet: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
              unreadCount: 0,
              action: "Waiting for reply" // Set action for new conversation
            };
            
            return {
              ...prev,
              [lowerCaseEmail]: {
                person: newPerson,
                messages: [message]
              }
            };
          }
        });
        
        setIsCreatingNewConversation(false);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return false;
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