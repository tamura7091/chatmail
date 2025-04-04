import React, { useRef, useEffect, useState, useMemo } from 'react';
import { EmailMessage, Person, Group, SpecialFolder } from '../types';
import MessageBubble from './MessageBubble';
import { useGmail } from '../context/GmailContext';
import { isPromotionalEmail } from '../utils/gmailAPI';
import { generateMessageSuggestion } from '../utils/openaiHelper';

interface ChatViewProps {
  messages: EmailMessage[];
  currentPerson: Person | null;
  userEmail: string;
  selectedView: 'conversation' | 'special_folder' | 'group';
  selectedId: string | null;
  specialFolders: Record<string, SpecialFolder>;
  groups: Record<string, Group>;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  messages, 
  currentPerson, 
  userEmail,
  selectedView,
  selectedId,
  specialFolders,
  groups
}) => {
  const { 
    updatePersonStatus, 
    sendMessage, 
    updateContact, 
    getContactByEmail,
    userProfile
  } = useGmail();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [customStatus, setCustomStatus] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showTemplatesPopup, setShowTemplatesPopup] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [aiSuggestion, setAISuggestion] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'attachments'>('chat');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<Array<{
    name: string;
    type: string;
    url: string;
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateButtonRef = useRef<HTMLButtonElement>(null);
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);
  const aiHelperRef = useRef<HTMLDivElement>(null);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create a local copy of messages that can be modified
  const [displayMessages, setDisplayMessages] = useState<EmailMessage[]>([]);
  
  // Use useEffect to update displayMessages when props.messages changes
  useEffect(() => {
    setDisplayMessages(messages);
  }, [messages]);
  
  // Add state for editable templates
  const [messageTemplates, setMessageTemplates] = useState<Array<{id: string, name: string, content: string}>>([
    { id: '1', name: "Follow-up", content: "Hi, I wanted to follow up on our previous conversation. Any updates on this?" },
    { id: '2', name: "Thank You", content: "Thank you for your message. I appreciate your time and will get back to you shortly." },
    { id: '3', name: "Meeting Request", content: "I'd like to schedule a meeting to discuss this further. Are you available sometime this week?" },
    { id: '4', name: "Payment Reminder", content: "Just a friendly reminder that payment for invoice #XXXX is due on DATE. Please let me know if you have any questions." }
  ]);
  
  // Template editing states
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  
  // Predefined statuses for influencer marketing
  const predefinedStatuses = [
    'Draft Submitted',
    'Payout Done',
    'In Review',
    'Approved',
    'Rejected',
    'Pending Revisions'
  ];

  // Load templates from localStorage on first render
  useEffect(() => {
    const savedTemplates = localStorage.getItem('messageTemplates');
    if (savedTemplates) {
      setMessageTemplates(JSON.parse(savedTemplates));
    }
  }, []);

  // Save templates to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('messageTemplates', JSON.stringify(messageTemplates));
  }, [messageTemplates]);

  // Load notes for the current person
  useEffect(() => {
    if (currentPerson) {
      // Try to find contact by email
      const contact = getContactByEmail(currentPerson.email);
      // Set notes from the contact or person
      setNotes(contact?.notes || currentPerson.notes || '');
    } else {
      setNotes('');
    }
  }, [currentPerson, getContactByEmail]);

  // Save notes with debounce
  useEffect(() => {
    // Clear any existing timeout
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }
    
    // Set a new timeout to save notes after 500ms of inactivity
    if (currentPerson) {
      notesTimeoutRef.current = setTimeout(() => {
        const contact = getContactByEmail(currentPerson.email);
        
        if (contact) {
          // Update the contact with the new notes
          updateContact(contact.id, { notes });
        } else if (currentPerson.contactId) {
          // Update existing contact
          updateContact(currentPerson.contactId, { notes });
        }
      }, 500);
    }

    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, [notes, currentPerson, updateContact, getContactByEmail]);

  // Scroll to bottom of messages when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateButtonRef.current && !templateButtonRef.current.contains(event.target as Node)) {
        if (!document.getElementById('templates-popup')?.contains(event.target as Node)) {
          setShowTemplatesPopup(false);
        }
      }
      
      if (aiButtonRef.current && !aiButtonRef.current.contains(event.target as Node)) {
        if (!document.getElementById('ai-popup')?.contains(event.target as Node)) {
          setShowAIHelper(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Extract URLs and attachments from messages
  useEffect(() => {
    const extractedAttachments: Array<{name: string, url: string, type: string}> = [];
    
    messages.forEach(message => {
      // Extract URLs from message content
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const messageBody = message.snippet || '';
      const urls = messageBody.match(urlRegex) || [];
      
      urls.forEach(url => {
        extractedAttachments.push({
          name: url,
          url: url,
          type: 'link'
        });
      });
      
      // Extract file attachments if they exist
      if (message.payload.parts) {
        message.payload.parts.forEach(part => {
          if (part.filename && part.filename.trim() !== '') {
            extractedAttachments.push({
              name: part.filename,
              url: `#attachment-${message.id}-${part.partId}`, // Placeholder URL
              type: part.mimeType || 'unknown'
            });
          }
        });
      }
    });
    
    setAttachments(extractedAttachments);
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;
    
    try {
      setSendingMessage(true);
      
      let recipient = '';
      if (selectedView === 'conversation' && currentPerson) {
        recipient = currentPerson.email;
      } else if (selectedView === 'group' && selectedId) {
        const group = groups[selectedId];
        if (group) {
          // In a real app, we'd handle group emails better
          // For now, just join all member emails with commas
          recipient = group.members
            .filter(member => member.email !== userEmail)
            .map(member => member.email)
            .join(',');
        }
      }
      
      if (!recipient) {
        console.error('No recipient found');
        setSendingMessage(false);
        return;
      }
      
      console.log('Sending message to:', recipient);
      
      // Create a temporary message to display immediately
      if (userProfile) {
        const tempMessage: EmailMessage = {
          id: `temp_${Date.now()}`,
          threadId: `temp_thread_${Date.now()}`,
          labelIds: ['SENT'],
          snippet: newMessage.substring(0, 100) + (newMessage.length > 100 ? '...' : ''),
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: `${userProfile.name} <${userProfile.email}>` },
              { name: 'To', value: recipient },
              { name: 'Subject', value: 'Re: ' + (currentPerson?.name || '') },
              { name: 'Date', value: new Date().toISOString() },
            ],
            body: {
              size: newMessage.length,
              data: btoa(unescape(encodeURIComponent(newMessage))),
            },
          },
          sizeEstimate: newMessage.length,
          historyId: Date.now().toString(),
          internalDate: Date.now().toString(),
        };
        
        // Add the temporary message to the UI
        setDisplayMessages(prev => [...prev, tempMessage]);
      }
      
      const success = await sendMessage(recipient, newMessage);
      
      if (success) {
        console.log('Message sent successfully');
        setNewMessage('');
      } else {
        // Show an error message
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSetStatus = (status: string) => {
    if (currentPerson && selectedView === 'conversation') {
      updatePersonStatus(currentPerson.email, status);
      setShowStatusDropdown(false);
    }
  };

  const handleCustomStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStatus.trim()) return;
    
    if (currentPerson && selectedView === 'conversation') {
      updatePersonStatus(currentPerson.email, customStatus);
      setCustomStatus('');
      setShowStatusDropdown(false);
    }
  };

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // In a real app, you would handle file uploads here
      console.log('Selected files:', files);
    }
  };

  const handleTemplateSelect = (templateContent: string) => {
    setNewMessage(templateContent);
    setShowTemplatesPopup(false);
  };

  const handleEditTemplate = (template: {id: string, name: string, content: string}) => {
    setEditTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateContent(template.content);
    setIsEditingTemplate(true);
    setIsAddingTemplate(false);
  };

  const handleDeleteTemplate = (id: string) => {
    setMessageTemplates(prev => prev.filter(template => template.id !== id));
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !templateContent.trim()) return;

    if (isAddingTemplate) {
      // Add new template
      const newTemplate = {
        id: Date.now().toString(),
        name: templateName,
        content: templateContent
      };
      setMessageTemplates(prev => [...prev, newTemplate]);
    } else if (editTemplateId) {
      // Update existing template
      setMessageTemplates(prev => 
        prev.map(template => 
          template.id === editTemplateId 
            ? { ...template, name: templateName, content: templateContent }
            : template
        )
      );
    }

    // Reset form
    setIsEditingTemplate(false);
    setIsAddingTemplate(false);
    setEditTemplateId(null);
    setTemplateName('');
    setTemplateContent('');
  };

  const handleAddNewTemplate = () => {
    setIsAddingTemplate(true);
    setIsEditingTemplate(true);
    setEditTemplateId(null);
    setTemplateName('');
    setTemplateContent('');
  };

  const handleCancelTemplateEdit = () => {
    setIsEditingTemplate(false);
    setIsAddingTemplate(false);
    setEditTemplateId(null);
    setTemplateName('');
    setTemplateContent('');
  };

  const generateAISuggestion = async (promptType?: string) => {
    console.log('Generating AI suggestion...');
    setShowAIHelper(true);
    setAISuggestion("Generating suggestion...");
    
    try {
      // Determine prompt type for context
      let prompt = '';
      if (promptType === 'followup') {
        prompt = 'follows up on the previous message in a friendly, professional way';
      } else if (promptType === 'thankYou') {
        prompt = 'expresses gratitude and appreciation';
      } else if (promptType === 'schedule') {
        prompt = 'proposes a meeting or call';
      } else if (promptType === 'clarify') {
        prompt = 'asks for clarification on something from the previous message';
      } else {
        // Default - analyze the conversation and respond appropriately
        prompt = 'responds appropriately to the conversation context';
      }
      
      const suggestionText = await generateMessageSuggestion(sortedMessages, prompt);
      setAISuggestion(suggestionText);
    } catch (error) {
      console.error('Error generating AI suggestion:', error);
      setAISuggestion("I'd be happy to help with your request. Please let me know if you need anything else.");
    }
  };

  const applyAISuggestion = () => {
    setNewMessage(aiSuggestion);
    setShowAIHelper(false);
  };

  // Filter messages based on view type
  const filteredMessages = useMemo(() => {
    if (selectedView === 'conversation' && currentPerson) {
      // Normal conversation view - no need to filter
      return displayMessages;
    } else if (selectedView === 'special_folder' && selectedId) {
      // Special folder view - filter based on folder type
      if (selectedId === 'others') {
        // Show promotional emails in the Others folder
        return displayMessages.filter(message => isPromotionalEmail(message));
      } else if (selectedId === 'reply_needed') {
        // TODO: Implement logic for reply needed messages
        return displayMessages.filter(message => {
          // Simple logic - messages containing a question mark might need a reply
          return message.snippet.includes('?');
        });
      }
    } else if (selectedView === 'group' && selectedId && groups[selectedId]) {
      // Group view - show messages to/from group members
      const group = groups[selectedId];
      const memberEmails = group.members.map(m => m.email.toLowerCase());
      
      return displayMessages.filter(message => {
        const fromHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'from');
        const toHeader = message.payload.headers.find(h => h.name.toLowerCase() === 'to');
        
        if (!fromHeader || !toHeader) return false;
        
        // Check if message is from or to any group member
        const fromValue = fromHeader.value.toLowerCase();
        const toValue = toHeader.value.toLowerCase();
        
        return memberEmails.some(email => fromValue.includes(email) || toValue.includes(email));
      });
    }
    
    // Default - return all messages
    return displayMessages;
  }, [selectedView, selectedId, currentPerson, displayMessages, groups]);
  
  // Sort messages by date
  const sortedMessages = [...filteredMessages].sort((a, b) => {
    return parseInt(a.internalDate) - parseInt(b.internalDate);
  });

  // Special header for the Others folder
  const renderHeader = () => {
    if (selectedView === 'special_folder' && selectedId === 'others') {
      return (
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10 shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-lg font-medium mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="font-medium text-gray-900">Others Folder</h2>
              <p className="text-sm text-gray-500">Promotional emails, newsletters, and marketing</p>
            </div>
          </div>
        </div>
      );
    } else if (selectedView === 'special_folder' && selectedId === 'reply_needed') {
      return (
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10 shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-lg font-medium mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <div>
              <h2 className="font-medium text-gray-900">Reply Needed</h2>
              <p className="text-sm text-gray-500">Messages that require your response</p>
            </div>
          </div>
        </div>
      );
    } else if (selectedView === 'group' && selectedId && groups[selectedId]) {
      const group = groups[selectedId];
      return (
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10 shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-lg font-medium mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-medium text-gray-900">{group.name}</h2>
              <p className="text-sm text-gray-500">{group.members.length} members</p>
            </div>
          </div>
        </div>
      );
    } else if (currentPerson) {
      return (
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10 shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-lg font-medium mr-3">
              {currentPerson.name ? currentPerson.name.charAt(0).toUpperCase() : currentPerson.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-medium text-gray-900">{currentPerson.name || currentPerson.email}</h2>
            </div>
          </div>
          
          <div className="relative">
            {currentPerson.status ? (
              <div 
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 cursor-pointer hover:bg-green-200 transition-colors duration-150"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                {currentPerson.status}
              </div>
            ) : (
              <button
                className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-50 transition-colors duration-150 flex items-center"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Set Status
              </button>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Add back the tabs UI
  const renderTabs = () => {
    return (
      <div className="mt-4 border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'chat'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'notes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => setActiveTab('attachments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'attachments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Attachments
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {renderHeader()}
      
      {selectedView === 'conversation' && currentPerson && renderTabs()}
      
      {activeTab === 'chat' && (
        <>
          {/* Messages area with improved message detection */}
          <div className="flex-1 overflow-y-auto p-4 pb-2">
            {sortedMessages.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">
                <p>No messages found</p>
                {selectedView === 'conversation' && (
                  <p className="text-sm mt-2">Send a message to start the conversation</p>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2 pb-1">
                {sortedMessages.map((message) => {
                  // Determine if message is from user
                  const fromHeader = message.payload.headers.find(
                    (header) => header.name.toLowerCase() === 'from'
                  );
                  
                  const fromValue = fromHeader?.value || '';
                  // Check if user email appears anywhere in the From header
                  const isFromUser = !!userEmail && fromValue.toLowerCase().includes(userEmail.toLowerCase());
                  
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isFromUser={isFromUser}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* Only show message input for conversations, not folders */}
          {selectedView === 'conversation' && currentPerson && (
            <div className="p-3 border-t bg-gray-50">
              <form onSubmit={handleSendMessage} className="flex flex-col">
                <div className="relative flex items-center mb-2 -ml-1">
                  <button
                    type="button"
                    className="p-2 text-gray-500 hover:text-blue-500 focus:outline-none rounded-full hover:bg-gray-100 transition-colors duration-150"
                    onClick={handleFileSelect}
                    title="Attach files"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                  />
                  
                  <div className="relative">
                    <button
                      type="button"
                      ref={templateButtonRef}
                      className="p-2 text-gray-500 hover:text-blue-500 focus:outline-none rounded-full hover:bg-gray-100 transition-colors duration-150"
                      onClick={() => setShowTemplatesPopup(!showTemplatesPopup)}
                      title="Message templates"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    
                    {/* Templates popup */}
                    {showTemplatesPopup && (
                      <div 
                        id="templates-popup"
                        className="absolute bottom-full mb-2 left-0 p-2 bg-white border rounded-lg shadow-lg w-64 z-10"
                        ref={templatesRef}
                      >
                        <div className="flex justify-between items-center mb-2 pb-1 border-b">
                          <div className="text-xs font-semibold text-gray-700">
                            Message Templates
                          </div>
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-800"
                            onClick={handleAddNewTemplate}
                          >
                            Add New
                          </button>
                        </div>

                        {isEditingTemplate ? (
                          <div className="p-2">
                            <input
                              type="text"
                              className="w-full p-2 mb-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Template name"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                            />
                            <textarea
                              className="w-full p-2 mb-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                              placeholder="Template content"
                              value={templateContent}
                              onChange={(e) => setTemplateContent(e.target.value)}
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                type="button"
                                className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                                onClick={handleCancelTemplateEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="text-xs text-white bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded"
                                onClick={handleSaveTemplate}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {messageTemplates.length === 0 ? (
                              <div className="text-sm text-gray-500 text-center py-2">
                                No templates available
                              </div>
                            ) : (
                              messageTemplates.map((template) => (
                                <div 
                                  key={template.id}
                                  className="relative group px-3 py-2 hover:bg-gray-50 rounded-md"
                                >
                                  <div className="flex justify-between items-center">
                                    <button
                                      type="button"
                                      className="w-full text-left text-sm text-gray-700"
                                      onClick={() => handleTemplateSelect(template.content)}
                                    >
                                      {template.name}
                                    </button>
                                    <div className="hidden group-hover:flex space-x-1">
                                      <button
                                        type="button"
                                        className="text-gray-400 hover:text-blue-600"
                                        onClick={() => handleEditTemplate(template)}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        className="text-gray-400 hover:text-red-600"
                                        onClick={() => handleDeleteTemplate(template.id)}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <button
                      type="button"
                      ref={aiButtonRef}
                      className="p-2 text-gray-500 hover:text-blue-500 focus:outline-none rounded-full hover:bg-gray-100 transition-colors duration-150"
                      onClick={() => generateAISuggestion()}
                      title="AI suggestions"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </button>
                    
                    {/* AI helper popup */}
                    {showAIHelper && (
                      <div 
                        id="ai-popup"
                        className="absolute bottom-full mb-2 right-0 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-lg w-80 z-10"
                      >
                        <div className="flex items-center text-xs font-semibold text-blue-600 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          AI Suggestion
                        </div>
                        
                        <p className="text-sm text-gray-700 mb-2">{aiSuggestion}</p>
                        
                        <div className="mb-2 flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                            onClick={() => generateAISuggestion('followup')}
                          >
                            Follow-up
                          </button>
                          <button
                            type="button"
                            className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                            onClick={() => generateAISuggestion('thankYou')}
                          >
                            Thank you
                          </button>
                          <button
                            type="button"
                            className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                            onClick={() => generateAISuggestion('schedule')}
                          >
                            Schedule
                          </button>
                          <button
                            type="button"
                            className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                            onClick={() => generateAISuggestion('clarify')}
                          >
                            Clarify
                          </button>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                            onClick={() => generateAISuggestion()}
                          >
                            Regenerate
                          </button>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                              onClick={() => setShowAIHelper(false)}
                            >
                              Dismiss
                            </button>
                            <button
                              type="button"
                              className="text-xs text-white bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded transition-colors duration-150"
                              onClick={applyAISuggestion}
                            >
                              Use
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="flex-1 relative">
                    <textarea
                      className="w-full p-3 pl-4 pr-12 rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[80px] resize-none shadow-sm"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sendingMessage}
                    />
                  </div>
                  <button
                    type="submit"
                    className="ml-2 p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!newMessage.trim() || sendingMessage}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
      
      {/* Notes tab */}
      {activeTab === 'notes' && selectedView === 'conversation' && currentPerson && (
        <div className="flex-1 p-4 flex flex-col">
          <p className="text-sm text-gray-600 mb-2">Add notes about this conversation (only visible to you)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes here..."
            className="flex-1 p-4 border border-gray-200 rounded-lg bg-white text-gray-800 resize-none transition-shadow duration-200 ease-in-out placeholder-gray-400 shadow-sm hover:shadow-md focus:outline-none focus:shadow-md focus:border-gray-300"
          />
        </div>
      )}
      
      {/* Attachments tab */}
      {activeTab === 'attachments' && selectedView === 'conversation' && currentPerson && (
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-md font-medium mb-4">Files & Links</h3>
          {attachments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No attachments or links found in this conversation</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((attachment, index) => (
                <li key={index} className="border border-gray-200 rounded-md p-3 flex items-center">
                  <div className="bg-gray-100 rounded-md p-2 mr-3">
                    {attachment.type === 'link' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.1 1.1" />
                      </svg>
                    ) : attachment.type.includes('image') ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="truncate flex-1">
                    <a 
                      href={attachment.url}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate block"
                    >
                      {attachment.name}
                    </a>
                    <span className="text-xs text-gray-500">{attachment.type}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatView; 