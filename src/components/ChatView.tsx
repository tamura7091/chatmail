import React, { useRef, useEffect, useState } from 'react';
import { EmailMessage, Person, Group, SpecialFolder } from '../types';
import MessageBubble from './MessageBubble';
import { useGmail } from '../context/GmailContext';

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
  const { updatePersonStatus, sendMessage } = useGmail();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [customStatus, setCustomStatus] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showTemplatesPopup, setShowTemplatesPopup] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateButtonRef = useRef<HTMLButtonElement>(null);
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);
  const aiHelperRef = useRef<HTMLDivElement>(null);
  
  // Predefined message templates
  const messageTemplates = [
    { name: "Follow-up", content: "Hi, I wanted to follow up on our previous conversation. Any updates on this?" },
    { name: "Thank You", content: "Thank you for your message. I appreciate your time and will get back to you shortly." },
    { name: "Meeting Request", content: "I'd like to schedule a meeting to discuss this further. Are you available sometime this week?" },
    { name: "Payment Reminder", content: "Just a friendly reminder that payment for invoice #XXXX is due on DATE. Please let me know if you have any questions." }
  ];
  
  // Predefined statuses for influencer marketing
  const predefinedStatuses = [
    'Draft Submitted',
    'Payout Done',
    'In Review',
    'Approved',
    'Rejected',
    'Pending Revisions'
  ];

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
      
      const success = await sendMessage(recipient, newMessage);
      
      if (success) {
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

  const generateAISuggestion = () => {
    // In a real app, this would call an AI service
    // For now, just simulate with a simple response
    const suggestions = [
      "Based on the conversation, I suggest following up on the deadline mentioned earlier.",
      "You might want to clarify the details about the meeting time.",
      "Consider asking for more information about the project requirements.",
      "A friendly reminder about the pending decision might be appropriate."
    ];
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    return randomSuggestion;
  };

  const applyAISuggestion = () => {
    setNewMessage(aiSuggestion);
    setShowAIHelper(false);
  };

  // Render special folder view
  if (selectedView === 'special_folder' && selectedId) {
    const folder = specialFolders[selectedId];
    if (!folder) return null;
    
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-white z-10">
          <div className="font-medium text-lg text-gray-800">
            {folder.name}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center text-gray-500 mt-10">
            {folder.type === 'others' ? (
              <div>
                <p className="mb-2">This folder contains all promotional emails, newsletters, and other non-personal messages.</p>
                <p>These are filtered to keep your main conversations clean and focused.</p>
              </div>
            ) : (
              <div>
                <p className="mb-2">This folder shows conversations that need your response.</p>
                <p>Emails are automatically added here when they haven't been replied to within 24 hours.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render group view
  if (selectedView === 'group' && selectedId) {
    const group = groups[selectedId];
    if (!group) return null;
    
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-white z-10">
          <div className="font-medium text-lg text-gray-800">
            {group.name}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {group.members.length} members
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <h3 className="font-medium text-gray-700 mb-2">Group Members:</h3>
            <ul className="space-y-1">
              {group.members.map((member) => (
                <li key={member.email} className="text-sm text-gray-600">
                  {member.name || member.email}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="text-center text-gray-500 mt-6">
            <p className="mb-2">All group conversations will be visible here.</p>
            <p>Everyone in this group will see all emails, even when they're not directly CC'd.</p>
          </div>
        </div>
        
        {/* Message input area with improved styling */}
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
                  >
                    <div className="text-xs font-semibold text-gray-700 mb-2 pb-1 border-b">
                      Message Templates
                    </div>
                    {messageTemplates.map((template, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                        onClick={() => handleTemplateSelect(template.content)}
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="relative">
                <button
                  type="button"
                  ref={aiButtonRef}
                  className="p-2 text-gray-500 hover:text-blue-500 focus:outline-none rounded-full hover:bg-gray-100 transition-colors duration-150"
                  onClick={generateAISuggestion}
                  title="AI suggestions"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </button>
                
                {/* AI helper popup */}
                {showAIHelper && aiSuggestion && (
                  <div 
                    id="ai-popup"
                    className="absolute bottom-full mb-2 right-0 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-lg w-64 z-10"
                  >
                    <div className="text-xs font-semibold text-blue-600 mb-1">AI Suggestion:</div>
                    <p className="text-sm text-gray-700 mb-2">{aiSuggestion}</p>
                    <div className="flex justify-end space-x-2">
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
      </div>
    );
  }

  // Default view for a conversation with a person
  if (!currentPerson) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Select a conversation</h2>
          <p className="text-gray-500">
            Choose a person from the left to see your conversation
          </p>
        </div>
      </div>
    );
  }

  // Sort messages by date
  const sortedMessages = [...messages].sort((a, b) => {
    return parseInt(a.internalDate) - parseInt(b.internalDate);
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium mr-3 shadow-sm">
              {currentPerson.name 
                ? currentPerson.name.charAt(0).toUpperCase() 
                : currentPerson.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-base text-gray-800">
                {currentPerson.name || currentPerson.email}
              </div>
              <div className="text-xs text-gray-500 flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                {currentPerson.email}
              </div>
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
            
            {showStatusDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white z-20 shadow-lg overflow-hidden">
                <div className="p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Set Status</h4>
                  
                  <div className="space-y-1">
                    {predefinedStatuses.map((status) => (
                      <button
                        key={status}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150"
                        onClick={() => handleSetStatus(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  
                  <div className="border-t mt-2 pt-2">
                    <form onSubmit={handleCustomStatusSubmit} className="flex mt-1">
                      <input
                        type="text"
                        className="flex-1 text-sm p-1.5 border rounded-l focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Custom status..."
                        value={customStatus}
                        onChange={(e) => setCustomStatus(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="bg-blue-500 text-white text-sm px-3 rounded-r hover:bg-blue-600 focus:outline-none transition-colors duration-150"
                      >
                        Set
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Messages area with improved styles */}
      <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50">
        {sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50 py-10">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center max-w-sm">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
              <p className="text-gray-500 mb-4">
                Send a message to start the conversation
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2 pb-1">
            {sortedMessages.map((message) => {
              // Determine if message is from user
              const fromHeader = message.payload.headers.find(
                (header) => header.name.toLowerCase() === 'from'
              );
              
              const fromEmail = fromHeader?.value.match(/<(.+)>/) || fromHeader?.value;
              const isFromUser = fromEmail && fromEmail.includes(userEmail);
              
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isFromUser={!!isFromUser}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Message input area with improved styling */}
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
                >
                  <div className="text-xs font-semibold text-gray-700 mb-2 pb-1 border-b">
                    Message Templates
                  </div>
                  {messageTemplates.map((template, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                      onClick={() => handleTemplateSelect(template.content)}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="relative">
              <button
                type="button"
                ref={aiButtonRef}
                className="p-2 text-gray-500 hover:text-blue-500 focus:outline-none rounded-full hover:bg-gray-100 transition-colors duration-150"
                onClick={generateAISuggestion}
                title="AI suggestions"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </button>
              
              {/* AI helper popup */}
              {showAIHelper && aiSuggestion && (
                <div 
                  id="ai-popup"
                  className="absolute bottom-full mb-2 right-0 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-lg w-64 z-10"
                >
                  <div className="text-xs font-semibold text-blue-600 mb-1">AI Suggestion:</div>
                  <p className="text-sm text-gray-700 mb-2">{aiSuggestion}</p>
                  <div className="flex justify-end space-x-2">
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
    </div>
  );
};

export default ChatView; 