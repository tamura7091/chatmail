import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { EmailMessage, Person } from '../types';
import { useGmail } from '../context/GmailContext';
import { extractEmailContent } from '../utils/gmailAPI';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: EmailMessage;
  isFromUser: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isFromUser }) => {
  const { conversations } = useGmail();
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showRemindDropdown, setShowRemindDropdown] = useState(false);
  const [showFollowUpDropdown, setShowFollowUpDropdown] = useState(false);
  
  const assignRef = useRef<HTMLButtonElement>(null);
  const remindRef = useRef<HTMLButtonElement>(null);
  const followUpRef = useRef<HTMLButtonElement>(null);

  // Extract date from headers
  const dateHeader = message.payload.headers.find(
    (header) => header.name.toLowerCase() === 'date'
  );

  // Extract subject from headers
  const subjectHeader = message.payload.headers.find(
    (header) => header.name.toLowerCase() === 'subject'
  );
  
  // Extract sender name from From header
  const fromHeader = message.payload.headers.find(
    (header) => header.name.toLowerCase() === 'from'
  );
  
  const senderMatch = fromHeader?.value.match(/^([^<]+)/);
  const senderName = senderMatch ? senderMatch[1].trim() : '';
  
  const formattedDate = dateHeader
    ? format(new Date(dateHeader.value), 'h:mm a')
    : '';
  
  const { html, text } = extractEmailContent(message.payload);
  const contentToDisplay = html || text || message.snippet;
  
  // Use DOMPurify to sanitize HTML content
  const sanitizedContent = DOMPurify.sanitize(contentToDisplay);

  // Get list of people for assignment dropdown
  const assignableContacts = Object.values(conversations).map(conv => ({
    email: conv.person.email,
    name: conv.person.name || conv.person.email
  }));
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignRef.current && !assignRef.current.contains(event.target as Node)) {
        if (!document.getElementById('assign-dropdown')?.contains(event.target as Node)) {
          setShowAssignDropdown(false);
        }
      }
      
      if (remindRef.current && !remindRef.current.contains(event.target as Node)) {
        if (!document.getElementById('remind-dropdown')?.contains(event.target as Node)) {
          setShowRemindDropdown(false);
        }
      }
      
      if (followUpRef.current && !followUpRef.current.contains(event.target as Node)) {
        if (!document.getElementById('followup-dropdown')?.contains(event.target as Node)) {
          setShowFollowUpDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleAssignToPerson = (person: Person) => {
    // In a real app this would make an API call to assign the message
    console.log(`Assigned message ${message.id} to ${person.email}`);
    setShowAssignDropdown(false);
  };
  
  const handleRemindMe = (time: string) => {
    console.log(`Set reminder for message ${message.id} in ${time}`);
    setShowRemindDropdown(false);
  };
  
  const handleFollowUp = (time: string) => {
    console.log(`Set auto follow-up for message ${message.id} in ${time}`);
    setShowFollowUpDropdown(false);
  };
  
  return (
    <div
      className={`max-w-[75%] mb-4 ${
        isFromUser ? 'ml-auto' : 'mr-auto'
      }`}
    >
      {!isFromUser && (
        <div className="text-xs font-medium text-gray-600 ml-2 mb-1 flex items-center">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 mr-1 text-[10px]">
            {senderName.charAt(0).toUpperCase()}
          </div>
          <span>{senderName || 'Unknown'}</span>
        </div>
      )}
      
      <div
        className={`p-3.5 rounded-2xl shadow-sm backdrop-blur-sm ${
          isFromUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
            : 'bg-white text-gray-800 border border-gray-100'
        }`}
      >
        {subjectHeader && subjectHeader.value !== 'Re: ' && (
          <div className={`font-semibold mb-1 ${isFromUser ? 'text-blue-100' : 'text-gray-700'}`}>
            {subjectHeader.value}
          </div>
        )}
        
        {html ? (
          <div 
            className="message-content text-sm leading-relaxed" 
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{sanitizedContent}</div>
        )}
      </div>
      
      <div className="flex justify-between items-center mt-1.5 mx-2">
        <div className="text-xs text-gray-400">
          {formattedDate}
        </div>
        
        <div className="flex items-center space-x-1.5">
          {/* Show Assign button only for messages from others */}
          {!isFromUser && (
            <div className="relative">
              <button 
                ref={assignRef}
                onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-150 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Assign
              </button>
              
              {showAssignDropdown && (
                <div 
                  id="assign-dropdown"
                  className="absolute right-0 mt-1 z-10 bg-white rounded-md shadow-lg border border-gray-200 py-1 w-48"
                >
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 border-b">
                    Assign to:
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {/* Get assignable people from conversations */}
                    {Object.values(conversations).map(conv => (
                      <button
                        key={conv.person.email}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => handleAssignToPerson(conv.person)}
                      >
                        {conv.person.name || conv.person.email}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Show Remind button for all messages */}
          <div className="relative">
            <button 
              ref={remindRef}
              onClick={() => setShowRemindDropdown(!showRemindDropdown)}
              className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-150 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Remind
            </button>
            
            {showRemindDropdown && (
              <div 
                id="remind-dropdown"
                className="absolute right-0 bottom-full mb-1 z-10 bg-white rounded-md shadow-lg border border-gray-200 py-1 w-48"
              >
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 border-b">
                  Remind me in:
                </div>
                <button
                  className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  onClick={() => handleRemindMe('1 hour')}
                >
                  1 hour
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  onClick={() => handleRemindMe('3 hours')}
                >
                  3 hours
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  onClick={() => handleRemindMe('Tomorrow')}
                >
                  Tomorrow
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  onClick={() => handleRemindMe('Next week')}
                >
                  Next week
                </button>
              </div>
            )}
          </div>
          
          {/* Show Auto follow up only for user's messages */}
          {isFromUser && (
            <div className="relative">
              <button 
                ref={followUpRef}
                onClick={() => setShowFollowUpDropdown(!showFollowUpDropdown)}
                className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-150 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Follow Up
              </button>
              
              {showFollowUpDropdown && (
                <div 
                  id="followup-dropdown"
                  className="absolute right-0 bottom-full mb-1 z-10 bg-white rounded-md shadow-lg border border-gray-200 py-1 w-48"
                >
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 border-b">
                    Auto follow-up if no reply:
                  </div>
                  <button
                    className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    onClick={() => handleFollowUp('Tomorrow')}
                  >
                    Tomorrow
                  </button>
                  <button
                    className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    onClick={() => handleFollowUp('3 days')}
                  >
                    3 days
                  </button>
                  <button
                    className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    onClick={() => handleFollowUp('1 week')}
                  >
                    1 week
                  </button>
                  <button
                    className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    onClick={() => handleFollowUp('Custom message...')}
                  >
                    Custom message...
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble; 